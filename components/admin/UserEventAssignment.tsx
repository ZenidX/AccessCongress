/**
 * UserEventAssignment Component
 *
 * Allows admins to assign/unassign controllers to events.
 * Features:
 * - List all controllers in the organization
 * - Toggle event assignment for each controller
 * - Show current assignments
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
  Switch,
} from 'react-native';
import { Colors, BorderRadius, Spacing, FontSizes, Shadows } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { useAuth } from '@/contexts/AuthContext';
import { Event } from '@/types/event';
import { User } from '@/types/user';
import {
  getControllersByOrganization,
  getUsersByOrganization,
  addEventToUser,
  removeEventFromUser,
  getUsersAssignedToEvent,
} from '@/services/userService';

interface UserEventAssignmentProps {
  event: Event;
  onClose: () => void;
  onAssignmentChange?: () => void;
}

export function UserEventAssignment({
  event,
  onClose,
  onAssignmentChange,
}: UserEventAssignmentProps) {
  const colorScheme = useColorScheme();
  const { user: currentUser, isSuperAdmin } = useAuth();
  const colors = Colors[colorScheme ?? 'light'];

  const [controllers, setControllers] = useState<User[]>([]);
  const [assignedUserIds, setAssignedUserIds] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState<string | null>(null);

  const loadData = useCallback(async () => {
    try {
      setLoading(true);

      // Get controllers for this organization
      let controllerList: User[];
      if (isSuperAdmin()) {
        // Super admin can see all users from the event's organization
        controllerList = await getControllersByOrganization(event.organizationId);
      } else if (currentUser?.organizationId) {
        controllerList = await getControllersByOrganization(currentUser.organizationId);
      } else {
        controllerList = [];
      }

      // Get users already assigned to this event
      const assignedUsers = await getUsersAssignedToEvent(event.id);
      const assignedIds = new Set(assignedUsers.map((u) => u.uid));

      setControllers(controllerList);
      setAssignedUserIds(assignedIds);
    } catch (error) {
      console.error('Error loading users:', error);
      Alert.alert('Error', 'No se pudieron cargar los usuarios');
    } finally {
      setLoading(false);
    }
  }, [event.id, event.organizationId, currentUser?.organizationId, isSuperAdmin]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleToggleAssignment = async (controller: User) => {
    const isCurrentlyAssigned = assignedUserIds.has(controller.uid);

    setUpdating(controller.uid);

    try {
      if (isCurrentlyAssigned) {
        await removeEventFromUser(controller.uid, event.id);
        setAssignedUserIds((prev) => {
          const newSet = new Set(prev);
          newSet.delete(controller.uid);
          return newSet;
        });
      } else {
        await addEventToUser(controller.uid, event.id);
        setAssignedUserIds((prev) => new Set(prev).add(controller.uid));
      }

      onAssignmentChange?.();
    } catch (error) {
      console.error('Error updating assignment:', error);
      Alert.alert('Error', 'No se pudo actualizar la asignación');
    } finally {
      setUpdating(null);
    }
  };

  const renderController = ({ item }: { item: User }) => {
    const isAssigned = assignedUserIds.has(item.uid);
    const isUpdating = updating === item.uid;

    return (
      <View
        style={[
          styles.controllerCard,
          {
            backgroundColor: colors.cardBackground,
            borderColor: isAssigned ? colors.success : colors.border,
            borderWidth: isAssigned ? 2 : 1,
          },
        ]}
      >
        <View style={styles.controllerInfo}>
          <Text style={[styles.controllerName, { color: colors.text }]}>
            {item.username || item.email}
          </Text>
          <Text style={[styles.controllerEmail, { color: colors.text }]}>
            {item.email}
          </Text>
          {isAssigned && (
            <View style={[styles.assignedBadge, { backgroundColor: colors.success }]}>
              <Text style={styles.assignedBadgeText}>Asignado</Text>
            </View>
          )}
        </View>

        <View style={styles.controllerAction}>
          {isUpdating ? (
            <ActivityIndicator size="small" color={colors.primary} />
          ) : (
            <Switch
              value={isAssigned}
              onValueChange={() => handleToggleAssignment(item)}
              trackColor={{ false: colors.border, true: colors.success }}
              thumbColor="#fff"
            />
          )}
        </View>
      </View>
    );
  };

  if (loading) {
    return (
      <View style={[styles.container, { backgroundColor: colors.background }]}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={[styles.loadingText, { color: colors.text }]}>
            Cargando controladores...
          </Text>
        </View>
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.headerText}>
          <Text style={[styles.title, { color: colors.text }]}>
            Asignar Controladores
          </Text>
          <Text style={[styles.eventName, { color: colors.primary }]}>
            {event.name}
          </Text>
        </View>
        <TouchableOpacity
          style={[styles.closeButton, { backgroundColor: colors.primary }]}
          onPress={onClose}
        >
          <Text style={styles.closeButtonText}>Cerrar</Text>
        </TouchableOpacity>
      </View>

      {/* Stats */}
      <View style={[styles.stats, { backgroundColor: colors.cardBackground }]}>
        <View style={styles.statItem}>
          <Text style={[styles.statValue, { color: colors.primary }]}>
            {controllers.length}
          </Text>
          <Text style={[styles.statLabel, { color: colors.text }]}>
            Controladores
          </Text>
        </View>
        <View style={styles.statDivider} />
        <View style={styles.statItem}>
          <Text style={[styles.statValue, { color: colors.success }]}>
            {assignedUserIds.size}
          </Text>
          <Text style={[styles.statLabel, { color: colors.text }]}>
            Asignados
          </Text>
        </View>
      </View>

      {/* Controllers list */}
      {controllers.length === 0 ? (
        <View style={styles.emptyContainer}>
          <Text style={[styles.emptyText, { color: colors.text }]}>
            No hay controladores en esta organización
          </Text>
          <Text style={[styles.emptySubtext, { color: colors.text }]}>
            Crea controladores primero desde la sección de usuarios
          </Text>
        </View>
      ) : (
        <FlatList
          data={controllers}
          renderItem={renderController}
          keyExtractor={(item) => item.uid}
          contentContainerStyle={styles.listContent}
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
  },
  loadingText: {
    marginTop: Spacing.md,
    fontSize: FontSizes.md,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: Spacing.lg,
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
  },
  headerText: {
    flex: 1,
  },
  title: {
    fontSize: FontSizes.xl,
    fontWeight: 'bold',
    marginBottom: 4,
  },
  eventName: {
    fontSize: FontSizes.md,
    fontWeight: '600',
  },
  closeButton: {
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.sm,
    borderRadius: BorderRadius.md,
  },
  closeButtonText: {
    color: '#fff',
    fontWeight: '600',
    fontSize: FontSizes.sm,
  },
  stats: {
    flexDirection: 'row',
    margin: Spacing.md,
    padding: Spacing.lg,
    borderRadius: BorderRadius.lg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  statItem: {
    alignItems: 'center',
    flex: 1,
  },
  statValue: {
    fontSize: FontSizes.xxl,
    fontWeight: 'bold',
  },
  statLabel: {
    fontSize: FontSizes.sm,
    opacity: 0.7,
  },
  statDivider: {
    width: 1,
    height: 40,
    backgroundColor: '#e0e0e0',
    marginHorizontal: Spacing.lg,
  },
  listContent: {
    padding: Spacing.md,
    paddingBottom: Spacing.xxl,
  },
  controllerCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: Spacing.md,
    borderRadius: BorderRadius.lg,
    marginBottom: Spacing.sm,
  },
  controllerInfo: {
    flex: 1,
  },
  controllerName: {
    fontSize: FontSizes.md,
    fontWeight: '600',
    marginBottom: 2,
  },
  controllerEmail: {
    fontSize: FontSizes.sm,
    opacity: 0.7,
  },
  assignedBadge: {
    alignSelf: 'flex-start',
    paddingHorizontal: Spacing.sm,
    paddingVertical: 2,
    borderRadius: BorderRadius.sm,
    marginTop: Spacing.xs,
  },
  assignedBadgeText: {
    color: '#fff',
    fontSize: FontSizes.xs,
    fontWeight: '600',
  },
  controllerAction: {
    marginLeft: Spacing.md,
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
