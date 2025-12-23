/**
 * Pantalla de administración
 *
 * Funciones administrativas para gestión de participantes:
 * 1. Importación masiva desde archivo CSV o Excel (.xlsx, .xls)
 * 2. Reseteo de estados (útil para testing o nuevo evento)
 * 3. Información sobre configuración de Firebase y reglas de Firestore
 *
 * Formato esperado (CSV o Excel):
 * Columna A: DNI
 * Columna B: Nombre
 * Columna C: MasterClass (Si/No o 1/0)
 * Columna D: Cena (Si/No o 1/0)
 *
 * Ejemplo:
 * DNI,Nombre,MasterClass,Cena
 * 12345678A,Juan Pérez,Si,Si
 */

import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Alert,
  ScrollView,
  ActivityIndicator,
  Image,
  Modal,
  Platform,
} from 'react-native';
import * as DocumentPicker from 'expo-document-picker';
import { useRouter } from 'expo-router';
import { ThemedView } from '@/components/themed-view';
import { ThemedText } from '@/components/themed-text';
import {
  importParticipantsFromCSV,
  importParticipantsFromExcel,
  resetAllParticipantStates,
  exportDataToExcel,
} from '@/services/participantService';
import { Colors, BorderRadius, Spacing, Shadows } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import * as Sharing from 'expo-sharing';

export default function AdminScreen() {
  const router = useRouter();
  const colorScheme = useColorScheme();

  // Estado de carga para operaciones asíncronas
  const [loading, setLoading] = useState(false);
  const [isInfoModalVisible, setInfoModalVisible] = useState(false);

  /**
   * Importar participantes desde archivo CSV
   *
   * Proceso:
   * 1. Abre selector de archivos del dispositivo
   * 2. Lee el contenido del CSV
   * 3. Parsea y valida cada línea
   * 4. Crea documentos en Firestore para cada participante
   * 5. Asigna permisos según columnas MasterClass y Cena
   * 6. Muestra confirmación con cantidad importada
   */
  const handleImportCSV = async () => {
    try {
      setLoading(true);

      // Abrir selector de documentos - acepta CSV y Excel
      const result = await DocumentPicker.getDocumentAsync({
        type: ['text/csv', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', 'application/vnd.ms-excel'],
        copyToCacheDirectory: true,
      });

      if (result.canceled) {
        setLoading(false);
        return;
      }

      const file = result.assets[0];
      const fileName = file.name?.toLowerCase() || '';
      const isExcel = fileName.endsWith('.xlsx') || fileName.endsWith('.xls');

      // Leer contenido del archivo
      const response = await fetch(file.uri);

      let count: number;

      if (isExcel) {
        // Procesar archivo Excel
        const arrayBuffer = await response.arrayBuffer();
        count = await importParticipantsFromExcel(arrayBuffer);
      } else {
        // Procesar archivo CSV
        const csvData = await response.text();
        count = await importParticipantsFromCSV(csvData);
      }

      setLoading(false);

      Alert.alert(
        'Importación exitosa',
        `Se importaron ${count} participantes correctamente desde ${isExcel ? 'Excel' : 'CSV'}.`,
        [{ text: 'OK' }]
      );
    } catch (error) {
      setLoading(false);
      console.error('Error importando archivo:', error);
      Alert.alert(
        'Error',
        `No se pudo importar el archivo: ${
          error instanceof Error ? error.message : 'Error desconocido'
        }`,
        [{ text: 'OK' }]
      );
    }
  };

  const handleResetStates = () => {
    Alert.alert(
      'Resetear estados',
      '¿Estás seguro de que quieres resetear todos los estados de los participantes? Esta acción no se puede deshacer.',
      [
        {
          text: 'Cancelar',
          style: 'cancel',
        },
        {
          text: 'Resetear',
          style: 'destructive',
          onPress: async () => {
            try {
              setLoading(true);
              await resetAllParticipantStates();
              setLoading(false);

              Alert.alert(
                'Estados reseteados',
                'Todos los estados han sido reseteados correctamente.',
                [{ text: 'OK' }]
              );
            } catch (error) {
              setLoading(false);
              console.error('Error reseteando estados:', error);
              Alert.alert(
                'Error',
                'No se pudieron resetear los estados.',
                [{ text: 'OK' }]
              );
            }
          },
        },
      ]
    );
  };

  const showCSVFormatInfo = () => {
    setInfoModalVisible(true);
  };

  /**
   * Exportar todos los datos a Excel
   * Genera un archivo con dos hojas: Participantes y Logs
   */
  const handleExportData = async () => {
    try {
      setLoading(true);

      // Generar y descargar archivo
      const fileUri = await exportDataToExcel();

      setLoading(false);

      // En web, la descarga ya se inició automáticamente
      // En móvil, abrir el diálogo de compartir
      if (Platform.OS !== 'web') {
        const isAvailable = await Sharing.isAvailableAsync();
        if (isAvailable) {
          await Sharing.shareAsync(fileUri, {
            mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
            dialogTitle: 'Exportar datos del congreso',
            UTI: 'com.microsoft.excel.xlsx',
          });
        }
      } else {
        // En web, mostrar confirmación
        Alert.alert(
          'Exportación exitosa',
          'El archivo Excel se ha descargado correctamente.',
          [{ text: 'OK' }]
        );
      }
    } catch (error: any) {
      setLoading(false);
      console.error('Error exportando datos:', error);
      Alert.alert(
        'Error',
        `No se pudieron exportar los datos:\n${error?.message || 'Error desconocido'}`,
        [{ text: 'OK' }]
      );
    }
  };

  return (
    <ThemedView style={styles.container}>
      <View style={styles.logoContainer}>
        <Image
          source={{ uri: 'https://impulseducacio.org/wp-content/uploads/2020/02/logo-web-impuls.png' }}
          style={styles.logo}
          resizeMode="contain"
        />
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.section}>
          <ThemedText style={styles.sectionTitle}>
            📊 Gestión de Participantes
          </ThemedText>

          <TouchableOpacity
            style={[
              styles.actionCard,
              colorScheme === 'dark' ? Shadows.light : Shadows.light,
              {
                backgroundColor:
                  colorScheme === 'dark'
                    ? Colors.dark.cardBackground
                    : Colors.light.cardBackground,
              },
            ]}
            onPress={handleImportCSV}
            disabled={loading}
            activeOpacity={0.7}
          >
            <Text style={styles.actionIcon}>📁</Text>
            <View style={styles.actionTextContainer}>
              <ThemedText style={styles.actionTitle}>
                Importar participantes desde CSV/Excel
              </ThemedText>
              <ThemedText style={styles.actionDescription}>
                Cargar desde archivo .csv, .xlsx o .xls
              </ThemedText>
            </View>
          </TouchableOpacity>

          <TouchableOpacity
            style={[
              styles.actionCard,
              colorScheme === 'dark' ? Shadows.light : Shadows.light,
              {
                backgroundColor:
                  colorScheme === 'dark'
                    ? Colors.dark.cardBackground
                    : Colors.light.cardBackground,
              },
            ]}
            onPress={handleExportData}
            disabled={loading}
            activeOpacity={0.7}
          >
            <Text style={styles.actionIcon}>📥</Text>
            <View style={styles.actionTextContainer}>
              <ThemedText style={styles.actionTitle}>
                Exportar datos a Excel
              </ThemedText>
              <ThemedText style={styles.actionDescription}>
                Descargar participantes y logs de acceso
              </ThemedText>
            </View>
          </TouchableOpacity>

          <TouchableOpacity
            style={[
              styles.infoButton,
              Shadows.medium,
              {
                backgroundColor:
                  colorScheme === 'dark' ? Colors.dark.primary : Colors.light.primary,
              },
            ]}
            onPress={showCSVFormatInfo}
            activeOpacity={0.8}
          >
            <Text style={styles.infoButtonText}>ℹ️ Ver formatos aceptados</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.section}>
          <ThemedText style={styles.sectionTitle}>⚙️ Herramientas</ThemedText>

          <TouchableOpacity
            style={[
              styles.actionCard,
              colorScheme === 'dark' ? Shadows.light : Shadows.light,
              {
                backgroundColor:
                  colorScheme === 'dark'
                    ? Colors.dark.cardBackground
                    : Colors.light.cardBackground,
              },
            ]}
            onPress={handleResetStates}
            disabled={loading}
            activeOpacity={0.7}
          >
            <Text style={styles.actionIcon}>🔄</Text>
            <View style={styles.actionTextContainer}>
              <ThemedText style={styles.actionTitle}>
                Resetear todos los estados
              </ThemedText>
              <ThemedText style={styles.actionDescription}>
                Marcar todos como no registrados y fuera de ubicaciones
              </ThemedText>
            </View>
          </TouchableOpacity>
        </View>

        <View style={styles.section}>
          <ThemedText style={styles.sectionTitle}>ℹ️ Información</ThemedText>

          <View
            style={[
              styles.infoCard,
              colorScheme === 'dark' ? Shadows.light : Shadows.light,
              {
                backgroundColor:
                  colorScheme === 'dark'
                    ? Colors.dark.cardBackground
                    : Colors.light.lightBackground,
              },
            ]}
          >
            <ThemedText style={styles.infoText}>
              <ThemedText style={styles.infoBold}>Firebase Config:</ThemedText>
              {'\n'}
              Asegúrate de configurar tu proyecto Firebase en{' '}
              <ThemedText style={styles.infoCode}>
                config/firebase.ts
              </ThemedText>
            </ThemedText>

            <ThemedText style={[styles.infoText, { marginTop: 15 }]}>
              <ThemedText style={styles.infoBold}>Reglas Firestore:</ThemedText>
              {'\n'}
              Configura las reglas de seguridad en Firebase Console para
              permitir lectura/escritura a la colección{' '}
              <ThemedText style={styles.infoCode}>participants</ThemedText>
            </ThemedText>

            <ThemedText style={[styles.infoText, { marginTop: 15 }]}>
              <ThemedText style={styles.infoBold}>Sincronización:</ThemedText>
              {'\n'}
              Los datos se sincronizan en tiempo real entre todos los
              dispositivos conectados a Firebase.
            </ThemedText>
          </View>
        </View>

        {loading && (
          <View style={styles.loadingContainer}>
            <ActivityIndicator
              size="large"
              color={colorScheme === 'dark' ? Colors.dark.primary : Colors.light.primary}
            />
            <ThemedText style={styles.loadingText}>Procesando...</ThemedText>
          </View>
        )}
      </ScrollView>

      <TouchableOpacity
        style={[
          styles.backButton,
          Shadows.medium,
          {
            backgroundColor:
              colorScheme === 'dark' ? Colors.dark.primary : Colors.light.primary,
          },
        ]}
        onPress={() => router.back()}
        disabled={loading}
        activeOpacity={0.8}
      >
        <Text style={styles.backButtonText}>← Volver</Text>
      </TouchableOpacity>

      <Modal
        animationType="fade"
        transparent={true}
        visible={isInfoModalVisible}
        onRequestClose={() => {
          setInfoModalVisible(!isInfoModalVisible);
        }}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { backgroundColor: colorScheme === 'dark' ? Colors.dark.cardBackground : Colors.light.cardBackground }]}>
            <ThemedText style={styles.modalTitle}>Formato de importación</ThemedText>
            
            <ThemedText style={styles.modalText}><ThemedText style={{fontWeight: 'bold'}}>FORMATOS ACEPTADOS:</ThemedText>{'\n'}• Archivos CSV (.csv){'\n'}• Archivos Excel (.xlsx, .xls)</ThemedText>
            <ThemedText style={styles.modalText}><ThemedText style={{fontWeight: 'bold'}}>ESTRUCTURA REQUERIDA:</ThemedText>{'\n'}Columna A: DNI{'\n'}Columna B: Nombre{'\n'}Columna C: MasterClass (Si/No o 1/0){'\n'}Columna D: Cena (Si/No o 1/0)</ThemedText>
            <ThemedText style={styles.modalText}><ThemedText style={{fontWeight: 'bold'}}>EJEMPLO CSV:</ThemedText>{'\n'}DNI,Nombre,MasterClass,Cena{'\n'}12345678A,Juan Pérez,Si,Si{'\n'}87654321B,María García,No,Si</ThemedText>
            <ThemedText style={styles.modalText}><ThemedText style={{fontWeight: 'bold'}}>EJEMPLO EXCEL:</ThemedText>{'\n'}Primera fila (cabecera): DNI | Nombre | MasterClass | Cena{'\n'}Segunda fila: 12345678A | Juan Pérez | Si | Si</ThemedText>
            <ThemedText style={styles.modalText}><ThemedText style={{fontWeight: 'bold'}}>Nota:</ThemedText> Todos los participantes tienen acceso automático al aula magna.</ThemedText>

            <TouchableOpacity
              style={[styles.modalCloseButton, { backgroundColor: colorScheme === 'dark' ? Colors.dark.primary : Colors.light.primary }]}
              onPress={() => setInfoModalVisible(false)}
            >
              <Text style={styles.modalCloseButtonText}>Entendido</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  logoContainer: {
    alignItems: 'center',
    paddingTop: Spacing.md,
    paddingBottom: Spacing.sm,
  },
  logo: {
    width: 140,
    height: 48,
  },
  content: {
    padding: Spacing.lg,
  },
  section: {
    marginBottom: Spacing.xxl,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    marginBottom: Spacing.md,
  },
  actionCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: Spacing.lg,
    borderRadius: BorderRadius.md,
    marginBottom: Spacing.md,
  },
  actionIcon: {
    fontSize: 40,
    marginRight: Spacing.md,
  },
  actionTextContainer: {
    flex: 1,
  },
  actionTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 5,
  },
  actionDescription: {
    fontSize: 14,
    opacity: 0.7,
  },
  infoButton: {
    padding: Spacing.md,
    borderRadius: BorderRadius.full,
    alignItems: 'center',
  },
  infoButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: 'bold',
  },
  infoCard: {
    padding: Spacing.lg,
    borderRadius: BorderRadius.md,
  },
  infoText: {
    fontSize: 14,
    lineHeight: 22,
  },
  infoBold: {
    fontWeight: 'bold',
  },
  infoCode: {
    fontFamily: 'monospace',
    fontSize: 13,
    opacity: 0.8,
  },
  loadingContainer: {
    alignItems: 'center',
    padding: Spacing.xxl,
  },
  loadingText: {
    marginTop: Spacing.md,
    fontSize: 16,
  },
  backButton: {
    margin: Spacing.md,
    padding: Spacing.md,
    borderRadius: BorderRadius.full,
    alignItems: 'center',
  },
  backButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
  // Estilos del Modal
  modalOverlay: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
  },
  modalContent: {
    width: '90%',
    maxWidth: 500,
    padding: Spacing.lg,
    borderRadius: BorderRadius.lg,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    marginBottom: Spacing.lg,
    textAlign: 'center',
  },
  modalText: {
    fontSize: 14,
    marginBottom: Spacing.md,
    lineHeight: 20,
  },
  modalCloseButton: {
    marginTop: Spacing.lg,
    padding: Spacing.md,
    borderRadius: BorderRadius.full,
    alignItems: 'center',
  },
  modalCloseButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
});
