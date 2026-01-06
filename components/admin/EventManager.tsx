/**
 * EventManager Component
 *
 * Lists and manages events for the current organization.
 * Features:
 * - List all events with status indicators
 * - Create new events
 * - Edit existing events
 * - Access reset functionality
 * - View participant counts
 */

import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  FlatList,
  Alert,
  ActivityIndicator,
  RefreshControl,
} from 'react-native';
import { Colors, BorderRadius, Spacing, FontSizes, Shadows } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { useAuth } from '@/contexts/AuthContext';
import { useEvent } from '@/contexts/EventContext';
import { Event, EventStatus } from '@/types/event';
import {
  getEventsByOrganization,
  getAllEvents,
  deleteEvent,
} from '@/services/eventService';
import { getParticipantCount } from '@/services/participantService';

interface EventManagerProps {
  organizationId?: string;
  onCreateEvent: () => void;
  onEditEvent: (event: Event) => void;
  onResetEvent: (event: Event) => void;
  onAssignUsers: (event: Event) => void;
  onSelectEvent?: (event: Event) => void;
}

const STATUS_COLORS: Record<EventStatus, string> = {
  draft: '#9e9e9e',
  active: '#4caf50',
  completed: '#2196f3',
  archived: '#757575',
};

const STATUS_LABELS: Record<EventStatus, string> = {
  draft: 'Borrador',
  active: 'Activo',
  completed: 'Completado',
  archived: 'Archivado',
};

export function EventManager({
  organizationId,
  onCreateEvent,
  onEditEvent,
  onResetEvent,
  onAssignUsers,
  onSelectEvent,
}: EventManagerProps) {
  const colorScheme = useColorScheme();
  const { user, isSuperAdmin } = useAuth();
  const { currentEvent, setCurrentEvent } = useEvent();

  const [events, setEvents] = useState<Event[]>([]);
  const [participantCounts, setParticipantCounts] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const colors = Colors[colorScheme ?? 'light'];

  const loadEvents = useCallback(async () => {
    try {
      let eventList: Event[];

      if (isSuperAdmin()) {
        // Super admin sees all events
        eventList = await getAllEvents();
      } else if (organizationId) {
        // Other admins see only their organization's events
        eventList = await getEventsByOrganization(organizationId);
      } else if (user?.organizationId) {
        eventList = await getEventsByOrganization(user.organizationId);
      } else {
        eventList = [];
      }

      setEvents(eventList);

      // Load participant counts for each event
      const counts: Record<string, number> = {};
      for (const event of eventList) {
        try {
          counts[event.id] = await getParticipantCount(event.id);
        } catch {
          counts[event.id] = 0;
        }
      }
      setParticipantCounts(counts);
    } catch (error) {
      console.error('Error loading events:', error);
      Alert.alert('Error', 'No se pudieron cargar los eventos');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [organizationId, user?.organizationId, isSuperAdmin]);

  useEffect(() => {
    loadEvents();
  }, [loadEvents]);

  const handleRefresh = () => {
    setRefreshing(true);
    loadEvents();
  };

  const handleDeleteEvent = (event: Event) => {
    Alert.alert(
      'Eliminar Evento',
      `¿Estás seguro de que quieres eliminar "${event.name}"? Esta acción no se puede deshacer.`,
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Eliminar',
          style: 'destructive',
          onPress: async () => {
            try {
              await deleteEvent(event.id);
              if (currentEvent?.id === event.id) {
                setCurrentEvent(null);
              }
              loadEvents();
              Alert.alert('Éxito', 'Evento eliminado correctamente');
            } catch (error) {
              console.error('Error deleting event:', error);
              Alert.alert('Error', 'No se pudo eliminar el evento');
            }
          },
        },
      ]
    );
  };

  const handleSelectEvent = (event: Event) => {
    setCurrentEvent(event);
    onSelectEvent?.(event);
  };

  const formatDate = (timestamp: number) => {
    return new Date(timestamp).toLocaleDateString('es-ES', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    });
  };

  const renderEventItem = ({ item }: { item: Event }) => {
    const isSelected = currentEvent?.id === item.id;
    const participantCount = participantCounts[item.id] ?? 0;

    return (
      <TouchableOpacity
        style={[
          styles.eventCard,
          {
            backgroundColor: colors.cardBackground,
            borderColor: isSelected ? colors.primary : colors.border,
            borderWidth: isSelected ? 2 : 1,
          },
          Shadows.light,
        ]}
        onPress={() => handleSelectEvent(item)}
        activeOpacity={0.7}
      >
        {/* Header with status badge */}
        <View style={styles.eventHeader}>
          <View style={styles.eventTitleRow}>
            <Text style={[styles.eventName, { color: colors.text }]} numberOfLines={1}>
              {item.name}
            </Text>
            {isSelected && (
              <View style={[styles.selectedBadge, { backgroundColor: colors.primary }]}>
                <Text style={styles.selectedBadgeText}>Activo</Text>
              </View>
            )}
          </View>
          <View style={[styles.statusBadge, { backgroundColor: STATUS_COLORS[item.status] }]}>
            <Text style={styles.statusText}>{STATUS_LABELS[item.status]}</Text>
          </View>
        </View>

        {/* Event info */}
        <View style={styles.eventInfo}>
          <Text style={[styles.eventDate, { color: colors.text }]}>
            {formatDate(item.date)}
          </Text>
          {item.location && (
            <Text style={[styles.eventLocation, { color: colors.text }]} numberOfLines={1}>
              {item.location}
            </Text>
          )}
          <Text style={[styles.participantCount, { color: colors.primary }]}>
            {participantCount} participantes
          </Text>
        </View>

        {/* Action buttons */}
        <View style={styles.actionButtons}>
          <TouchableOpacity
            style={[styles.actionButton, { backgroundColor: colors.primary }]}
            onPress={() => onEditEvent(item)}
          >
            <Text style={styles.actionButtonText}>Editar</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.actionButton, { backgroundColor: colors.warning }]}
            onPress={() => onResetEvent(item)}
          >
            <Text style={styles.actionButtonText}>Reset</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.actionButton, { backgroundColor: colors.secondary }]}
            onPress={() => onAssignUsers(item)}
          >
            <Text style={styles.actionButtonText}>Usuarios</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.actionButton, { backgroundColor: colors.error }]}
            onPress={() => handleDeleteEvent(item)}
          >
            <Text style={styles.actionButtonText}>Eliminar</Text>
          </TouchableOpacity>
        </View>
      </TouchableOpacity>
    );
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={colors.primary} />
        <Text style={[styles.loadingText, { color: colors.text }]}>
          Cargando eventos...
        </Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={[styles.title, { color: colors.text }]}>Gestión de Eventos</Text>
        <TouchableOpacity
          style={[styles.createButton, { backgroundColor: colors.success }]}
          onPress={onCreateEvent}
        >
          <Text style={styles.createButtonText}>+ Crear Evento</Text>
        </TouchableOpacity>
      </View>

      {/* Events list */}
      {events.length === 0 ? (
        <View style={styles.emptyContainer}>
          <Text style={[styles.emptyText, { color: colors.text }]}>
            No hay eventos creados
          </Text>
          <Text style={[styles.emptySubtext, { color: colors.text }]}>
            Crea tu primer evento para comenzar
          </Text>
        </View>
      ) : (
        <FlatList
          data={events}
          renderItem={renderEventItem}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.listContent}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={handleRefresh}
              colors={[colors.primary]}
            />
          }
          showsVerticalScrollIndicator={false}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: Spacing.xl,
  },
  loadingText: {
    marginTop: Spacing.md,
    fontSize: FontSizes.md,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.lg,
  },
  title: {
    fontSize: FontSizes.xl,
    fontWeight: 'bold',
  },
  createButton: {
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.sm,
    borderRadius: BorderRadius.md,
  },
  createButtonText: {
    color: '#fff',
    fontWeight: '600',
    fontSize: FontSizes.sm,
  },
  listContent: {
    padding: Spacing.md,
    paddingBottom: Spacing.xxl,
  },
  eventCard: {
    borderRadius: BorderRadius.lg,
    padding: Spacing.md,
    marginBottom: Spacing.md,
  },
  eventHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: Spacing.sm,
  },
  eventTitleRow: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
  },
  eventName: {
    fontSize: FontSizes.lg,
    fontWeight: 'bold',
    flex: 1,
  },
  selectedBadge: {
    paddingHorizontal: Spacing.sm,
    paddingVertical: 2,
    borderRadius: BorderRadius.sm,
  },
  selectedBadgeText: {
    color: '#fff',
    fontSize: FontSizes.xs,
    fontWeight: '600',
  },
  statusBadge: {
    paddingHorizontal: Spacing.sm,
    paddingVertical: 4,
    borderRadius: BorderRadius.sm,
    marginLeft: Spacing.sm,
  },
  statusText: {
    color: '#fff',
    fontSize: FontSizes.xs,
    fontWeight: '600',
  },
  eventInfo: {
    marginBottom: Spacing.md,
  },
  eventDate: {
    fontSize: FontSizes.sm,
    marginBottom: 4,
  },
  eventLocation: {
    fontSize: FontSizes.sm,
    opacity: 0.7,
    marginBottom: 4,
  },
  participantCount: {
    fontSize: FontSizes.sm,
    fontWeight: '600',
  },
  actionButtons: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.xs,
  },
  actionButton: {
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.xs,
    borderRadius: BorderRadius.sm,
  },
  actionButtonText: {
    color: '#fff',
    fontSize: FontSizes.xs,
    fontWeight: '600',
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: Spacing.xl,
  },
  emptyText: {
    fontSize: FontSizes.lg,
    fontWeight: '600',
    marginBottom: Spacing.sm,
  },
  emptySubtext: {
    fontSize: FontSizes.md,
    opacity: 0.7,
    textAlign: 'center',
  },
});
