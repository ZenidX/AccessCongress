/**
 * EventResetModal Component
 *
 * Modal for resetting event participant states.
 * Two types of reset:
 * - Daily Reset: Clears all participant states (registrado, aula_magna, master_class, cena)
 * - Total Reset: Clears all states AND deletes all access logs (entries/exits)
 */

import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Modal,
  Alert,
  ActivityIndicator,
  Platform,
} from 'react-native';
import { Colors, BorderRadius, Spacing, FontSizes, Shadows } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { Event } from '@/types/event';
import { ResetType } from '@/types/event';
import { resetEventDaily, resetEventTotal } from '@/services/eventService';

interface EventResetModalProps {
  visible: boolean;
  event: Event | null;
  onClose: () => void;
  onResetComplete: (type: ResetType, count: number) => void;
}

export function EventResetModal({
  visible,
  event,
  onClose,
  onResetComplete,
}: EventResetModalProps) {
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme ?? 'light'];

  const [resetting, setResetting] = useState(false);
  const [selectedType, setSelectedType] = useState<ResetType | null>(null);

  const showAlert = (title: string, message: string) => {
    if (Platform.OS === 'web') {
      window.alert(`${title}\n\n${message}`);
    } else {
      Alert.alert(title, message);
    }
  };

  const showConfirm = (title: string, message: string, onConfirm: () => void) => {
    if (Platform.OS === 'web') {
      if (window.confirm(`${title}\n\n${message}`)) {
        onConfirm();
      }
    } else {
      Alert.alert(title, message, [
        { text: 'Cancelar', style: 'cancel' },
        { text: 'Confirmar', style: 'destructive', onPress: onConfirm },
      ]);
    }
  };

  const handleReset = async (type: ResetType) => {
    if (!event) return;

    const typeLabel = type === 'daily' ? 'Reset Diario' : 'Reset Total';
    const typeDescription =
      type === 'daily'
        ? 'Se borrarán TODOS los estados de los participantes (registro, aula magna, master class, cena). Los logs de acceso se mantendrán.'
        : 'Se borrarán TODOS los estados de los participantes Y se eliminarán TODOS los logs de acceso (entradas y salidas). Esta acción no se puede deshacer.';

    showConfirm(
      `Confirmar ${typeLabel}`,
      `${typeDescription}\n\n¿Estás seguro de continuar?`,
      async () => {
        setResetting(true);
        setSelectedType(type);

        try {
          let message: string;
          let count: number;

          if (type === 'daily') {
            count = await resetEventDaily(event.id);
            message = `Se han reseteado ${count} participantes.`;
          } else {
            const result = await resetEventTotal(event.id);
            count = result.participants;
            message = `Se han reseteado ${result.participants} participantes y eliminado ${result.logs} registros de acceso.`;
          }

          showAlert('Reset Completado', message);

          onResetComplete(type, count);
          onClose();
        } catch (error: any) {
          console.error('Error during reset:', error);
          showAlert('Error', error.message || 'No se pudo completar el reset');
        } finally {
          setResetting(false);
          setSelectedType(null);
        }
      }
    );
  };

  if (!event) return null;

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
    >
      <View style={styles.overlay}>
        <View
          style={[
            styles.modal,
            { backgroundColor: colors.cardBackground },
            Shadows.medium,
          ]}
        >
          {/* Header */}
          <View style={styles.header}>
            <Text style={[styles.title, { color: colors.text }]}>
              Reset de Estados
            </Text>
            <Text style={[styles.eventName, { color: colors.primary }]}>
              {event.name}
            </Text>
          </View>

          {/* Description */}
          <Text style={[styles.description, { color: colors.text }]}>
            Selecciona el tipo de reset que deseas realizar:
          </Text>

          {/* Reset options */}
          <View style={styles.options}>
            {/* Daily Reset */}
            <TouchableOpacity
              style={[
                styles.optionCard,
                { backgroundColor: colors.warning + '15', borderColor: colors.warning },
              ]}
              onPress={() => handleReset('daily')}
              disabled={resetting}
            >
              <View style={styles.optionHeader}>
                <Text style={[styles.optionIcon]}>🔄</Text>
                <Text style={[styles.optionTitle, { color: colors.warning }]}>
                  Reset Diario
                </Text>
              </View>
              <Text style={[styles.optionDescription, { color: colors.text }]}>
                Borra todos los estados de los participantes. Los logs se mantienen.
              </Text>
              <View style={styles.optionDetails}>
                <Text style={[styles.optionDetail, { color: colors.error }]}>
                  ✗ Borra: registrado, aula_magna, master_class, cena
                </Text>
                <Text style={[styles.optionDetail, { color: colors.success }]}>
                  ✓ Mantiene: logs de acceso (entradas/salidas)
                </Text>
              </View>
              {resetting && selectedType === 'daily' && (
                <ActivityIndicator
                  style={styles.loader}
                  size="small"
                  color={colors.warning}
                />
              )}
            </TouchableOpacity>

            {/* Total Reset */}
            <TouchableOpacity
              style={[
                styles.optionCard,
                { backgroundColor: colors.error + '15', borderColor: colors.error },
              ]}
              onPress={() => handleReset('total')}
              disabled={resetting}
            >
              <View style={styles.optionHeader}>
                <Text style={[styles.optionIcon]}>⚠️</Text>
                <Text style={[styles.optionTitle, { color: colors.error }]}>
                  Reset Total
                </Text>
              </View>
              <Text style={[styles.optionDescription, { color: colors.text }]}>
                Borra TODOS los estados Y elimina TODOS los logs de acceso.
              </Text>
              <View style={styles.optionDetails}>
                <Text style={[styles.optionDetail, { color: colors.error }]}>
                  ✗ Borra: registrado, aula_magna, master_class, cena
                </Text>
                <Text style={[styles.optionDetail, { color: colors.error }]}>
                  ✗ Elimina: todos los logs de entradas y salidas
                </Text>
              </View>
              {resetting && selectedType === 'total' && (
                <ActivityIndicator
                  style={styles.loader}
                  size="small"
                  color={colors.error}
                />
              )}
            </TouchableOpacity>
          </View>

          {/* Cancel button */}
          <TouchableOpacity
            style={[styles.cancelButton, { borderColor: colors.border }]}
            onPress={onClose}
            disabled={resetting}
          >
            <Text style={[styles.cancelButtonText, { color: colors.text }]}>
              Cancelar
            </Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: Spacing.lg,
  },
  modal: {
    width: '100%',
    maxWidth: 400,
    borderRadius: BorderRadius.lg,
    padding: Spacing.xl,
  },
  header: {
    marginBottom: Spacing.lg,
    alignItems: 'center',
  },
  title: {
    fontSize: FontSizes.xl,
    fontWeight: 'bold',
    marginBottom: Spacing.xs,
  },
  eventName: {
    fontSize: FontSizes.md,
    fontWeight: '600',
  },
  description: {
    fontSize: FontSizes.md,
    textAlign: 'center',
    marginBottom: Spacing.lg,
    opacity: 0.8,
  },
  options: {
    gap: Spacing.md,
    marginBottom: Spacing.lg,
  },
  optionCard: {
    borderWidth: 2,
    borderRadius: BorderRadius.lg,
    padding: Spacing.lg,
  },
  optionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: Spacing.sm,
  },
  optionIcon: {
    fontSize: 24,
    marginRight: Spacing.sm,
  },
  optionTitle: {
    fontSize: FontSizes.lg,
    fontWeight: 'bold',
  },
  optionDescription: {
    fontSize: FontSizes.sm,
    marginBottom: Spacing.sm,
  },
  optionDetails: {
    gap: 4,
  },
  optionDetail: {
    fontSize: FontSizes.xs,
  },
  loader: {
    marginTop: Spacing.sm,
  },
  cancelButton: {
    padding: Spacing.md,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    alignItems: 'center',
  },
  cancelButtonText: {
    fontSize: FontSizes.md,
    fontWeight: '600',
  },
});
