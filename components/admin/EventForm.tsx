/**
 * EventForm Component
 *
 * Form for creating and editing events.
 * Features:
 * - Event name, description, date, location
 * - Calendar date picker for date fields
 * - Status selection
 * - Access modes configuration
 * - Organization selector for super_admin
 * - Validation
 */

import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  ScrollView,
  Alert,
  ActivityIndicator,
  Switch,
  Platform,
  Modal,
} from 'react-native';
import DateTimePicker, { DateTimePickerEvent } from '@react-native-community/datetimepicker';
import { Colors, BorderRadius, Spacing, FontSizes } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { useAuth } from '@/contexts/AuthContext';
import {
  Event,
  EventStatus,
  CreateEventData,
  UpdateEventData,
  DEFAULT_EVENT_SETTINGS,
} from '@/types/event';
import { AccessMode } from '@/types/participant';
import { createEvent, updateEvent } from '@/services/eventService';
import { Organization } from '@/types/organization';
import { getAllOrganizations } from '@/services/organizationService';

interface EventFormProps {
  event?: Event | null;
  organizationId?: string;
  onSave: (event: Event) => void;
  onCancel: () => void;
}

const STATUS_OPTIONS: { value: EventStatus; label: string }[] = [
  { value: 'draft', label: 'Borrador' },
  { value: 'active', label: 'Activo' },
  { value: 'completed', label: 'Completado' },
  { value: 'archived', label: 'Archivado' },
];

const ACCESS_MODE_OPTIONS: { value: AccessMode; label: string }[] = [
  { value: 'registro', label: 'Registro' },
  { value: 'aula_magna', label: 'Aula Magna' },
  { value: 'master_class', label: 'Master Class' },
  { value: 'cena', label: 'Cena' },
];

export function EventForm({
  event,
  organizationId,
  onSave,
  onCancel,
}: EventFormProps) {
  const colorScheme = useColorScheme();
  const { user, isSuperAdmin } = useAuth();
  const colors = Colors[colorScheme ?? 'light'];
  const isEditing = !!event;

  // Organizations state (for super_admin)
  const [organizations, setOrganizations] = useState<Organization[]>([]);
  const [selectedOrgId, setSelectedOrgId] = useState<string>(
    organizationId || event?.organizationId || ''
  );
  const [loadingOrgs, setLoadingOrgs] = useState(false);

  // Form state
  const [name, setName] = useState(event?.name ?? '');
  const [description, setDescription] = useState(event?.description ?? '');
  const [location, setLocation] = useState(event?.location ?? '');
  const [status, setStatus] = useState<EventStatus>(event?.status ?? 'draft');
  const [accessModes, setAccessModes] = useState<AccessMode[]>(
    event?.settings?.accessModes ?? DEFAULT_EVENT_SETTINGS.accessModes
  );

  // Load organizations for super_admin
  useEffect(() => {
    if (isSuperAdmin() && !organizationId) {
      loadOrganizations();
    }
  }, []);

  const loadOrganizations = async () => {
    setLoadingOrgs(true);
    try {
      const orgs = await getAllOrganizations();
      setOrganizations(orgs);
      // If no org selected and we have orgs, select the first one
      if (!selectedOrgId && orgs.length > 0) {
        setSelectedOrgId(orgs[0].id);
      }
    } catch (error) {
      console.error('Error loading organizations:', error);
    } finally {
      setLoadingOrgs(false);
    }
  };

  // Date state - store as Date objects
  const [date, setDate] = useState<Date | null>(
    event?.date ? new Date(event.date) : null
  );
  const [endDate, setEndDate] = useState<Date | null>(
    event?.endDate ? new Date(event.endDate) : null
  );

  // Date picker visibility state
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [showEndDatePicker, setShowEndDatePicker] = useState(false);
  const [activeDateField, setActiveDateField] = useState<'date' | 'endDate'>('date');

  const [saving, setSaving] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const validate = (): boolean => {
    const newErrors: Record<string, string> = {};

    if (!name.trim()) {
      newErrors.name = 'El nombre es obligatorio';
    }

    if (!date) {
      newErrors.date = 'La fecha es obligatoria';
    }

    if (accessModes.length === 0) {
      newErrors.accessModes = 'Selecciona al menos un modo de acceso';
    }

    // Validate organization for super_admin
    const orgId = organizationId || selectedOrgId || user?.organizationId;
    if (!orgId && !isEditing) {
      newErrors.organization = 'Selecciona una organización';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSave = async () => {
    if (!validate()) {
      return;
    }

    setSaving(true);

    try {
      const dateTimestamp = date!.getTime();
      const endDateTimestamp = endDate ? endDate.getTime() : undefined;

      if (isEditing && event) {
        // Update existing event
        const updateData: UpdateEventData = {
          name: name.trim(),
          description: description.trim() || undefined,
          location: location.trim() || undefined,
          date: dateTimestamp,
          endDate: endDateTimestamp,
          status,
          settings: {
            accessModes,
          },
        };

        await updateEvent(event.id, updateData);

        const updatedEvent: Event = {
          ...event,
          ...updateData,
          settings: {
            ...event.settings,
            accessModes,
          },
          updatedAt: Date.now(),
        };

        onSave(updatedEvent);
        Alert.alert('Éxito', 'Evento actualizado correctamente');
      } else {
        // Create new event
        const orgId = organizationId || selectedOrgId || user?.organizationId;
        if (!orgId) {
          Alert.alert('Error', 'No se pudo determinar la organización. Selecciona una organización o crea una nueva.');
          setSaving(false);
          return;
        }

        const createData: CreateEventData = {
          organizationId: orgId,
          name: name.trim(),
          description: description.trim() || undefined,
          location: location.trim() || undefined,
          date: dateTimestamp,
          endDate: endDateTimestamp,
          status,
          settings: {
            accessModes,
          },
        };

        const newEvent = await createEvent(createData, user?.uid ?? '');

        onSave(newEvent);
        Alert.alert('Éxito', 'Evento creado correctamente');
      }
    } catch (error: any) {
      console.error('Error saving event:', error);
      Alert.alert('Error', error.message || 'No se pudo guardar el evento');
    } finally {
      setSaving(false);
    }
  };

  const toggleAccessMode = (mode: AccessMode) => {
    setAccessModes((prev) => {
      const newModes = prev.includes(mode)
        ? prev.filter((m) => m !== mode)
        : [...prev, mode];

      // Clear error when at least one mode is selected
      if (errors.accessModes && newModes.length > 0) {
        setErrors((prevErrors) => ({ ...prevErrors, accessModes: '' }));
      }

      return newModes;
    });
  };

  // Format date for display
  const formatDate = (d: Date | null): string => {
    if (!d) return '';
    return d.toLocaleDateString('es-ES', {
      day: '2-digit',
      month: 'long',
      year: 'numeric',
    });
  };

  // Handle date change from picker
  const handleDateChange = (event: DateTimePickerEvent, selectedDate?: Date) => {
    if (Platform.OS === 'android') {
      setShowDatePicker(false);
      setShowEndDatePicker(false);
    }

    if (event.type === 'set' && selectedDate) {
      if (activeDateField === 'date') {
        setDate(selectedDate);
        // Clear error when date is selected
        if (errors.date) {
          setErrors((prev) => ({ ...prev, date: '' }));
        }
      } else {
        setEndDate(selectedDate);
      }
    }

    if (Platform.OS === 'ios') {
      // On iOS, keep the picker open until user dismisses
    }
  };

  // Open date picker
  const openDatePicker = (field: 'date' | 'endDate') => {
    setActiveDateField(field);
    if (field === 'date') {
      setShowDatePicker(true);
    } else {
      setShowEndDatePicker(true);
    }
  };

  // Confirm date selection (iOS)
  const confirmDateSelection = () => {
    setShowDatePicker(false);
    setShowEndDatePicker(false);
  };

  // Clear end date
  const clearEndDate = () => {
    setEndDate(null);
  };

  // Render date picker based on platform
  const renderDatePicker = () => {
    if (Platform.OS === 'web') {
      return null; // Web uses native input
    }

    const isVisible = showDatePicker || showEndDatePicker;
    const currentValue = activeDateField === 'date' ? date : endDate;

    if (!isVisible) return null;

    if (Platform.OS === 'ios') {
      return (
        <Modal
          visible={isVisible}
          transparent
          animationType="slide"
          onRequestClose={confirmDateSelection}
        >
          <View style={styles.datePickerModal}>
            <View style={[styles.datePickerContainer, { backgroundColor: colors.cardBackground }]}>
              <View style={styles.datePickerHeader}>
                <TouchableOpacity onPress={confirmDateSelection}>
                  <Text style={[styles.datePickerDone, { color: colors.primary }]}>Listo</Text>
                </TouchableOpacity>
              </View>
              <DateTimePicker
                value={currentValue || new Date()}
                mode="date"
                display="spinner"
                onChange={handleDateChange}
                locale="es-ES"
              />
            </View>
          </View>
        </Modal>
      );
    }

    // Android
    return (
      <DateTimePicker
        value={currentValue || new Date()}
        mode="date"
        display="default"
        onChange={handleDateChange}
      />
    );
  };

  return (
    <ScrollView
      style={[styles.container, { backgroundColor: colors.background }]}
      contentContainerStyle={styles.content}
      showsVerticalScrollIndicator={false}
    >
      {/* Header */}
      <Text style={[styles.title, { color: colors.text }]}>
        {isEditing ? 'Editar Evento' : 'Crear Evento'}
      </Text>

      {/* Validation errors summary */}
      {Object.keys(errors).filter(k => errors[k]).length > 0 && (
        <View style={[styles.errorSummary, { backgroundColor: colors.error + '15', borderColor: colors.error }]}>
          <Text style={[styles.errorSummaryTitle, { color: colors.error }]}>
            ⚠️ Por favor, corrige los siguientes errores:
          </Text>
          {Object.entries(errors).filter(([_, v]) => v).map(([key, value]) => (
            <Text key={key} style={[styles.errorSummaryItem, { color: colors.error }]}>
              • {value}
            </Text>
          ))}
        </View>
      )}

      {/* Organization Selector (for super_admin without organizationId) */}
      {isSuperAdmin() && !organizationId && !isEditing && (
        <View style={styles.field}>
          <Text style={[styles.label, { color: errors.organization ? colors.error : colors.text }]}>
            Organización *
          </Text>
          {loadingOrgs ? (
            <ActivityIndicator size="small" color={colors.primary} />
          ) : organizations.length === 0 ? (
            <View style={styles.noOrgContainer}>
              <Text style={[styles.noOrgText, { color: colors.text }]}>
                No hay organizaciones. Crea una primero desde la sección de Organizaciones.
              </Text>
            </View>
          ) : (
            <View style={styles.orgSelector}>
              {organizations.map((org) => (
                <TouchableOpacity
                  key={org.id}
                  style={[
                    styles.orgOption,
                    {
                      backgroundColor:
                        selectedOrgId === org.id ? colors.primary : colors.cardBackground,
                      borderColor: errors.organization ? colors.error : colors.border,
                      borderWidth: errors.organization ? 2 : 1,
                    },
                  ]}
                  onPress={() => {
                    setSelectedOrgId(org.id);
                    if (errors.organization) {
                      setErrors((prev) => ({ ...prev, organization: '' }));
                    }
                  }}
                >
                  <Text
                    style={[
                      styles.orgOptionText,
                      { color: selectedOrgId === org.id ? '#fff' : colors.text },
                    ]}
                  >
                    {org.name}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          )}
          {errors.organization && (
            <Text style={[styles.errorText, { color: colors.error }]}>
              {errors.organization}
            </Text>
          )}
        </View>
      )}

      {/* Name */}
      <View style={styles.field}>
        <Text style={[styles.label, { color: errors.name ? colors.error : colors.text }]}>
          Nombre *
        </Text>
        <TextInput
          style={[
            styles.input,
            {
              backgroundColor: colors.cardBackground,
              color: colors.text,
              borderColor: errors.name ? colors.error : colors.border,
              borderWidth: errors.name ? 2 : 1,
            },
          ]}
          value={name}
          onChangeText={(text) => {
            setName(text);
            if (errors.name && text.trim()) {
              setErrors((prev) => ({ ...prev, name: '' }));
            }
          }}
          placeholder="Nombre del evento"
          placeholderTextColor={colors.text + '60'}
        />
        {errors.name && (
          <Text style={[styles.errorText, { color: colors.error }]}>
            {errors.name}
          </Text>
        )}
      </View>

      {/* Description */}
      <View style={styles.field}>
        <Text style={[styles.label, { color: colors.text }]}>Descripción</Text>
        <TextInput
          style={[
            styles.input,
            styles.textArea,
            {
              backgroundColor: colors.cardBackground,
              color: colors.text,
              borderColor: colors.border,
            },
          ]}
          value={description}
          onChangeText={setDescription}
          placeholder="Descripción del evento"
          placeholderTextColor={colors.text + '60'}
          multiline
          numberOfLines={3}
        />
      </View>

      {/* Location */}
      <View style={styles.field}>
        <Text style={[styles.label, { color: colors.text }]}>Ubicación</Text>
        <TextInput
          style={[
            styles.input,
            {
              backgroundColor: colors.cardBackground,
              color: colors.text,
              borderColor: colors.border,
            },
          ]}
          value={location}
          onChangeText={setLocation}
          placeholder="Ubicación del evento"
          placeholderTextColor={colors.text + '60'}
        />
      </View>

      {/* Dates Row - Start and End Date side by side */}
      <View style={styles.datesRow}>
        {/* Start Date */}
        <View style={styles.dateFieldHalf}>
          <Text style={[styles.label, { color: errors.date ? colors.error : colors.text }]}>
            Fecha de inicio *
          </Text>
          {Platform.OS === 'web' ? (
            <input
              type="date"
              value={date ? date.toISOString().split('T')[0] : ''}
              onChange={(e) => {
                const newDate = e.target.value ? new Date(e.target.value) : null;
                setDate(newDate);
                if (errors.date && newDate) {
                  setErrors((prev) => ({ ...prev, date: '' }));
                }
              }}
              style={{
                ...styles.webDateInput,
                backgroundColor: colors.cardBackground,
                color: colors.text,
                borderColor: errors.date ? colors.error : colors.border,
                borderWidth: errors.date ? 2 : 1,
              }}
            />
          ) : (
            <TouchableOpacity
              style={[
                styles.dateButton,
                styles.dateButtonFullWidth,
                {
                  backgroundColor: colors.cardBackground,
                  borderColor: errors.date ? colors.error : colors.border,
                  borderWidth: errors.date ? 2 : 1,
                },
              ]}
              onPress={() => openDatePicker('date')}
            >
              <Text style={styles.dateButtonIcon}>📅</Text>
              <Text
                style={[
                  styles.dateButtonText,
                  { color: date ? colors.text : colors.text + '60' },
                ]}
                numberOfLines={1}
              >
                {date ? formatDate(date) : 'Seleccionar'}
              </Text>
            </TouchableOpacity>
          )}
          {errors.date && (
            <Text style={[styles.errorText, { color: colors.error }]}>
              {errors.date}
            </Text>
          )}
        </View>

        {/* End Date */}
        <View style={styles.dateFieldHalf}>
          <Text style={[styles.label, { color: colors.text }]}>Fecha de fin</Text>
          {Platform.OS === 'web' ? (
            <View style={styles.webDateRow}>
              <input
                type="date"
                value={endDate ? endDate.toISOString().split('T')[0] : ''}
                onChange={(e) => setEndDate(e.target.value ? new Date(e.target.value) : null)}
                style={{
                  ...styles.webDateInput,
                  backgroundColor: colors.cardBackground,
                  color: colors.text,
                  borderColor: colors.border,
                  flex: 1,
                }}
              />
              {endDate && (
                <TouchableOpacity
                  style={[styles.clearButton, { backgroundColor: colors.error }]}
                  onPress={clearEndDate}
                >
                  <Text style={styles.clearButtonText}>✕</Text>
                </TouchableOpacity>
              )}
            </View>
          ) : (
            <View style={styles.dateRowInner}>
              <TouchableOpacity
                style={[
                  styles.dateButton,
                  styles.dateButtonFlex,
                  {
                    backgroundColor: colors.cardBackground,
                    borderColor: colors.border,
                  },
                ]}
                onPress={() => openDatePicker('endDate')}
              >
                <Text style={styles.dateButtonIcon}>📅</Text>
                <Text
                  style={[
                    styles.dateButtonText,
                    { color: endDate ? colors.text : colors.text + '60' },
                  ]}
                  numberOfLines={1}
                >
                  {endDate ? formatDate(endDate) : 'Seleccionar'}
                </Text>
              </TouchableOpacity>
              {endDate && (
                <TouchableOpacity
                  style={[styles.clearButton, { backgroundColor: colors.error }]}
                  onPress={clearEndDate}
                >
                  <Text style={styles.clearButtonText}>✕</Text>
                </TouchableOpacity>
              )}
            </View>
          )}
        </View>
      </View>

      {/* Status */}
      <View style={styles.field}>
        <Text style={[styles.label, { color: colors.text }]}>Estado</Text>
        <View style={styles.statusOptions}>
          {STATUS_OPTIONS.map((option) => (
            <TouchableOpacity
              key={option.value}
              style={[
                styles.statusOption,
                {
                  backgroundColor:
                    status === option.value ? colors.primary : colors.cardBackground,
                  borderColor: colors.border,
                },
              ]}
              onPress={() => setStatus(option.value)}
            >
              <Text
                style={[
                  styles.statusOptionText,
                  { color: status === option.value ? '#fff' : colors.text },
                ]}
              >
                {option.label}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>

      {/* Access Modes */}
      <View style={styles.field}>
        <Text style={[styles.label, { color: errors.accessModes ? colors.error : colors.text }]}>
          Modos de Acceso *
        </Text>
        {errors.accessModes && (
          <Text style={[styles.errorText, { color: colors.error }]}>
            {errors.accessModes}
          </Text>
        )}
        <View style={[
          styles.accessModesList,
          errors.accessModes && { borderWidth: 2, borderColor: colors.error, borderRadius: BorderRadius.md, padding: Spacing.xs }
        ]}>
          {ACCESS_MODE_OPTIONS.map((option) => (
            <View
              key={option.value}
              style={[
                styles.accessModeItem,
                { backgroundColor: colors.cardBackground },
              ]}
            >
              <Text style={[styles.accessModeLabel, { color: colors.text }]}>
                {option.label}
              </Text>
              <Switch
                value={accessModes.includes(option.value)}
                onValueChange={() => toggleAccessMode(option.value)}
                trackColor={{ false: colors.border, true: colors.primary }}
                thumbColor="#fff"
              />
            </View>
          ))}
        </View>
      </View>

      {/* Action buttons */}
      <View style={styles.actions}>
        <TouchableOpacity
          style={[styles.cancelButton, { borderColor: colors.border }]}
          onPress={onCancel}
          disabled={saving}
        >
          <Text style={[styles.cancelButtonText, { color: colors.text }]}>
            Cancelar
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[
            styles.saveButton,
            { backgroundColor: colors.success },
            saving && styles.buttonDisabled,
          ]}
          onPress={handleSave}
          disabled={saving}
        >
          {saving ? (
            <ActivityIndicator size="small" color="#fff" />
          ) : (
            <Text style={styles.saveButtonText}>
              {isEditing ? 'Guardar Cambios' : 'Crear Evento'}
            </Text>
          )}
        </TouchableOpacity>
      </View>

      {/* Date Picker Modal (iOS/Android) */}
      {renderDatePicker()}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  content: {
    padding: Spacing.lg,
    paddingBottom: Spacing.xxl,
  },
  title: {
    fontSize: FontSizes.xl,
    fontWeight: 'bold',
    marginBottom: Spacing.xl,
    textAlign: 'center',
  },
  field: {
    marginBottom: Spacing.lg,
  },
  label: {
    fontSize: FontSizes.md,
    fontWeight: '600',
    marginBottom: Spacing.xs,
  },
  input: {
    borderWidth: 1,
    borderRadius: BorderRadius.md,
    padding: Spacing.md,
    fontSize: FontSizes.md,
  },
  textArea: {
    minHeight: 80,
    textAlignVertical: 'top',
  },
  errorText: {
    fontSize: FontSizes.sm,
    marginTop: 4,
    fontWeight: '500',
  },
  errorSummary: {
    padding: Spacing.md,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    marginBottom: Spacing.lg,
  },
  errorSummaryTitle: {
    fontSize: FontSizes.md,
    fontWeight: 'bold',
    marginBottom: Spacing.xs,
  },
  errorSummaryItem: {
    fontSize: FontSizes.sm,
    marginLeft: Spacing.xs,
    marginTop: 2,
  },
  // Date picker styles
  dateButton: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderRadius: BorderRadius.md,
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.sm,
    gap: Spacing.xs,
    height: 48,
  },
  dateButtonFullWidth: {
    width: '100%',
  },
  dateButtonFlex: {
    flex: 1,
    minWidth: 0,
  },
  dateButtonIcon: {
    fontSize: 18,
  },
  dateButtonText: {
    fontSize: FontSizes.sm,
    flex: 1,
  },
  dateRowInner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
  },
  webDateRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
  },
  datesRow: {
    flexDirection: 'row',
    gap: Spacing.sm,
    marginBottom: Spacing.lg,
  },
  dateFieldHalf: {
    flex: 1,
    minWidth: 0,
  },
  clearButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  clearButtonText: {
    color: '#fff',
    fontWeight: 'bold',
    fontSize: 12,
  },
  // Date picker modal (iOS)
  datePickerModal: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(0,0,0,0.5)',
  },
  datePickerContainer: {
    borderTopLeftRadius: BorderRadius.lg,
    borderTopRightRadius: BorderRadius.lg,
    paddingBottom: Spacing.xl,
  },
  datePickerHeader: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    padding: Spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(0,0,0,0.1)',
  },
  datePickerDone: {
    fontSize: FontSizes.md,
    fontWeight: '600',
  },
  // Web date input
  webDateInput: {
    borderWidth: 1,
    borderRadius: BorderRadius.md,
    paddingLeft: Spacing.sm,
    paddingRight: Spacing.sm,
    fontSize: FontSizes.sm,
    width: '100%',
    height: 48,
    outline: 'none',
    boxSizing: 'border-box',
  } as any,
  statusOptions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.xs,
  },
  statusOption: {
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
  },
  statusOptionText: {
    fontSize: FontSizes.sm,
    fontWeight: '600',
  },
  accessModesList: {
    marginTop: Spacing.xs,
  },
  accessModeItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: Spacing.md,
    borderRadius: BorderRadius.md,
    marginBottom: Spacing.xs,
  },
  accessModeLabel: {
    fontSize: FontSizes.md,
  },
  actions: {
    flexDirection: 'row',
    gap: Spacing.md,
    marginTop: Spacing.xl,
  },
  cancelButton: {
    flex: 1,
    padding: Spacing.md,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    alignItems: 'center',
  },
  cancelButtonText: {
    fontSize: FontSizes.md,
    fontWeight: '600',
  },
  saveButton: {
    flex: 1,
    padding: Spacing.md,
    borderRadius: BorderRadius.md,
    alignItems: 'center',
  },
  saveButtonText: {
    color: '#fff',
    fontSize: FontSizes.md,
    fontWeight: '600',
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  // Organization selector styles
  noOrgContainer: {
    padding: Spacing.md,
    alignItems: 'center',
  },
  noOrgText: {
    fontSize: FontSizes.sm,
    textAlign: 'center',
    marginBottom: Spacing.md,
  },
  createOrgButton: {
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.sm,
    borderRadius: BorderRadius.md,
  },
  createOrgButtonText: {
    color: '#fff',
    fontSize: FontSizes.sm,
    fontWeight: '600',
  },
  orgSelector: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.xs,
  },
  orgOption: {
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
  },
  orgOptionText: {
    fontSize: FontSizes.sm,
    fontWeight: '600',
  },
});
