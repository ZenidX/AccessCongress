/**
 * Pantalla principal - Selección de modo de control
 */

import React from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  Alert,
} from 'react-native';
import { useRouter } from 'expo-router';
import { ThemedView } from '@/components/themed-view';
import { ThemedText } from '@/components/themed-text';
import { useApp } from '@/contexts/AppContext';
import { AccessMode, AccessDirection } from '@/types/participant';
import { Colors } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';

interface ModeOption {
  modo: AccessMode;
  titulo: string;
  descripcion: string;
  icono: string;
  color: string;
}

const MODOS: ModeOption[] = [
  {
    modo: 'registro',
    titulo: 'Registro Inicial',
    descripcion: 'Registro de participantes al inicio del congreso',
    icono: '📝',
    color: '#4CAF50',
  },
  {
    modo: 'aula_magna',
    titulo: 'Aula Magna',
    descripcion: 'Control de acceso al aula magna',
    icono: '🏛️',
    color: '#2196F3',
  },
  {
    modo: 'master_class',
    titulo: 'Master Class',
    descripcion: 'Control de acceso a la master class',
    icono: '🎓',
    color: '#FF9800',
  },
  {
    modo: 'cena',
    titulo: 'Cena de Clausura',
    descripcion: 'Control de acceso a la cena',
    icono: '🍽️',
    color: '#9C27B0',
  },
];

export default function HomeScreen() {
  const router = useRouter();
  const colorScheme = useColorScheme();
  const { setModo, setDireccion, direccion } = useApp();

  const handleSelectMode = (modo: AccessMode) => {
    setModo(modo);

    // El modo registro no tiene entrada/salida
    if (modo === 'registro') {
      setDireccion('entrada');
      router.push('/scanner');
    } else {
      // Mostrar selector de entrada/salida
      Alert.alert(
        'Tipo de acceso',
        'Selecciona el tipo de control:',
        [
          {
            text: 'Entrada',
            onPress: () => {
              setDireccion('entrada');
              router.push('/scanner');
            },
          },
          {
            text: 'Salida',
            onPress: () => {
              setDireccion('salida');
              router.push('/scanner');
            },
          },
          {
            text: 'Cancelar',
            style: 'cancel',
          },
        ]
      );
    }
  };

  const handleGoToDashboard = () => {
    router.push('/dashboard');
  };

  const handleGoToAdmin = () => {
    router.push('/admin');
  };

  return (
    <ThemedView style={styles.container}>
      <View style={styles.header}>
        <ThemedText style={styles.title}>Control de Acceso</ThemedText>
        <ThemedText style={styles.subtitle}>Congreso 2025</ThemedText>
      </View>

      <ScrollView style={styles.content} contentContainerStyle={styles.contentContainer}>
        <ThemedText style={styles.sectionTitle}>Selecciona el modo de control:</ThemedText>

        {MODOS.map((modoOption) => (
          <TouchableOpacity
            key={modoOption.modo}
            style={[
              styles.modeCard,
              {
                backgroundColor:
                  colorScheme === 'dark'
                    ? 'rgba(255,255,255,0.1)'
                    : 'rgba(0,0,0,0.05)',
                borderLeftColor: modoOption.color,
              },
            ]}
            onPress={() => handleSelectMode(modoOption.modo)}
            activeOpacity={0.7}
          >
            <View style={styles.modeIconContainer}>
              <Text style={styles.modeIcon}>{modoOption.icono}</Text>
            </View>
            <View style={styles.modeTextContainer}>
              <ThemedText style={styles.modeTitle}>{modoOption.titulo}</ThemedText>
              <ThemedText style={styles.modeDescription}>
                {modoOption.descripcion}
              </ThemedText>
            </View>
            <Text style={styles.chevron}>›</Text>
          </TouchableOpacity>
        ))}

        <View style={styles.actionButtons}>
          <TouchableOpacity
            style={[
              styles.actionButton,
              {
                backgroundColor:
                  colorScheme === 'dark' ? Colors.dark.tint : Colors.light.tint,
              },
            ]}
            onPress={handleGoToDashboard}
          >
            <Text style={styles.actionButtonText}>📊 Ver Dashboard</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[
              styles.actionButton,
              {
                backgroundColor: '#666',
              },
            ]}
            onPress={handleGoToAdmin}
          >
            <Text style={styles.actionButtonText}>⚙️ Administración</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    paddingTop: 60,
    paddingBottom: 20,
    paddingHorizontal: 20,
    alignItems: 'center',
  },
  title: {
    fontSize: 32,
    fontWeight: 'bold',
    marginBottom: 5,
  },
  subtitle: {
    fontSize: 18,
    opacity: 0.7,
  },
  content: {
    flex: 1,
  },
  contentContainer: {
    padding: 20,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 15,
  },
  modeCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 20,
    borderRadius: 12,
    marginBottom: 15,
    borderLeftWidth: 5,
  },
  modeIconContainer: {
    marginRight: 15,
  },
  modeIcon: {
    fontSize: 40,
  },
  modeTextContainer: {
    flex: 1,
  },
  modeTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 5,
  },
  modeDescription: {
    fontSize: 14,
    opacity: 0.7,
  },
  chevron: {
    fontSize: 30,
    opacity: 0.3,
    marginLeft: 10,
  },
  actionButtons: {
    marginTop: 20,
    gap: 10,
  },
  actionButton: {
    padding: 18,
    borderRadius: 12,
    alignItems: 'center',
  },
  actionButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
});
