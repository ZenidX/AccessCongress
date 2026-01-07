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
  useWindowDimensions,
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
  ImportMode,
} from '@/services/participantService';
import { sendEmailToParticipant, sendBulkEmails } from '@/services/emailSendService';
import { getDefaultTemplate } from '@/services/emailTemplateService';
import { Participant } from '@/types/participant';
import { Event } from '@/types/event';
import { Colors, BorderRadius, Spacing, Shadows, FontSizes } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { useEvent } from '@/contexts/EventContext';
import { useAuth } from '@/contexts/AuthContext';
import { getEventsByOrganization, getAllEvents } from '@/services/eventService';
import { getUserData } from '@/services/userService';
import { User } from '@/types/user';

export function ParticipantsSection() {
  const colorScheme = useColorScheme();
  const { currentEvent, setCurrentEvent } = useEvent();
  const { user, isSuperAdmin } = useAuth();

  // Responsive layout
  const { width } = useWindowDimensions();
  const isWideScreen = width >= 900;

  // State
  const [loading, setLoading] = useState(false);
  const [importMode, setImportMode] = useState<ImportMode>('merge');
  const [participants, setParticipants] = useState<Participant[]>([]);
  const [loadingParticipants, setLoadingParticipants] = useState(false);

  // Local events state (fetch directly like EventManager)
  const [events, setEvents] = useState<Event[]>([]);
  const [loadingEvents, setLoadingEvents] = useState(true);
  // Organization names for grouping (organizationId -> name)
  const [orgNames, setOrgNames] = useState<Record<string, string>>({});

  // Add participant modal state
  const [showAddParticipantModal, setShowAddParticipantModal] = useState(false);
  const [newParticipantDNI, setNewParticipantDNI] = useState('');
  const [newParticipantNombre, setNewParticipantNombre] = useState('');
  const [newParticipantEmail, setNewParticipantEmail] = useState('');
  const [newParticipantTelefono, setNewParticipantTelefono] = useState('');

  // Email sending state
  const [showEmailConfirmModal, setShowEmailConfirmModal] = useState(false);
  const [emailTarget, setEmailTarget] = useState<'single' | 'all'>('all');
  const [selectedParticipantForEmail, setSelectedParticipantForEmail] = useState<Participant | null>(null);
  const [sendingEmail, setSendingEmail] = useState(false);

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
    } catch (error) {
      console.error('Error loading participants:', error);
      Alert.alert('Error', 'No se pudieron cargar los participantes');
    } finally {
      setLoadingParticipants(false);
    }
  }, [currentEvent]);

  /**
   * Import participants from CSV or Excel file
   */
  const handleImportCSV = async () => {
    if (!currentEvent) {
      Alert.alert('Error', 'Selecciona un evento primero');
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
      Alert.alert(
        'Importación Completada',
        `Se ${importMode === 'replace' ? 'reemplazaron' : 'importaron'} ${count} participantes correctamente.`
      );

      // Reload participants list
      loadParticipants();
    } catch (error: any) {
      console.error('Error importing:', error);
      setLoading(false);
      Alert.alert('Error de Importación', error.message || 'Error al procesar el archivo');
    }
  };

  /**
   * Export data to Excel
   */
  const handleExportData = async () => {
    if (!currentEvent) {
      Alert.alert('Error', 'Selecciona un evento primero');
      return;
    }

    try {
      setLoading(true);
      const fileUri = await exportDataToExcel(currentEvent.id);
      setLoading(false);

      if (Platform.OS === 'web') {
        Alert.alert('Exportación Completada', 'El archivo se ha descargado');
      } else {
        const isAvailable = await Sharing.isAvailableAsync();
        if (isAvailable) {
          await Sharing.shareAsync(fileUri, {
            mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
            dialogTitle: 'Exportar datos del evento',
          });
        } else {
          Alert.alert('Exportación Completada', `Archivo guardado en: ${fileUri}`);
        }
      }
    } catch (error: any) {
      console.error('Error exporting:', error);
      setLoading(false);
      Alert.alert('Error de Exportación', error.message || 'Error al exportar datos');
    }
  };

  /**
   * Add individual participant
   */
  const handleAddParticipant = async () => {
    if (!newParticipantDNI.trim() || !newParticipantNombre.trim()) {
      Alert.alert('Error', 'DNI y Nombre son obligatorios');
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
        permisos: {
          aula_magna: true,
          master_class: false,
          cena: false,
        },
        estado: {
          registrado: false,
          en_aula_magna: false,
          en_master_class: false,
          en_cena: false,
        },
      }, currentEvent.id);

      Alert.alert('Éxito', 'Participante añadido correctamente');
      setShowAddParticipantModal(false);
      setNewParticipantDNI('');
      setNewParticipantNombre('');
      setNewParticipantEmail('');
      setNewParticipantTelefono('');
      loadParticipants();
    } catch (error: any) {
      console.error('Error adding participant:', error);
      Alert.alert('Error', error.message || 'No se pudo añadir el participante');
    } finally {
      setLoading(false);
    }
  };

  /**
   * Delete participant
   */
  const handleDeleteParticipant = (dni: string, nombre: string) => {
    if (!currentEvent) return;

    Alert.alert(
      'Confirmar eliminación',
      `¿Estás seguro de eliminar a ${nombre} (${dni})?`,
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Eliminar',
          style: 'destructive',
          onPress: async () => {
            setLoading(true);
            try {
              await deleteParticipant(dni, currentEvent.id);
              Alert.alert('Éxito', 'Participante eliminado');
              loadParticipants();
            } catch (error: any) {
              Alert.alert('Error', error.message || 'No se pudo eliminar');
            } finally {
              setLoading(false);
            }
          },
        },
      ]
    );
  };

  /**
   * Send email to a single participant
   */
  const handleSendEmailToParticipant = async (participant: Participant) => {
    if (!participant.email) {
      Alert.alert('Error', 'Este participante no tiene email registrado');
      return;
    }
    if (!currentEvent) {
      Alert.alert('Error', 'No hay evento seleccionado');
      return;
    }

    // Check if there's a default template
    const template = await getDefaultTemplate(currentEvent.id);
    if (!template) {
      Alert.alert(
        'Sin plantilla',
        'No hay plantilla de email configurada para este evento. Ve a la sección "Invitaciones" para crear una.'
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
    if (!currentEvent) {
      Alert.alert('Error', 'No hay evento seleccionado');
      return;
    }

    const participantsWithEmail = participants.filter((p) => p.email);
    if (participantsWithEmail.length === 0) {
      Alert.alert('Error', 'No hay participantes con email registrado');
      return;
    }

    // Check if there's a default template
    const template = await getDefaultTemplate(currentEvent.id);
    if (!template) {
      Alert.alert(
        'Sin plantilla',
        'No hay plantilla de email configurada para este evento. Ve a la sección "Invitaciones" para crear una.'
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
          Alert.alert('Éxito', `Email enviado a ${selectedParticipantForEmail.nombre}`);
        } else {
          Alert.alert('Error', result.error || 'No se pudo enviar el email');
        }
      } else {
        const result = await sendBulkEmails(currentEvent.id);
        if (result.success) {
          Alert.alert(
            'Envío completado',
            `Se enviaron ${result.sentCount} emails correctamente.${
              result.failedCount > 0 ? `\n${result.failedCount} fallaron.` : ''
            }`
          );
        } else {
          Alert.alert(
            'Envío parcial',
            `Enviados: ${result.sentCount}\nFallidos: ${result.failedCount}`
          );
        }
      }
      setShowEmailConfirmModal(false);
      setSelectedParticipantForEmail(null);
    } catch (error: any) {
      Alert.alert('Error', error.message || 'Error al enviar emails');
    } finally {
      setSendingEmail(false);
    }
  };

  /**
   * Reset all participant states
   */
  const handleResetStates = () => {
    if (!currentEvent) {
      Alert.alert('Error', 'Selecciona un evento primero');
      return;
    }

    Alert.alert(
      'Confirmar Reset',
      '¿Estás seguro de resetear TODOS los estados de participantes? Esto marcará a todos como no registrados.',
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Resetear',
          style: 'destructive',
          onPress: async () => {
            setLoading(true);
            try {
              await resetAllParticipantStates(currentEvent.id);
              Alert.alert('Éxito', 'Estados reseteados correctamente');
              loadParticipants();
            } catch (error: any) {
              Alert.alert('Error', error.message || 'No se pudo resetear');
            } finally {
              setLoading(false);
            }
          },
        },
      ]
    );
  };

  /**
   * Show CSV format info
   */
  const showCSVFormatInfo = () => {
    Alert.alert(
      'Formatos Aceptados',
      'CSV (.csv):\nDNI,Nombre,MasterClass,Cena\n12345678A,Juan Pérez,Si,No\n\nExcel (.xlsx, .xls):\nMismas columnas en la primera hoja.\n\nMasterClass y Cena: Si/No o 1/0',
      [{ text: 'Entendido' }]
    );
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

                {/* Table rows */}
                <ScrollView style={isWideScreen ? { maxHeight: 800 } : { maxHeight: 600 }}>
                  {participants.map((participant, index) => (
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
          <View style={[styles.modalContent, { backgroundColor: Colors[colorScheme ?? 'light'].cardBackground }]}>
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
    width: 350,
    flexShrink: 0,
  },
  rightColumn: {
    flex: 1,
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
});
