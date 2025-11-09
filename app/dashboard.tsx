/**
 * Dashboard en tiempo real de asistentes
 */

import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  FlatList,
  RefreshControl,
} from 'react-native';
import { useRouter } from 'expo-router';
import { ThemedView } from '@/components/themed-view';
import { ThemedText } from '@/components/themed-text';
import {
  subscribeToLocationParticipants,
  subscribeToRegisteredParticipants,
} from '@/services/participantService';
import { Participant } from '@/types/participant';
import { Colors } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';

type Location = 'registrados' | 'aula_magna' | 'master_class' | 'cena';

interface LocationInfo {
  key: Location;
  titulo: string;
  icono: string;
  color: string;
}

const LOCATIONS: LocationInfo[] = [
  {
    key: 'registrados',
    titulo: 'Registrados',
    icono: '📝',
    color: '#4CAF50',
  },
  {
    key: 'aula_magna',
    titulo: 'Aula Magna',
    icono: '🏛️',
    color: '#2196F3',
  },
  {
    key: 'master_class',
    titulo: 'Master Class',
    icono: '🎓',
    color: '#FF9800',
  },
  {
    key: 'cena',
    titulo: 'Cena',
    icono: '🍽️',
    color: '#9C27B0',
  },
];

export default function DashboardScreen() {
  const router = useRouter();
  const colorScheme = useColorScheme();
  const [selectedLocation, setSelectedLocation] = useState<Location>('aula_magna');
  const [participants, setParticipants] = useState<Participant[]>([]);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    let unsubscribe: (() => void) | undefined;

    if (selectedLocation === 'registrados') {
      unsubscribe = subscribeToRegisteredParticipants((data) => {
        setParticipants(data);
        setRefreshing(false);
      });
    } else {
      unsubscribe = subscribeToLocationParticipants(selectedLocation, (data) => {
        setParticipants(data);
        setRefreshing(false);
      });
    }

    return () => {
      if (unsubscribe) unsubscribe();
    };
  }, [selectedLocation]);

  const handleRefresh = () => {
    setRefreshing(true);
    // La suscripción en tiempo real se encargará de actualizar
  };

  const renderParticipant = ({ item }: { item: Participant }) => (
    <View
      style={[
        styles.participantCard,
        {
          backgroundColor:
            colorScheme === 'dark'
              ? 'rgba(255,255,255,0.1)'
              : 'rgba(0,0,0,0.05)',
        },
      ]}
    >
      <View style={styles.participantInfo}>
        <ThemedText style={styles.participantName}>{item.nombre}</ThemedText>
        <ThemedText style={styles.participantDni}>DNI: {item.dni}</ThemedText>
      </View>

      <View style={styles.participantBadges}>
        {item.permisos.master_class && (
          <View style={[styles.badge, { backgroundColor: '#FF9800' }]}>
            <Text style={styles.badgeText}>MC</Text>
          </View>
        )}
        {item.permisos.cena && (
          <View style={[styles.badge, { backgroundColor: '#9C27B0' }]}>
            <Text style={styles.badgeText}>Cena</Text>
          </View>
        )}
      </View>
    </View>
  );

  const selectedLocationInfo = LOCATIONS.find((loc) => loc.key === selectedLocation);

  return (
    <ThemedView style={styles.container}>
      {/* Selector de ubicación */}
      <View style={styles.locationSelector}>
        {LOCATIONS.map((location) => (
          <TouchableOpacity
            key={location.key}
            style={[
              styles.locationButton,
              {
                backgroundColor:
                  selectedLocation === location.key
                    ? location.color
                    : colorScheme === 'dark'
                    ? 'rgba(255,255,255,0.1)'
                    : 'rgba(0,0,0,0.1)',
              },
            ]}
            onPress={() => setSelectedLocation(location.key)}
          >
            <Text style={styles.locationIcon}>{location.icono}</Text>
            <Text
              style={[
                styles.locationText,
                {
                  color:
                    selectedLocation === location.key
                      ? '#fff'
                      : colorScheme === 'dark'
                      ? '#fff'
                      : '#000',
                },
              ]}
            >
              {location.titulo}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Contador */}
      <View
        style={[
          styles.counterContainer,
          {
            backgroundColor: selectedLocationInfo?.color,
          },
        ]}
      >
        <Text style={styles.counterNumber}>{participants.length}</Text>
        <Text style={styles.counterLabel}>
          {participants.length === 1 ? 'Asistente' : 'Asistentes'}
        </Text>
      </View>

      {/* Lista de participantes */}
      <View style={styles.listContainer}>
        <ThemedText style={styles.listTitle}>
          {selectedLocationInfo?.icono} {selectedLocationInfo?.titulo}
        </ThemedText>

        {participants.length === 0 ? (
          <View style={styles.emptyContainer}>
            <Text style={styles.emptyIcon}>📭</Text>
            <ThemedText style={styles.emptyText}>
              No hay asistentes en esta ubicación
            </ThemedText>
          </View>
        ) : (
          <FlatList
            data={participants}
            renderItem={renderParticipant}
            keyExtractor={(item) => item.dni}
            contentContainerStyle={styles.listContent}
            refreshControl={
              <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} />
            }
          />
        )}
      </View>

      {/* Botón volver */}
      <TouchableOpacity
        style={[
          styles.backButton,
          {
            backgroundColor:
              colorScheme === 'dark' ? Colors.dark.tint : Colors.light.tint,
          },
        ]}
        onPress={() => router.back()}
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
  locationSelector: {
    flexDirection: 'row',
    padding: 10,
    gap: 8,
    flexWrap: 'wrap',
  },
  locationButton: {
    flex: 1,
    minWidth: '45%',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 12,
    borderRadius: 10,
    gap: 8,
  },
  locationIcon: {
    fontSize: 20,
  },
  locationText: {
    fontSize: 14,
    fontWeight: 'bold',
  },
  counterContainer: {
    padding: 20,
    margin: 15,
    borderRadius: 15,
    alignItems: 'center',
  },
  counterNumber: {
    fontSize: 48,
    fontWeight: 'bold',
    color: '#fff',
  },
  counterLabel: {
    fontSize: 18,
    color: '#fff',
    marginTop: 5,
  },
  listContainer: {
    flex: 1,
    paddingHorizontal: 15,
  },
  listTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    marginBottom: 15,
  },
  listContent: {
    paddingBottom: 20,
  },
  participantCard: {
    flexDirection: 'row',
    padding: 15,
    borderRadius: 10,
    marginBottom: 10,
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  participantInfo: {
    flex: 1,
  },
  participantName: {
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 5,
  },
  participantDni: {
    fontSize: 14,
    opacity: 0.7,
  },
  participantBadges: {
    flexDirection: 'row',
    gap: 5,
  },
  badge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  badgeText: {
    color: '#fff',
    fontSize: 11,
    fontWeight: 'bold',
  },
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 60,
  },
  emptyIcon: {
    fontSize: 60,
    marginBottom: 15,
  },
  emptyText: {
    fontSize: 16,
    opacity: 0.6,
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
