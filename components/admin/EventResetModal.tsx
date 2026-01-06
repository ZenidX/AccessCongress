/**
 * EventResetModal Component
 *
 * Modal for resetting event participant states.
 * Two types of reset:
 * - Daily Reset: Clears aula_magna, master_class, keeps registrado and cena
 * - Total Reset: Clears all states including registrado
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

  const handleReset = async (type: ResetType) => {
    if (!event) return;

    const typeLabel = type === 'daily' ? 'Reset Diario' : 'Reset Total';
    const typeDescription =
      type === 'daily'
        ? 'Se limpiaran los estados de aula magna y master class. Se mantendra el registro y la cena.'
        : 'Se limpiaran TODOS los estados de todos los participantes, incluyendo el registro.';

    Alert.alert(
      `Confirmar ${typeLabel}`,
      `${typeDescription}\n\n¿Estás seguro de continuar?`,
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Confirmar',
          style: 'destructive',
          onPress: async () => {
            setResetting(true);
            setSelectedType(type);

            try {
              let count: number;
              if (type === 'daily') {
                count = await resetEventDaily(event.id);
              } else {
                count = await resetEventTotal(event.id);
              }

              Alert.alert(
                'Reset Completado',
                `Se han actualizado ${count} participantes.`
              );

              onResetComplete(type, count);
              onClose();
            } catch (error: any) {
              console.error('Error during reset:', error);
              Alert.alert(
                'Error',
                error.message || 'No se pudo completar el reset'
              );
            } finally {
              setResetting(false);
              setSelectedType(null);
            }
          },
        },
      ]
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
                Limpia los estados de ubicación (aula magna, master class).
              </Text>
              <View style={styles.optionDetails}>
                <Text style={[styles.optionDetail, { color: colors.success }]}>
                  ✓ Mantiene: registrado, cena
                </Text>
                <Text style={[styles.optionDetail, { color: colors.error }]}>
                  ✗ Limpia: en_aula_magna, en_master_class
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
                Limpia TODOS los estados de todos los participantes.
              </Text>
              <View style={styles.optionDetails}>
                <Text style={[styles.optionDetail, { color: colors.error }]}>
                  ✗ Limpia: registrado, en_aula_magna, en_master_class, en_cena
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
