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
  ImportMode,
} from '@/services/participantService';
import { Participant } from '@/types/participant';
import { Event } from '@/types/event';
import { Colors, BorderRadius, Spacing, Shadows, FontSizes } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { useEvent } from '@/contexts/EventContext';
import { useAuth } from '@/contexts/AuthContext';
import { getEventsByOrganization, getAllEvents } from '@/services/eventService';

export function ParticipantsSection() {
  const colorScheme = useColorScheme();
  const { currentEvent, setCurrentEvent } = useEvent();
  const { user, isSuperAdmin } = useAuth();

  // State
  const [loading, setLoading] = useState(false);
  const [importMode, setImportMode] = useState<ImportMode>('merge');
  const [participants, setParticipants] = useState<Participant[]>([]);
  const [loadingParticipants, setLoadingParticipants] = useState(false);

  // Local events state (fetch directly like EventManager)
  const [events, setEvents] = useState<Event[]>([]);
  const [loadingEvents, setLoadingEvents] = useState(true);

  // Add participant modal state
  const [showAddParticipantModal, setShowAddParticipantModal] = useState(false);
  const [newParticipantDNI, setNewParticipantDNI] = useState('');
  const [newParticipantNombre, setNewParticipantNombre] = useState('');
  const [newParticipantEmail, setNewParticipantEmail] = useState('');
  const [newParticipantTelefono, setNewParticipantTelefono] = useState('');

  // Load events directly (same logic as EventManager)
  useEffect(() => {
    const loadEvents = async () => {
      if (!user) {
        setEvents([]);
        setLoadingEvents(false);
        return;
      }

      setLoadingEvents(true);
      try {
        let eventList: Event[];

        if (isSuperAdmin()) {
          // Super admin sees all events
          eventList = await getAllEvents();
        } else if (user.organizationId) {
          // Other admins see only their organization's events
          eventList = await getEventsByOrganization(user.organizationId);
        } else {
          eventList = [];
        }

        // Sort by date (most recent first)
        eventList.sort((a, b) => b.date - a.date);
        setEvents(eventList);

        // Auto-select first event if none selected
        if (!currentEvent && eventList.length > 0) {
          setCurrentEvent(eventList[0]);
        }
      } catch (error) {
        console.error('Error loading events:', error);
        setEvents([]);
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
        count = await importParticipantsFromExcel(fileUri, currentEvent.id, importMode);
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

      {/* Event selector */}
      <View style={styles.eventSelectorSection}>
        <ThemedText style={styles.fieldLabel}>Evento:</ThemedText>
        {loadingEvents ? (
          <ActivityIndicator size="small" color={Colors[colorScheme ?? 'light'].primary} />
        ) : events.length === 0 ? (
          <View style={[
            styles.warningBanner,
            { backgroundColor: Colors[colorScheme ?? 'light'].warning + '20' }
          ]}>
            <Text style={[styles.warningText, { color: Colors[colorScheme ?? 'light'].warning }]}>
              ⚠️ No hay eventos disponibles. Crea uno en la sección "Eventos".
            </Text>
          </View>
        ) : (
          <View style={styles.eventSelectorList}>
            {events.map((event) => (
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

      {/* Participants table */}
      <View style={[styles.subsection, { marginTop: Spacing.xl }]}>
        <View style={styles.subsectionHeader}>
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
            <ScrollView style={{ maxHeight: 600 }}>
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
  // Event selector
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
    width: 60,
    alignItems: 'center',
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
});
