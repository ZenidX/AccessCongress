/**
 * UserEventAssignment Component
 *
 * Allows admins to assign/unassign users (admins and controllers) to events.
 * Features:
 * - List all admins and controllers in the organization
 * - Toggle event assignment for each user
 * - Show current assignments grouped by role
 */

import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
  Switch,
  SectionList,
} from 'react-native';
import { Colors, BorderRadius, Spacing, FontSizes } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { useAuth } from '@/contexts/AuthContext';
import { Event } from '@/types/event';
import { User, UserRole } from '@/types/user';
import {
  getUsersByOrganization,
  addEventToUser,
  removeEventFromUser,
  getUsersAssignedToEvent,
} from '@/services/userService';

// Role labels and colors
const ROLE_CONFIG: Record<UserRole, { label: string; color: string; icon: string }> = {
  super_admin: { label: 'Super Admin', color: '#9c27b0', icon: '👑' },
  admin_responsable: { label: 'Admin Responsable', color: '#2196f3', icon: '🏢' },
  admin: { label: 'Administrador', color: '#ff9800', icon: '👔' },
  controlador: { label: 'Controlador', color: '#4caf50', icon: '📱' },
};

interface UserEventAssignmentProps {
  event: Event;
  onClose: () => void;
  onAssignmentChange?: () => void;
}

// Section data type for SectionList
interface UserSection {
  title: string;
  role: UserRole;
  icon: string;
  color: string;
  data: User[];
}

export function UserEventAssignment({
  event,
  onClose,
  onAssignmentChange,
}: UserEventAssignmentProps) {
  const colorScheme = useColorScheme();
  const { user: currentUser, isSuperAdmin } = useAuth();
  const colors = Colors[colorScheme ?? 'light'];

  const [admins, setAdmins] = useState<User[]>([]);
  const [controllers, setControllers] = useState<User[]>([]);
  const [assignedUserIds, setAssignedUserIds] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState<string | null>(null);

  const loadData = useCallback(async () => {
    try {
      setLoading(true);

      // Get all users from the organization
      const orgId = isSuperAdmin() ? event.organizationId : currentUser?.organizationId;
      if (!orgId) {
        setAdmins([]);
        setControllers([]);
        return;
      }

      const allUsers = await getUsersByOrganization(orgId);

      // Filter by role (exclude admin_responsable - they have full access anyway)
      const adminList = allUsers.filter((u) => u.role === 'admin');
      const controllerList = allUsers.filter((u) => u.role === 'controlador');

      // Get users already assigned to this event
      const assignedUsers = await getUsersAssignedToEvent(event.id);
      const assignedIds = new Set(assignedUsers.map((u) => u.uid));

      setAdmins(adminList);
      setControllers(controllerList);
      setAssignedUserIds(assignedIds);
    } catch (error) {
      console.error('Error loading users:', error);
      Alert.alert('Error', 'No se pudieron cargar los usuarios');
    } finally {
      setLoading(false);
    }
  }, [event.id, event.organizationId, currentUser?.organizationId, isSuperAdmin]);

  // Prepare sections for SectionList
  const sections: UserSection[] = [
    ...(admins.length > 0
      ? [{
          title: ROLE_CONFIG.admin.label + 's',
          role: 'admin' as UserRole,
          icon: ROLE_CONFIG.admin.icon,
          color: ROLE_CONFIG.admin.color,
          data: admins,
        }]
      : []),
    ...(controllers.length > 0
      ? [{
          title: ROLE_CONFIG.controlador.label + 'es',
          role: 'controlador' as UserRole,
          icon: ROLE_CONFIG.controlador.icon,
          color: ROLE_CONFIG.controlador.color,
          data: controllers,
        }]
      : []),
  ];

  const totalUsers = admins.length + controllers.length;

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

  const renderSectionHeader = ({ section }: { section: UserSection }) => (
    <View style={[styles.sectionHeader, { backgroundColor: colors.background }]}>
      <Text style={styles.sectionIcon}>{section.icon}</Text>
      <Text style={[styles.sectionTitle, { color: section.color }]}>
        {section.title}
      </Text>
      <View style={[styles.sectionBadge, { backgroundColor: section.color }]}>
        <Text style={styles.sectionBadgeText}>{section.data.length}</Text>
      </View>
    </View>
  );

  if (loading) {
    return (
      <View style={[styles.container, { backgroundColor: colors.background }]}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={[styles.loadingText, { color: colors.text }]}>
            Cargando usuarios...
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
            Usuarios del Evento
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
          <Text style={[styles.statValue, { color: ROLE_CONFIG.admin.color }]}>
            {admins.length}
          </Text>
          <Text style={[styles.statLabel, { color: colors.text }]}>
            {ROLE_CONFIG.admin.icon} Admins
          </Text>
        </View>
        <View style={styles.statDivider} />
        <View style={styles.statItem}>
          <Text style={[styles.statValue, { color: ROLE_CONFIG.controlador.color }]}>
            {controllers.length}
          </Text>
          <Text style={[styles.statLabel, { color: colors.text }]}>
            {ROLE_CONFIG.controlador.icon} Controladores
          </Text>
        </View>
        <View style={styles.statDivider} />
        <View style={styles.statItem}>
          <Text style={[styles.statValue, { color: colors.success }]}>
            {assignedUserIds.size}
          </Text>
          <Text style={[styles.statLabel, { color: colors.text }]}>
            ✓ Asignados
          </Text>
        </View>
      </View>

      {/* Users list */}
      {totalUsers === 0 ? (
        <View style={styles.emptyContainer}>
          <Text style={[styles.emptyText, { color: colors.text }]}>
            No hay administradores ni controladores
          </Text>
          <Text style={[styles.emptySubtext, { color: colors.text }]}>
            Crea usuarios primero desde la sección de gestión de usuarios
          </Text>
        </View>
      ) : (
        <SectionList
          sections={sections}
          renderItem={renderController}
          renderSectionHeader={renderSectionHeader}
          keyExtractor={(item) => item.uid}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
          stickySectionHeadersEnabled={false}
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
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.xs,
    marginTop: Spacing.md,
    marginBottom: Spacing.xs,
  },
  sectionIcon: {
    fontSize: FontSizes.lg,
    marginRight: Spacing.xs,
  },
  sectionTitle: {
    fontSize: FontSizes.md,
    fontWeight: '700',
    flex: 1,
  },
  sectionBadge: {
    paddingHorizontal: Spacing.sm,
    paddingVertical: 2,
    borderRadius: BorderRadius.full,
    minWidth: 24,
    alignItems: 'center',
  },
  sectionBadgeText: {
    color: '#fff',
    fontSize: FontSizes.xs,
    fontWeight: '700',
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
