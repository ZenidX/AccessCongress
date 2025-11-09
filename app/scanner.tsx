/**
 * Pantalla de escaneo de QR
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

export default function ScannerScreen() {
  const router = useRouter();
  const { modo, direccion, operador } = useApp();
  const [hasPermission, setHasPermission] = useState<boolean | null>(null);
  const [scanned, setScanned] = useState(false);
  const [processing, setProcessing] = useState(false);
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

  useEffect(() => {
    (async () => {
      const { status } = await Camera.requestCameraPermissionsAsync();
      setHasPermission(status === 'granted');
    })();
  }, []);

  const handleBarCodeScanned = async ({ data }: { data: string }) => {
    if (scanned || processing) return;

    setScanned(true);
    setProcessing(true);

    try {
      // Parsear datos del QR
      const qrData: QRData = JSON.parse(data);

      if (!qrData.dni || !qrData.nombre || !qrData.permisos) {
        throw new Error('QR inválido: faltan datos obligatorios');
      }

      // Crear/actualizar participante desde QR
      await upsertParticipantFromQR(qrData);

      // Obtener participante actualizado
      const participante = await getParticipantByDNI(qrData.dni);

      // Validar acceso según modo
      const validacion = validateAccess(participante, modo, direccion);

      if (validacion.valido && participante) {
        // Actualizar estado
        await updateParticipantStatus(qrData.dni, modo, direccion);

        // Registrar log
        await logAccess(
          qrData.dni,
          qrData.nombre,
          modo,
          direccion,
          true,
          validacion.mensaje,
          operador
        );

        // Mostrar resultado exitoso
        showResult(true, validacion.mensaje, participante);
      } else {
        // Registrar log de fallo
        await logAccess(
          qrData.dni,
          qrData.nombre,
          modo,
          direccion,
          false,
          validacion.mensaje,
          operador
        );

        // Mostrar resultado de fallo
        showResult(false, validacion.mensaje, participante || undefined);
      }
    } catch (error) {
      console.error('Error procesando QR:', error);
      const errorMessage =
        error instanceof Error ? error.message : 'Error al procesar el código QR';

      showResult(false, `❌ ${errorMessage}`);
    } finally {
      setProcessing(false);
    }
  };

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

    // Auto-cerrar después de 3 segundos si es exitoso
    if (success) {
      setTimeout(() => {
        closeResultModal();
      }, 3000);
    }
  };

  const closeResultModal = () => {
    setResultModal({ visible: false, success: false, message: '' });
    setScanned(false);
  };

  if (hasPermission === null) {
    return (
      <ThemedView style={styles.container}>
        <ThemedText>Solicitando permisos de cámara...</ThemedText>
      </ThemedView>
    );
  }

  if (hasPermission === false) {
    return (
      <ThemedView style={styles.container}>
        <ThemedText style={styles.errorText}>
          No se ha otorgado permiso para usar la cámara
        </ThemedText>
        <TouchableOpacity
          style={styles.button}
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
      <View style={styles.header}>
        <Text style={styles.headerText}>
          {getModoLabel()}
          {modo !== 'registro' && ` - ${direccion.toUpperCase()}`}
        </Text>
      </View>

      <CameraView
        style={styles.camera}
        facing="back"
        onBarcodeScanned={scanned ? undefined : handleBarCodeScanned}
        barcodeScannerSettings={{
          barcodeTypes: ['qr'],
        }}
      >
        <View style={styles.overlay}>
          <View style={styles.scanArea}>
            <View style={[styles.corner, styles.topLeft]} />
            <View style={[styles.corner, styles.topRight]} />
            <View style={[styles.corner, styles.bottomLeft]} />
            <View style={[styles.corner, styles.bottomRight]} />
          </View>

          <View style={styles.instructionsContainer}>
            <Text style={styles.instructions}>
              Coloca el código QR dentro del marco
            </Text>
          </View>
        </View>
      </CameraView>

      <View style={styles.footer}>
        <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
          <Text style={styles.backButtonText}>← Volver</Text>
        </TouchableOpacity>
      </View>

      {/* Modal de resultado */}
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
                backgroundColor: resultModal.success ? '#4CAF50' : '#F44336',
              },
            ]}
          >
            <Text style={styles.modalIcon}>
              {resultModal.success ? '✅' : '❌'}
            </Text>
            <Text style={styles.modalMessage}>{resultModal.message}</Text>

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

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000',
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
    borderColor: '#fff',
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
    padding: 15,
    borderRadius: 10,
  },
  instructions: {
    color: '#fff',
    fontSize: 16,
    textAlign: 'center',
  },
  footer: {
    backgroundColor: 'rgba(0,0,0,0.8)',
    padding: 15,
  },
  backButton: {
    padding: 15,
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
    backgroundColor: '#2196F3',
    padding: 15,
    borderRadius: 10,
    marginHorizontal: 20,
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
    borderRadius: 20,
    padding: 30,
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
    padding: 15,
    borderRadius: 10,
    width: '100%',
    marginBottom: 20,
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
    paddingHorizontal: 30,
    paddingVertical: 12,
    borderRadius: 25,
  },
  modalButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
});
