/**
 * Pantalla de administración
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
} from 'react-native';
import * as DocumentPicker from 'expo-document-picker';
import { useRouter } from 'expo-router';
import { ThemedView } from '@/components/themed-view';
import { ThemedText } from '@/components/themed-text';
import {
  importParticipantsFromCSV,
  resetAllParticipantStates,
} from '@/services/participantService';
import { Colors } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';

export default function AdminScreen() {
  const router = useRouter();
  const colorScheme = useColorScheme();
  const [loading, setLoading] = useState(false);

  const handleImportCSV = async () => {
    try {
      setLoading(true);

      // Seleccionar archivo CSV
      const result = await DocumentPicker.getDocumentAsync({
        type: 'text/csv',
        copyToCacheDirectory: true,
      });

      if (result.canceled) {
        setLoading(false);
        return;
      }

      const file = result.assets[0];

      // Leer contenido del archivo
      const response = await fetch(file.uri);
      const csvData = await response.text();

      // Importar participantes
      const count = await importParticipantsFromCSV(csvData);

      setLoading(false);

      Alert.alert(
        'Importación exitosa',
        `Se importaron ${count} participantes correctamente.`,
        [{ text: 'OK' }]
      );
    } catch (error) {
      setLoading(false);
      console.error('Error importando CSV:', error);
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
    Alert.alert(
      'Formato del CSV',
      'El archivo CSV debe tener el siguiente formato:\n\n' +
        'DNI,Nombre,MasterClass,Cena\n' +
        '12345678A,Juan Pérez,Si,Si\n' +
        '87654321B,María García,No,Si\n\n' +
        'Columnas:\n' +
        '• DNI: Documento de identidad\n' +
        '• Nombre: Nombre completo\n' +
        '• MasterClass: Si/No o 1/0\n' +
        '• Cena: Si/No o 1/0\n\n' +
        'Nota: Todos los participantes tienen acceso automático al aula magna.',
      [{ text: 'Entendido' }]
    );
  };

  return (
    <ThemedView style={styles.container}>
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.section}>
          <ThemedText style={styles.sectionTitle}>
            📊 Gestión de Participantes
          </ThemedText>

          <TouchableOpacity
            style={[
              styles.actionCard,
              {
                backgroundColor:
                  colorScheme === 'dark'
                    ? 'rgba(255,255,255,0.1)'
                    : 'rgba(0,0,0,0.05)',
              },
            ]}
            onPress={handleImportCSV}
            disabled={loading}
          >
            <Text style={styles.actionIcon}>📁</Text>
            <View style={styles.actionTextContainer}>
              <ThemedText style={styles.actionTitle}>
                Importar participantes desde CSV
              </ThemedText>
              <ThemedText style={styles.actionDescription}>
                Cargar la lista de participantes inscritos
              </ThemedText>
            </View>
          </TouchableOpacity>

          <TouchableOpacity
            style={[
              styles.infoButton,
              {
                backgroundColor:
                  colorScheme === 'dark' ? Colors.dark.tint : Colors.light.tint,
              },
            ]}
            onPress={showCSVFormatInfo}
          >
            <Text style={styles.infoButtonText}>ℹ️ Ver formato del CSV</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.section}>
          <ThemedText style={styles.sectionTitle}>⚙️ Herramientas</ThemedText>

          <TouchableOpacity
            style={[
              styles.actionCard,
              {
                backgroundColor:
                  colorScheme === 'dark'
                    ? 'rgba(255,255,255,0.1)'
                    : 'rgba(0,0,0,0.05)',
              },
            ]}
            onPress={handleResetStates}
            disabled={loading}
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
              {
                backgroundColor:
                  colorScheme === 'dark'
                    ? 'rgba(255,255,255,0.1)'
                    : 'rgba(0,0,0,0.05)',
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
            <ActivityIndicator size="large" color={Colors.light.tint} />
            <ThemedText style={styles.loadingText}>Procesando...</ThemedText>
          </View>
        )}
      </ScrollView>

      <TouchableOpacity
        style={[
          styles.backButton,
          {
            backgroundColor:
              colorScheme === 'dark' ? Colors.dark.tint : Colors.light.tint,
          },
        ]}
        onPress={() => router.back()}
        disabled={loading}
      >
        <Text style={styles.backButtonText}>← Volver</Text>
      </TouchableOpacity>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  content: {
    padding: 20,
  },
  section: {
    marginBottom: 30,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    marginBottom: 15,
  },
  actionCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 20,
    borderRadius: 12,
    marginBottom: 15,
  },
  actionIcon: {
    fontSize: 40,
    marginRight: 15,
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
    padding: 15,
    borderRadius: 10,
    alignItems: 'center',
  },
  infoButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: 'bold',
  },
  infoCard: {
    padding: 20,
    borderRadius: 12,
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
    padding: 30,
  },
  loadingText: {
    marginTop: 15,
    fontSize: 16,
  },
  backButton: {
    margin: 15,
    padding: 15,
    borderRadius: 10,
    alignItems: 'center',
  },
  backButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
});
