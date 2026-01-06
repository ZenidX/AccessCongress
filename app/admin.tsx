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

import React, { useState, useEffect } from 'react';
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
  TextInput,
} from 'react-native';
import * as DocumentPicker from 'expo-document-picker';
import { useRouter } from 'expo-router';
import { ThemedView } from '@/components/themed/themed-view';
import { ThemedText } from '@/components/themed/themed-text';
import {
  importParticipantsFromCSV,
  importParticipantsFromExcel,
  resetAllParticipantStates,
  exportDataToExcel,
  createParticipant,
  getAllParticipants,
  deleteParticipant,
} from '@/services/participantService';
import { Participant } from '@/types/participant';
import { ImportMode } from '@/services/participantService';
import {
  getAllUsers,
  getUsersByOrganization,
  createUser,
  updateUserRole,
  deleteUserFromFirestore,
} from '@/services/userService';
import { User, UserRole, getCreatableRoles, canManageRole } from '@/types/user';

// Role label mapping for UI
const ROLE_LABELS: Record<UserRole, string> = {
  'super_admin': 'Super Admin',
  'admin_responsable': 'Admin Responsable',
  'admin': 'Administrador',
  'controlador': 'Controlador',
};

// Role colors for badges
const ROLE_COLORS: Record<UserRole, string> = {
  'super_admin': '#9b51e0', // Purple
  'admin_responsable': '#00a4e1', // Blue
  'admin': '#ffaf00', // Orange
  'controlador': '#4caf50', // Green
};
import { Colors, BorderRadius, Spacing, Shadows, FontSizes } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import * as Sharing from 'expo-sharing';
import { LoginButton } from '@/components/forms/LoginButton';
import { useAuth } from '@/contexts/AuthContext';
import { useEvent } from '@/contexts/EventContext';
import { AdminSidebar, AdminSection } from '@/components/layout/AdminSidebar';
import { BackButton } from '@/components/navigation/BackButton';
import { RoleBadge } from '@/components/data-display/RoleBadge';
import {
  EventManager,
  EventForm,
  EventResetModal,
  UserEventAssignment,
} from '@/components/admin';
import { Event, ResetType } from '@/types/event';

export default function AdminScreen() {
  const router = useRouter();
  const colorScheme = useColorScheme();
  const { user, isSuperAdmin } = useAuth();
  const { currentEvent, setCurrentEvent, refreshEvents, availableEvents, isLoadingEvents } = useEvent();

  // Estado de carga para operaciones asíncronas
  const [loading, setLoading] = useState(false);
  const [isInfoModalVisible, setInfoModalVisible] = useState(false);

  // Estado del sidebar y sección seleccionada
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [selectedSection, setSelectedSection] = useState<AdminSection>('events');

  // Estado para gestión de eventos
  const [showEventForm, setShowEventForm] = useState(false);
  const [editingEvent, setEditingEvent] = useState<Event | null>(null);
  const [showResetModal, setShowResetModal] = useState(false);
  const [resetEvent, setResetEvent] = useState<Event | null>(null);
  const [showUserAssignment, setShowUserAssignment] = useState(false);
  const [assignmentEvent, setAssignmentEvent] = useState<Event | null>(null);
  const [importMode, setImportMode] = useState<ImportMode>('merge');

  // Estado para gestión de usuarios jerárquica
  const [adminResponsables, setAdminResponsables] = useState<User[]>([]); // Solo para super_admin
  const [selectedAdminResponsable, setSelectedAdminResponsable] = useState<User | null>(null); // Admin resp seleccionado
  const [users, setUsers] = useState<User[]>([]); // Admins y controladores de la org seleccionada
  const [isCreateUserModalVisible, setCreateUserModalVisible] = useState(false);
  const [isEditRoleModalVisible, setEditRoleModalVisible] = useState(false);
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const [creatingUserType, setCreatingUserType] = useState<'admin_responsable' | 'admin' | 'controlador'>('controlador');

  // Estado para gestión de participantes
  const [participants, setParticipants] = useState<Participant[]>([]);
  const [loadingParticipants, setLoadingParticipants] = useState(false);

  // Formulario de nuevo usuario
  const [newUserEmail, setNewUserEmail] = useState('');
  const [newUserPassword, setNewUserPassword] = useState('');
  const [newUserUsername, setNewUserUsername] = useState('');
  const [newUserRole, setNewUserRole] = useState<UserRole>('controlador');
  const [adminPassword, setAdminPassword] = useState('');

  // Estado para modal de añadir participante
  const [isAddParticipantModalVisible, setAddParticipantModalVisible] = useState(false);
  const [newParticipantDNI, setNewParticipantDNI] = useState('');
  const [newParticipantNombre, setNewParticipantNombre] = useState('');
  const [newParticipantEmail, setNewParticipantEmail] = useState('');
  const [newParticipantTelefono, setNewParticipantTelefono] = useState('');
  const [newParticipantEscuela, setNewParticipantEscuela] = useState('');
  const [newParticipantCargo, setNewParticipantCargo] = useState('');
  const [newParticipantAcceso, setNewParticipantAcceso] = useState('presencial');
  const [newParticipantHaPagado, setNewParticipantHaPagado] = useState(false);
  const [newParticipantMasterClass, setNewParticipantMasterClass] = useState(false);
  const [newParticipantCena, setNewParticipantCena] = useState(false);

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
    if (!currentEvent) {
      Alert.alert('Error', 'Selecciona un evento primero desde la sección de Eventos');
      return;
    }

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
        count = await importParticipantsFromExcel(arrayBuffer, currentEvent.id, importMode);
      } else {
        // Procesar archivo CSV
        const csvData = await response.text();
        count = await importParticipantsFromCSV(csvData, currentEvent.id, importMode);
      }

      setLoading(false);

      const modeLabel = importMode === 'replace' ? '(modo Total - reemplazando existentes)' : '(modo Añadir - agregando nuevos)';
      const successMessage = `Importación exitosa: Se importaron ${count} participantes al evento "${currentEvent.name}" ${modeLabel}.`;

      // Recargar lista de participantes
      await loadParticipants();

      if (Platform.OS === 'web') {
        window.alert(successMessage);
      } else {
        Alert.alert('Importación exitosa', successMessage, [{ text: 'OK' }]);
      }
    } catch (error) {
      setLoading(false);
      console.error('Error importando archivo:', error);

      const errorMessage = `No se pudo importar el archivo: ${error instanceof Error ? error.message : 'Error desconocido'}`;

      if (Platform.OS === 'web') {
        window.alert(errorMessage);
      } else {
        Alert.alert('Error', errorMessage, [{ text: 'OK' }]);
      }
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
   * Abrir modal de añadir participante
   */
  const handleOpenAddParticipant = () => {
    // Resetear formulario
    setNewParticipantDNI('');
    setNewParticipantNombre('');
    setNewParticipantEmail('');
    setNewParticipantTelefono('');
    setNewParticipantEscuela('');
    setNewParticipantCargo('');
    setNewParticipantAcceso('presencial');
    setNewParticipantHaPagado(false);
    setNewParticipantMasterClass(false);
    setNewParticipantCena(false);
    setAddParticipantModalVisible(true);
  };

  /**
   * Crear participante individual
   */
  const handleCreateParticipant = async () => {
    if (!newParticipantDNI || !newParticipantNombre) {
      if (Platform.OS === 'web') {
        window.alert('DNI y Nombre son obligatorios');
      } else {
        Alert.alert('Error', 'DNI y Nombre son obligatorios');
      }
      return;
    }

    if (!currentEvent) {
      Alert.alert('Error', 'Selecciona un evento primero');
      return;
    }

    setLoading(true);
    try {
      await createParticipant({
        dni: newParticipantDNI,
        nombre: newParticipantNombre,
        email: newParticipantEmail || undefined,
        telefono: newParticipantTelefono || undefined,
        escuela: newParticipantEscuela || undefined,
        cargo: newParticipantCargo || undefined,
        acceso: newParticipantAcceso,
        haPagado: newParticipantHaPagado,
        masterClass: newParticipantMasterClass,
        cena: newParticipantCena,
      }, currentEvent.id);

      setAddParticipantModalVisible(false);

      // Recargar lista de participantes
      await loadParticipants();

      const successMsg = `Participante ${newParticipantNombre} creado en "${currentEvent.name}"`;
      if (Platform.OS === 'web') {
        window.alert(successMsg);
      } else {
        Alert.alert('Éxito', successMsg);
      }
    } catch (error: any) {
      const errorMsg = error.message || 'Error al crear participante';
      if (Platform.OS === 'web') {
        window.alert(errorMsg);
      } else {
        Alert.alert('Error', errorMsg);
      }
    } finally {
      setLoading(false);
    }
  };

  /**
   * Cargar lista de admin_responsables (solo para super_admin)
   */
  const loadAdminResponsables = async () => {
    if (!user || !isSuperAdmin()) return;

    try {
      const allUsers = await getAllUsers();
      const adminsResp = allUsers.filter(u => u.role === 'admin_responsable');
      setAdminResponsables(adminsResp);
    } catch (error) {
      console.error('Error cargando admin responsables:', error);
    }
  };

  /**
   * Cargar usuarios (admins y controladores) según la organización
   */
  const loadUsers = async () => {
    if (!user) return;

    try {
      let usersList: User[] = [];

      if (isSuperAdmin()) {
        // Super admin: carga usuarios de la org del admin_responsable seleccionado
        if (selectedAdminResponsable?.organizationId) {
          const orgUsers = await getUsersByOrganization(selectedAdminResponsable.organizationId);
          // Filtrar solo admins y controladores (no el propio admin_responsable)
          usersList = orgUsers.filter(u =>
            u.role === 'admin' || u.role === 'controlador'
          );
        }
      } else if (user.role === 'admin_responsable') {
        // Admin responsable: carga admins y controladores de su org
        if (user.organizationId) {
          const orgUsers = await getUsersByOrganization(user.organizationId);
          usersList = orgUsers.filter(u =>
            u.role === 'admin' || u.role === 'controlador'
          );
        }
      } else if (user.role === 'admin') {
        // Admin: solo ve controladores de su org
        if (user.organizationId) {
          const orgUsers = await getUsersByOrganization(user.organizationId);
          usersList = orgUsers.filter(u => u.role === 'controlador');
        }
      }

      setUsers(usersList);
    } catch (error) {
      console.error('Error cargando usuarios:', error);
      Alert.alert('Error', 'No se pudieron cargar los usuarios');
    }
  };

  /**
   * Cargar lista de participantes desde Firestore
   */
  const loadParticipants = async () => {
    setLoadingParticipants(true);
    try {
      const participantsList = await getAllParticipants(currentEvent?.id);
      setParticipants(participantsList);
    } catch (error) {
      console.error('Error cargando participantes:', error);
      if (Platform.OS === 'web') {
        window.alert('No se pudieron cargar los participantes');
      } else {
        Alert.alert('Error', 'No se pudieron cargar los participantes');
      }
    } finally {
      setLoadingParticipants(false);
    }
  };

  /**
   * Eliminar un participante
   */
  const handleDeleteParticipant = async (dni: string, nombre: string) => {
    const confirmMsg = `¿Estás seguro que deseas eliminar a ${nombre} (${dni})?`;

    if (Platform.OS === 'web') {
      if (!window.confirm(confirmMsg)) {
        return;
      }
    } else {
      Alert.alert(
        'Eliminar participante',
        confirmMsg,
        [
          { text: 'Cancelar', style: 'cancel' },
          {
            text: 'Eliminar',
            style: 'destructive',
            onPress: async () => {
              await executeDelete(dni, nombre);
            },
          },
        ]
      );
      return;
    }

    await executeDelete(dni, nombre);
  };

  const executeDelete = async (dni: string, nombre: string) => {
    setLoading(true);
    try {
      await deleteParticipant(dni);

      // Recargar lista de participantes
      await loadParticipants();

      const successMsg = `Participante ${nombre} eliminado exitosamente`;
      if (Platform.OS === 'web') {
        window.alert(successMsg);
      } else {
        Alert.alert('Éxito', successMsg);
      }
    } catch (error: any) {
      const errorMsg = error.message || 'Error al eliminar participante';
      if (Platform.OS === 'web') {
        window.alert(errorMsg);
      } else {
        Alert.alert('Error', errorMsg);
      }
    } finally {
      setLoading(false);
    }
  };

  // Cargar admin_responsables cuando el usuario es super_admin
  useEffect(() => {
    if (user && isSuperAdmin()) {
      loadAdminResponsables();
    }
  }, [user?.uid]);

  // Cargar usuarios cuando cambia el admin_responsable seleccionado o el usuario
  useEffect(() => {
    if (user) {
      loadUsers();
    }
  }, [user?.uid, user?.role, selectedAdminResponsable?.uid]);

  // Recargar participantes cuando cambia el evento seleccionado
  useEffect(() => {
    if (currentEvent) {
      loadParticipants();
    } else {
      setParticipants([]);
    }
  }, [currentEvent?.id]);

  /**
   * Abrir modal de crear usuario
   */
  const handleOpenCreateUser = () => {
    setNewUserEmail('');
    setNewUserPassword('');
    setNewUserUsername('');
    // Set initial role based on creatingUserType
    setNewUserRole(creatingUserType);
    setAdminPassword('');
    setCreateUserModalVisible(true);
  };

  /**
   * Crear nuevo usuario
   */
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

      // Determine organization based on creator's role and user type being created
      let orgId: string | null = null;

      if (newUserRole === 'admin_responsable') {
        // Admin responsables need a NEW organization created for them
        // For now, we'll create the organization with their email as the name
        // This will be done in a separate step after user creation
        orgId = null; // Will be set after organization creation
      } else if (isSuperAdmin()) {
        // Super admin creating admin/controlador needs to use selected admin_responsable's org
        if (!selectedAdminResponsable?.organizationId) {
          setLoading(false);
          Alert.alert('Error', 'Selecciona un Administrador Responsable primero');
          return;
        }
        orgId = selectedAdminResponsable.organizationId;
      } else {
        // Admin responsable or admin creating users in their own org
        orgId = user.organizationId || null;
      }

      // For admin_responsable, their own UID will be their organizationId
      // This is set after creation since we don't know the UID yet
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

      // If creating an admin_responsable, set their organizationId to their own UID
      // The admin_responsable IS the organization (no separate organizations collection needed)
      if (newUserRole === 'admin_responsable') {
        const { updateUserOrganization } = await import('@/services/userService');
        await updateUserOrganization(newUid, newUid);
      }

      setLoading(false);
      setCreateUserModalVisible(false);

      // Recargar lista de usuarios y admin_responsables
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
      console.error('Error creando usuario:', error);
      Alert.alert('Error', error.message || 'No se pudo crear el usuario');
    }
  };

  /**
   * Abrir modal de editar rol
   */
  const handleOpenEditRole = (targetUser: User) => {
    // Safety check: can only edit roles of users you can manage
    if (!user || !canManageRole(user.role, targetUser.role)) {
      Alert.alert('Error', 'No tienes permisos para cambiar el rol de este usuario');
      return;
    }

    setSelectedUser(targetUser);
    setEditRoleModalVisible(true);
  };

  /**
   * Actualizar rol de usuario
   */
  const handleUpdateRole = async (newRole: UserRole) => {
    if (!selectedUser) return;

    try {
      setLoading(true);
      await updateUserRole(selectedUser.uid, newRole);
      setLoading(false);
      setEditRoleModalVisible(false);

      // Recargar lista de usuarios
      await loadUsers();

      Alert.alert(
        'Rol actualizado',
        `El rol de ${selectedUser.email} ha sido actualizado a ${newRole}.`
      );
    } catch (error) {
      setLoading(false);
      console.error('Error actualizando rol:', error);
      Alert.alert('Error', 'No se pudo actualizar el rol del usuario');
    }
  };

  /**
   * Eliminar usuario de Firestore
   * NOTA: El usuario seguirá existiendo en Firebase Auth
   */
  const handleDeleteUser = (targetUser: User) => {
    // Safety check: can only delete users you can manage
    if (!user || !canManageRole(user.role, targetUser.role)) {
      Alert.alert('Error', 'No tienes permisos para eliminar este usuario');
      return;
    }

    // Can't delete yourself
    if (targetUser.uid === user.uid) {
      Alert.alert('Error', 'No puedes eliminarte a ti mismo');
      return;
    }

    Alert.alert(
      'Eliminar usuario',
      `¿Estás seguro de que quieres eliminar a ${targetUser.email}?\n\nNOTA: El usuario será eliminado de la base de datos pero la cuenta de autenticación permanecerá activa en Firebase Auth.`,
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

              // If deleted user was the selected admin_responsable, clear selection
              if (selectedAdminResponsable?.uid === targetUser.uid) {
                setSelectedAdminResponsable(null);
              }

              // Reload admin_responsables if super_admin and deleted user was an admin_responsable
              if (isSuperAdmin() && targetUser.role === 'admin_responsable') {
                await loadAdminResponsables();
              }

              // Recargar lista de usuarios
              await loadUsers();

              Alert.alert(
                'Usuario eliminado',
                `${targetUser.email} ha sido eliminado de la base de datos.`
              );
            } catch (error) {
              setLoading(false);
              console.error('Error eliminando usuario:', error);
              Alert.alert('Error', 'No se pudo eliminar el usuario');
            }
          },
        },
      ]
    );
  };

  /**
   * Exportar todos los datos a Excel
   * Genera un archivo con dos hojas: Participantes y Logs
   */
  const handleExportData = async () => {
    if (!currentEvent) {
      Alert.alert('Error', 'Selecciona un evento primero desde la sección de Eventos');
      return;
    }

    try {
      setLoading(true);

      // Generar y descargar archivo usando el evento actual
      const fileUri = await exportDataToExcel(currentEvent.id);

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

  // Handlers for event management
  const handleCreateEvent = () => {
    setEditingEvent(null);
    setShowEventForm(true);
  };

  const handleEditEvent = (event: Event) => {
    setEditingEvent(event);
    setShowEventForm(true);
  };

  const handleResetEvent = (event: Event) => {
    setResetEvent(event);
    setShowResetModal(true);
  };

  const handleAssignUsers = (event: Event) => {
    setAssignmentEvent(event);
    setShowUserAssignment(true);
  };

  const handleEventSaved = (event: Event) => {
    setShowEventForm(false);
    setEditingEvent(null);
    refreshEvents();
  };

  const handleResetComplete = (type: ResetType, count: number) => {
    setShowResetModal(false);
    setResetEvent(null);
    // Reload participants if current event was reset
    if (currentEvent && resetEvent?.id === currentEvent.id) {
      loadParticipants();
    }
  };

  // Renderizar contenido según la sección seleccionada
  const renderSectionContent = () => {
    switch (selectedSection) {
      case 'user-info':
        return renderUserInfoSection();
      case 'events':
        return renderEventsSection();
      case 'participants':
        return renderParticipantsSection();
      case 'users':
        return renderUsersSection();
      case 'about':
        return renderAboutSection();
      default:
        return null;
    }
  };

  // Sección: Gestión de Eventos
  const renderEventsSection = () => {
    // Show event form
    if (showEventForm) {
      return (
        <EventForm
          event={editingEvent}
          organizationId={user?.organizationId || undefined}
          onSave={handleEventSaved}
          onCancel={() => {
            setShowEventForm(false);
            setEditingEvent(null);
          }}
        />
      );
    }

    // Show user assignment
    if (showUserAssignment && assignmentEvent) {
      return (
        <UserEventAssignment
          event={assignmentEvent}
          onClose={() => {
            setShowUserAssignment(false);
            setAssignmentEvent(null);
          }}
          onAssignmentChange={() => {
            // Could refresh any relevant data here
          }}
        />
      );
    }

    // Show event manager
    return (
      <View style={styles.section}>
        <EventManager
          organizationId={user?.organizationId || undefined}
          onCreateEvent={handleCreateEvent}
          onEditEvent={handleEditEvent}
          onResetEvent={handleResetEvent}
          onAssignUsers={handleAssignUsers}
          onSelectEvent={(event) => {
            setCurrentEvent(event);
          }}
        />

        {/* Current event indicator */}
        {currentEvent && (
          <View style={[
            styles.currentEventBanner,
            { backgroundColor: Colors[colorScheme ?? 'light'].success + '20' }
          ]}>
            <Text style={[styles.currentEventLabel, { color: Colors[colorScheme ?? 'light'].success }]}>
              Evento activo:
            </Text>
            <Text style={[styles.currentEventName, { color: Colors[colorScheme ?? 'light'].text }]}>
              {currentEvent.name}
            </Text>
          </View>
        )}
      </View>
    );
  };

  // Sección: Información de Usuario
  const renderUserInfoSection = () => (
    <View style={styles.section}>
      <ThemedText style={styles.sectionTitle}>👤 Mi Perfil</ThemedText>

      {user ? (
        <View
          style={[ 
            styles.infoCard,
            colorScheme === 'dark' ? Shadows.light : Shadows.light,
            {
              backgroundColor:
                colorScheme === 'dark'
                  ? Colors.dark.cardBackground
                  : Colors.light.cardBackground,
            },
          ]}
        >
          <ThemedText style={styles.infoText}>
            <ThemedText style={styles.infoBold}>Nombre:</ThemedText> {user.username}
          </ThemedText>
          <ThemedText style={[styles.infoText, { marginTop: 10 }]}>
            <ThemedText style={styles.infoBold}>Email:</ThemedText> {user.email}
          </ThemedText>
          <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 10 }}>
            <ThemedText style={[styles.infoText, styles.infoBold]}>Rol: </ThemedText>
            <RoleBadge role={user.role} />
          </View>
          <ThemedText style={[styles.infoText, { marginTop: 10 }]}>
            <ThemedText style={styles.infoBold}>UID:</ThemedText> <ThemedText style={styles.infoCode}>{user.uid}</ThemedText>
          </ThemedText>
        </View>
      ) : (
        <View style={styles.infoCard}>
          <ThemedText style={styles.infoText}>
            Cargando información del usuario...
          </ThemedText>
        </View>
      )}
    </View>
  );

  // Sección: Gestión de Participantes
  const renderParticipantsSection = () => (
    <View style={styles.section}>
      <ThemedText style={styles.sectionTitle}>
        📊 Gestión de Participantes
      </ThemedText>

      {/* Event selector */}
      <View style={styles.eventSelectorSection}>
        <ThemedText style={styles.fieldLabel}>Evento:</ThemedText>
        {isLoadingEvents ? (
          <ActivityIndicator size="small" color={Colors[colorScheme ?? 'light'].primary} />
        ) : availableEvents.length === 0 ? (
          <View style={[
            styles.currentEventBanner,
            { backgroundColor: Colors[colorScheme ?? 'light'].warning + '20' }
          ]}>
            <Text style={[styles.currentEventLabel, { color: Colors[colorScheme ?? 'light'].warning }]}>
              ⚠️ No hay eventos disponibles. Crea uno en la sección "Eventos".
            </Text>
          </View>
        ) : (
          <View style={styles.eventSelectorList}>
            {availableEvents.map((event) => (
              <TouchableOpacity
                key={event.id}
                style={[
                  styles.eventSelectorOption,
                  {
                    backgroundColor: currentEvent?.id === event.id
                      ? Colors[colorScheme ?? 'light'].primary
                      : Colors[colorScheme ?? 'light'].cardBackground,
                    borderColor: currentEvent?.id === event.id
                      ? Colors[colorScheme ?? 'light'].primary
                      : Colors[colorScheme ?? 'light'].border,
                  },
                ]}
                onPress={() => setCurrentEvent(event)}
              >
                <Text
                  style={[
                    styles.eventSelectorOptionText,
                    {
                      color: currentEvent?.id === event.id
                        ? '#fff'
                        : Colors[colorScheme ?? 'light'].text,
                    },
                  ]}
                  numberOfLines={1}
                >
                  {event.name}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        )}
      </View>

      {/* Import mode selector */}
      <View style={styles.importModeSection}>
        <ThemedText style={styles.fieldLabel}>Modo de importación:</ThemedText>
        <View style={styles.roleSelector}>
          <TouchableOpacity
            style={[
              styles.roleOption,
              importMode === 'merge' && { backgroundColor: Colors.light.success },
            ]}
            onPress={() => setImportMode('merge')}
          >
            <Text style={[styles.roleOptionText, importMode === 'merge' && { color: '#fff' }]}>
              Añadir
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[
              styles.roleOption,
              importMode === 'replace' && { backgroundColor: Colors.light.error },
            ]}
            onPress={() => setImportMode('replace')}
          >
            <Text style={[styles.roleOptionText, importMode === 'replace' && { color: '#fff' }]}>
              Total (Reemplazar)
            </Text>
          </TouchableOpacity>
        </View>
        <ThemedText style={[styles.actionDescription, { marginTop: Spacing.xs }]}>
          {importMode === 'merge'
            ? 'Añade nuevos participantes sin borrar los existentes'
            : 'Elimina todos los participantes existentes y carga los nuevos'}
        </ThemedText>
      </View>

      <TouchableOpacity
        style={[
          styles.actionCard,
          colorScheme === 'dark' ? Shadows.light : Shadows.light,
          {
            backgroundColor:
              colorScheme === 'dark'
                ? Colors.dark.cardBackground
                : Colors.light.cardBackground,
            opacity: currentEvent ? 1 : 0.5,
          },
        ]}
        onPress={handleImportCSV}
        disabled={loading || !currentEvent}
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
            opacity: currentEvent ? 1 : 0.5,
          },
        ]}
        onPress={handleExportData}
        disabled={loading || !currentEvent}
        activeOpacity={0.7}
      >
        <Text style={styles.actionIcon}>📥</Text>
        <View style={styles.actionTextContainer}>
          <ThemedText style={styles.actionTitle}>
            Exportar datos a Excel
          </ThemedText>
          <ThemedText style={styles.actionDescription}>
            Descargar participantes y logs del evento actual
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
        onPress={handleOpenAddParticipant}
        disabled={loading}
        activeOpacity={0.7}
      >
        <Text style={styles.actionIcon}>➕</Text>
        <View style={styles.actionTextContainer}>
          <ThemedText style={styles.actionTitle}>
            Añadir participante individual
          </ThemedText>
          <ThemedText style={styles.actionDescription}>
            Registrar un participante manualmente
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

      {/* Tabla de participantes */}
      <View style={[styles.section, { marginTop: Spacing.xl }]}>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: Spacing.md }}>
          <ThemedText style={styles.sectionTitle}>
            👥 Lista de Participantes ({participants.length})
          </ThemedText>
          <TouchableOpacity
            onPress={loadParticipants}
            disabled={loadingParticipants}
            style={{ padding: Spacing.xs }}
          >
            <Text style={{ fontSize: 20 }}>{loadingParticipants ? '⏳' : '🔄'}</Text>
          </TouchableOpacity>
        </View>

        {loadingParticipants ? (
          <View style={{ padding: Spacing.xl, alignItems: 'center' }}>
            <ActivityIndicator size="large" color={Colors.light.primary} />
            <ThemedText style={{ marginTop: Spacing.md }}>Cargando participantes...</ThemedText>
          </View>
        ) : participants.length === 0 ? (
          <View style={[styles.infoCard, {
            backgroundColor: colorScheme === 'dark' ? Colors.dark.cardBackground : Colors.light.cardBackground
          }]}>
            <ThemedText style={styles.infoText}>
              No hay participantes registrados. Importa o añade participantes para comenzar.
            </ThemedText>
          </View>
        ) : (
          <View style={styles.table}>
            {/* Cabecera de la tabla */}
            <View style={[styles.tableRow, styles.tableHeader]}>
              <Text style={[styles.tableCell, styles.tableHeaderCell, styles.colDNI]}>DNI</Text>
              <Text style={[styles.tableCell, styles.tableHeaderCell, styles.colNombre]}>Nombre</Text>
              <Text style={[styles.tableCell, styles.tableHeaderCell, styles.colPermisos, { textAlign: 'center' }]}>Permisos</Text>
              <Text style={[styles.tableCell, styles.tableHeaderCell, styles.colAcciones]}>Acciones</Text>
            </View>

            {/* Filas de participantes */}
            <ScrollView style={{ maxHeight: 600 }}>
              {participants.map((participant, index) => (
                <View
                  key={participant.dni}
                  style={[
                    styles.tableRow,
                    { backgroundColor: index % 2 === 0
                      ? (colorScheme === 'dark' ? Colors.dark.cardBackground : '#fff')
                      : (colorScheme === 'dark' ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.02)')
                    }
                  ]}
                >
                  <View style={[styles.tableCell, styles.colDNI]}>
                    <ThemedText style={{ fontSize: FontSizes.xs, fontWeight: '600' }}>{participant.dni}</ThemedText>
                  </View>
                  <View style={[styles.tableCell, styles.colNombre]}>
                    <ThemedText style={{ fontSize: FontSizes.sm, fontWeight: 'bold' }}>{participant.nombre}</ThemedText>
                    {participant.email && (
                      <ThemedText style={{ fontSize: FontSizes.xs, opacity: 0.7 }}>📧 {participant.email}</ThemedText>
                    )}
                    {participant.cargo && (
                      <ThemedText style={{ fontSize: FontSizes.xs, opacity: 0.7 }}>💼 {participant.cargo}</ThemedText>
                    )}
                  </View>
                  <View style={[styles.tableCell, styles.colPermisos]}>
                    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 4, justifyContent: 'center' }}>
                      {participant.haPagado && (
                        <View style={[styles.permisoBadge, { backgroundColor: Colors.light.success }]}>
                          <Text style={styles.permisoBadgeText}>Pagado</Text>
                        </View>
                      )}
                      {participant.permisos.aula_magna && (
                        <View style={[styles.permisoBadge, { backgroundColor: Colors.light.modeCena }]}>
                          <Text style={styles.permisoBadgeText}>Aula Magna</Text>
                        </View>
                      )}
                      {participant.permisos.master_class && (
                        <View style={[styles.permisoBadge, { backgroundColor: Colors.light.modeAulaMagna }]}>
                          <Text style={styles.permisoBadgeText}>Master Class</Text>
                        </View>
                      )}
                      {participant.permisos.cena && (
                        <View style={[styles.permisoBadge, { backgroundColor: Colors.light.modeMasterClass }]}>
                          <Text style={styles.permisoBadgeText}>Cena</Text>
                        </View>
                      )}
                    </View>
                  </View>
                  <View style={[styles.tableCell, styles.colAcciones]}>
                    <TouchableOpacity
                      onPress={() => handleDeleteParticipant(participant.dni, participant.nombre)}
                      style={[styles.deleteButton, { backgroundColor: Colors.light.error }]}
                      disabled={loading}
                    >
                      <Text style={styles.deleteButtonText}>🗑️</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              ))}
            </ScrollView>
          </View>
        )}
      </View>

      <View style={[styles.section, { marginTop: Spacing.xl }]}>
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
    </View>
  );

  // Renderizar tarjeta de usuario individual
  const renderUserCard = (userData: User) => {
    const canManage = user && canManageRole(user.role, userData.role);
    const isCurrentUser = userData.uid === user?.uid;

    return (
      <View
        key={userData.uid}
        style={[
          styles.userCard,
          colorScheme === 'dark' ? Shadows.light : Shadows.light,
          {
            backgroundColor:
              colorScheme === 'dark'
                ? Colors.dark.cardBackground
                : Colors.light.cardBackground,
          },
        ]}
      >
        <View style={styles.userCardHeader}>
          <View style={styles.userCardInfo}>
            <ThemedText style={styles.userCardName}>
              {userData.username}
              {isCurrentUser && ' (Tú)'}
            </ThemedText>
            <ThemedText style={styles.userCardEmail}>
              {userData.email}
            </ThemedText>
            {userData.organizationId && (
              <ThemedText style={[styles.userCardEmail, { fontSize: 10, opacity: 0.6 }]}>
                Org: {userData.organizationId.substring(0, 8)}...
              </ThemedText>
            )}
          </View>
          <RoleBadge role={userData.role} />
        </View>

        {canManage && !isCurrentUser && (
          <View style={styles.userCardActions}>
            <TouchableOpacity
              style={[
                styles.userActionButton,
                {
                  backgroundColor:
                    colorScheme === 'dark'
                      ? Colors.dark.primary
                      : Colors.light.primary,
                },
              ]}
              onPress={() => handleOpenEditRole(userData)}
              disabled={loading}
            >
              <Text style={styles.userActionButtonText}>
                ✏️ Cambiar rol
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[
                styles.userActionButton,
                { backgroundColor: Colors.light.error },
              ]}
              onPress={() => handleDeleteUser(userData)}
              disabled={loading}
            >
              <Text style={styles.userActionButtonText}>
                🗑️ Eliminar
              </Text>
            </TouchableOpacity>
          </View>
        )}
      </View>
    );
  };

  // Sección: Gestión de Usuarios (jerárquica)
  const renderUsersSection = () => {
    // Determine what sections to show based on role
    const showAdminResponsablesSection = isSuperAdmin();
    const canCreateAdminOrController = user?.role === 'super_admin' ||
                                       user?.role === 'admin_responsable' ||
                                       user?.role === 'admin';

    // Get the organization context label
    const getOrgContextLabel = (): string => {
      if (isSuperAdmin()) {
        return selectedAdminResponsable
          ? `Organización: ${selectedAdminResponsable.username}`
          : 'Selecciona un Admin Responsable para ver sus usuarios';
      }
      if (user?.role === 'admin_responsable') {
        return 'Tu organización';
      }
      if (user?.role === 'admin') {
        return 'Controladores de tu organización';
      }
      return '';
    };

    return (
      <View style={styles.section}>
        <ThemedText style={styles.sectionTitle}>👥 Gestión de Usuarios</ThemedText>

        {/* === SECCIÓN 1: Admin Responsables (solo visible para super_admin) === */}
        {showAdminResponsablesSection && (
          <View style={styles.userHierarchySection}>
            <View style={styles.userSectionHeader}>
              <ThemedText style={styles.userSectionTitle}>
                🏢 Administradores Responsables
              </ThemedText>
              <TouchableOpacity
                style={[
                  styles.addUserButton,
                  { backgroundColor: ROLE_COLORS['admin_responsable'] },
                ]}
                onPress={() => {
                  setCreatingUserType('admin_responsable');
                  handleOpenCreateUser();
                }}
                disabled={loading}
              >
                <Text style={styles.addUserButtonText}>+ Nuevo Admin Resp.</Text>
              </TouchableOpacity>
            </View>

            {adminResponsables.length === 0 ? (
              <View style={[
                styles.infoCard,
                {
                  backgroundColor: colorScheme === 'dark'
                    ? Colors.dark.cardBackground
                    : Colors.light.lightBackground,
                },
              ]}>
                <ThemedText style={styles.infoText}>
                  No hay administradores responsables. Crea uno para comenzar a gestionar organizaciones.
                </ThemedText>
              </View>
            ) : (
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                style={styles.adminResponsablesScroll}
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
                          : colorScheme === 'dark'
                            ? Colors.dark.cardBackground
                            : Colors.light.cardBackground,
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

            {/* Acciones para el admin_responsable seleccionado */}
            {selectedAdminResponsable && (
              <View style={styles.selectedAdminActions}>
                <TouchableOpacity
                  style={[
                    styles.userActionButton,
                    { backgroundColor: Colors.light.error, flex: 0, paddingHorizontal: Spacing.lg },
                  ]}
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

        {/* === SECCIÓN 2: Admins y Controladores === */}
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

            {/* Botón crear usuario (solo si tiene contexto de org) */}
            {canCreateAdminOrController && (
              (isSuperAdmin() && selectedAdminResponsable) || !isSuperAdmin()
            ) && (
              <TouchableOpacity
                style={[
                  styles.addUserButton,
                  { backgroundColor: Colors.light.primary },
                ]}
                onPress={() => {
                  // Si es super_admin, puede crear admin o controlador
                  // Si es admin_responsable, puede crear admin o controlador
                  // Si es admin, solo puede crear controlador
                  if (user?.role === 'admin') {
                    setCreatingUserType('controlador');
                  } else {
                    setCreatingUserType('admin'); // Default, can change in modal
                  }
                  handleOpenCreateUser();
                }}
                disabled={loading}
              >
                <Text style={styles.addUserButtonText}>+ Nuevo Usuario</Text>
              </TouchableOpacity>
            )}
          </View>

          {/* Mostrar mensaje si super_admin no ha seleccionado admin_responsable */}
          {isSuperAdmin() && !selectedAdminResponsable ? (
            <View style={[
              styles.infoCard,
              {
                backgroundColor: colorScheme === 'dark'
                  ? Colors.dark.cardBackground
                  : Colors.light.lightBackground,
              },
            ]}>
              <ThemedText style={styles.infoText}>
                👆 Selecciona un Administrador Responsable de la lista de arriba para ver y gestionar los usuarios de su organización.
              </ThemedText>
            </View>
          ) : users.length === 0 ? (
            <View style={[
              styles.infoCard,
              {
                backgroundColor: colorScheme === 'dark'
                  ? Colors.dark.cardBackground
                  : Colors.light.lightBackground,
              },
            ]}>
              <ThemedText style={styles.infoText}>
                No hay {user?.role === 'admin' ? 'controladores' : 'administradores ni controladores'} en esta organización.
                Crea el primer usuario usando el botón de arriba.
              </ThemedText>
            </View>
          ) : (
            <View>
              {/* Separar admins y controladores para mejor visualización */}
              {user?.role !== 'admin' && users.filter(u => u.role === 'admin').length > 0 && (
                <View style={styles.userRoleGroup}>
                  <ThemedText style={styles.userRoleGroupTitle}>
                    Administradores ({users.filter(u => u.role === 'admin').length})
                  </ThemedText>
                  {users.filter(u => u.role === 'admin').map(renderUserCard)}
                </View>
              )}

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
      </View>
    );
  };

  // Sección: Acerca de
  const renderAboutSection = () => (
    <View style={styles.section}>
      <ThemedText style={styles.sectionTitle}>ℹ️ Acerca de la Aplicación</ThemedText>

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
        <ThemedText style={[styles.infoBold, { fontSize: FontSizes.lg, marginBottom: Spacing.md }]}>
          Impuls Educació
        </ThemedText>

        <ThemedText style={styles.infoText}>
          <ThemedText style={styles.infoBold}>Organización:</ThemedText>
          Impuls Educació es una organización dedicada a la formación y educación.
        </ThemedText>

        <ThemedText style={[styles.infoText, { marginTop: 15 }]}>
          <ThemedText style={styles.infoBold}>Web:</ThemedText>
          https://impulseducacio.org/
        </ThemedText>

        <ThemedText style={[styles.infoBold, { fontSize: FontSizes.lg, marginTop: Spacing.xxl, marginBottom: Spacing.md }]}>
          Desarrollador
        </ThemedText>

        <ThemedText style={styles.infoText}>
          <ThemedText style={styles.infoBold}>Aplicación desarrollada por:</ThemedText>
          Xavi Lara
        </ThemedText>

        <ThemedText style={[styles.infoText, { marginTop: 15 }]}>
          <ThemedText style={styles.infoBold}>Contacto:</ThemedText>
          zenid77@gmail.com
        </ThemedText>

        <ThemedText style={[styles.infoBold, { fontSize: FontSizes.lg, marginTop: Spacing.xxl, marginBottom: Spacing.md }]}>
          Información Técnica
        </ThemedText>

        <ThemedText style={styles.infoText}>
          <ThemedText style={styles.infoBold}>Versión:</ThemedText> 1.0.0
        </ThemedText>

        <ThemedText style={[styles.infoText, { marginTop: 10 }]}>
          <ThemedText style={styles.infoBold}>Tecnologías:</ThemedText>
          • React Native + Expo
          • Firebase (Authentication, Firestore, Hosting)
          • TypeScript
        </ThemedText>
      </View>
    </View>
  );

  return (
    <ThemedView style={styles.container}>
      {/* Layout horizontal: Sidebar + Contenido */}
      <View style={styles.mainLayout}>
        {/* Sidebar colapsable */}
        <AdminSidebar
          isCollapsed={sidebarCollapsed}
          onToggleCollapse={() => setSidebarCollapsed(!sidebarCollapsed)}
          selectedSection={selectedSection}
          onSelectSection={setSelectedSection}
        />

        {/* Contenido principal */}
        <View style={styles.mainContent}>
          {/* Header con logo y login */}
          <View style={styles.headerContainer}>
            <View style={styles.logoContainer}>
              <Image
                source={{ uri: 'https://impulseducacio.org/wp-content/uploads/2020/02/logo-web-impuls.png' }}
                style={styles.logo}
                resizeMode="contain"
              />
            </View>
            <View style={styles.loginContainer}>
              <LoginButton />
            </View>
          </View>

          <ScrollView contentContainerStyle={styles.content} style={{ flex: 1 }}>
            {renderSectionContent()}

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
      
          {/* Footer para el botón de volver */}
          <View style={styles.footer}>
            <BackButton disabled={loading} style={{ margin: 0 }} />
          </View>
        </View>
      </View>

      {/* Modal de información de formato CSV */}
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

                        <ThemedText style={styles.modalText}><ThemedText style={{fontWeight: 'bold'}}>ESTRUCTURA REQUERIDA (Excel):</ThemedText>{'\n'}Una hoja llamada "INSCRIPCIONS/PAGAMENTS" con las siguientes columnas (el orden y el uso de mayúsculas no importa):{'\n'}DNI, NOM, COGNOMS, TIPUS D'ESCOLA, LLOC/RESPONSABILITAT, MAIL, TELÈFON, ACCESO, MASTER_CLASS, CENA, HA PAGAT?</ThemedText>

                        <ThemedText style={styles.modalText}><ThemedText style={{fontWeight: 'bold'}}>Nota sobre ACCESO:</ThemedText> El valor "Presencial" en esta columna dará acceso al "aula_magna". Cualquier otro valor (ej. "Online") no dará acceso.</ThemedText>

                        <ThemedText style={styles.modalText}><ThemedText style={{fontWeight: 'bold'}}>Nota sobre permisos:</ThemedText> Para los campos de permisos (MASTER_CLASS, CENA) y el de pago (HA PAGAT?), un valor positivo puede ser "Si", "1", "Yes" o "True".</ThemedText>

            <TouchableOpacity
              style={[styles.modalCloseButton, { backgroundColor: colorScheme === 'dark' ? Colors.dark.primary : Colors.light.primary }]}
              onPress={() => setInfoModalVisible(false)}
            >
              <Text style={styles.modalCloseButtonText}>Entendido</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Modal de añadir participante individual */}
      <Modal
        animationType="slide"
        transparent={true}
        visible={isAddParticipantModalVisible}
        onRequestClose={() => setAddParticipantModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <ScrollView contentContainerStyle={{ flexGrow: 1, justifyContent: 'center', padding: Spacing.md }}>
            <View style={[styles.modalContent, { backgroundColor: colorScheme === 'dark' ? Colors.dark.cardBackground : Colors.light.cardBackground, maxHeight: '90%' }]}>
              <ThemedText style={styles.modalTitle}>Añadir Participante</ThemedText>

              <ScrollView style={{ maxHeight: 500 }}>
                {/* DNI */}
                <ThemedText style={styles.fieldLabel}>DNI *</ThemedText>
                <TextInput
                  style={[
                    styles.input,
                    {
                      backgroundColor: colorScheme === 'dark' ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.05)',
                      color: colorScheme === 'dark' ? '#fff' : '#000',
                    },
                  ]}
                  placeholder="12345678A"
                  placeholderTextColor={colorScheme === 'dark' ? 'rgba(255,255,255,0.5)' : 'rgba(0,0,0,0.5)'}
                  value={newParticipantDNI}
                  onChangeText={setNewParticipantDNI}
                  autoCapitalize="characters"
                />

                {/* Nombre */}
                <ThemedText style={styles.fieldLabel}>Nombre *</ThemedText>
                <TextInput
                  style={[
                    styles.input,
                    {
                      backgroundColor: colorScheme === 'dark' ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.05)',
                      color: colorScheme === 'dark' ? '#fff' : '#000',
                    },
                  ]}
                  placeholder="Juan Pérez García"
                  placeholderTextColor={colorScheme === 'dark' ? 'rgba(255,255,255,0.5)' : 'rgba(0,0,0,0.5)'}
                  value={newParticipantNombre}
                  onChangeText={setNewParticipantNombre}
                />

                {/* Email */}
                <ThemedText style={styles.fieldLabel}>Email</ThemedText>
                <TextInput
                  style={[
                    styles.input,
                    {
                      backgroundColor: colorScheme === 'dark' ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.05)',
                      color: colorScheme === 'dark' ? '#fff' : '#000',
                    },
                  ]}
                  placeholder="ejemplo@email.com"
                  placeholderTextColor={colorScheme === 'dark' ? 'rgba(255,255,255,0.5)' : 'rgba(0,0,0,0.5)'}
                  value={newParticipantEmail}
                  onChangeText={setNewParticipantEmail}
                  autoCapitalize="none"
                  keyboardType="email-address"
                />

                {/* Teléfono */}
                <ThemedText style={styles.fieldLabel}>Teléfono</ThemedText>
                <TextInput
                  style={[
                    styles.input,
                    {
                      backgroundColor: colorScheme === 'dark' ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.05)',
                      color: colorScheme === 'dark' ? '#fff' : '#000',
                    },
                  ]}
                  placeholder="612345678"
                  placeholderTextColor={colorScheme === 'dark' ? 'rgba(255,255,255,0.5)' : 'rgba(0,0,0,0.5)'}
                  value={newParticipantTelefono}
                  onChangeText={setNewParticipantTelefono}
                  keyboardType="phone-pad"
                />

                {/* Escuela */}
                <ThemedText style={styles.fieldLabel}>Tipo de Escuela</ThemedText>
                <TextInput
                  style={[
                    styles.input,
                    {
                      backgroundColor: colorScheme === 'dark' ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.05)',
                      color: colorScheme === 'dark' ? '#fff' : '#000',
                    },
                  ]}
                  placeholder="Pública / Concertada / Privada"
                  placeholderTextColor={colorScheme === 'dark' ? 'rgba(255,255,255,0.5)' : 'rgba(0,0,0,0.5)'}
                  value={newParticipantEscuela}
                  onChangeText={setNewParticipantEscuela}
                />

                {/* Cargo */}
                <ThemedText style={styles.fieldLabel}>Cargo/Responsabilidad</ThemedText>
                <TextInput
                  style={[
                    styles.input,
                    {
                      backgroundColor: colorScheme === 'dark' ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.05)',
                      color: colorScheme === 'dark' ? '#fff' : '#000',
                    },
                  ]}
                  placeholder="Director / Profesor / Coordinador"
                  placeholderTextColor={colorScheme === 'dark' ? 'rgba(255,255,255,0.5)' : 'rgba(0,0,0,0.5)'}
                  value={newParticipantCargo}
                  onChangeText={setNewParticipantCargo}
                />

                {/* Tipo de acceso */}
                <ThemedText style={styles.fieldLabel}>Tipo de Acceso</ThemedText>
                <View style={styles.roleSelector}>
                  <TouchableOpacity
                    style={[
                      styles.roleOption,
                      newParticipantAcceso === 'presencial' && { backgroundColor: Colors.light.primary },
                    ]}
                    onPress={() => setNewParticipantAcceso('presencial')}
                  >
                    <Text style={[styles.roleOptionText, newParticipantAcceso === 'presencial' && { color: '#fff' }]}>
                      Presencial
                    </Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[
                      styles.roleOption,
                      newParticipantAcceso === 'online' && { backgroundColor: Colors.light.primary },
                    ]}
                    onPress={() => setNewParticipantAcceso('online')}
                  >
                    <Text style={[styles.roleOptionText, newParticipantAcceso === 'online' && { color: '#fff' }]}>
                      Online
                    </Text>
                  </TouchableOpacity>
                </View>

                {/* Permisos */}
                <ThemedText style={[styles.fieldLabel, { marginTop: Spacing.md }]}>Permisos</ThemedText>

                <TouchableOpacity
                  style={styles.checkboxRow}
                  onPress={() => setNewParticipantHaPagado(!newParticipantHaPagado)}
                >
                  <View style={[styles.checkbox, newParticipantHaPagado && styles.checkboxChecked]}>
                    {newParticipantHaPagado && <Text style={styles.checkmark}>✓</Text>}
                  </View>
                  <ThemedText style={styles.checkboxLabel}>Ha pagado</ThemedText>
                </TouchableOpacity>

                <TouchableOpacity
                  style={styles.checkboxRow}
                  onPress={() => setNewParticipantMasterClass(!newParticipantMasterClass)}
                >
                  <View style={[styles.checkbox, newParticipantMasterClass && styles.checkboxChecked]}>
                    {newParticipantMasterClass && <Text style={styles.checkmark}>✓</Text>}
                  </View>
                  <ThemedText style={styles.checkboxLabel}>Acceso Master Class</ThemedText>
                </TouchableOpacity>

                <TouchableOpacity
                  style={styles.checkboxRow}
                  onPress={() => setNewParticipantCena(!newParticipantCena)}
                >
                  <View style={[styles.checkbox, newParticipantCena && styles.checkboxChecked]}>
                    {newParticipantCena && <Text style={styles.checkmark}>✓</Text>}
                  </View>
                  <ThemedText style={styles.checkboxLabel}>Acceso Cena</ThemedText>
                </TouchableOpacity>
              </ScrollView>

              {/* Botones */}
              <View style={styles.modalButtons}>
                <TouchableOpacity
                  style={[styles.modalButton, styles.modalCancelButton]}
                  onPress={() => setAddParticipantModalVisible(false)}
                >
                  <Text style={styles.modalCancelButtonText}>Cancelar</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[
                    styles.modalButton,
                    styles.modalConfirmButton,
                    { backgroundColor: colorScheme === 'dark' ? Colors.dark.primary : Colors.light.primary },
                  ]}
                  onPress={handleCreateParticipant}
                  disabled={loading}
                >
                  <Text style={styles.modalConfirmButtonText}>
                    {loading ? 'Creando...' : 'Crear'}
                  </Text>
                </TouchableOpacity>
              </View>
            </View>
          </ScrollView>
        </View>
      </Modal>

      {/* Modal de crear usuario */}
      <Modal
        animationType="slide"
        transparent={true}
        visible={isCreateUserModalVisible}
        onRequestClose={() => setCreateUserModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { backgroundColor: colorScheme === 'dark' ? Colors.dark.cardBackground : Colors.light.cardBackground }]}>
            <ThemedText style={styles.modalTitle}>
              {creatingUserType === 'admin_responsable'
                ? 'Crear Admin Responsable'
                : 'Crear nuevo usuario'}
            </ThemedText>

            {/* Show context info for super_admin creating admin/controlador */}
            {isSuperAdmin() && creatingUserType !== 'admin_responsable' && selectedAdminResponsable && (
              <View style={[styles.currentEventBanner, { backgroundColor: ROLE_COLORS['admin_responsable'] + '20', marginBottom: Spacing.md }]}>
                <ThemedText style={styles.currentEventLabel}>
                  Se creará en la organización de:
                </ThemedText>
                <ThemedText style={[styles.currentEventName, { color: ROLE_COLORS['admin_responsable'] }]}>
                  {selectedAdminResponsable.username}
                </ThemedText>
              </View>
            )}

            <TextInput
              style={[
                styles.input,
                {
                  backgroundColor: colorScheme === 'dark' ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.05)',
                  color: colorScheme === 'dark' ? '#fff' : '#000',
                },
              ]}
              placeholder="Email"
              placeholderTextColor={colorScheme === 'dark' ? 'rgba(255,255,255,0.5)' : 'rgba(0,0,0,0.5)'}
              value={newUserEmail}
              onChangeText={setNewUserEmail}
              autoCapitalize="none"
              keyboardType="email-address"
            />

            <TextInput
              style={[ 
                styles.input,
                {
                  backgroundColor: colorScheme === 'dark' ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.05)',
                  color: colorScheme === 'dark' ? '#fff' : '#000',
                },
              ]}
              placeholder="Nombre de usuario"
              placeholderTextColor={colorScheme === 'dark' ? 'rgba(255,255,255,0.5)' : 'rgba(0,0,0,0.5)'}
              value={newUserUsername}
              onChangeText={setNewUserUsername}
            />

            <TextInput
              style={[ 
                styles.input,
                {
                  backgroundColor: colorScheme === 'dark' ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.05)',
                  color: colorScheme === 'dark' ? '#fff' : '#000',
                },
              ]}
              placeholder="Contraseña (mínimo 6 caracteres)"
              placeholderTextColor={colorScheme === 'dark' ? 'rgba(255,255,255,0.5)' : 'rgba(0,0,0,0.5)'}
              value={newUserPassword}
              onChangeText={setNewUserPassword}
              secureTextEntry
            />

            <ThemedText style={[styles.modalText, { marginTop: Spacing.md }]}>
              Rol del usuario:
            </ThemedText>
            {/* If creating admin_responsable, role is fixed */}
            {creatingUserType === 'admin_responsable' ? (
              <View style={[
                styles.roleOption,
                { backgroundColor: ROLE_COLORS['admin_responsable'], alignSelf: 'flex-start' }
              ]}>
                <Text style={[styles.roleOptionText, { color: '#fff' }]}>
                  {ROLE_LABELS['admin_responsable']}
                </Text>
              </View>
            ) : (
              <View style={styles.roleSelector}>
                {/* Filter out admin_responsable since that's created via separate button */}
                {user && getCreatableRoles(user.role)
                  .filter(role => role !== 'admin_responsable')
                  .map((role) => (
                    <TouchableOpacity
                      key={role}
                      style={[
                        styles.roleOption,
                        newUserRole === role && {
                          backgroundColor: ROLE_COLORS[role],
                        },
                      ]}
                      onPress={() => setNewUserRole(role)}
                    >
                      <Text style={[
                        styles.roleOptionText,
                        newUserRole === role && { color: '#fff' },
                      ]}>
                        {ROLE_LABELS[role]}
                      </Text>
                    </TouchableOpacity>
                  ))}
              </View>
            )}

            <TextInput
              style={[ 
                styles.input,
                {
                  backgroundColor: colorScheme === 'dark' ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.05)',
                  color: colorScheme === 'dark' ? '#fff' : '#000',
                  marginTop: Spacing.md,
                },
              ]}
              placeholder="Tu contraseña de admin (para confirmar)"
              placeholderTextColor={colorScheme === 'dark' ? 'rgba(255,255,255,0.5)' : 'rgba(0,0,0,0.5)'}
              value={adminPassword}
              onChangeText={setAdminPassword}
              secureTextEntry
            />
            <View style={styles.modalButtons}>
              <TouchableOpacity
                style={[styles.modalButton, { backgroundColor: 'rgba(0,0,0,0.1)' }]}
                onPress={() => setCreateUserModalVisible(false)}
                disabled={loading}
              >
                <Text style={styles.cancelButtonText}>Cancelar</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[
                  styles.modalButton,
                  {
                    backgroundColor: colorScheme === 'dark' ? Colors.dark.primary : Colors.light.primary,
                  },
                ]}
                onPress={handleCreateUser}
                disabled={loading}
              >
                <Text style={styles.confirmButtonText}>
                  {loading ? 'Creando...' : 'Crear usuario'}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
      {/* Modal de editar rol */}
      <Modal
        animationType="fade"
        transparent={true}
        visible={isEditRoleModalVisible}
        onRequestClose={() => setEditRoleModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { backgroundColor: colorScheme === 'dark' ? Colors.dark.cardBackground : Colors.light.cardBackground }]}>
            <ThemedText style={styles.modalTitle}>Cambiar rol de usuario</ThemedText>
            {selectedUser && (
              <>
                <ThemedText style={styles.modalText}>
                  Usuario:
                  <ThemedText style={{ fontWeight: 'bold' }}>
                    {selectedUser.email}
                  </ThemedText>
                </ThemedText>
                <ThemedText style={styles.modalText}>
                  Rol actual:
                  <ThemedText style={{ fontWeight: 'bold' }}>
                    {selectedUser.role}
                  </ThemedText>
                </ThemedText>
                <ThemedText style={[styles.modalText, { marginTop: Spacing.md }]}>
                  Selecciona el nuevo rol:
                </ThemedText>
                <View style={styles.roleSelector}>
                  {user && getCreatableRoles(user.role)
                    .filter((role) => canManageRole(user.role, role))
                    .map((role) => (
                      <TouchableOpacity
                        key={role}
                        style={[
                          styles.roleOption,
                          { backgroundColor: ROLE_COLORS[role] },
                        ]}
                        onPress={() => handleUpdateRole(role)}
                        disabled={loading || selectedUser.role === role}
                      >
                        <Text style={[styles.roleOptionText, { color: '#fff' }]}>
                          {ROLE_LABELS[role]}
                        </Text>
                      </TouchableOpacity>
                    ))}
                </View>
              </>
            )}
            <TouchableOpacity
              style={[
                styles.modalCloseButton,
                { backgroundColor: 'rgba(0,0,0,0.1)', marginTop: Spacing.lg },
              ]}
              onPress={() => setEditRoleModalVisible(false)}
              disabled={loading}
            >
              <Text style={[styles.cancelButtonText]}>Cancelar</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Modal de reset de evento */}
      <EventResetModal
        visible={showResetModal}
        event={resetEvent}
        onClose={() => {
          setShowResetModal(false);
          setResetEvent(null);
        }}
        onResetComplete={handleResetComplete}
      />
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  mainLayout: {
    flex: 1,
    flexDirection: 'row',
  },
  mainContent: {
    flex: 1,
  },
  headerContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.md,
    paddingTop: Spacing.md,
    paddingBottom: Spacing.sm,
  },
  logoContainer: {
    flex: 1,
    alignItems: 'center',
  },
  logo: {
    width: 140,
    height: 48,
  },
  loginContainer: {
    position: 'absolute',
    right: Spacing.md,
    top: Spacing.md,
    zIndex: 9999,
    elevation: 9999, // Para Android
  },
  content: {
    padding: Spacing.lg,
  },
  footer: {
    padding: Spacing.md,
    borderTopWidth: 1,
    borderColor: 'rgba(0,0,0,0.1)',
  },
  section: {
    marginBottom: Spacing.xxl,
  },
  sectionTitle: {
    fontSize: FontSizes.xl,
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
    fontSize: FontSizes.lg,
    fontWeight: 'bold',
    marginBottom: 5,
  },
  actionDescription: {
    fontSize: FontSizes.md,
    opacity: 0.7,
  },
  infoButton: {
    padding: Spacing.md,
    borderRadius: BorderRadius.full,
    alignItems: 'center',
  },
  infoButtonText: {
    color: '#fff',
    fontSize: FontSizes.md,
    fontWeight: 'bold',
  },
  infoCard: {
    padding: Spacing.lg,
    borderRadius: BorderRadius.md,
  },
  infoText: {
    fontSize: FontSizes.md,
    lineHeight: 22,
  },
  infoBold: {
    fontWeight: 'bold',
  },
  infoCode: {
    fontFamily: 'monospace',
    fontSize: FontSizes.sm,
    opacity: 0.8,
  },
  loadingContainer: {
    alignItems: 'center',
    padding: Spacing.xxl,
  },
  loadingText: {
    marginTop: Spacing.md,
    fontSize: FontSizes.lg,
  },
  backButton: {
    margin: Spacing.md,
    padding: Spacing.md,
    borderRadius: BorderRadius.full,
    alignItems: 'center',
  },
  backButtonText: {
    color: '#fff',
    fontSize: FontSizes.lg,
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
    fontSize: FontSizes.xl,
    fontWeight: 'bold',
    marginBottom: Spacing.lg,
    textAlign: 'center',
  },
  modalText: {
    fontSize: FontSizes.md,
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
    fontSize: FontSizes.lg,
    fontWeight: 'bold',
  },
  // Estilos de gestión de usuarios
  userCard: {
    padding: Spacing.lg,
    borderRadius: BorderRadius.md,
    marginBottom: Spacing.md,
  },
  userCardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: Spacing.md,
  },
  userCardInfo: {
    flex: 1,
  },
  userCardName: {
    fontSize: FontSizes.lg,
    fontWeight: 'bold',
    marginBottom: 4,
  },
  userCardEmail: {
    fontSize: FontSizes.md,
    opacity: 0.7,
  },
  userRoleBadge: {
    paddingHorizontal: Spacing.sm,
    paddingVertical: Spacing.xs,
    borderRadius: BorderRadius.sm,
  },
  userRoleText: {
    fontSize: FontSizes.xs,
    fontWeight: 'bold',
    color: '#fff',
  },
  userCardActions: {
    flexDirection: 'row',
    gap: Spacing.sm,
  },
  userActionButton: {
    flex: 1,
    padding: Spacing.sm,
    borderRadius: BorderRadius.md,
    alignItems: 'center',
  },
  userActionButtonText: {
    color: '#fff',
    fontSize: FontSizes.sm,
    fontWeight: 'bold',
  },
  // Estilos de formulario de usuario
  input: {
    borderRadius: BorderRadius.md,
    padding: Spacing.md,
    marginBottom: Spacing.md,
    fontSize: FontSizes.lg,
  },
  roleSelector: {
    flexDirection: 'row',
    gap: Spacing.sm,
    marginTop: Spacing.sm,
    marginBottom: Spacing.md,
  },
  roleOption: {
    flex: 1,
    padding: Spacing.md,
    borderRadius: BorderRadius.md,
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.05)',
  },
  roleOptionText: {
    fontSize: FontSizes.md,
    fontWeight: 'bold',
  },
  modalButtons: {
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
  cancelButtonText: {
    fontSize: FontSizes.lg,
    fontWeight: 'bold',
    color: Colors.light.text,
  },
  confirmButtonText: {
    fontSize: FontSizes.lg,
    fontWeight: 'bold',
    color: '#fff',
  },
  fieldLabel: {
    fontSize: FontSizes.md,
    fontWeight: 'bold',
    marginTop: Spacing.sm,
    marginBottom: Spacing.xs,
    opacity: 0.8,
  },
  checkboxRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: Spacing.xs,
  },
  checkbox: {
    width: 24,
    height: 24,
    borderWidth: 2,
    borderColor: Colors.light.primary,
    borderRadius: BorderRadius.sm,
    marginRight: Spacing.sm,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkboxChecked: {
    backgroundColor: Colors.light.primary,
  },
  checkmark: {
    color: '#fff',
    fontSize: FontSizes.lg,
    fontWeight: 'bold',
  },
  checkboxLabel: {
    fontSize: FontSizes.md,
  },
  modalCancelButton: {
    backgroundColor: 'rgba(0,0,0,0.1)',
  },
  modalCancelButtonText: {
    fontSize: FontSizes.lg,
    fontWeight: 'bold',
    color: Colors.light.text,
  },
  modalConfirmButton: {},
  modalConfirmButtonText: {
    fontSize: FontSizes.lg,
    fontWeight: 'bold',
    color: '#fff',
  },
  // Estilos de tabla de participantes
  table: {
    borderWidth: 1,
    borderColor: 'rgba(0,0,0,0.1)',
    borderRadius: BorderRadius.md,
    overflow: 'hidden',
  },
  tableRow: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(0,0,0,0.05)',
    minHeight: 50,
  },
  tableHeader: {
    backgroundColor: Colors.light.primary,
  },
  tableCell: {
    padding: Spacing.sm,
    fontSize: FontSizes.sm,
    borderRightWidth: 1,
    borderRightColor: 'rgba(0,0,0,0.05)',
    justifyContent: 'center',
  },
  tableHeaderCell: {
    color: '#fff',
    fontWeight: 'bold',
    fontSize: FontSizes.xs,
  },
  // Anchos de columnas responsivos
  colDNI: {
    flex: 1.2,
    minWidth: 100,
  },
  colNombre: {
    flex: 2.5,
    minWidth: 180,
  },
  colPermisos: {
    flex: 2,
    minWidth: 150,
  },
  colAcciones: {
    flex: 0.8,
    minWidth: 80,
    alignItems: 'center',
  },
  permisoBadge: {
    paddingHorizontal: 6,
    paddingVertical: 3,
    borderRadius: BorderRadius.full,
  },
  permisoBadgeText: {
    color: '#fff',
    fontSize: FontSizes.xs,
    fontWeight: 'bold',
  },
  deleteButton: {
    padding: Spacing.xs,
    borderRadius: BorderRadius.sm,
    alignItems: 'center',
    justifyContent: 'center',
    minWidth: 40,
    minHeight: 40,
  },
  deleteButtonText: {
    fontSize: 18,
  },
  // Event management styles
  currentEventBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: Spacing.md,
    borderRadius: BorderRadius.md,
    gap: Spacing.sm,
    flexWrap: 'wrap',
  },
  currentEventLabel: {
    fontSize: FontSizes.md,
    fontWeight: '600',
  },
  currentEventName: {
    fontSize: FontSizes.md,
    fontWeight: 'bold',
  },
  eventSelectorSection: {
    marginBottom: Spacing.lg,
  },
  eventSelectorList: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.xs,
    marginTop: Spacing.xs,
  },
  eventSelectorOption: {
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
  },
  eventSelectorOptionText: {
    fontSize: FontSizes.sm,
    fontWeight: '600',
  },
  importModeSection: {
    marginBottom: Spacing.lg,
    padding: Spacing.md,
    backgroundColor: 'rgba(0,0,0,0.02)',
    borderRadius: BorderRadius.md,
  },
  // Hierarchical user section styles
  userHierarchySection: {
    marginBottom: Spacing.xl,
    padding: Spacing.md,
    backgroundColor: 'rgba(0,0,0,0.02)',
    borderRadius: BorderRadius.md,
  },
  userSectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: Spacing.md,
    flexWrap: 'wrap',
    gap: Spacing.sm,
  },
  userSectionTitle: {
    fontSize: FontSizes.lg,
    fontWeight: 'bold',
  },
  userSectionSubtitle: {
    fontSize: FontSizes.sm,
    opacity: 0.7,
    marginTop: 2,
  },
  addUserButton: {
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderRadius: BorderRadius.md,
  },
  addUserButtonText: {
    color: '#fff',
    fontWeight: 'bold',
    fontSize: FontSizes.sm,
  },
  adminResponsablesScroll: {
    marginBottom: Spacing.md,
  },
  adminResponsablesContent: {
    paddingVertical: Spacing.xs,
    gap: Spacing.md,
  },
  adminResponsableCard: {
    padding: Spacing.md,
    borderRadius: BorderRadius.md,
    minWidth: 180,
    marginRight: Spacing.md,
    borderWidth: 2,
    borderColor: 'transparent',
  },
  adminResponsableCardSelected: {
    borderColor: '#fff',
  },
  adminResponsableName: {
    fontSize: FontSizes.md,
    fontWeight: 'bold',
    marginBottom: 4,
  },
  adminResponsableEmail: {
    fontSize: FontSizes.sm,
    opacity: 0.7,
  },
  selectedIndicator: {
    marginTop: Spacing.xs,
    paddingTop: Spacing.xs,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.3)',
  },
  selectedAdminActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    marginTop: Spacing.sm,
  },
  userRoleGroup: {
    marginBottom: Spacing.lg,
  },
  userRoleGroupTitle: {
    fontSize: FontSizes.md,
    fontWeight: '600',
    marginBottom: Spacing.sm,
    opacity: 0.8,
  },
});
