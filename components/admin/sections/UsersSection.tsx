/**
 * UsersSection Component
 *
 * Manages users with hierarchical role-based access:
 * - super_admin: sees all admin_responsables, can manage all users
 * - admin_responsable: sees admins and controllers in their org
 * - admin: sees only controllers in their org
 */

import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Alert,
  ScrollView,
  ActivityIndicator,
  Modal,
  TextInput,
} from 'react-native';
import { ThemedText } from '@/components/themed/themed-text';
import { RoleBadge } from '@/components/data-display/RoleBadge';
import {
  getAllUsers,
  getUsersByOrganization,
  createUser,
  updateUserRole,
  deleteUserFromFirestore,
  updateUserOrganization,
  assignEventsToUser,
} from '@/services/userService';
import { getEventsByOrganization } from '@/services/eventService';
import { User, UserRole, canManageRole, getCreatableRoles } from '@/types/user';
import { Event } from '@/types/event';
import { Colors, BorderRadius, Spacing, Shadows, FontSizes } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { useAuth } from '@/contexts/AuthContext';

// Role labels for UI
const ROLE_LABELS: Record<UserRole, string> = {
  'super_admin': 'Super Admin',
  'admin_responsable': 'Admin Responsable',
  'admin': 'Administrador',
  'controlador': 'Controlador',
};

// Role colors
const ROLE_COLORS: Record<UserRole, string> = {
  'super_admin': '#9b51e0',
  'admin_responsable': '#00a4e1',
  'admin': '#ffaf00',
  'controlador': '#4caf50',
};

export function UsersSection() {
  const colorScheme = useColorScheme();
  const { user, isSuperAdmin } = useAuth();

  // State
  const [loading, setLoading] = useState(false);
  const [adminResponsables, setAdminResponsables] = useState<User[]>([]);
  const [selectedAdminResponsable, setSelectedAdminResponsable] = useState<User | null>(null);
  const [users, setUsers] = useState<User[]>([]);

  // Create user modal state
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [creatingUserType, setCreatingUserType] = useState<'admin_responsable' | 'admin' | 'controlador'>('controlador');
  const [newUserEmail, setNewUserEmail] = useState('');
  const [newUserPassword, setNewUserPassword] = useState('');
  const [newUserUsername, setNewUserUsername] = useState('');
  const [newUserRole, setNewUserRole] = useState<UserRole>('controlador');
  const [adminPassword, setAdminPassword] = useState('');

  // Edit role modal state
  const [showEditRoleModal, setShowEditRoleModal] = useState(false);
  const [selectedUser, setSelectedUser] = useState<User | null>(null);

  // Assign events modal state
  const [showAssignEventsModal, setShowAssignEventsModal] = useState(false);
  const [selectedControlador, setSelectedControlador] = useState<User | null>(null);
  const [availableEvents, setAvailableEvents] = useState<Event[]>([]);
  const [selectedEventIds, setSelectedEventIds] = useState<string[]>([]);
  const [loadingEvents, setLoadingEvents] = useState(false);

  // Load admin responsables for super_admin
  const loadAdminResponsables = useCallback(async () => {
    if (!user || !isSuperAdmin()) return;

    try {
      const allUsers = await getAllUsers();
      const adminsResp = allUsers.filter(u => u.role === 'admin_responsable');
      setAdminResponsables(adminsResp);
    } catch (error) {
      console.error('Error loading admin responsables:', error);
    }
  }, [user, isSuperAdmin]);

  // Load users based on organization
  const loadUsers = useCallback(async () => {
    if (!user) return;

    try {
      let usersList: User[] = [];

      if (isSuperAdmin()) {
        // For admin_responsable, their UID IS their organizationId (fallback for backwards compatibility)
        const orgId = selectedAdminResponsable?.organizationId || selectedAdminResponsable?.uid;
        if (orgId) {
          const orgUsers = await getUsersByOrganization(orgId);
          usersList = orgUsers.filter(u => u.role === 'admin' || u.role === 'controlador');
        }
      } else if (user.role === 'admin_responsable') {
        if (user.organizationId) {
          const orgUsers = await getUsersByOrganization(user.organizationId);
          usersList = orgUsers.filter(u => u.role === 'admin' || u.role === 'controlador');
        }
      } else if (user.role === 'admin') {
        if (user.organizationId) {
          const orgUsers = await getUsersByOrganization(user.organizationId);
          usersList = orgUsers.filter(u => u.role === 'controlador');
        }
      }

      setUsers(usersList);
    } catch (error) {
      console.error('Error loading users:', error);
      Alert.alert('Error', 'No se pudieron cargar los usuarios');
    }
  }, [user, isSuperAdmin, selectedAdminResponsable]);

  // Load data on mount and when dependencies change
  useEffect(() => {
    if (user && isSuperAdmin()) {
      loadAdminResponsables();
    }
  }, [user?.uid, loadAdminResponsables]);

  useEffect(() => {
    if (user) {
      loadUsers();
    }
  }, [user?.uid, user?.role, selectedAdminResponsable?.uid, loadUsers]);

  // Open create user modal
  const handleOpenCreateUser = (type: 'admin_responsable' | 'admin' | 'controlador') => {
    setCreatingUserType(type);
    setNewUserEmail('');
    setNewUserPassword('');
    setNewUserUsername('');
    setNewUserRole(type);
    setAdminPassword('');
    setShowCreateModal(true);
  };

  // Create user
  const handleCreateUser = async () => {
    if (!newUserEmail || !newUserPassword || !newUserUsername || !adminPassword) {
      Alert.alert('Error', 'Por favor completa todos los campos');
      return;
    }

    if (!user?.email) {
      Alert.alert('Error', 'No se pudo obtener el email del administrador');
      return;
    }

    try {
      setLoading(true);

      let orgId: string | null = null;

      if (newUserRole === 'admin_responsable') {
        orgId = null; // Will be set to own UID after creation
      } else if (isSuperAdmin()) {
        // For admin_responsable, their UID IS their organizationId (fallback for backwards compatibility)
        const selectedOrgId = selectedAdminResponsable?.organizationId || selectedAdminResponsable?.uid;
        if (!selectedOrgId) {
          setLoading(false);
          Alert.alert('Error', 'Selecciona un Administrador Responsable primero');
          return;
        }
        orgId = selectedOrgId;
      } else {
        orgId = user.organizationId || null;
      }

      const newUid = await createUser(
        newUserEmail,
        newUserPassword,
        newUserUsername,
        newUserRole,
        orgId,
        user.email,
        adminPassword,
        user.uid
      );

      // If creating admin_responsable, set their organizationId to their own UID
      if (newUserRole === 'admin_responsable') {
        await updateUserOrganization(newUid, newUid);
      }

      setLoading(false);
      setShowCreateModal(false);

      if (isSuperAdmin()) {
        await loadAdminResponsables();
      }
      await loadUsers();

      Alert.alert(
        'Usuario creado',
        `El usuario ${newUserEmail} ha sido creado correctamente con rol de ${ROLE_LABELS[newUserRole]}.`
      );
    } catch (error: any) {
      setLoading(false);
      console.error('Error creating user:', error);
      Alert.alert('Error', error.message || 'No se pudo crear el usuario');
    }
  };

  // Delete user
  const handleDeleteUser = (targetUser: User) => {
    if (!user || !canManageRole(user.role, targetUser.role)) {
      Alert.alert('Error', 'No tienes permisos para eliminar este usuario');
      return;
    }

    if (targetUser.uid === user.uid) {
      Alert.alert('Error', 'No puedes eliminarte a ti mismo');
      return;
    }

    Alert.alert(
      'Eliminar usuario',
      `¿Estás seguro de que quieres eliminar a ${targetUser.email}?`,
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Eliminar',
          style: 'destructive',
          onPress: async () => {
            try {
              setLoading(true);
              await deleteUserFromFirestore(targetUser.uid);
              setLoading(false);

              if (selectedAdminResponsable?.uid === targetUser.uid) {
                setSelectedAdminResponsable(null);
              }

              if (isSuperAdmin() && targetUser.role === 'admin_responsable') {
                await loadAdminResponsables();
              }

              await loadUsers();

              Alert.alert('Usuario eliminado', `${targetUser.email} ha sido eliminado.`);
            } catch (error) {
              setLoading(false);
              Alert.alert('Error', 'No se pudo eliminar el usuario');
            }
          },
        },
      ]
    );
  };

  // Update user role
  const handleUpdateRole = async (newRole: UserRole) => {
    if (!selectedUser) return;

    try {
      setLoading(true);
      await updateUserRole(selectedUser.uid, newRole);
      setLoading(false);
      setShowEditRoleModal(false);
      await loadUsers();

      Alert.alert('Rol actualizado', `El rol de ${selectedUser.email} ha sido actualizado.`);
    } catch (error) {
      setLoading(false);
      Alert.alert('Error', 'No se pudo actualizar el rol');
    }
  };

  // Open assign events modal
  const handleOpenAssignEvents = async (controlador: User) => {
    setSelectedControlador(controlador);
    setSelectedEventIds(controlador.assignedEventIds || []);
    setShowAssignEventsModal(true);
    setLoadingEvents(true);

    try {
      // Get organization ID
      let orgId: string | null = null;
      if (isSuperAdmin()) {
        orgId = selectedAdminResponsable?.organizationId || selectedAdminResponsable?.uid || null;
      } else {
        orgId = user?.organizationId || null;
      }

      if (orgId) {
        const events = await getEventsByOrganization(orgId);
        setAvailableEvents(events);
      } else {
        setAvailableEvents([]);
      }
    } catch (error) {
      console.error('Error loading events:', error);
      setAvailableEvents([]);
    } finally {
      setLoadingEvents(false);
    }
  };

  // Toggle event selection
  const toggleEventSelection = (eventId: string) => {
    setSelectedEventIds(prev =>
      prev.includes(eventId)
        ? prev.filter(id => id !== eventId)
        : [...prev, eventId]
    );
  };

  // Save assigned events
  const handleSaveAssignedEvents = async () => {
    if (!selectedControlador) return;

    try {
      setLoading(true);
      await assignEventsToUser(selectedControlador.uid, selectedEventIds);
      setLoading(false);
      setShowAssignEventsModal(false);
      await loadUsers();

      Alert.alert(
        'Eventos asignados',
        `Se han asignado ${selectedEventIds.length} evento(s) a ${selectedControlador.username}.`
      );
    } catch (error) {
      setLoading(false);
      console.error('Error saving assigned events:', error);
      Alert.alert('Error', 'No se pudieron guardar los eventos asignados');
    }
  };

  // Render user card
  const renderUserCard = (userData: User) => {
    const canManage = user && canManageRole(user.role, userData.role);
    const isCurrentUser = userData.uid === user?.uid;

    return (
      <View
        key={userData.uid}
        style={[
          styles.userCard,
          Shadows.light,
          { backgroundColor: Colors[colorScheme ?? 'light'].cardBackground },
        ]}
      >
        <View style={styles.userCardHeader}>
          <View style={styles.userCardInfo}>
            <ThemedText style={styles.userCardName}>
              {userData.username}
              {isCurrentUser && ' (Tú)'}
            </ThemedText>
            <ThemedText style={styles.userCardEmail}>{userData.email}</ThemedText>
          </View>
          <RoleBadge role={userData.role} />
        </View>

        {canManage && !isCurrentUser && (
          <View style={styles.userCardActions}>
            {userData.role === 'controlador' && (
              <TouchableOpacity
                style={[styles.userActionButton, { backgroundColor: Colors.light.success }]}
                onPress={() => handleOpenAssignEvents(userData)}
                disabled={loading}
              >
                <Text style={styles.userActionButtonText}>
                  📅 Eventos ({userData.assignedEventIds?.length || 0})
                </Text>
              </TouchableOpacity>
            )}
            <TouchableOpacity
              style={[styles.userActionButton, { backgroundColor: Colors.light.primary }]}
              onPress={() => {
                setSelectedUser(userData);
                setShowEditRoleModal(true);
              }}
              disabled={loading}
            >
              <Text style={styles.userActionButtonText}>Cambiar Rol</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.userActionButton, { backgroundColor: Colors.light.error }]}
              onPress={() => handleDeleteUser(userData)}
              disabled={loading}
            >
              <Text style={styles.userActionButtonText}>Eliminar</Text>
            </TouchableOpacity>
          </View>
        )}
      </View>
    );
  };

  // Determine what sections to show
  const showAdminResponsablesSection = isSuperAdmin();
  const canCreateAdminOrController = user?.role === 'super_admin' ||
    user?.role === 'admin_responsable' ||
    user?.role === 'admin';

  const getOrgContextLabel = () => {
    if (isSuperAdmin()) {
      if (selectedAdminResponsable) {
        return `Organización de ${selectedAdminResponsable.username}`;
      }
      return 'Selecciona un Admin Responsable arriba';
    }
    if (user?.role === 'admin_responsable' || user?.role === 'admin') {
      return 'Tu organización';
    }
    return '';
  };

  return (
    <View style={styles.section}>
      <ThemedText style={styles.sectionTitle}>👥 Gestión de Usuarios</ThemedText>

      {/* Admin Responsables section (super_admin only) */}
      {showAdminResponsablesSection && (
        <View style={styles.userHierarchySection}>
          <View style={styles.userSectionHeader}>
            <ThemedText style={styles.userSectionTitle}>
              🏢 Administradores Responsables
            </ThemedText>
            <TouchableOpacity
              style={[styles.addUserButton, { backgroundColor: ROLE_COLORS['admin_responsable'] }]}
              onPress={() => handleOpenCreateUser('admin_responsable')}
              disabled={loading}
            >
              <Text style={styles.addUserButtonText}>+ Nuevo Admin Resp.</Text>
            </TouchableOpacity>
          </View>

          {adminResponsables.length === 0 ? (
            <View style={[styles.infoCard, { backgroundColor: Colors[colorScheme ?? 'light'].cardBackground }]}>
              <ThemedText style={styles.infoText}>
                No hay administradores responsables. Crea uno para comenzar.
              </ThemedText>
            </View>
          ) : (
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.adminResponsablesContent}
            >
              {adminResponsables.map((adminResp) => (
                <TouchableOpacity
                  key={adminResp.uid}
                  style={[
                    styles.adminResponsableCard,
                    selectedAdminResponsable?.uid === adminResp.uid && styles.adminResponsableCardSelected,
                    {
                      backgroundColor: selectedAdminResponsable?.uid === adminResp.uid
                        ? ROLE_COLORS['admin_responsable']
                        : Colors[colorScheme ?? 'light'].cardBackground,
                    },
                  ]}
                  onPress={() => {
                    if (selectedAdminResponsable?.uid === adminResp.uid) {
                      setSelectedAdminResponsable(null);
                    } else {
                      setSelectedAdminResponsable(adminResp);
                    }
                  }}
                >
                  <ThemedText style={[
                    styles.adminResponsableName,
                    selectedAdminResponsable?.uid === adminResp.uid && { color: '#fff' },
                  ]}>
                    {adminResp.username}
                  </ThemedText>
                  <ThemedText style={[
                    styles.adminResponsableEmail,
                    selectedAdminResponsable?.uid === adminResp.uid && { color: 'rgba(255,255,255,0.8)' },
                  ]}>
                    {adminResp.email}
                  </ThemedText>
                  {selectedAdminResponsable?.uid === adminResp.uid && (
                    <View style={styles.selectedIndicator}>
                      <Text style={{ color: '#fff', fontSize: 12 }}>✓ Seleccionado</Text>
                    </View>
                  )}
                </TouchableOpacity>
              ))}
            </ScrollView>
          )}

          {/* Actions for selected admin_responsable */}
          {selectedAdminResponsable && (
            <View style={styles.selectedAdminActions}>
              <TouchableOpacity
                style={[styles.userActionButton, { backgroundColor: Colors.light.error, paddingHorizontal: Spacing.lg }]}
                onPress={() => handleDeleteUser(selectedAdminResponsable)}
                disabled={loading}
              >
                <Text style={styles.userActionButtonText}>
                  🗑️ Eliminar {selectedAdminResponsable.username}
                </Text>
              </TouchableOpacity>
            </View>
          )}
        </View>
      )}

      {/* Admins and Controllers section */}
      <View style={styles.userHierarchySection}>
        <View style={styles.userSectionHeader}>
          <View>
            <ThemedText style={styles.userSectionTitle}>
              {user?.role === 'admin' ? '🎮 Controladores' : '👥 Administradores y Controladores'}
            </ThemedText>
            <ThemedText style={styles.userSectionSubtitle}>
              {getOrgContextLabel()}
            </ThemedText>
          </View>

          {canCreateAdminOrController && ((isSuperAdmin() && selectedAdminResponsable) || !isSuperAdmin()) && (
            <TouchableOpacity
              style={[styles.addUserButton, { backgroundColor: Colors.light.primary }]}
              onPress={() => {
                if (user?.role === 'admin') {
                  handleOpenCreateUser('controlador');
                } else {
                  handleOpenCreateUser('admin');
                }
              }}
              disabled={loading}
            >
              <Text style={styles.addUserButtonText}>+ Nuevo Usuario</Text>
            </TouchableOpacity>
          )}
        </View>

        {isSuperAdmin() && !selectedAdminResponsable ? (
          <View style={[styles.infoCard, { backgroundColor: Colors[colorScheme ?? 'light'].cardBackground }]}>
            <ThemedText style={styles.infoText}>
              👆 Selecciona un Administrador Responsable de la lista de arriba para ver y gestionar los usuarios de su organización.
            </ThemedText>
          </View>
        ) : users.length === 0 ? (
          <View style={[styles.infoCard, { backgroundColor: Colors[colorScheme ?? 'light'].cardBackground }]}>
            <ThemedText style={styles.infoText}>
              No hay {user?.role === 'admin' ? 'controladores' : 'administradores ni controladores'} en esta organización.
            </ThemedText>
          </View>
        ) : (
          <View>
            {/* Admins group */}
            {user?.role !== 'admin' && users.filter(u => u.role === 'admin').length > 0 && (
              <View style={styles.userRoleGroup}>
                <ThemedText style={styles.userRoleGroupTitle}>
                  Administradores ({users.filter(u => u.role === 'admin').length})
                </ThemedText>
                {users.filter(u => u.role === 'admin').map(renderUserCard)}
              </View>
            )}

            {/* Controllers group */}
            {users.filter(u => u.role === 'controlador').length > 0 && (
              <View style={styles.userRoleGroup}>
                <ThemedText style={styles.userRoleGroupTitle}>
                  Controladores ({users.filter(u => u.role === 'controlador').length})
                </ThemedText>
                {users.filter(u => u.role === 'controlador').map(renderUserCard)}
              </View>
            )}
          </View>
        )}
      </View>

      {/* Loading overlay */}
      {loading && (
        <View style={styles.loadingOverlay}>
          <ActivityIndicator size="large" color="#fff" />
          <Text style={styles.loadingText}>Procesando...</Text>
        </View>
      )}

      {/* Create User Modal */}
      <Modal
        visible={showCreateModal}
        animationType="slide"
        transparent
        onRequestClose={() => setShowCreateModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { backgroundColor: Colors[colorScheme ?? 'light'].cardBackground }]}>
            <ThemedText style={styles.modalTitle}>
              Crear {ROLE_LABELS[creatingUserType]}
            </ThemedText>

            <ScrollView style={{ maxHeight: 400 }}>
              <View style={styles.formField}>
                <ThemedText style={styles.fieldLabel}>Email *</ThemedText>
                <TextInput
                  style={[styles.input, { backgroundColor: Colors[colorScheme ?? 'light'].background, color: Colors[colorScheme ?? 'light'].text }]}
                  value={newUserEmail}
                  onChangeText={setNewUserEmail}
                  placeholder="usuario@email.com"
                  placeholderTextColor={Colors[colorScheme ?? 'light'].text + '60'}
                  keyboardType="email-address"
                  autoCapitalize="none"
                />
              </View>

              <View style={styles.formField}>
                <ThemedText style={styles.fieldLabel}>Contraseña *</ThemedText>
                <TextInput
                  style={[styles.input, { backgroundColor: Colors[colorScheme ?? 'light'].background, color: Colors[colorScheme ?? 'light'].text }]}
                  value={newUserPassword}
                  onChangeText={setNewUserPassword}
                  placeholder="Mínimo 6 caracteres"
                  placeholderTextColor={Colors[colorScheme ?? 'light'].text + '60'}
                  secureTextEntry
                />
              </View>

              <View style={styles.formField}>
                <ThemedText style={styles.fieldLabel}>Nombre *</ThemedText>
                <TextInput
                  style={[styles.input, { backgroundColor: Colors[colorScheme ?? 'light'].background, color: Colors[colorScheme ?? 'light'].text }]}
                  value={newUserUsername}
                  onChangeText={setNewUserUsername}
                  placeholder="Nombre del usuario"
                  placeholderTextColor={Colors[colorScheme ?? 'light'].text + '60'}
                />
              </View>

              {/* Role selector (only show if not creating admin_responsable) */}
              {creatingUserType !== 'admin_responsable' && (
                <View style={styles.formField}>
                  <ThemedText style={styles.fieldLabel}>Rol *</ThemedText>
                  <View style={styles.roleSelector}>
                    {getCreatableRoles(user?.role || 'controlador').map((role) => (
                      <TouchableOpacity
                        key={role}
                        style={[
                          styles.roleOption,
                          newUserRole === role && { backgroundColor: ROLE_COLORS[role] },
                        ]}
                        onPress={() => setNewUserRole(role)}
                      >
                        <Text style={[styles.roleOptionText, newUserRole === role && { color: '#fff' }]}>
                          {ROLE_LABELS[role]}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                </View>
              )}

              <View style={styles.formField}>
                <ThemedText style={styles.fieldLabel}>Tu contraseña (verificación) *</ThemedText>
                <TextInput
                  style={[styles.input, { backgroundColor: Colors[colorScheme ?? 'light'].background, color: Colors[colorScheme ?? 'light'].text }]}
                  value={adminPassword}
                  onChangeText={setAdminPassword}
                  placeholder="Tu contraseña actual"
                  placeholderTextColor={Colors[colorScheme ?? 'light'].text + '60'}
                  secureTextEntry
                />
                <ThemedText style={styles.fieldHint}>
                  Necesario para re-autenticarte después de crear el usuario
                </ThemedText>
              </View>
            </ScrollView>

            <View style={styles.modalActions}>
              <TouchableOpacity
                style={[styles.modalButton, styles.cancelButton]}
                onPress={() => setShowCreateModal(false)}
              >
                <Text style={styles.cancelButtonText}>Cancelar</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modalButton, styles.submitButton, { backgroundColor: Colors.light.success }]}
                onPress={handleCreateUser}
                disabled={loading}
              >
                <Text style={styles.submitButtonText}>Crear Usuario</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Edit Role Modal */}
      <Modal
        visible={showEditRoleModal}
        animationType="fade"
        transparent
        onRequestClose={() => setShowEditRoleModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { backgroundColor: Colors[colorScheme ?? 'light'].cardBackground }]}>
            <ThemedText style={styles.modalTitle}>
              Cambiar Rol de {selectedUser?.username}
            </ThemedText>

            <View style={styles.roleSelector}>
              {getCreatableRoles(user?.role || 'controlador').map((role) => (
                <TouchableOpacity
                  key={role}
                  style={[
                    styles.roleOption,
                    styles.roleOptionLarge,
                    selectedUser?.role === role && { backgroundColor: ROLE_COLORS[role] },
                  ]}
                  onPress={() => handleUpdateRole(role)}
                  disabled={loading || selectedUser?.role === role}
                >
                  <Text style={[styles.roleOptionText, selectedUser?.role === role && { color: '#fff' }]}>
                    {ROLE_LABELS[role]}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            <TouchableOpacity
              style={[styles.modalButton, styles.cancelButton, { marginTop: Spacing.lg }]}
              onPress={() => setShowEditRoleModal(false)}
            >
              <Text style={styles.cancelButtonText}>Cancelar</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Assign Events Modal */}
      <Modal
        visible={showAssignEventsModal}
        animationType="slide"
        transparent
        onRequestClose={() => setShowAssignEventsModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { backgroundColor: Colors[colorScheme ?? 'light'].cardBackground, maxHeight: '80%' }]}>
            <ThemedText style={styles.modalTitle}>
              Asignar Eventos a {selectedControlador?.username}
            </ThemedText>

            <ThemedText style={styles.modalSubtitle}>
              Selecciona los eventos que este controlador podrá gestionar
            </ThemedText>

            {loadingEvents ? (
              <View style={styles.loadingContainer}>
                <ActivityIndicator size="large" color={Colors.light.primary} />
                <ThemedText style={{ marginTop: Spacing.md }}>Cargando eventos...</ThemedText>
              </View>
            ) : availableEvents.length === 0 ? (
              <View style={styles.emptyContainer}>
                <ThemedText style={styles.emptyText}>
                  No hay eventos disponibles en esta organización
                </ThemedText>
              </View>
            ) : (
              <ScrollView style={styles.eventsList}>
                {availableEvents.map((event) => (
                  <TouchableOpacity
                    key={event.id}
                    style={[
                      styles.eventCheckItem,
                      selectedEventIds.includes(event.id) && styles.eventCheckItemSelected,
                      { backgroundColor: selectedEventIds.includes(event.id)
                        ? Colors.light.success + '20'
                        : Colors[colorScheme ?? 'light'].background
                      },
                    ]}
                    onPress={() => toggleEventSelection(event.id)}
                  >
                    <View style={styles.eventCheckBox}>
                      {selectedEventIds.includes(event.id) ? (
                        <Text style={styles.eventCheckMark}>✓</Text>
                      ) : null}
                    </View>
                    <View style={styles.eventCheckInfo}>
                      <ThemedText style={styles.eventCheckName}>{event.name}</ThemedText>
                      <ThemedText style={styles.eventCheckDate}>
                        {new Date(event.date).toLocaleDateString('es-ES', {
                          day: 'numeric',
                          month: 'short',
                          year: 'numeric',
                        })}
                      </ThemedText>
                    </View>
                  </TouchableOpacity>
                ))}
              </ScrollView>
            )}

            <View style={styles.modalActions}>
              <TouchableOpacity
                style={[styles.modalButton, styles.cancelButton]}
                onPress={() => setShowAssignEventsModal(false)}
              >
                <Text style={styles.cancelButtonText}>Cancelar</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modalButton, styles.submitButton, { backgroundColor: Colors.light.success }]}
                onPress={handleSaveAssignedEvents}
                disabled={loading}
              >
                <Text style={styles.submitButtonText}>
                  Guardar ({selectedEventIds.length})
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  section: {
    flex: 1,
  },
  sectionTitle: {
    fontSize: FontSizes.lg,
    fontWeight: 'bold',
    marginBottom: Spacing.md,
  },
  userHierarchySection: {
    marginBottom: Spacing.xl,
  },
  userSectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: Spacing.md,
  },
  userSectionTitle: {
    fontSize: FontSizes.md,
    fontWeight: 'bold',
  },
  userSectionSubtitle: {
    fontSize: FontSizes.sm,
    opacity: 0.7,
    marginTop: 4,
  },
  addUserButton: {
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderRadius: BorderRadius.md,
  },
  addUserButtonText: {
    color: '#fff',
    fontWeight: '600',
    fontSize: FontSizes.sm,
  },
  // Admin responsables cards
  adminResponsablesContent: {
    gap: Spacing.md,
    paddingVertical: Spacing.xs,
  },
  adminResponsableCard: {
    padding: Spacing.md,
    borderRadius: BorderRadius.md,
    minWidth: 180,
    ...Shadows.light,
  },
  adminResponsableCardSelected: {
    borderWidth: 2,
    borderColor: '#fff',
  },
  adminResponsableName: {
    fontWeight: 'bold',
    fontSize: FontSizes.md,
    marginBottom: 4,
  },
  adminResponsableEmail: {
    fontSize: FontSizes.sm,
    opacity: 0.8,
  },
  selectedIndicator: {
    marginTop: Spacing.sm,
    paddingTop: Spacing.xs,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.3)',
  },
  selectedAdminActions: {
    marginTop: Spacing.md,
    alignItems: 'flex-start',
  },
  // User cards
  userCard: {
    padding: Spacing.md,
    borderRadius: BorderRadius.md,
    marginBottom: Spacing.sm,
  },
  userCardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  userCardInfo: {
    flex: 1,
    marginRight: Spacing.sm,
  },
  userCardName: {
    fontWeight: 'bold',
    fontSize: FontSizes.md,
  },
  userCardEmail: {
    fontSize: FontSizes.sm,
    opacity: 0.7,
    marginTop: 2,
  },
  userCardActions: {
    flexDirection: 'row',
    gap: Spacing.sm,
    marginTop: Spacing.md,
  },
  userActionButton: {
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderRadius: BorderRadius.md,
  },
  userActionButtonText: {
    color: '#fff',
    fontWeight: '600',
    fontSize: FontSizes.sm,
  },
  userRoleGroup: {
    marginBottom: Spacing.lg,
  },
  userRoleGroupTitle: {
    fontSize: FontSizes.sm,
    fontWeight: 'bold',
    opacity: 0.7,
    marginBottom: Spacing.sm,
  },
  // Info card
  infoCard: {
    padding: Spacing.lg,
    borderRadius: BorderRadius.md,
  },
  infoText: {
    textAlign: 'center',
    opacity: 0.7,
  },
  // Loading
  loadingOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.7)',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 1000,
  },
  loadingText: {
    color: '#fff',
    marginTop: Spacing.md,
    fontSize: FontSizes.md,
  },
  // Modal
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: Spacing.lg,
  },
  modalContent: {
    width: '100%',
    maxWidth: 450,
    borderRadius: BorderRadius.lg,
    padding: Spacing.lg,
  },
  modalTitle: {
    fontSize: FontSizes.xl,
    fontWeight: 'bold',
    marginBottom: Spacing.lg,
    textAlign: 'center',
  },
  formField: {
    marginBottom: Spacing.md,
  },
  fieldLabel: {
    fontSize: FontSizes.sm,
    fontWeight: '600',
    marginBottom: Spacing.xs,
  },
  fieldHint: {
    fontSize: FontSizes.xs,
    opacity: 0.6,
    marginTop: 4,
  },
  input: {
    borderWidth: 1,
    borderColor: Colors.light.border,
    borderRadius: BorderRadius.md,
    padding: Spacing.md,
    fontSize: FontSizes.md,
  },
  roleSelector: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.sm,
  },
  roleOption: {
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    borderColor: Colors.light.border,
  },
  roleOptionLarge: {
    flex: 1,
    minWidth: 120,
    alignItems: 'center',
  },
  roleOptionText: {
    fontSize: FontSizes.sm,
    fontWeight: '600',
  },
  modalActions: {
    flexDirection: 'row',
    gap: Spacing.md,
    marginTop: Spacing.lg,
  },
  modalButton: {
    flex: 1,
    padding: Spacing.md,
    borderRadius: BorderRadius.md,
    alignItems: 'center',
  },
  cancelButton: {
    borderWidth: 1,
    borderColor: Colors.light.border,
  },
  cancelButtonText: {
    fontWeight: '600',
  },
  submitButton: {
    backgroundColor: Colors.light.success,
  },
  submitButtonText: {
    color: '#fff',
    fontWeight: '600',
  },
  // Assign events modal styles
  modalSubtitle: {
    fontSize: FontSizes.sm,
    opacity: 0.7,
    textAlign: 'center',
    marginBottom: Spacing.lg,
  },
  loadingContainer: {
    padding: Spacing.xl,
    alignItems: 'center',
  },
  emptyContainer: {
    padding: Spacing.xl,
    alignItems: 'center',
  },
  emptyText: {
    opacity: 0.7,
    textAlign: 'center',
  },
  eventsList: {
    maxHeight: 300,
    marginBottom: Spacing.md,
  },
  eventCheckItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: Spacing.md,
    borderRadius: BorderRadius.md,
    marginBottom: Spacing.sm,
    borderWidth: 1,
    borderColor: Colors.light.border,
  },
  eventCheckItemSelected: {
    borderColor: Colors.light.success,
  },
  eventCheckBox: {
    width: 24,
    height: 24,
    borderRadius: 4,
    borderWidth: 2,
    borderColor: Colors.light.success,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: Spacing.md,
  },
  eventCheckMark: {
    color: Colors.light.success,
    fontWeight: 'bold',
    fontSize: 16,
  },
  eventCheckInfo: {
    flex: 1,
  },
  eventCheckName: {
    fontWeight: '600',
    fontSize: FontSizes.md,
  },
  eventCheckDate: {
    fontSize: FontSizes.sm,
    opacity: 0.7,
    marginTop: 2,
  },
});
