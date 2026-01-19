/**
 * Pantalla de escaneo de QR
 *
 * Funcionalidad principal de la aplicación. Escanea códigos QR de participantes
 * y valida su acceso según el modo seleccionado (Registro, Aula Magna, Master Class, Cena).
 *
 * Formatos de QR aceptados (en orden de prioridad):
 * 1. Nombre/DNI/Correo: Juan Pérez/12345678A/email@example.com (formato con 3 partes)
 * 2. EventId/DNI: abc123/12345678A (formato emails con QR - 2 partes)
 * 3. JSON: {"dni":"12345678A","nombre":"Juan Pérez"}
 * 4. DNI simple: 12345678A
 * 5. DNI + email: 12345678A+email@example.com
 *
 * Flujo:
 * 1. Solicita permisos de cámara
 * 2. Escanea código QR
 * 3. Detecta formato y extrae eventId/DNI
 * 4. Valida que el eventId coincida con el evento activo
 * 5. Busca el participante en Firestore
 * 6. Aplica validaciones según el modo (permisos, estado actual, etc.)
 * 7. Actualiza estado del participante si la validación es exitosa
 * 8. Registra el intento en los logs de acceso
 * 9. Muestra resultado visual al operador (modal de éxito/error)
 */

import React, { useState, useEffect, useRef } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Modal, Platform, Pressable } from 'react-native';
import { CameraView, Camera } from 'expo-camera';
import { useRouter } from 'expo-router';
import { ThemedView } from '@/components/themed/themed-view';
import { ThemedText } from '@/components/themed/themed-text';
import { useApp } from '@/contexts/AppContext';
import { validateAccess } from '@/utils/validations';
import {
  getParticipantByDNI,
  updateParticipantStatus,
  logAccess,
} from '@/services/participantService';
import { QRData, Participant } from '@/types/participant';
import { Colors, BorderRadius, Spacing } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { LoginButton } from '@/components/forms/LoginButton';
import { useAuth } from '@/contexts/AuthContext';
import { useEvent } from '@/contexts/EventContext';

export default function ScannerScreen() {
  const router = useRouter();
  const colorScheme = useColorScheme();

  // Obtener modo, dirección y operador desde el contexto global
  const { modo, direccion, operador } = useApp();

  // Obtener usuario autenticado para mensajes de error personalizados
  const { user } = useAuth();

  // Obtener evento activo
  const { currentEvent } = useEvent();

  // Estados de permisos de cámara
  const [hasPermission, setHasPermission] = useState<boolean | null>(null);

  // Control de escaneo: previene escaneos múltiples simultáneos
  const [scanned, setScanned] = useState(false);
  const [processing, setProcessing] = useState(false);

  // Referencia a la cámara
  const cameraRef = useRef<CameraView>(null);

  // Estado para mostrar indicador de enfoque al tocar
  const [focusPoint, setFocusPoint] = useState<{ x: number; y: number; visible: boolean }>({
    x: 0,
    y: 0,
    visible: false,
  });

  // Estado del modal de resultado (éxito/error)
  const [resultModal, setResultModal] = useState<{
    visible: boolean;
    success: boolean;
    message: string;
    participant?: Participant;
  }>({
    visible: false,
    success: false,
    message: '',
  });

  /**
   * Solicitar permisos de cámara al montar el componente
   * Necesario para acceder a la cámara del dispositivo
   */
  useEffect(() => {
    (async () => {
      const { status } = await Camera.requestCameraPermissionsAsync();
      setHasPermission(status === 'granted');
    })();
  }, []);

  /**
   * Maneja el tap para enfocar en web
   * En dispositivos nativos el autofocus funciona bien, pero en web
   * necesitamos dar feedback visual y intentar re-enfocar
   */
  const handleTapToFocus = async (event: { nativeEvent: { locationX: number; locationY: number } }) => {
    const { locationX, locationY } = event.nativeEvent;

    // Mostrar indicador visual de enfoque
    setFocusPoint({ x: locationX, y: locationY, visible: true });

    // Ocultar indicador después de 1 segundo
    setTimeout(() => {
      setFocusPoint(prev => ({ ...prev, visible: false }));
    }, 1000);

    // En web, intentamos forzar un re-enfoque manipulando el stream
    if (Platform.OS === 'web') {
      try {
        // Obtener el stream de video actual
        const videoElements = document.querySelectorAll('video');
        for (const video of videoElements) {
          const stream = video.srcObject as MediaStream;
          if (stream) {
            const track = stream.getVideoTracks()[0];
            if (track) {
              const capabilities = track.getCapabilities?.() as MediaTrackCapabilities & { focusMode?: string[] };

              // Verificar si soporta control de enfoque
              if (capabilities?.focusMode?.includes('continuous') || capabilities?.focusMode?.includes('single-shot')) {
                // Intentar enfocar
                await track.applyConstraints({
                  advanced: [{ focusMode: 'continuous' } as MediaTrackConstraintSet]
                });
                console.log('📷 Enfoque activado');
              }
            }
          }
        }
      } catch (error) {
        console.log('📷 Control de enfoque no disponible en este navegador:', error);
      }
    }
  };

  /**
   * Maneja el escaneo de un código QR
   *
   * Proceso completo:
   * 1. Parsea JSON del QR (DNI, nombre, permisos)
   * 2. Valida que contenga los campos obligatorios
   * 3. Crea o actualiza el participante en Firestore
   * 4. Obtiene el estado actual del participante
   * 5. Valida el acceso según el modo y dirección
   * 6. Si es válido: actualiza estado + registra log de éxito
   * 7. Si no es válido: solo registra log de fallo (sin cambiar estado)
   * 8. Muestra modal de resultado al operador
   *
   * Control de concurrencia: Si ya se está procesando un QR, ignora nuevos escaneos
   */
  const handleBarCodeScanned = async ({ data }: { data: string }) => {
    // Prevenir escaneos simultáneos
    if (scanned || processing) return;

    setScanned(true);
    setProcessing(true);

    try {
      let dni: string;
      let participante: Participant | null;
      let qrNombre: string | null = null;

      const qrContent = data.trim();

      // 1. FORMATO CON BARRAS: puede ser nombre/dni/correo (3 partes) o eventId/dni (2 partes)
      // Detectar si contiene "/" y no es JSON
      if (qrContent.includes('/') && !qrContent.startsWith('{')) {
        const parts = qrContent.split('/');

        // 1a. FORMATO NOMBRE/DNI/CORREO (3 partes)
        if (parts.length === 3) {
          const [qrNombreCompleto, qrDni, qrCorreo] = parts;

          dni = qrDni.trim();
          qrNombre = qrNombreCompleto.trim();

          console.log(`📱 QR formato nombre/dni/correo: ${qrNombre} / ${dni} / ${qrCorreo.trim()}`);

          // Buscar participante en Firestore (en el evento activo)
          participante = await getParticipantByDNI(dni, currentEvent?.id);

          if (!participante) {
            const isAdminRole = user?.role && ['super_admin', 'admin_responsable', 'admin'].includes(user.role);
            const errorMsg = isAdminRole
              ? `Participante no encontrado en la base de datos.\n\nDNI: ${dni}\nNombre: ${qrNombre}\n\nSi quisieras inscribir a este participante, regístralo antes en el apartado de Administración.`
              : `Participante no encontrado en la base de datos.\n\nDNI: ${dni}\nNombre: ${qrNombre}\n\nSi este participante debería estar inscrito, avisa a tu administrador.`;
            throw new Error(errorMsg);
          }

        // 1b. FORMATO EVENTID/DNI (2 partes - desde emails con QR)
        } else if (parts.length === 2) {
          const [qrEventId, qrDni] = parts;

          // Validar que hay evento activo
          if (!currentEvent?.id) {
            throw new Error('No hay evento activo seleccionado.\n\nSelecciona un evento en el Dashboard antes de escanear.');
          }

          // Validar que el eventId del QR coincide con el evento activo
          if (qrEventId !== currentEvent.id) {
            throw new Error(`Este QR es para otro evento.\n\nEvento del QR: ${qrEventId}\nEvento activo: ${currentEvent.name}\n\nAsegúrate de tener seleccionado el evento correcto.`);
          }

          dni = qrDni.trim();

          // Buscar participante en Firestore
          participante = await getParticipantByDNI(dni, currentEvent.id);

          if (!participante) {
            const isAdminRole = user?.role && ['super_admin', 'admin_responsable', 'admin'].includes(user.role);
            const errorMsg = isAdminRole
              ? `Participante no encontrado.\n\nDNI: ${dni}\nEvento: ${currentEvent.name}\n\nRegistra al participante en Administración.`
              : `Participante no encontrado.\n\nDNI: ${dni}\n\nContacta a tu administrador.`;
            throw new Error(errorMsg);
          }
        } else {
          throw new Error(`Formato QR inválido.\n\nFormatos aceptados:\n- nombre/dni/correo\n- eventId/dni\n\nRecibido: ${qrContent}`);
        }

      // 2. FORMATO JSON: {"dni":"...", "nombre":"..."}
      } else if (qrContent.startsWith('{')) {
        try {
          const qrData: QRData = JSON.parse(qrContent);

          if (!qrData.dni || !qrData.nombre) {
            throw new Error('QR JSON inválido: faltan DNI o nombre');
          }

          dni = qrData.dni.trim();
          qrNombre = qrData.nombre.trim();

          // Buscar participante en Firestore por DNI (en el evento activo)
          participante = await getParticipantByDNI(dni, currentEvent?.id);

          if (!participante) {
            const isAdminRole = user?.role && ['super_admin', 'admin_responsable', 'admin'].includes(user.role);
            const errorMsg = isAdminRole
              ? `Participante no encontrado en la base de datos.\n\nDNI: ${dni}\nNombre: ${qrNombre}\n\nSi quisieras inscribir a este participante, regístralo antes en el apartado de Administración.`
              : `Participante no encontrado en la base de datos.\n\nDNI: ${dni}\nNombre: ${qrNombre}\n\nSi este participante debería estar inscrito, avisa a tu administrador.`;
            throw new Error(errorMsg);
          }

          // Verificar que el nombre del QR coincida con el de Firestore
          const nombreFirestore = participante.nombre.toLowerCase().trim();
          const nombreQR = qrNombre.toLowerCase();

          if (nombreFirestore !== nombreQR) {
            console.warn(`⚠️ Nombre en QR (${qrNombre}) no coincide exactamente con Firestore (${participante.nombre})`);
            showResult(
              true,
              `⚠️ Advertencia: El nombre en el QR difiere ligeramente.\n\nQR: ${qrNombre}\nBase de datos: ${participante.nombre}\n\nSe procederá con la validación.`
            );
            await new Promise(resolve => setTimeout(resolve, 2000));
          }
        } catch (jsonError) {
          throw new Error(`QR JSON malformado.\n\nContenido: ${qrContent}\n\nError: ${jsonError instanceof Error ? jsonError.message : 'Error de sintaxis'}`);
        }

      // 3. FORMATO SIMPLE: DNI o DNI+email
      } else {
        // Extraer DNI (antes del + si hay email)
        dni = qrContent.split('+')[0].trim();

        if (!dni) {
          throw new Error('QR inválido: no se pudo extraer el DNI');
        }

        // Validar formato básico de DNI (8 dígitos + letra, o NIE)
        const dniRegex = /^[0-9XYZ][0-9]{7}[A-Z]$/i;
        if (!dniRegex.test(dni)) {
          throw new Error(`Formato de DNI inválido: ${dni}\n\nEl DNI debe tener 8 dígitos seguidos de una letra.`);
        }

        // Buscar participante en Firestore (en el evento activo)
        participante = await getParticipantByDNI(dni, currentEvent?.id);

        if (!participante) {
          const isAdminRole = user?.role && ['super_admin', 'admin_responsable', 'admin'].includes(user.role);
          const errorMsg = isAdminRole
            ? `Participante no encontrado en la base de datos.\n\nDNI: ${dni}\n\nSi quisieras inscribir a este participante, regístralo antes en el apartado de Administración.`
            : `Participante no encontrado en la base de datos.\n\nDNI: ${dni}\n\nSi este participante debería estar inscrito, avisa a tu administrador.`;
          throw new Error(errorMsg);
        }
      }

      // 5. Validar acceso según el modo y dirección
      // Aplica reglas de negocio: permisos, registro previo, estado de ubicación
      const validacion = validateAccess(participante, modo, direccion);

      if (validacion.valido && participante) {
        // 6a. ACCESO VÁLIDO
        // Actualizar estado del participante (registrado, en_aula_magna, etc.)
        await updateParticipantStatus(dni, modo, direccion, currentEvent?.id);

        // Registrar log de éxito en la colección access_logs
        await logAccess(
          dni,
          participante.nombre,
          modo,
          direccion,
          true,
          validacion.mensaje,
          operador,
          user?.uid,
          currentEvent?.id,
          participante
        );

        // Mostrar modal de éxito al operador
        showResult(true, validacion.mensaje, participante);
      } else {
        // 6b. ACCESO DENEGADO
        // Solo registrar el intento fallido, sin modificar el estado
        await logAccess(
          dni,
          participante?.nombre || 'Desconocido',
          modo,
          direccion,
          false,
          validacion.mensaje,
          operador,
          user?.uid,
          currentEvent?.id,
          participante
        );

        // Mostrar modal de error al operador
        showResult(false, validacion.mensaje, participante || undefined);
      }
    } catch (error) {
      // Manejo de errores: QR inválido, problemas de conexión, etc.
      console.error('Error procesando QR:', error);
      const errorMessage =
        error instanceof Error ? error.message : 'Error al procesar el código QR';

      showResult(false, `❌ ${errorMessage}`);
    } finally {
      // Liberar estado de procesamiento
      setProcessing(false);
    }
  };

  /**
   * Muestra el modal de resultado (éxito o error)
   * Siempre requiere toque del usuario para continuar (evita logs duplicados)
   */
  const showResult = (
    success: boolean,
    message: string,
    participant?: Participant
  ) => {
    setResultModal({
      visible: true,
      success,
      message,
      participant,
    });
  };

  /**
   * Cierra el modal de resultado y permite escanear el siguiente QR
   */
  const closeResultModal = () => {
    setResultModal({ visible: false, success: false, message: '' });
    setScanned(false); // Permite escanear el siguiente QR
  };

  // Estado de carga: esperando respuesta de permisos
  if (hasPermission === null) {
    return (
      <ThemedView style={styles.container}>
        <ThemedText>Solicitando permisos de cámara...</ThemedText>
      </ThemedView>
    );
  }

  // Permisos denegados: mostrar botón para solicitarlos de nuevo
  if (hasPermission === false) {
    return (
      <ThemedView style={styles.container}>
        <ThemedText style={styles.errorText}>
          No se ha otorgado permiso para usar la cámara
        </ThemedText>
        <TouchableOpacity
          style={[styles.button, { backgroundColor: colorScheme === 'dark' ? Colors.dark.primary : Colors.light.primary }]}
          onPress={async () => {
            const { status } = await Camera.requestCameraPermissionsAsync();
            setHasPermission(status === 'granted');
          }}
        >
          <Text style={styles.buttonText}>Solicitar permisos</Text>
        </TouchableOpacity>
      </ThemedView>
    );
  }

  /**
   * Obtiene el label legible del modo actual
   * Para mostrar en el header (ej: "Aula Magna - ENTRADA")
   */
  const getModoLabel = () => {
    const labels: Record<string, string> = {
      registro: 'Registro Inicial',
      aula_magna: 'Aula Magna',
      master_class: 'Master Class',
      cena: 'Cena de Clausura',
    };
    return labels[modo] || modo;
  };

  return (
    <View style={styles.container}>
      {/* Header: muestra el modo actual y dirección (si aplica) */}
      <View style={styles.header}>
        <View style={styles.headerContent}>
          <Text style={styles.headerText}>
            {getModoLabel()}
            {/* Mostrar dirección solo si no es registro (ej: "ENTRADA" o "SALIDA") */}
            {modo !== 'registro' && ` - ${direccion.toUpperCase()}`}
          </Text>
        </View>
        <View style={styles.loginContainer}>
          <LoginButton />
        </View>
      </View>

      {/* Cámara para escanear QR */}
      <Pressable style={styles.cameraContainer} onPress={handleTapToFocus}>
        <CameraView
          ref={cameraRef}
          style={styles.camera}
          facing="back"
          // Solo permitir escaneo si no hay uno en proceso
          onBarcodeScanned={scanned ? undefined : handleBarCodeScanned}
          barcodeScannerSettings={{
            barcodeTypes: ['qr'], // Solo QR codes, no barcodes lineales
          }}
        >
          {/* Overlay con marco de escaneo */}
          <View style={styles.overlay}>
            {/* Marco de escaneo con esquinas en azul Impuls */}
            <View style={styles.scanArea}>
              <View style={[styles.corner, styles.topLeft]} />
              <View style={[styles.corner, styles.topRight]} />
              <View style={[styles.corner, styles.bottomLeft]} />
              <View style={[styles.corner, styles.bottomRight]} />
            </View>

            {/* Indicador de enfoque (aparece al tocar) */}
            {focusPoint.visible && (
              <View
                style={[
                  styles.focusIndicator,
                  { left: focusPoint.x - 30, top: focusPoint.y - 30 },
                ]}
              />
            )}

            {/* Instrucciones para el operador */}
            <View style={styles.instructionsContainer}>
              <Text style={styles.instructions}>
                {Platform.OS === 'web'
                  ? 'Toca la pantalla para enfocar'
                  : 'Coloca el código QR dentro del marco'}
              </Text>
            </View>
          </View>
        </CameraView>
      </Pressable>

      {/* Footer: botón para volver a la pantalla anterior */}
      <View style={styles.footer}>
        <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
          <Text style={styles.backButtonText}>← Volver</Text>
        </TouchableOpacity>
      </View>

      {/* Modal de resultado: muestra éxito o error después de escanear */}
      <Modal
        visible={resultModal.visible}
        transparent
        animationType="fade"
        onRequestClose={closeResultModal}
      >
        <View style={styles.modalOverlay}>
          <View
            style={[
              styles.modalContent,
              {
                // Color de fondo según resultado (verde=éxito, rojo=error)
                backgroundColor: resultModal.success
                  ? (colorScheme === 'dark' ? Colors.dark.success : Colors.light.success)
                  : (colorScheme === 'dark' ? Colors.dark.error : Colors.light.error),
              },
            ]}
          >
            {/* Icono grande de éxito/error */}
            <Text style={styles.modalIcon}>
              {resultModal.success ? '✅' : '❌'}
            </Text>

            {/* Mensaje de validación (ej: "Acceso permitido", "Sin permiso de master class") */}
            <Text style={styles.modalMessage}>{resultModal.message}</Text>

            {/* Información del participante (nombre y DNI) */}
            {resultModal.participant && (
              <View style={styles.participantInfo}>
                <Text style={styles.participantName}>
                  {resultModal.participant.nombre}
                </Text>
                <Text style={styles.participantDni}>
                  DNI: {resultModal.participant.dni}
                </Text>
              </View>
            )}

            {/* Botón para cerrar y continuar con el siguiente escaneo */}
            <TouchableOpacity
              style={styles.modalButton}
              onPress={closeResultModal}
            >
              <Text style={styles.modalButtonText}>Continuar</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </View>
  );
}

/**
 * Estilos del scanner
 * Diseño minimalista enfocado en la funcionalidad:
 * - Fondo negro para la cámara
 * - Marco de escaneo con esquinas en azul Impuls
 * - Modal de resultado con colores de éxito/error
 */
const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000', // Fondo negro para mejor contraste con la cámara
  },
  cameraContainer: {
    flex: 1,
  },
  header: {
    backgroundColor: 'rgba(0,0,0,0.8)',
    padding: 15,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerContent: {
    flex: 1,
    alignItems: 'center',
  },
  headerText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: 'bold',
  },
  loginContainer: {
    position: 'absolute',
    right: 15,
  },
  camera: {
    flex: 1,
  },
  overlay: {
    flex: 1,
    backgroundColor: 'transparent',
    justifyContent: 'center',
    alignItems: 'center',
  },
  scanArea: {
    width: 250,
    height: 250,
    position: 'relative',
  },
  corner: {
    position: 'absolute',
    width: 40,
    height: 40,
    borderColor: Colors.light.primary, // Impuls blue for corners
  },
  topLeft: {
    top: 0,
    left: 0,
    borderTopWidth: 4,
    borderLeftWidth: 4,
  },
  topRight: {
    top: 0,
    right: 0,
    borderTopWidth: 4,
    borderRightWidth: 4,
  },
  bottomLeft: {
    bottom: 0,
    left: 0,
    borderBottomWidth: 4,
    borderLeftWidth: 4,
  },
  bottomRight: {
    bottom: 0,
    right: 0,
    borderBottomWidth: 4,
    borderRightWidth: 4,
  },
  instructionsContainer: {
    position: 'absolute',
    bottom: 100,
    backgroundColor: 'rgba(0,0,0,0.7)',
    padding: Spacing.md,
    borderRadius: BorderRadius.md,
  },
  instructions: {
    color: '#fff',
    fontSize: 16,
    textAlign: 'center',
  },
  focusIndicator: {
    position: 'absolute',
    width: 60,
    height: 60,
    borderWidth: 2,
    borderColor: Colors.light.primary,
    borderRadius: 30,
    backgroundColor: 'transparent',
  },
  footer: {
    backgroundColor: 'rgba(0,0,0,0.8)',
    padding: Spacing.md,
  },
  backButton: {
    padding: Spacing.md,
    alignItems: 'center',
  },
  backButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
  errorText: {
    fontSize: 16,
    textAlign: 'center',
    marginBottom: 20,
  },
  button: {
    padding: Spacing.md,
    borderRadius: BorderRadius.full,
    marginHorizontal: Spacing.lg,
  },
  buttonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
    textAlign: 'center',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.8)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContent: {
    width: '85%',
    borderRadius: BorderRadius.xl,
    padding: Spacing.xxl,
    alignItems: 'center',
  },
  modalIcon: {
    fontSize: 60,
    marginBottom: 15,
  },
  modalMessage: {
    color: '#fff',
    fontSize: 20,
    fontWeight: 'bold',
    textAlign: 'center',
    marginBottom: 15,
  },
  participantInfo: {
    backgroundColor: 'rgba(255,255,255,0.2)',
    padding: Spacing.md,
    borderRadius: BorderRadius.md,
    width: '100%',
    marginBottom: Spacing.lg,
  },
  participantName: {
    color: '#fff',
    fontSize: 18,
    fontWeight: 'bold',
    textAlign: 'center',
    marginBottom: 5,
  },
  participantDni: {
    color: '#fff',
    fontSize: 14,
    textAlign: 'center',
  },
  modalButton: {
    backgroundColor: 'rgba(255,255,255,0.3)',
    paddingHorizontal: Spacing.xxl,
    paddingVertical: Spacing.sm,
    borderRadius: BorderRadius.full,
  },
  modalButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
});
