/**
 * ParticipantsSection Component
 *
 * Manages participants for the currently selected event:
 * - Event selector
 * - Import from CSV/Excel
 * - Export to Excel
 * - Add individual participant
 * - Participants list/table
 * - Reset states tool
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
  Platform,
  TextInput,
  Modal,
} from 'react-native';
import * as DocumentPicker from 'expo-document-picker';
import * as Sharing from 'expo-sharing';
import { ThemedText } from '@/components/themed/themed-text';
import {
  importParticipantsFromCSV,
  importParticipantsFromExcel,
  resetAllParticipantStates,
  exportDataToExcel,
  createParticipant,
  getAllParticipants,
  deleteParticipant,
  deleteAllParticipants,
  ImportMode,
} from '@/services/participantService';
import { sendEmailToParticipant, sendBulkEmails } from '@/services/emailSendService';
import { getDefaultTemplate } from '@/services/emailTemplateService';
import { Participant } from '@/types/participant';
import { Event } from '@/types/event';
import { Colors, BorderRadius, Spacing, Shadows, FontSizes } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { useResponsiveLayout } from '@/hooks/useResponsiveLayout';
import { useEvent } from '@/contexts/EventContext';
import { useAuth } from '@/contexts/AuthContext';
import { getEventsByOrganization, getAllEvents } from '@/services/eventService';
import { getUserData } from '@/services/userService';
import { User } from '@/types/user';

// Cross-platform confirm helper
const showConfirm = async (
  title: string,
  message: string,
  confirmText: string = 'Confirmar',
  cancelText: string = 'Cancelar',
  destructive: boolean = false
): Promise<boolean> => {
  if (Platform.OS === 'web') {
    return window.confirm(`${title}\n\n${message}`);
  }
  return new Promise((resolve) => {
    Alert.alert(title, message, [
      { text: cancelText, style: 'cancel', onPress: () => resolve(false) },
      { text: confirmText, style: destructive ? 'destructive' : 'default', onPress: () => resolve(true) },
    ]);
  });
};

// Cross-platform delete confirm with logs option
// Returns: 'with-logs' | 'without-logs' | 'cancel'
const showDeleteConfirm = async (
  title: string,
  message: string
): Promise<'with-logs' | 'without-logs' | 'cancel'> => {
  if (Platform.OS === 'web') {
    const confirmDelete = window.confirm(`${title}\n\n${message}`);
    if (!confirmDelete) return 'cancel';

    const deleteLogs = window.confirm(
      '¿Eliminar también los logs de acceso?\n\n' +
      '• Aceptar: Eliminar participante(s) Y sus logs de acceso\n' +
      '• Cancelar: Eliminar solo participante(s), mantener logs'
    );
    return deleteLogs ? 'with-logs' : 'without-logs';
  }

  return new Promise((resolve) => {
    Alert.alert(
      title,
      message + '\n\n¿Qué deseas hacer con los logs de acceso?',
      [
        { text: 'Cancelar', style: 'cancel', onPress: () => resolve('cancel') },
        { text: 'Mantener logs', style: 'default', onPress: () => resolve('without-logs') },
        { text: 'Eliminar con logs', style: 'destructive', onPress: () => resolve('with-logs') },
      ]
    );
  });
};

// Result modal types
type ResultType = 'success' | 'error' | 'warning' | 'info';
interface ResultModalData {
  visible: boolean;
  type: ResultType;
  title: string;
  message: string;
  details?: string[];
  action?: {
    label: string;
    onPress: () => void;
  };
}

export function ParticipantsSection() {
  const colorScheme = useColorScheme();
  const { currentEvent, setCurrentEvent } = useEvent();
  const { user, isSuperAdmin } = useAuth();

  // Responsive layout
  const { isWideScreen, isMobile, deviceType } = useResponsiveLayout();

  // State
  const [loading, setLoading] = useState(false);
  const [importMode, setImportMode] = useState<ImportMode>('merge');
  const [participants, setParticipants] = useState<Participant[]>([]);
  const [loadingParticipants, setLoadingParticipants] = useState(false);

  // Local events state (fetch directly like EventManager)
  const [events, setEvents] = useState<Event[]>([]);
  const [loadingEvents, setLoadingEvents] = useState(true);

  // Search state for participants list
  const [searchText, setSearchText] = useState('');
  // Organization names for grouping (organizationId -> name)
  const [orgNames, setOrgNames] = useState<Record<string, string>>({});

  // Add participant modal state
  const [showAddParticipantModal, setShowAddParticipantModal] = useState(false);
  const [newParticipantDNI, setNewParticipantDNI] = useState('');
  const [newParticipantNombre, setNewParticipantNombre] = useState('');
  const [newParticipantEmail, setNewParticipantEmail] = useState('');
  const [newParticipantTelefono, setNewParticipantTelefono] = useState('');
  const [newParticipantEntitat, setNewParticipantEntitat] = useState('');
  const [newParticipantEscuela, setNewParticipantEscuela] = useState('');
  const [newParticipantCargo, setNewParticipantCargo] = useState('');
  const [newParticipantHaPagado, setNewParticipantHaPagado] = useState(false);
  const [newParticipantPermisoAulaMagna, setNewParticipantPermisoAulaMagna] = useState(true);
  const [newParticipantPermisoMasterClass, setNewParticipantPermisoMasterClass] = useState(false);
  const [newParticipantPermisoCena, setNewParticipantPermisoCena] = useState(false);

  // Email sending state
  const [showEmailConfirmModal, setShowEmailConfirmModal] = useState(false);
  const [emailTarget, setEmailTarget] = useState<'single' | 'all'>('all');
  const [selectedParticipantForEmail, setSelectedParticipantForEmail] = useState<Participant | null>(null);
  const [sendingEmail, setSendingEmail] = useState(false);

  // Format info modal state
  const [showFormatInfoModal, setShowFormatInfoModal] = useState(false);

  // Result modal state (unified feedback modal)
  const [resultModal, setResultModal] = useState<ResultModalData>({
    visible: false,
    type: 'info',
    title: '',
    message: '',
  });

  // Helper to show result modal
  const showResult = (
    type: ResultType,
    title: string,
    message: string,
    details?: string[],
    action?: { label: string; onPress: () => void }
  ) => {
    setResultModal({ visible: true, type, title, message, details, action });
  };

  // Helper to close result modal
  const closeResultModal = () => {
    setResultModal(prev => ({ ...prev, visible: false }));
  };

  // Helper to require event selection
  const requireEvent = (actionName: string): boolean => {
    if (!currentEvent) {
      showResult(
        'warning',
        'Evento no seleccionado',
        `Para ${actionName}, primero debes seleccionar un evento de la lista.`,
        ['Usa el selector de eventos en la parte superior de esta sección.']
      );
      return false;
    }
    return true;
  };

  // Load events directly (same logic as EventManager)
  useEffect(() => {
    const loadEvents = async () => {
      if (!user) {
        console.log('🔴 ParticipantsSection: No user');
        setEvents([]);
        setOrgNames({});
        setLoadingEvents(false);
        return;
      }

      console.log('🔵 ParticipantsSection: Loading events for user:', {
        email: user.email,
        role: user.role,
        organizationId: user.organizationId,
        isSuperAdmin: isSuperAdmin(),
      });

      setLoadingEvents(true);
      try {
        let eventList: Event[];

        if (isSuperAdmin()) {
          // Super admin sees all events
          console.log('🟢 ParticipantsSection: Fetching ALL events (super_admin)');
          eventList = await getAllEvents();
        } else if (user.organizationId) {
          // Other admins see only their organization's events
          console.log('🟢 ParticipantsSection: Fetching events for org:', user.organizationId);
          eventList = await getEventsByOrganization(user.organizationId);
        } else {
          console.log('🔴 ParticipantsSection: No organizationId, empty list');
          eventList = [];
        }

        console.log('🟣 ParticipantsSection: Found events:', eventList.length);
        eventList.forEach(e => {
          console.log(`   📅 Event: "${e.name}" | orgId: ${e.organizationId} | createdBy: ${e.createdBy}`);
        });
        console.log(`🔍 ParticipantsSection: User orgId: ${user.organizationId} | User UID: ${user.uid}`);

        // Sort by date (most recent first)
        eventList.sort((a, b) => b.date - a.date);
        setEvents(eventList);

        // Get unique organization IDs and fetch their names
        const uniqueOrgIds = [...new Set(eventList.map(e => e.organizationId))];
        const names: Record<string, string> = {};

        for (const orgId of uniqueOrgIds) {
          try {
            const adminUser = await getUserData(orgId);
            names[orgId] = adminUser?.username || adminUser?.email || 'Organización desconocida';
          } catch {
            names[orgId] = 'Organización desconocida';
          }
        }
        setOrgNames(names);

        // Auto-select first event if none selected
        if (!currentEvent && eventList.length > 0) {
          setCurrentEvent(eventList[0]);
        }
      } catch (error) {
        console.error('Error loading events:', error);
        setEvents([]);
        setOrgNames({});
      } finally {
        setLoadingEvents(false);
      }
    };

    loadEvents();
  }, [user, isSuperAdmin]);

  // Load participants when event changes
  useEffect(() => {
    if (currentEvent) {
      loadParticipants();
    } else {
      setParticipants([]);
    }
  }, [currentEvent?.id]);

  const loadParticipants = useCallback(async () => {
    if (!currentEvent) return;

    setLoadingParticipants(true);
    try {
      const data = await getAllParticipants(currentEvent.id);
      setParticipants(data);
    } catch (error: any) {
      console.error('Error loading participants:', error);
      showResult(
        'error',
        'Error al cargar participantes',
        `No se pudo cargar la lista de participantes del evento "${currentEvent.name}".`,
        [
          error.message || 'Error de conexión con la base de datos',
          'Verifica tu conexión a internet e inténtalo de nuevo.',
        ]
      );
    } finally {
      setLoadingParticipants(false);
    }
  }, [currentEvent]);

  /**
   * Import participants from CSV or Excel file
   */
  const handleImportCSV = async () => {
    if (!requireEvent('importar participantes')) {
      return;
    }

    try {
      setLoading(true);

      const result = await DocumentPicker.getDocumentAsync({
        type: ['text/csv', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', 'application/vnd.ms-excel'],
        copyToCacheDirectory: true,
      });

      if (result.canceled) {
        setLoading(false);
        return;
      }

      const file = result.assets[0];
      const fileUri = file.uri;
      const fileName = file.name || '';
      const isExcel = fileName.endsWith('.xlsx') || fileName.endsWith('.xls');

      let count = 0;
      if (isExcel) {
        // Fetch file and convert to ArrayBuffer for Excel import
        const response = await fetch(fileUri);
        const arrayBuffer = await response.arrayBuffer();
        count = await importParticipantsFromExcel(arrayBuffer, currentEvent.id, importMode);
      } else {
        const response = await fetch(fileUri);
        const csvContent = await response.text();
        count = await importParticipantsFromCSV(csvContent, currentEvent.id, importMode);
      }

      setLoading(false);
      const modeText = importMode === 'replace' ? 'Reemplazo total' : 'Añadidos/actualizados';
      showResult(
        'success',
        'Importación completada',
        `Se han procesado ${count} participantes correctamente.`,
        [
          `📁 Archivo: ${fileName}`,
          `📊 Modo: ${modeText}`,
          `📅 Evento: ${currentEvent.name}`,
          count === 1 ? '👤 1 participante importado' : `👥 ${count} participantes importados`,
        ]
      );

      // Reload participants list
      loadParticipants();
    } catch (error: any) {
      console.error('Error importing:', error);
      setLoading(false);
      showResult(
        'error',
        'Error de importación',
        'No se pudo procesar el archivo de participantes.',
        [
          error.message || 'Error desconocido al procesar el archivo',
          'Verifica que el formato del archivo sea correcto.',
          'Consulta "Ver formatos aceptados" para más información.',
        ],
        {
          label: 'Ver formatos aceptados',
          onPress: () => {
            closeResultModal();
            setShowFormatInfoModal(true);
          },
        }
      );
    }
  };

  /**
   * Export data to Excel
   */
  const handleExportData = async () => {
    if (!requireEvent('exportar datos')) {
      return;
    }

    try {
      setLoading(true);
      const fileUri = await exportDataToExcel(currentEvent.id);
      setLoading(false);

      if (Platform.OS === 'web') {
        showResult(
          'success',
          'Exportación completada',
          'El archivo Excel se ha descargado correctamente.',
          [
            `📅 Evento: ${currentEvent.name}`,
            `👥 Participantes: ${participants.length}`,
            '📄 Incluye: lista de participantes y registro de accesos',
          ]
        );
      } else {
        const isAvailable = await Sharing.isAvailableAsync();
        if (isAvailable) {
          await Sharing.shareAsync(fileUri, {
            mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
            dialogTitle: 'Exportar datos del evento',
          });
        } else {
          showResult(
            'success',
            'Exportación completada',
            'El archivo Excel se ha guardado correctamente.',
            [
              `📁 Ubicación: ${fileUri}`,
              `📅 Evento: ${currentEvent.name}`,
            ]
          );
        }
      }
    } catch (error: any) {
      console.error('Error exporting:', error);
      setLoading(false);
      showResult(
        'error',
        'Error de exportación',
        'No se pudieron exportar los datos del evento.',
        [
          error.message || 'Error desconocido',
          'Verifica que haya participantes en el evento.',
          'Inténtalo de nuevo o contacta soporte.',
        ]
      );
    }
  };

  /**
   * Add individual participant
   */
  const handleAddParticipant = async () => {
    if (!newParticipantDNI.trim() || !newParticipantNombre.trim()) {
      showResult(
        'warning',
        'Campos obligatorios',
        'Para añadir un participante necesitas completar los campos obligatorios.',
        ['DNI: identificador único del participante', 'Nombre: nombre completo']
      );
      return;
    }

    if (!requireEvent('añadir participantes')) {
      return;
    }

    setLoading(true);
    try {
      await createParticipant({
        dni: newParticipantDNI,
        nombre: newParticipantNombre,
        email: newParticipantEmail || undefined,
        telefono: newParticipantTelefono || undefined,
        entitat: newParticipantEntitat || undefined,
        escuela: newParticipantEscuela || undefined,
        cargo: newParticipantCargo || undefined,
        haPagado: newParticipantHaPagado,
        permisos: {
          aula_magna: newParticipantPermisoAulaMagna,
          master_class: newParticipantPermisoMasterClass,
          cena: newParticipantPermisoCena,
        },
        estado: {
          registrado: false,
          en_aula_magna: false,
          en_master_class: false,
          en_cena: false,
        },
      }, currentEvent.id);

      const addedName = newParticipantNombre;
      const addedDNI = newParticipantDNI;
      const addedEmail = newParticipantEmail;

      setShowAddParticipantModal(false);
      setNewParticipantDNI('');
      setNewParticipantNombre('');
      setNewParticipantEmail('');
      setNewParticipantTelefono('');
      setNewParticipantEntitat('');
      setNewParticipantEscuela('');
      setNewParticipantCargo('');
      setNewParticipantHaPagado(false);
      setNewParticipantPermisoAulaMagna(true);
      setNewParticipantPermisoMasterClass(false);
      setNewParticipantPermisoCena(false);
      loadParticipants();

      showResult(
        'success',
        'Participante añadido',
        `${addedName} se ha añadido correctamente al evento.`,
        [
          `🆔 DNI: ${addedDNI}`,
          `📅 Evento: ${currentEvent.name}`,
          addedEmail ? `📧 Email: ${addedEmail}` : '⚠️ Sin email (no podrá recibir invitación)',
          '✅ Permiso de Aula Magna activado por defecto',
        ]
      );
    } catch (error: any) {
      console.error('Error adding participant:', error);
      const isDuplicate = error.message?.includes('Ya existe');
      showResult(
        'error',
        isDuplicate ? 'Participante duplicado' : 'Error al añadir',
        isDuplicate
          ? `Ya existe un participante con el DNI "${newParticipantDNI}" en este evento.`
          : 'No se pudo añadir el participante al evento.',
        [
          error.message || 'Error desconocido',
          isDuplicate
            ? 'Si necesitas actualizar sus datos, elimínalo primero y vuelve a añadirlo.'
            : 'Verifica los datos e inténtalo de nuevo.',
        ]
      );
    } finally {
      setLoading(false);
    }
  };

  /**
   * Delete participant
   */
  const handleDeleteParticipant = async (dni: string, nombre: string) => {
    if (!currentEvent) return;

    const result = await showDeleteConfirm(
      'Confirmar eliminación',
      `¿Estás seguro de eliminar a ${nombre} (${dni})?\n\nEsta acción no se puede deshacer.`
    );

    if (result === 'cancel') return;

    const deleteLogs = result === 'with-logs';

    setLoading(true);
    try {
      const logsDeleted = await deleteParticipant(dni, currentEvent.id, deleteLogs);
      showResult(
        'success',
        'Participante eliminado',
        `${nombre} ha sido eliminado del evento.`,
        [
          `🆔 DNI: ${dni}`,
          `📅 Evento: ${currentEvent.name}`,
          deleteLogs
            ? `🗑️ Logs eliminados: ${logsDeleted}`
            : `📋 Logs de acceso mantenidos`,
        ]
      );
      loadParticipants();
    } catch (error: any) {
      showResult(
        'error',
        'Error al eliminar',
        `No se pudo eliminar a ${nombre} del evento.`,
        [error.message || 'Error desconocido', 'Inténtalo de nuevo.']
      );
    } finally {
      setLoading(false);
    }
  };

  /**
   * Send email to a single participant
   */
  const handleSendEmailToParticipant = async (participant: Participant) => {
    if (!participant.email) {
      showResult(
        'warning',
        'Sin email registrado',
        `${participant.nombre} no tiene dirección de email registrada.`,
        [
          '📧 No se puede enviar la invitación sin email.',
          'Edita el participante para añadir su email o impórtalo de nuevo con el email correcto.',
        ]
      );
      return;
    }
    if (!requireEvent('enviar invitaciones')) {
      return;
    }

    // Check if there's a default template
    const template = await getDefaultTemplate(currentEvent.id);
    if (!template) {
      showResult(
        'warning',
        'Sin plantilla de email',
        'No hay plantilla de email configurada para este evento.',
        [
          '📧 Necesitas crear una plantilla antes de enviar invitaciones.',
          '💡 Ve a la sección "Invitaciones" en el menú de administración.',
        ],
        {
          label: 'Ir a Invitaciones',
          onPress: () => {
            closeResultModal();
            // Note: Navigation would need to be implemented
          },
        }
      );
      return;
    }

    setSelectedParticipantForEmail(participant);
    setEmailTarget('single');
    setShowEmailConfirmModal(true);
  };

  /**
   * Send email to all participants with email
   */
  const handleSendEmailToAll = async () => {
    if (!requireEvent('enviar invitaciones masivas')) {
      return;
    }

    const participantsWithEmail = participants.filter((p) => p.email);
    if (participantsWithEmail.length === 0) {
      showResult(
        'warning',
        'Sin destinatarios',
        'No hay participantes con email registrado en este evento.',
        [
          `👥 Participantes totales: ${participants.length}`,
          '📧 Participantes con email: 0',
          '💡 Importa los participantes con sus emails o añádelos manualmente.',
        ]
      );
      return;
    }

    // Check if there's a default template
    const template = await getDefaultTemplate(currentEvent.id);
    if (!template) {
      showResult(
        'warning',
        'Sin plantilla de email',
        'No hay plantilla de email configurada para este evento.',
        [
          '📧 Necesitas crear una plantilla antes de enviar invitaciones.',
          '💡 Ve a la sección "Invitaciones" en el menú de administración.',
        ]
      );
      return;
    }

    setEmailTarget('all');
    setShowEmailConfirmModal(true);
  };

  /**
   * Confirm and send emails
   */
  const handleConfirmSendEmail = async () => {
    if (!currentEvent?.id) return;

    setSendingEmail(true);
    try {
      if (emailTarget === 'single' && selectedParticipantForEmail) {
        const result = await sendEmailToParticipant(currentEvent.id, selectedParticipantForEmail.dni);
        if (result.success) {
          showResult(
            'success',
            'Email enviado',
            `La invitación se ha enviado correctamente a ${selectedParticipantForEmail.nombre}.`,
            [
              `📧 Destinatario: ${selectedParticipantForEmail.email}`,
              `📅 Evento: ${currentEvent.name}`,
              '📱 El email incluye el código QR para acceder al evento.',
            ]
          );
        } else {
          showResult(
            'error',
            'Error al enviar email',
            `No se pudo enviar la invitación a ${selectedParticipantForEmail.nombre}.`,
            [
              result.error || 'Error desconocido',
              `📧 Email: ${selectedParticipantForEmail.email}`,
              'Verifica que el email sea correcto e inténtalo de nuevo.',
            ]
          );
        }
      } else {
        const result = await sendBulkEmails(currentEvent.id);
        const participantsWithEmail = participants.filter((p) => p.email).length;

        if (result.success && result.failedCount === 0) {
          showResult(
            'success',
            'Envío masivo completado',
            `Todas las invitaciones se han enviado correctamente.`,
            [
              `✅ Emails enviados: ${result.sentCount}`,
              `📅 Evento: ${currentEvent.name}`,
              '📱 Cada email incluye el código QR personalizado.',
            ]
          );
        } else if (result.sentCount > 0) {
          showResult(
            'warning',
            'Envío parcial',
            `Se enviaron algunas invitaciones, pero hubo errores.`,
            [
              `✅ Enviados correctamente: ${result.sentCount}`,
              `❌ Fallidos: ${result.failedCount}`,
              `📊 Total con email: ${participantsWithEmail}`,
              'Revisa los emails fallidos e inténtalo de nuevo.',
            ]
          );
        } else {
          showResult(
            'error',
            'Error en envío masivo',
            'No se pudo enviar ninguna invitación.',
            [
              `❌ Fallidos: ${result.failedCount}`,
              'Verifica la configuración de email y la plantilla.',
            ]
          );
        }
      }
      setShowEmailConfirmModal(false);
      setSelectedParticipantForEmail(null);
    } catch (error: any) {
      showResult(
        'error',
        'Error al enviar emails',
        'Ocurrió un error inesperado durante el envío.',
        [
          error.message || 'Error desconocido',
          'Verifica tu conexión e inténtalo de nuevo.',
        ]
      );
    } finally {
      setSendingEmail(false);
    }
  };

  /**
   * Reset all participant states
   */
  const handleResetStates = async () => {
    if (!requireEvent('resetear estados')) {
      return;
    }

    const confirmed = await showConfirm(
      'Confirmar Reset',
      `¿Estás seguro de resetear TODOS los estados de ${participants.length} participantes?\n\nEsto marcará a todos como:\n• No registrados\n• Fuera de Aula Magna\n• Fuera de Master Class\n• Fuera de Cena\n\n⚠️ Esta acción no se puede deshacer.`,
      'Resetear todo',
      'Cancelar',
      true
    );

    if (!confirmed) return;

    setLoading(true);
    try {
      await resetAllParticipantStates(currentEvent.id);
      showResult(
        'success',
        'Estados reseteados',
        `Se han reseteado los estados de todos los participantes.`,
        [
          `📅 Evento: ${currentEvent.name}`,
          `👥 Participantes afectados: ${participants.length}`,
          '✅ Todos marcados como no registrados',
          '✅ Todos fuera de todas las ubicaciones',
        ]
      );
      loadParticipants();
    } catch (error: any) {
      showResult(
        'error',
        'Error al resetear',
        'No se pudieron resetear los estados de los participantes.',
        [
          error.message || 'Error desconocido',
          'Inténtalo de nuevo o contacta soporte.',
        ]
      );
    } finally {
      setLoading(false);
    }
  };

  /**
   * Delete all participants from the event
   */
  const handleDeleteAllParticipants = async () => {
    if (!requireEvent('eliminar participantes')) {
      return;
    }

    if (participants.length === 0) {
      showResult(
        'info',
        'Sin participantes',
        'No hay participantes para eliminar en este evento.',
        [`📅 Evento: ${currentEvent.name}`]
      );
      return;
    }

    const result = await showDeleteConfirm(
      '⚠️ Eliminar TODOS los participantes',
      `¿Estás seguro de eliminar TODOS los ${participants.length} participantes del evento "${currentEvent.name}"?\n\n🚨 ESTA ACCIÓN ES IRREVERSIBLE 🚨`
    );

    if (result === 'cancel') return;

    const deleteLogs = result === 'with-logs';

    // Double confirmation for safety
    const doubleConfirmed = await showConfirm(
      '¿Estás completamente seguro?',
      `Vas a eliminar ${participants.length} participantes${deleteLogs ? ' y todos sus logs de acceso' : ''}.\n\nEscribe mentalmente "ELIMINAR" para confirmar que entiendes las consecuencias.`,
      'Sí, eliminar todo',
      'No, cancelar',
      true
    );

    if (!doubleConfirmed) return;

    setLoading(true);
    try {
      const { participants: deletedCount, logs: logsDeleted } = await deleteAllParticipants(currentEvent.id, deleteLogs);
      showResult(
        'success',
        'Participantes eliminados',
        `Se han eliminado todos los participantes del evento.`,
        [
          `📅 Evento: ${currentEvent.name}`,
          `🗑️ Participantes eliminados: ${deletedCount}`,
          deleteLogs
            ? `🗑️ Logs eliminados: ${logsDeleted}`
            : `📋 Logs de acceso mantenidos`,
          '⚠️ Esta acción no se puede deshacer',
        ]
      );
      loadParticipants();
    } catch (error: any) {
      showResult(
        'error',
        'Error al eliminar',
        'No se pudieron eliminar los participantes.',
        [
          error.message || 'Error desconocido',
          'Inténtalo de nuevo o contacta soporte.',
        ]
      );
    } finally {
      setLoading(false);
    }
  };

  /**
   * Show CSV format info
   */
  const showCSVFormatInfo = () => {
    setShowFormatInfoModal(true);
  };

  return (
    <View style={styles.section}>
      <ThemedText style={styles.sectionTitle}>
        📊 Gestión de Participantes
      </ThemedText>

      {/* Responsive layout container */}
      <View style={isWideScreen ? styles.twoColumnLayout : styles.singleColumnLayout}>
        {/* Left column: Controls */}
        <View style={isWideScreen ? styles.leftColumn : styles.fullWidth}>
          {/* Event selector - grouped by organization */}
          <View style={styles.eventSelectorSection}>
            <ThemedText style={styles.fieldLabel}>Seleccionar Evento:</ThemedText>
            {loadingEvents ? (
              <ActivityIndicator size="small" color={Colors[colorScheme ?? 'light'].primary} />
            ) : events.length === 0 ? (
              <View style={[
                styles.warningBanner,
                { backgroundColor: Colors[colorScheme ?? 'light'].warning + '20' }
              ]}>
                <Text style={[styles.warningText, { color: Colors[colorScheme ?? 'light'].warning }]}>
                  ⚠️ No hay eventos disponibles. Crea uno en la sección &quot;Eventos&quot;.
                </Text>
              </View>
            ) : (
              <ScrollView
                style={[
                  styles.eventSelectorScrollView,
                  { backgroundColor: Colors[colorScheme ?? 'light'].cardBackground }
                ]}
                nestedScrollEnabled
              >
                {/* Group events by organization */}
                {Object.keys(orgNames).map((orgId) => {
                  const orgEvents = events.filter(e => e.organizationId === orgId);
                  if (orgEvents.length === 0) return null;

                  return (
                    <View key={orgId} style={styles.orgGroup}>
                      {/* Organization header */}
                      <View style={[
                        styles.orgHeader,
                        { backgroundColor: Colors[colorScheme ?? 'light'].primary + '15' }
                      ]}>
                        <Text style={[styles.orgHeaderText, { color: Colors[colorScheme ?? 'light'].primary }]}>
                          🏢 {orgNames[orgId]}
                        </Text>
                      </View>

                      {/* Events of this organization */}
                      <View style={styles.orgEventsList}>
                        {orgEvents.map((event) => (
                          <TouchableOpacity
                            key={event.id}
                            style={[
                              styles.eventSelectorOption,
                              {
                                backgroundColor: currentEvent?.id === event.id
                                  ? Colors[colorScheme ?? 'light'].primary
                                  : 'transparent',
                                borderColor: currentEvent?.id === event.id
                                  ? Colors[colorScheme ?? 'light'].primary
                                  : Colors[colorScheme ?? 'light'].border,
                              },
                            ]}
                            onPress={() => setCurrentEvent(event)}
                          >
                            <View style={styles.eventOptionContent}>
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
                              <Text
                                style={[
                                  styles.eventDateText,
                                  {
                                    color: currentEvent?.id === event.id
                                      ? 'rgba(255,255,255,0.8)'
                                      : Colors[colorScheme ?? 'light'].textSecondary,
                                  },
                                ]}
                              >
                                {new Date(event.date).toLocaleDateString('es-ES', {
                                  day: '2-digit',
                                  month: 'short',
                                  year: 'numeric',
                                })}
                              </Text>
                            </View>
                            {currentEvent?.id === event.id && (
                              <Text style={styles.selectedIcon}>✓</Text>
                            )}
                          </TouchableOpacity>
                        ))}
                      </View>
                    </View>
                  );
                })}
              </ScrollView>
            )}
          </View>

          {/* Import mode selector */}
          <View style={styles.importModeSection}>
            <ThemedText style={styles.fieldLabel}>Modo de importación:</ThemedText>
            <View style={styles.modeSelector}>
              <TouchableOpacity
                style={[
                  styles.modeOption,
                  importMode === 'merge' && { backgroundColor: Colors.light.success },
                ]}
                onPress={() => setImportMode('merge')}
              >
                <Text style={[styles.modeOptionText, importMode === 'merge' && { color: '#fff' }]}>
                  Añadir
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[
                  styles.modeOption,
                  importMode === 'replace' && { backgroundColor: Colors.light.error },
                ]}
                onPress={() => setImportMode('replace')}
              >
                <Text style={[styles.modeOptionText, importMode === 'replace' && { color: '#fff' }]}>
                  Total (Reemplazar)
                </Text>
              </TouchableOpacity>
            </View>
            <ThemedText style={styles.modeDescription}>
              {importMode === 'merge'
                ? 'Añade nuevos participantes sin borrar los existentes'
                : 'Elimina todos los participantes existentes y carga los nuevos'}
            </ThemedText>
          </View>

          {/* Action buttons */}
          <TouchableOpacity
            style={[
              styles.actionCard,
              Shadows.light,
              {
                backgroundColor: Colors[colorScheme ?? 'light'].cardBackground,
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
              Shadows.light,
              {
                backgroundColor: Colors[colorScheme ?? 'light'].cardBackground,
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
              Shadows.light,
              { backgroundColor: Colors[colorScheme ?? 'light'].cardBackground },
            ]}
            onPress={() => setShowAddParticipantModal(true)}
            disabled={loading || !currentEvent}
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
              { backgroundColor: Colors[colorScheme ?? 'light'].primary },
            ]}
            onPress={showCSVFormatInfo}
            activeOpacity={0.8}
          >
            <Text style={styles.infoButtonText}>ℹ️ Ver formatos aceptados</Text>
          </TouchableOpacity>

          {/* Tools section */}
          <View style={[styles.subsection, { marginTop: Spacing.xl }]}>
            <ThemedText style={styles.sectionTitle}>⚙️ Herramientas</ThemedText>

            <TouchableOpacity
              style={[
                styles.actionCard,
                Shadows.light,
                {
                  backgroundColor: Colors[colorScheme ?? 'light'].cardBackground,
                  opacity: currentEvent ? 1 : 0.5,
                },
              ]}
              onPress={handleResetStates}
              disabled={loading || !currentEvent}
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

            <TouchableOpacity
              style={[
                styles.actionCard,
                Shadows.light,
                {
                  backgroundColor: Colors[colorScheme ?? 'light'].cardBackground,
                  borderWidth: 2,
                  borderColor: Colors.light.error,
                  opacity: currentEvent && participants.length > 0 ? 1 : 0.5,
                },
              ]}
              onPress={handleDeleteAllParticipants}
              disabled={loading || !currentEvent || participants.length === 0}
              activeOpacity={0.7}
            >
              <Text style={styles.actionIcon}>🗑️</Text>
              <View style={styles.actionTextContainer}>
                <ThemedText style={[styles.actionTitle, { color: Colors.light.error }]}>
                  Eliminar todos los participantes
                </ThemedText>
                <ThemedText style={styles.actionDescription}>
                  Borrar permanentemente todos los participantes y logs ({participants.length})
                </ThemedText>
              </View>
            </TouchableOpacity>
          </View>
        </View>

        {/* Right column: Participants list */}
        <View style={isWideScreen ? styles.rightColumn : styles.fullWidth}>
          {/* Participants table */}
          <View style={[styles.subsection, isWideScreen ? { marginTop: 0 } : { marginTop: Spacing.xl }]}>
            <View style={styles.subsectionHeader}>
              <ThemedText style={styles.sectionTitle}>
                👥 Lista de Participantes ({participants.length})
              </ThemedText>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: Spacing.sm }}>
                {/* Send email to all button */}
                {currentEvent && participants.filter((p) => p.email).length > 0 && (
                  <TouchableOpacity
                    onPress={handleSendEmailToAll}
                    disabled={loading || sendingEmail}
                    style={[
                      styles.emailAllButton,
                      { backgroundColor: Colors[colorScheme ?? 'light'].primary },
                    ]}
                  >
                    <Text style={styles.emailAllButtonText}>
                      📧 Enviar a todos ({participants.filter((p) => p.email).length})
                    </Text>
                  </TouchableOpacity>
                )}
                <TouchableOpacity
                  onPress={loadParticipants}
                  disabled={loadingParticipants}
                  style={{ padding: Spacing.xs }}
                >
                  <Text style={{ fontSize: 20 }}>{loadingParticipants ? '⏳' : '🔄'}</Text>
                </TouchableOpacity>
              </View>
            </View>

            {/* Search bar */}
            {currentEvent && participants.length > 0 && (
              <View style={[
                styles.participantSearchContainer,
                {
                  backgroundColor: colorScheme === 'dark' ? 'rgba(255,255,255,0.1)' : '#fff',
                  borderColor: colorScheme === 'dark' ? 'rgba(255,255,255,0.2)' : '#ddd'
                }
              ]}>
                <Text style={styles.participantSearchIcon}>🔍</Text>
                <TextInput
                  style={[styles.participantSearchInput, { color: Colors[colorScheme ?? 'light'].text }]}
                  placeholder="Buscar por nombre, DNI, email, entidad..."
                  placeholderTextColor={Colors[colorScheme ?? 'light'].text + '60'}
                  value={searchText}
                  onChangeText={setSearchText}
                  autoCapitalize="none"
                  autoCorrect={false}
                />
                {searchText.length > 0 && (
                  <TouchableOpacity onPress={() => setSearchText('')}>
                    <Text style={styles.participantSearchClear}>✕</Text>
                  </TouchableOpacity>
                )}
              </View>
            )}

            {loadingParticipants ? (
              <View style={styles.loadingContainer}>
                <ActivityIndicator size="large" color={Colors.light.primary} />
                <ThemedText style={{ marginTop: Spacing.md }}>Cargando participantes...</ThemedText>
              </View>
            ) : !currentEvent ? (
              <View style={[styles.infoCard, { backgroundColor: Colors[colorScheme ?? 'light'].cardBackground }]}>
                <ThemedText style={styles.infoText}>
                  Selecciona un evento para ver sus participantes.
                </ThemedText>
              </View>
            ) : participants.length === 0 ? (
              <View style={[styles.infoCard, { backgroundColor: Colors[colorScheme ?? 'light'].cardBackground }]}>
                <ThemedText style={styles.infoText}>
                  No hay participantes registrados. Importa o añade participantes para comenzar.
                </ThemedText>
              </View>
            ) : (
              <View style={styles.table}>
                {/* Table header */}
                <View style={[styles.tableRow, styles.tableHeader]}>
                  <Text style={[styles.tableCell, styles.tableHeaderCell, styles.colDNI]}>DNI</Text>
                  <Text style={[styles.tableCell, styles.tableHeaderCell, styles.colNombre]}>Nombre</Text>
                  <Text style={[styles.tableCell, styles.tableHeaderCell, styles.colPermisos, { textAlign: 'center' }]}>Permisos</Text>
                  <Text style={[styles.tableCell, styles.tableHeaderCell, styles.colAcciones]}>Acciones</Text>
                </View>

                {/* Search results count */}
                {searchText.trim() && (
                  <View style={styles.searchResultsCount}>
                    <ThemedText style={styles.searchResultsText}>
                      {participants.filter(p => {
                        const searchLower = searchText.toLowerCase().trim();
                        const searchFields = [
                          p.dni, p.nombre, p.email, p.entitat, p.escuela, p.cargo, p.telefono
                        ].filter(Boolean).join(' ').toLowerCase();
                        return searchFields.includes(searchLower);
                      }).length} de {participants.length} participantes
                    </ThemedText>
                  </View>
                )}

                {/* Table rows - height calculated to match left column bottom */}
                <ScrollView style={{ maxHeight: isWideScreen ? 900 : 400 }}>
                  {participants
                    .filter(p => {
                      if (!searchText.trim()) return true;
                      const searchLower = searchText.toLowerCase().trim();
                      const searchFields = [
                        p.dni, p.nombre, p.email, p.entitat, p.escuela, p.cargo, p.telefono
                      ].filter(Boolean).join(' ').toLowerCase();
                      return searchFields.includes(searchLower);
                    })
                    .map((participant, index) => (
                    <View
                      key={participant.dni}
                      style={[
                        styles.tableRow,
                        {
                          backgroundColor: index % 2 === 0
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
                        <View style={styles.permisosContainer}>
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
                        <View style={styles.actionButtonsRow}>
                          {/* Email button - only show if participant has email */}
                          {participant.email && (
                            <TouchableOpacity
                              onPress={() => handleSendEmailToParticipant(participant)}
                              style={[styles.emailButton, { backgroundColor: Colors.light.primary }]}
                              disabled={loading || sendingEmail}
                            >
                              <Text style={styles.emailButtonText}>📧</Text>
                            </TouchableOpacity>
                          )}
                          {/* Delete button */}
                          <TouchableOpacity
                            onPress={() => handleDeleteParticipant(participant.dni, participant.nombre)}
                            style={[styles.deleteButton, { backgroundColor: Colors.light.error }]}
                            disabled={loading}
                          >
                            <Text style={styles.deleteButtonText}>🗑️</Text>
                          </TouchableOpacity>
                        </View>
                      </View>
                    </View>
                  ))}
                </ScrollView>
              </View>
            )}
          </View>

        </View>
      </View>

      {/* Loading overlay */}
      {loading && (
        <View style={styles.loadingOverlay}>
          <ActivityIndicator size="large" color="#fff" />
          <Text style={styles.loadingText}>Procesando...</Text>
        </View>
      )}

      {/* Add participant modal */}
      <Modal
        visible={showAddParticipantModal}
        animationType="slide"
        transparent
        onRequestClose={() => setShowAddParticipantModal(false)}
      >
        <View style={styles.modalOverlay}>
          <ScrollView
            style={styles.addParticipantScrollView}
            contentContainerStyle={styles.addParticipantScrollContent}
            keyboardShouldPersistTaps="handled"
          >
          <View style={[styles.modalContent, styles.addParticipantModalContent, { backgroundColor: Colors[colorScheme ?? 'light'].cardBackground }]}>
            <ThemedText style={styles.modalTitle}>Añadir Participante</ThemedText>

            <View style={styles.formField}>
              <ThemedText style={styles.fieldLabel}>DNI *</ThemedText>
              <TextInput
                style={[styles.input, { backgroundColor: Colors[colorScheme ?? 'light'].background, color: Colors[colorScheme ?? 'light'].text }]}
                value={newParticipantDNI}
                onChangeText={setNewParticipantDNI}
                placeholder="12345678A"
                placeholderTextColor={Colors[colorScheme ?? 'light'].text + '60'}
              />
            </View>

            <View style={styles.formField}>
              <ThemedText style={styles.fieldLabel}>Nombre *</ThemedText>
              <TextInput
                style={[styles.input, { backgroundColor: Colors[colorScheme ?? 'light'].background, color: Colors[colorScheme ?? 'light'].text }]}
                value={newParticipantNombre}
                onChangeText={setNewParticipantNombre}
                placeholder="Juan Pérez"
                placeholderTextColor={Colors[colorScheme ?? 'light'].text + '60'}
              />
            </View>

            <View style={styles.formField}>
              <ThemedText style={styles.fieldLabel}>Email</ThemedText>
              <TextInput
                style={[styles.input, { backgroundColor: Colors[colorScheme ?? 'light'].background, color: Colors[colorScheme ?? 'light'].text }]}
                value={newParticipantEmail}
                onChangeText={setNewParticipantEmail}
                placeholder="juan@email.com"
                placeholderTextColor={Colors[colorScheme ?? 'light'].text + '60'}
                keyboardType="email-address"
              />
            </View>

            <View style={styles.formField}>
              <ThemedText style={styles.fieldLabel}>Teléfono</ThemedText>
              <TextInput
                style={[styles.input, { backgroundColor: Colors[colorScheme ?? 'light'].background, color: Colors[colorScheme ?? 'light'].text }]}
                value={newParticipantTelefono}
                onChangeText={setNewParticipantTelefono}
                placeholder="600123456"
                placeholderTextColor={Colors[colorScheme ?? 'light'].text + '60'}
                keyboardType="phone-pad"
              />
            </View>

            <View style={styles.formField}>
              <ThemedText style={styles.fieldLabel}>Entitat/Institución</ThemedText>
              <TextInput
                style={[styles.input, { backgroundColor: Colors[colorScheme ?? 'light'].background, color: Colors[colorScheme ?? 'light'].text }]}
                value={newParticipantEntitat}
                onChangeText={setNewParticipantEntitat}
                placeholder="Nombre de la institución"
                placeholderTextColor={Colors[colorScheme ?? 'light'].text + '60'}
              />
            </View>

            <View style={styles.formField}>
              <ThemedText style={styles.fieldLabel}>Tipo de Escuela</ThemedText>
              <TextInput
                style={[styles.input, { backgroundColor: Colors[colorScheme ?? 'light'].background, color: Colors[colorScheme ?? 'light'].text }]}
                value={newParticipantEscuela}
                onChangeText={setNewParticipantEscuela}
                placeholder="Pública, Concertada, Privada..."
                placeholderTextColor={Colors[colorScheme ?? 'light'].text + '60'}
              />
            </View>

            <View style={styles.formField}>
              <ThemedText style={styles.fieldLabel}>Cargo/Responsabilidad</ThemedText>
              <TextInput
                style={[styles.input, { backgroundColor: Colors[colorScheme ?? 'light'].background, color: Colors[colorScheme ?? 'light'].text }]}
                value={newParticipantCargo}
                onChangeText={setNewParticipantCargo}
                placeholder="Director, Profesor, Coordinador..."
                placeholderTextColor={Colors[colorScheme ?? 'light'].text + '60'}
              />
            </View>

            {/* Ha Pagado toggle */}
            <TouchableOpacity
              style={styles.checkboxRow}
              onPress={() => setNewParticipantHaPagado(!newParticipantHaPagado)}
            >
              <View style={[
                styles.checkbox,
                newParticipantHaPagado && { backgroundColor: Colors.light.success, borderColor: Colors.light.success }
              ]}>
                {newParticipantHaPagado && <Text style={styles.checkboxCheck}>✓</Text>}
              </View>
              <ThemedText style={styles.checkboxLabel}>Ha Pagado</ThemedText>
            </TouchableOpacity>

            {/* Permisos section */}
            <View style={styles.permisosSection}>
              <ThemedText style={styles.permisosSectionTitle}>Permisos de Acceso</ThemedText>

              <TouchableOpacity
                style={styles.checkboxRow}
                onPress={() => setNewParticipantPermisoAulaMagna(!newParticipantPermisoAulaMagna)}
              >
                <View style={[
                  styles.checkbox,
                  newParticipantPermisoAulaMagna && { backgroundColor: Colors.light.modeCena, borderColor: Colors.light.modeCena }
                ]}>
                  {newParticipantPermisoAulaMagna && <Text style={styles.checkboxCheck}>✓</Text>}
                </View>
                <ThemedText style={styles.checkboxLabel}>Aula Magna</ThemedText>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.checkboxRow}
                onPress={() => setNewParticipantPermisoMasterClass(!newParticipantPermisoMasterClass)}
              >
                <View style={[
                  styles.checkbox,
                  newParticipantPermisoMasterClass && { backgroundColor: Colors.light.modeAulaMagna, borderColor: Colors.light.modeAulaMagna }
                ]}>
                  {newParticipantPermisoMasterClass && <Text style={styles.checkboxCheck}>✓</Text>}
                </View>
                <ThemedText style={styles.checkboxLabel}>Master Class</ThemedText>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.checkboxRow}
                onPress={() => setNewParticipantPermisoCena(!newParticipantPermisoCena)}
              >
                <View style={[
                  styles.checkbox,
                  newParticipantPermisoCena && { backgroundColor: Colors.light.modeMasterClass, borderColor: Colors.light.modeMasterClass }
                ]}>
                  {newParticipantPermisoCena && <Text style={styles.checkboxCheck}>✓</Text>}
                </View>
                <ThemedText style={styles.checkboxLabel}>Cena</ThemedText>
              </TouchableOpacity>
            </View>

            <View style={styles.modalActions}>
              <TouchableOpacity
                style={[styles.modalButton, styles.cancelButton]}
                onPress={() => setShowAddParticipantModal(false)}
              >
                <Text style={styles.cancelButtonText}>Cancelar</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modalButton, styles.submitButton, { backgroundColor: Colors.light.success }]}
                onPress={handleAddParticipant}
                disabled={loading}
              >
                <Text style={styles.submitButtonText}>Añadir</Text>
              </TouchableOpacity>
            </View>
          </View>
          </ScrollView>
        </View>
      </Modal>

      {/* Email confirmation modal */}
      <Modal
        visible={showEmailConfirmModal}
        animationType="fade"
        transparent
        onRequestClose={() => setShowEmailConfirmModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { backgroundColor: Colors[colorScheme ?? 'light'].cardBackground }]}>
            <ThemedText style={styles.modalTitle}>
              📧 Confirmar Envío de Email
            </ThemedText>

            {emailTarget === 'single' && selectedParticipantForEmail ? (
              <View style={styles.emailConfirmInfo}>
                <ThemedText style={styles.emailConfirmText}>
                  ¿Enviar invitación a:
                </ThemedText>
                <ThemedText style={styles.emailConfirmName}>
                  {selectedParticipantForEmail.nombre}
                </ThemedText>
                <ThemedText style={styles.emailConfirmEmail}>
                  {selectedParticipantForEmail.email}
                </ThemedText>
              </View>
            ) : (
              <View style={styles.emailConfirmInfo}>
                <ThemedText style={styles.emailConfirmText}>
                  ¿Enviar invitación a todos los participantes con email?
                </ThemedText>
                <ThemedText style={styles.emailConfirmCount}>
                  {participants.filter((p) => p.email).length} participantes recibirán el email
                </ThemedText>
              </View>
            )}

            <ThemedText style={styles.emailConfirmNote}>
              Se usará la plantilla predeterminada del evento &quot;{currentEvent?.name}&quot;.
            </ThemedText>

            <View style={styles.modalButtons}>
              <TouchableOpacity
                style={[styles.modalButton, styles.cancelModalButton]}
                onPress={() => {
                  setShowEmailConfirmModal(false);
                  setSelectedParticipantForEmail(null);
                }}
                disabled={sendingEmail}
              >
                <Text style={styles.cancelModalButtonText}>Cancelar</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[
                  styles.modalButton,
                  styles.confirmModalButton,
                  { backgroundColor: Colors.light.primary },
                ]}
                onPress={handleConfirmSendEmail}
                disabled={sendingEmail}
              >
                <Text style={styles.confirmModalButtonText}>
                  {sendingEmail ? 'Enviando...' : '📧 Enviar'}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Result modal (unified feedback) */}
      <Modal
        visible={resultModal.visible}
        animationType="fade"
        transparent
        onRequestClose={closeResultModal}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.resultModal, { backgroundColor: Colors[colorScheme ?? 'light'].cardBackground }]}>
            {/* Icon based on type */}
            <View style={[
              styles.resultIconContainer,
              {
                backgroundColor:
                  resultModal.type === 'success' ? Colors.light.success + '20' :
                  resultModal.type === 'error' ? Colors.light.error + '20' :
                  resultModal.type === 'warning' ? Colors.light.warning + '20' :
                  Colors.light.primary + '20',
              },
            ]}>
              <Text style={styles.resultIcon}>
                {resultModal.type === 'success' ? '✅' :
                 resultModal.type === 'error' ? '❌' :
                 resultModal.type === 'warning' ? '⚠️' : 'ℹ️'}
              </Text>
            </View>

            {/* Title */}
            <ThemedText style={styles.resultTitle}>{resultModal.title}</ThemedText>

            {/* Message */}
            <ThemedText style={styles.resultMessage}>{resultModal.message}</ThemedText>

            {/* Details */}
            {resultModal.details && resultModal.details.length > 0 && (
              <View style={[
                styles.resultDetails,
                { backgroundColor: Colors[colorScheme ?? 'light'].background },
              ]}>
                {resultModal.details.map((detail, index) => (
                  <ThemedText key={index} style={styles.resultDetailItem}>
                    {detail}
                  </ThemedText>
                ))}
              </View>
            )}

            {/* Actions */}
            <View style={styles.resultActions}>
              {resultModal.action && (
                <TouchableOpacity
                  style={[styles.resultActionButton, { backgroundColor: Colors[colorScheme ?? 'light'].primary }]}
                  onPress={resultModal.action.onPress}
                >
                  <Text style={styles.resultActionButtonText}>{resultModal.action.label}</Text>
                </TouchableOpacity>
              )}
              <TouchableOpacity
                style={[
                  styles.resultCloseButton,
                  resultModal.action ? { flex: 1 } : { width: '100%' },
                  { borderColor: Colors[colorScheme ?? 'light'].border },
                ]}
                onPress={closeResultModal}
              >
                <ThemedText style={styles.resultCloseButtonText}>Cerrar</ThemedText>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Format info modal */}
      <Modal
        visible={showFormatInfoModal}
        animationType="fade"
        transparent
        onRequestClose={() => setShowFormatInfoModal(false)}
      >
        <View style={styles.modalOverlay}>
          <ScrollView
            style={styles.formatInfoScrollView}
            contentContainerStyle={styles.formatInfoScrollContent}
          >
            <View style={[styles.formatInfoModal, { backgroundColor: Colors[colorScheme ?? 'light'].cardBackground }]}>
              <ThemedText style={styles.modalTitle}>
                Formato de Importación
              </ThemedText>

              {/* Formatos aceptados */}
              <View style={styles.formatSection}>
                <ThemedText style={styles.formatSectionTitle}>
                  FORMATOS DE ARCHIVO ACEPTADOS
                </ThemedText>
                <ThemedText style={styles.formatText}>
                  • Archivos CSV (.csv){'\n'}
                  • Archivos Excel (.xlsx, .xls)
                </ThemedText>
              </View>

              {/* Hoja de Excel */}
              <View style={styles.formatSection}>
                <ThemedText style={styles.formatSectionTitle}>
                  HOJA DE EXCEL
                </ThemedText>
                <ThemedText style={styles.formatText}>
                  Se usa siempre la <ThemedText style={styles.formatBold}>primera hoja</ThemedText> del archivo Excel, independientemente de su nombre.
                </ThemedText>
              </View>

              {/* Columnas obligatorias */}
              <View style={styles.formatSection}>
                <ThemedText style={styles.formatSectionTitle}>
                  COLUMNAS OBLIGATORIAS
                </ThemedText>
                <ThemedText style={styles.formatText}>
                  <ThemedText style={styles.formatBold}>DNI</ThemedText> - Identificador único del participante{'\n'}
                  • Puede ser cualquier texto (ej: &quot;12345678A&quot;, &quot;P001&quot;){'\n'}
                  • Se usa como clave primaria en la base de datos{'\n'}
                  • Si hay DNIs duplicados, solo se guarda el último{'\n\n'}
                  <ThemedText style={styles.formatBold}>NOMBRE</ThemedText> - Nombre completo{'\n'}
                  • Se acepta columna &quot;Nombre&quot; directamente{'\n'}
                  • O combinación de &quot;NOM&quot; + &quot;COGNOMS&quot; (se concatenan automáticamente)
                </ThemedText>
              </View>

              {/* Columnas funcionales */}
              <View style={styles.formatSection}>
                <ThemedText style={styles.formatSectionTitle}>
                  COLUMNAS FUNCIONALES (Afectan al funcionamiento de la app)
                </ThemedText>
                <ThemedText style={styles.formatText}>
                  <ThemedText style={styles.formatBold}>ACCESO</ThemedText> - Tipo de acceso al evento{'\n'}
                  • Si contiene &quot;Presencial&quot; → Permiso de Aula Magna{'\n'}
                  • Cualquier otro valor (ej: &quot;Online&quot;) → Sin acceso presencial{'\n\n'}
                  <ThemedText style={styles.formatBold}>MASTER_CLASS</ThemedText> - Permiso para Master Class{'\n'}
                  • Valores positivos: &quot;Si&quot;, &quot;Sí&quot;, &quot;1&quot;, &quot;Yes&quot;, &quot;True&quot;{'\n'}
                  • Cualquier otro valor = No tiene permiso{'\n\n'}
                  <ThemedText style={styles.formatBold}>CENA</ThemedText> - Permiso para Cena{'\n'}
                  • Mismos valores positivos que Master Class{'\n\n'}
                  <ThemedText style={styles.formatBold}>MAIL / EMAIL</ThemedText> - Correo electrónico{'\n'}
                  • Se muestra al escanear el QR (junto con nombre y DNI){'\n'}
                  • Necesario para enviar invitaciones con código QR{'\n'}
                  • Sin email, no se puede enviar la invitación al participante
                </ThemedText>
              </View>

              {/* Columnas informativas */}
              <View style={styles.formatSection}>
                <ThemedText style={styles.formatSectionTitle}>
                  COLUMNAS INFORMATIVAS (Opcionales)
                </ThemedText>
                <ThemedText style={styles.formatText}>
                  Si no existen o están vacías, se importan como vacías:{'\n\n'}
                  • <ThemedText style={styles.formatBold}>TELÈFON / TELEFONO</ThemedText> - Teléfono de contacto{'\n'}
                  • <ThemedText style={styles.formatBold}>ENTITAT/INSTITUCIÓ / ENTITAT</ThemedText> - Entidad o institución{'\n'}
                  • <ThemedText style={styles.formatBold}>TIPUS D&apos;ESCOLA / ESCUELA</ThemedText> - Tipo de escuela{'\n'}
                  • <ThemedText style={styles.formatBold}>LLOC/RESPONSABILITAT / CARGO</ThemedText> - Cargo o responsabilidad{'\n'}
                  • <ThemedText style={styles.formatBold}>HA PAGAT? / HA PAGADO</ThemedText> - Estado de pago (Si/No)
                </ThemedText>
              </View>

              {/* Notas importantes */}
              <View style={[styles.formatSection, styles.formatNoteSection]}>
                <ThemedText style={styles.formatSectionTitle}>
                  NOTAS IMPORTANTES
                </ThemedText>
                <ThemedText style={styles.formatText}>
                  • El orden de las columnas NO importa{'\n'}
                  • Las mayúsculas/minúsculas NO importan{'\n'}
                  • La primera fila debe ser la cabecera con los nombres{'\n'}
                  • Las filas sin DNI o sin Nombre se saltan automáticamente{'\n'}
                  • DNIs duplicados se sobrescriben (solo cuenta el último)
                </ThemedText>
              </View>

              {/* Ejemplo CSV */}
              <View style={[styles.formatSection, styles.formatExampleSection]}>
                <ThemedText style={styles.formatSectionTitle}>
                  EJEMPLO MÍNIMO CSV
                </ThemedText>
                <View style={styles.codeBlock}>
                  <Text style={styles.codeText}>
                    DNI,Nombre,Acceso,Master_Class,Cena{'\n'}
                    12345678A,Juan Pérez,Presencial,Si,No{'\n'}
                    87654321B,María García,Online,No,Si
                  </Text>
                </View>
              </View>

              {/* Formatos QR */}
              <View style={styles.formatSection}>
                <ThemedText style={styles.formatSectionTitle}>
                  FORMATOS DE QR ACEPTADOS
                </ThemedText>
                <ThemedText style={styles.formatText}>
                  El escáner acepta varios formatos de código QR:{'\n\n'}
                  <ThemedText style={styles.formatBold}>1. Nombre/DNI/Correo</ThemedText> (recomendado){'\n'}
                  Formato usado en las invitaciones enviadas por email.{'\n'}
                  Ejemplo: Juan Pérez/12345678A/juan@email.com{'\n\n'}
                  <ThemedText style={styles.formatBold}>2. EventoID/DNI</ThemedText>{'\n'}
                  Valida que el QR sea del evento activo.{'\n'}
                  Ejemplo: abc123xyz/12345678A{'\n\n'}
                  <ThemedText style={styles.formatBold}>3. JSON</ThemedText> (legacy){'\n'}
                  Formato alternativo en JSON.{'\n'}
                  Ejemplo: {'{'}&#34;dni&#34;:&#34;12345678A&#34;,&#34;nombre&#34;:&#34;Juan&#34;{'}'}
                </ThemedText>
              </View>

              <TouchableOpacity
                style={[styles.formatCloseButton, { backgroundColor: Colors[colorScheme ?? 'light'].primary }]}
                onPress={() => setShowFormatInfoModal(false)}
              >
                <Text style={styles.formatCloseButtonText}>Entendido</Text>
              </TouchableOpacity>
            </View>
          </ScrollView>
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
  // Responsive layout styles
  twoColumnLayout: {
    flexDirection: 'row',
    gap: Spacing.xl,
  },
  singleColumnLayout: {
    flexDirection: 'column',
  },
  leftColumn: {
    flex: 2,
    minWidth: 300,
  },
  rightColumn: {
    flex: 3,
    minWidth: 400,
  },
  fullWidth: {
    width: '100%',
  },
  subsection: {
    marginTop: Spacing.lg,
  },
  subsectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: Spacing.md,
  },
  fieldLabel: {
    fontSize: FontSizes.sm,
    fontWeight: '600',
    marginBottom: Spacing.xs,
  },
  // Event selector (grouped by organization)
  eventSelectorSection: {
    marginBottom: Spacing.lg,
  },
  eventSelectorScrollView: {
    maxHeight: 250,
    borderRadius: BorderRadius.md,
    marginTop: Spacing.xs,
    borderWidth: 1,
    borderColor: 'rgba(0,0,0,0.1)',
  },
  orgGroup: {
    marginBottom: Spacing.xs,
  },
  orgHeader: {
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
  },
  orgHeaderText: {
    fontSize: FontSizes.sm,
    fontWeight: 'bold',
  },
  orgEventsList: {
    paddingHorizontal: Spacing.xs,
    paddingBottom: Spacing.xs,
  },
  eventSelectorOption: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    marginBottom: Spacing.xs,
  },
  eventOptionContent: {
    flex: 1,
  },
  eventSelectorOptionText: {
    fontSize: FontSizes.sm,
    fontWeight: '600',
  },
  eventDateText: {
    fontSize: FontSizes.xs,
    marginTop: 2,
  },
  selectedIcon: {
    fontSize: FontSizes.md,
    color: '#fff',
    fontWeight: 'bold',
    marginLeft: Spacing.sm,
  },
  eventSelectorList: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.xs,
    marginTop: Spacing.xs,
  },
  warningBanner: {
    padding: Spacing.md,
    borderRadius: BorderRadius.md,
  },
  warningText: {
    fontSize: FontSizes.md,
    fontWeight: '600',
  },
  // Import mode
  importModeSection: {
    marginBottom: Spacing.lg,
    padding: Spacing.md,
    backgroundColor: 'rgba(0,0,0,0.02)',
    borderRadius: BorderRadius.md,
  },
  modeSelector: {
    flexDirection: 'row',
    gap: Spacing.sm,
    marginTop: Spacing.xs,
  },
  modeOption: {
    flex: 1,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    borderColor: Colors.light.border,
    alignItems: 'center',
  },
  modeOptionText: {
    fontSize: FontSizes.sm,
    fontWeight: '600',
  },
  modeDescription: {
    fontSize: FontSizes.xs,
    opacity: 0.7,
    marginTop: Spacing.xs,
  },
  // Action cards
  actionCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: Spacing.md,
    borderRadius: BorderRadius.lg,
    marginBottom: Spacing.md,
    gap: Spacing.md,
  },
  actionIcon: {
    fontSize: 32,
  },
  actionTextContainer: {
    flex: 1,
  },
  actionTitle: {
    fontSize: FontSizes.md,
    fontWeight: 'bold',
    marginBottom: 4,
  },
  actionDescription: {
    fontSize: FontSizes.sm,
    opacity: 0.7,
  },
  infoButton: {
    padding: Spacing.md,
    borderRadius: BorderRadius.md,
    alignItems: 'center',
    marginTop: Spacing.sm,
  },
  infoButtonText: {
    color: '#fff',
    fontWeight: '600',
    fontSize: FontSizes.sm,
  },
  // Participant search
  participantSearchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    marginBottom: Spacing.md,
  },
  participantSearchIcon: {
    fontSize: 16,
    marginRight: Spacing.sm,
  },
  participantSearchInput: {
    flex: 1,
    fontSize: FontSizes.sm,
    paddingVertical: Spacing.xs,
  },
  participantSearchClear: {
    fontSize: 16,
    color: Colors.light.textSecondary,
    paddingHorizontal: Spacing.sm,
  },
  searchResultsCount: {
    paddingVertical: Spacing.xs,
    paddingHorizontal: Spacing.sm,
    backgroundColor: Colors.light.primary + '15',
    borderRadius: BorderRadius.sm,
    marginBottom: Spacing.sm,
  },
  searchResultsText: {
    fontSize: FontSizes.xs,
    color: Colors.light.primary,
    fontWeight: '600',
  },
  // Table
  table: {
    borderRadius: BorderRadius.md,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: Colors.light.border,
  },
  tableRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.xs,
    borderBottomWidth: 1,
    borderBottomColor: Colors.light.border,
  },
  tableHeader: {
    backgroundColor: Colors.light.primary + '20',
  },
  tableCell: {
    paddingHorizontal: Spacing.xs,
  },
  tableHeaderCell: {
    fontWeight: 'bold',
    fontSize: FontSizes.xs,
    color: Colors.light.primary,
  },
  colDNI: {
    width: 100,
  },
  colNombre: {
    flex: 1,
    minWidth: 150,
  },
  colPermisos: {
    width: 200,
  },
  colAcciones: {
    width: 90,
    alignItems: 'center',
  },
  actionButtonsRow: {
    flexDirection: 'row',
    gap: 4,
    alignItems: 'center',
  },
  emailButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emailButtonText: {
    fontSize: 14,
  },
  emailAllButton: {
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.xs,
    borderRadius: BorderRadius.md,
  },
  emailAllButtonText: {
    color: '#fff',
    fontWeight: '600',
    fontSize: FontSizes.sm,
  },
  permisosContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 4,
    justifyContent: 'center',
  },
  permisoBadge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  permisoBadgeText: {
    color: '#fff',
    fontSize: 10,
    fontWeight: '600',
  },
  deleteButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  deleteButtonText: {
    fontSize: 14,
  },
  // Info card
  infoCard: {
    padding: Spacing.lg,
    borderRadius: BorderRadius.md,
    alignItems: 'center',
  },
  infoText: {
    textAlign: 'center',
    opacity: 0.7,
  },
  // Loading
  loadingContainer: {
    padding: Spacing.xl,
    alignItems: 'center',
  },
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
    maxWidth: 400,
    borderRadius: BorderRadius.lg,
    padding: Spacing.lg,
  },
  addParticipantScrollView: {
    flex: 1,
    width: '100%',
  },
  addParticipantScrollContent: {
    flexGrow: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: Spacing.lg,
  },
  addParticipantModalContent: {
    maxWidth: 450,
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
  input: {
    borderWidth: 1,
    borderColor: Colors.light.border,
    borderRadius: BorderRadius.md,
    padding: Spacing.md,
    fontSize: FontSizes.md,
  },
  checkboxRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: Spacing.sm,
    paddingVertical: Spacing.xs,
  },
  checkbox: {
    width: 24,
    height: 24,
    borderWidth: 2,
    borderColor: Colors.light.border,
    borderRadius: BorderRadius.sm,
    marginRight: Spacing.sm,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkboxCheck: {
    color: '#fff',
    fontWeight: 'bold',
    fontSize: 14,
  },
  checkboxLabel: {
    fontSize: FontSizes.md,
  },
  permisosSection: {
    marginTop: Spacing.md,
    marginBottom: Spacing.md,
    padding: Spacing.md,
    backgroundColor: 'rgba(0,0,0,0.03)',
    borderRadius: BorderRadius.md,
  },
  permisosSectionTitle: {
    fontSize: FontSizes.sm,
    fontWeight: 'bold',
    marginBottom: Spacing.sm,
    color: Colors.light.primary,
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
  // Email confirmation modal
  emailConfirmInfo: {
    alignItems: 'center',
    marginBottom: Spacing.md,
  },
  emailConfirmText: {
    fontSize: FontSizes.md,
    textAlign: 'center',
    marginBottom: Spacing.sm,
  },
  emailConfirmName: {
    fontSize: FontSizes.lg,
    fontWeight: 'bold',
    textAlign: 'center',
  },
  emailConfirmEmail: {
    fontSize: FontSizes.sm,
    opacity: 0.7,
    textAlign: 'center',
  },
  emailConfirmCount: {
    fontSize: FontSizes.lg,
    fontWeight: 'bold',
    textAlign: 'center',
    color: Colors.light.primary,
  },
  emailConfirmNote: {
    fontSize: FontSizes.xs,
    fontStyle: 'italic',
    opacity: 0.7,
    textAlign: 'center',
    marginBottom: Spacing.lg,
  },
  modalButtons: {
    flexDirection: 'row',
    gap: Spacing.md,
  },
  cancelModalButton: {
    borderWidth: 1,
    borderColor: Colors.light.border,
  },
  cancelModalButtonText: {
    fontWeight: '600',
  },
  confirmModalButton: {},
  confirmModalButtonText: {
    color: '#fff',
    fontWeight: '600',
  },
  // Result modal styles
  resultModal: {
    width: '100%',
    maxWidth: 420,
    borderRadius: BorderRadius.lg,
    padding: Spacing.xl,
    alignItems: 'center',
  },
  resultIconContainer: {
    width: 64,
    height: 64,
    borderRadius: 32,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: Spacing.md,
  },
  resultIcon: {
    fontSize: 32,
  },
  resultTitle: {
    fontSize: FontSizes.xl,
    fontWeight: 'bold',
    textAlign: 'center',
    marginBottom: Spacing.sm,
  },
  resultMessage: {
    fontSize: FontSizes.md,
    textAlign: 'center',
    opacity: 0.8,
    marginBottom: Spacing.md,
  },
  resultDetails: {
    width: '100%',
    borderRadius: BorderRadius.md,
    padding: Spacing.md,
    marginBottom: Spacing.lg,
  },
  resultDetailItem: {
    fontSize: FontSizes.sm,
    marginBottom: Spacing.xs,
    lineHeight: 20,
  },
  resultActions: {
    flexDirection: 'row',
    gap: Spacing.md,
    width: '100%',
  },
  resultActionButton: {
    flex: 1,
    padding: Spacing.md,
    borderRadius: BorderRadius.md,
    alignItems: 'center',
  },
  resultActionButtonText: {
    color: '#fff',
    fontWeight: '600',
    fontSize: FontSizes.md,
  },
  resultCloseButton: {
    padding: Spacing.md,
    borderRadius: BorderRadius.md,
    alignItems: 'center',
    borderWidth: 1,
  },
  resultCloseButtonText: {
    fontWeight: '600',
    fontSize: FontSizes.md,
  },
  // Format info modal styles
  formatInfoScrollView: {
    flex: 1,
    width: '100%',
  },
  formatInfoScrollContent: {
    flexGrow: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: Spacing.lg,
  },
  formatInfoModal: {
    width: '100%',
    maxWidth: 550,
    borderRadius: BorderRadius.lg,
    padding: Spacing.lg,
  },
  formatSection: {
    marginBottom: Spacing.lg,
  },
  formatSectionTitle: {
    fontSize: FontSizes.sm,
    fontWeight: 'bold',
    color: Colors.light.primary,
    marginBottom: Spacing.xs,
    letterSpacing: 0.5,
  },
  formatText: {
    fontSize: FontSizes.sm,
    lineHeight: 22,
  },
  formatBold: {
    fontWeight: 'bold',
  },
  formatNoteSection: {
    backgroundColor: Colors.light.warning + '15',
    padding: Spacing.md,
    borderRadius: BorderRadius.md,
    borderLeftWidth: 3,
    borderLeftColor: Colors.light.warning,
  },
  formatExampleSection: {
    backgroundColor: Colors.light.primary + '10',
    padding: Spacing.md,
    borderRadius: BorderRadius.md,
  },
  codeBlock: {
    backgroundColor: '#1e1e1e',
    padding: Spacing.md,
    borderRadius: BorderRadius.sm,
    marginTop: Spacing.xs,
  },
  codeText: {
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
    fontSize: FontSizes.xs,
    color: '#d4d4d4',
    lineHeight: 18,
  },
  formatCloseButton: {
    padding: Spacing.md,
    borderRadius: BorderRadius.md,
    alignItems: 'center',
    marginTop: Spacing.md,
  },
  formatCloseButtonText: {
    color: '#fff',
    fontWeight: '600',
    fontSize: FontSizes.md,
  },
});
