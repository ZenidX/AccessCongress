/**
 * InlineCameraScanner Component
 *
 * Embedded camera scanner for web dashboard.
 * Shows the camera preview inline with QR scanning capability.
 */

import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Platform } from 'react-native';
import { CameraView, Camera } from 'expo-camera';
import { Colors, BorderRadius, Spacing } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { useApp } from '@/contexts/AppContext';
import { useAuth } from '@/contexts/AuthContext';
import { useEvent } from '@/contexts/EventContext';
import { validateAccess } from '@/utils/validations';
import {
  getParticipantByDNI,
  updateParticipantStatus,
  logAccess,
} from '@/services/participantService';
import { Participant, QRData } from '@/types/participant';

interface InlineCameraScannerProps {
  onScanResult?: (success: boolean, message: string, participant?: Participant) => void;
}

export function InlineCameraScanner({ onScanResult }: InlineCameraScannerProps) {
  const colorScheme = useColorScheme();
  const { modo, direccion, operador } = useApp();
  const { user } = useAuth();
  const { currentEvent } = useEvent();

  const [hasPermission, setHasPermission] = useState<boolean | null>(null);
  const [scanned, setScanned] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [lastResult, setLastResult] = useState<{
    success: boolean;
    message: string;
    participant?: Participant;
  } | null>(null);

  // Request camera permissions
  useEffect(() => {
    (async () => {
      const { status } = await Camera.requestCameraPermissionsAsync();
      setHasPermission(status === 'granted');
    })();
  }, []);

  // Auto-clear result after 3 seconds for success
  useEffect(() => {
    if (lastResult?.success) {
      const timer = setTimeout(() => {
        setLastResult(null);
        setScanned(false);
      }, 3000);
      return () => clearTimeout(timer);
    }
  }, [lastResult]);

  const handleBarCodeScanned = async ({ data }: { data: string }) => {
    if (scanned || processing) return;

    setScanned(true);
    setProcessing(true);

    try {
      let dni: string;
      let participante: Participant | null;
      let qrNombre: string | null = null;

      const qrContent = data.trim();

      // Parse QR content (same logic as scanner.tsx)
      if (qrContent.includes('/') && !qrContent.startsWith('{')) {
        const parts = qrContent.split('/');

        if (parts.length === 3) {
          const [qrNombreCompleto, qrDni] = parts;
          dni = qrDni.trim();
          qrNombre = qrNombreCompleto.trim();
          participante = await getParticipantByDNI(dni, currentEvent?.id);

          if (!participante) {
            throw new Error(`Participante no encontrado: ${dni}`);
          }
        } else if (parts.length === 2) {
          const [qrEventId, qrDni] = parts;

          if (!currentEvent?.id) {
            throw new Error('No hay evento activo seleccionado');
          }

          if (qrEventId !== currentEvent.id) {
            throw new Error('Este QR es para otro evento');
          }

          dni = qrDni.trim();
          participante = await getParticipantByDNI(dni, currentEvent.id);

          if (!participante) {
            throw new Error(`Participante no encontrado: ${dni}`);
          }
        } else {
          throw new Error('Formato QR inválido');
        }
      } else if (qrContent.startsWith('{')) {
        const qrData: QRData = JSON.parse(qrContent);

        if (!qrData.dni || !qrData.nombre) {
          throw new Error('QR JSON inválido');
        }

        dni = qrData.dni.trim();
        qrNombre = qrData.nombre.trim();
        participante = await getParticipantByDNI(dni, currentEvent?.id);

        if (!participante) {
          throw new Error(`Participante no encontrado: ${dni}`);
        }
      } else {
        dni = qrContent.split('+')[0].trim();

        if (!dni) {
          throw new Error('QR inválido: no se pudo extraer el DNI');
        }

        participante = await getParticipantByDNI(dni, currentEvent?.id);

        if (!participante) {
          throw new Error(`Participante no encontrado: ${dni}`);
        }
      }

      // Validate access
      const validacion = validateAccess(participante, modo, direccion);

      if (validacion.valido && participante) {
        await updateParticipantStatus(dni, modo, direccion, currentEvent?.id);

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

        const result = { success: true, message: validacion.mensaje, participant: participante };
        setLastResult(result);
        onScanResult?.(true, validacion.mensaje, participante);
      } else {
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

        const result = { success: false, message: validacion.mensaje, participant: participante || undefined };
        setLastResult(result);
        onScanResult?.(false, validacion.mensaje, participante || undefined);
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Error al procesar QR';
      const result = { success: false, message: errorMessage };
      setLastResult(result);
      onScanResult?.(false, errorMessage);
    } finally {
      setProcessing(false);
    }
  };

  const handleClearResult = () => {
    setLastResult(null);
    setScanned(false);
  };

  // Permission states
  if (hasPermission === null) {
    return (
      <View style={styles.container}>
        <View style={styles.messageContainer}>
          <Text style={styles.messageText}>Solicitando permisos de cámara...</Text>
        </View>
      </View>
    );
  }

  if (hasPermission === false) {
    return (
      <View style={styles.container}>
        <View style={styles.messageContainer}>
          <Text style={styles.messageText}>Sin permiso de cámara</Text>
          <TouchableOpacity
            style={[styles.permissionButton, { backgroundColor: Colors.light.primary }]}
            onPress={async () => {
              const { status } = await Camera.requestCameraPermissionsAsync();
              setHasPermission(status === 'granted');
            }}
          >
            <Text style={styles.permissionButtonText}>Solicitar permiso</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <CameraView
        style={styles.camera}
        facing="back"
        onBarcodeScanned={scanned ? undefined : handleBarCodeScanned}
        barcodeScannerSettings={{ barcodeTypes: ['qr'] }}
      >
        {/* Scan overlay */}
        <View style={styles.overlay}>
          <View style={styles.scanArea}>
            <View style={[styles.corner, styles.topLeft]} />
            <View style={[styles.corner, styles.topRight]} />
            <View style={[styles.corner, styles.bottomLeft]} />
            <View style={[styles.corner, styles.bottomRight]} />
          </View>
        </View>

        {/* Result overlay */}
        {lastResult && (
          <TouchableOpacity
            style={[
              styles.resultOverlay,
              { backgroundColor: lastResult.success ? 'rgba(76, 175, 80, 0.95)' : 'rgba(244, 67, 54, 0.95)' },
            ]}
            onPress={handleClearResult}
            activeOpacity={0.9}
          >
            <Text style={styles.resultIcon}>{lastResult.success ? '✅' : '❌'}</Text>
            <Text style={styles.resultMessage}>{lastResult.message}</Text>
            {lastResult.participant && (
              <Text style={styles.resultParticipant}>{lastResult.participant.nombre}</Text>
            )}
            <Text style={styles.resultHint}>Toca para continuar</Text>
          </TouchableOpacity>
        )}
      </CameraView>

      {/* Processing indicator */}
      {processing && (
        <View style={styles.processingOverlay}>
          <Text style={styles.processingText}>Procesando...</Text>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000',
    borderRadius: BorderRadius.lg,
    overflow: 'hidden',
    minHeight: 300,
  },
  camera: {
    flex: 1,
  },
  overlay: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'center',
    alignItems: 'center',
  },
  scanArea: {
    width: 200,
    height: 200,
    position: 'relative',
  },
  corner: {
    position: 'absolute',
    width: 30,
    height: 30,
    borderColor: Colors.light.primary,
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
  messageContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: Spacing.lg,
  },
  messageText: {
    color: '#fff',
    fontSize: 14,
    textAlign: 'center',
  },
  permissionButton: {
    marginTop: Spacing.md,
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.sm,
    borderRadius: BorderRadius.md,
  },
  permissionButtonText: {
    color: '#fff',
    fontWeight: 'bold',
  },
  resultOverlay: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'center',
    alignItems: 'center',
    padding: Spacing.lg,
  },
  resultIcon: {
    fontSize: 48,
    marginBottom: Spacing.sm,
  },
  resultMessage: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
    textAlign: 'center',
    marginBottom: Spacing.xs,
  },
  resultParticipant: {
    color: '#fff',
    fontSize: 14,
    opacity: 0.9,
    textAlign: 'center',
  },
  resultHint: {
    color: '#fff',
    fontSize: 12,
    opacity: 0.7,
    marginTop: Spacing.md,
  },
  processingOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.7)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  processingText: {
    color: '#fff',
    fontSize: 16,
  },
});

export default InlineCameraScanner;
