/**
 * Pantalla de escaneo de QR
 *
 * Funcionalidad principal de la aplicación. Escanea códigos QR de participantes
 * y valida su acceso según el modo seleccionado (Registro, Aula Magna, Master Class, Cena).
 *
 * Formatos de QR aceptados:
 * 1. JSON completo: {"dni":"12345678A","nombre":"Juan Pérez","permisos":{...}}
 * 2. DNI simple: 12345678A
 * 3. DNI + email: 12345678A+email@example.com
 *
 * Flujo:
 * 1. Solicita permisos de cámara
 * 2. Escanea código QR
 * 3. Intenta parsear como JSON, si falla extrae el DNI
 * 4. Busca el participante en Firestore
 * 5. Aplica validaciones según el modo (permisos, estado actual, etc.)
 * 6. Actualiza estado del participante si la validación es exitosa
 * 7. Registra el intento en los logs de acceso
 * 8. Muestra resultado visual al operador (modal de éxito/error)
 */

import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, Alert, TouchableOpacity, Modal } from 'react-native';
import { CameraView, Camera } from 'expo-camera';
import { useRouter } from 'expo-router';
import { ThemedView } from '@/components/themed-view';
import { ThemedText } from '@/components/themed-text';
import { useApp } from '@/contexts/AppContext';
import { validateAccess } from '@/utils/validations';
import {
  getParticipantByDNI,
  upsertParticipantFromQR,
  updateParticipantStatus,
  logAccess,
} from '@/services/participantService';
import { QRData, Participant } from '@/types/participant';
import { Colors, BorderRadius, Spacing } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';

export default function ScannerScreen() {
  const router = useRouter();
  const colorScheme = useColorScheme();

  // Obtener modo, dirección y operador desde el contexto global
  const { modo, direccion, operador } = useApp();

  // Estados de permisos de cámara
  const [hasPermission, setHasPermission] = useState<boolean | null>(null);

  // Control de escaneo: previene escaneos múltiples simultáneos
  const [scanned, setScanned] = useState(false);
  const [processing, setProcessing] = useState(false);

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

      // 1. Intentar parsear como JSON (formato completo)
      try {
        const qrData: QRData = JSON.parse(data);

        if (!qrData.dni || !qrData.nombre || !qrData.permisos) {
          throw new Error('QR JSON inválido: faltan datos obligatorios');
        }

        // Crear/actualizar participante con datos del QR
        await upsertParticipantFromQR(qrData);
        dni = qrData.dni;
        participante = await getParticipantByDNI(dni);
      } catch (jsonError) {
        // 2. Si no es JSON válido, tratarlo como DNI simple
        // Formato aceptado: "DNI" o "DNI+email"
        const qrContent = data.trim();

        // Extraer DNI (antes del + si hay email)
        dni = qrContent.split('+')[0].trim();

        if (!dni) {
          throw new Error('QR inválido: no se pudo extraer el DNI');
        }

        // 3. Buscar participante en Firestore
        participante = await getParticipantByDNI(dni);

        if (!participante) {
          throw new Error(`Participante no registrado en el sistema.\nDNI: ${dni}`);
        }
      }

      // 5. Validar acceso según el modo y dirección
      // Aplica reglas de negocio: permisos, registro previo, estado de ubicación
      const validacion = validateAccess(participante, modo, direccion);

      if (validacion.valido && participante) {
        // 6a. ACCESO VÁLIDO
        // Actualizar estado del participante (registrado, en_aula_magna, etc.)
        await updateParticipantStatus(dni, modo, direccion);

        // Registrar log de éxito en la colección access_logs
        await logAccess(
          dni,
          participante.nombre,
          modo,
          direccion,
          true,
          validacion.mensaje,
          operador
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
          operador
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
   * Si es exitoso, se auto-cierra después de 3 segundos
   * Si es error, requiere confirmación manual del operador
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

    // Auto-cerrar después de 3 segundos solo si es exitoso
    // Esto permite al operador escanear rápidamente múltiples participantes
    if (success) {
      setTimeout(() => {
        closeResultModal();
      }, 3000);
    }
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
        <Text style={styles.headerText}>
          {getModoLabel()}
          {/* Mostrar dirección solo si no es registro (ej: "ENTRADA" o "SALIDA") */}
          {modo !== 'registro' && ` - ${direccion.toUpperCase()}`}
        </Text>
      </View>

      {/* Cámara para escanear QR */}
      <CameraView
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

          {/* Instrucciones para el operador */}
          <View style={styles.instructionsContainer}>
            <Text style={styles.instructions}>
              Coloca el código QR dentro del marco
            </Text>
          </View>
        </View>
      </CameraView>

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
  header: {
    backgroundColor: 'rgba(0,0,0,0.8)',
    padding: 15,
    alignItems: 'center',
  },
  headerText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: 'bold',
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
