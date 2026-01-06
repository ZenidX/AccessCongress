/**
 * Modal para insertar variables en plantillas de email
 *
 * Muestra las variables disponibles agrupadas por categoría
 * (evento, participante, QR) para facilitar su inserción.
 */

import React from 'react';
import {
  View,
  Text,
  Modal,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
} from 'react-native';
import { ThemedText } from '@/components/themed/themed-text';
import { EMAIL_TEMPLATE_VARIABLES, EmailTemplateVariable } from '@/types/emailTemplate';
import { Colors, BorderRadius, Spacing, FontSizes } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';

interface VariableInserterProps {
  visible: boolean;
  onClose: () => void;
  onSelect: (variable: string) => void;
}

export function VariableInserter({ visible, onClose, onSelect }: VariableInserterProps) {
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme ?? 'light'];

  const groupedVariables = {
    evento: EMAIL_TEMPLATE_VARIABLES.filter((v) => v.category === 'evento'),
    participante: EMAIL_TEMPLATE_VARIABLES.filter((v) => v.category === 'participante'),
    qr: EMAIL_TEMPLATE_VARIABLES.filter((v) => v.category === 'qr'),
  };

  const handleSelect = (variable: string) => {
    onSelect(variable);
    onClose();
  };

  const categoryInfo = {
    evento: { icon: '📅', title: 'Evento' },
    participante: { icon: '👤', title: 'Participante' },
    qr: { icon: '📱', title: 'Código QR' },
  };

  return (
    <Modal visible={visible} transparent animationType="slide">
      <View style={styles.overlay}>
        <View style={[styles.container, { backgroundColor: colors.cardBackground }]}>
          <View style={styles.header}>
            <ThemedText style={styles.title}>Insertar Variable</ThemedText>
            <TouchableOpacity onPress={onClose} style={styles.closeButtonContainer}>
              <Text style={[styles.closeButton, { color: colors.text }]}>✕</Text>
            </TouchableOpacity>
          </View>

          <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
            {(Object.keys(groupedVariables) as Array<keyof typeof groupedVariables>).map(
              (category) => (
                <View key={category} style={styles.category}>
                  <View style={styles.categoryHeader}>
                    <Text style={styles.categoryIcon}>{categoryInfo[category].icon}</Text>
                    <ThemedText style={styles.categoryTitle}>
                      {categoryInfo[category].title}
                    </ThemedText>
                  </View>

                  {groupedVariables[category].map((v) => (
                    <TouchableOpacity
                      key={v.key}
                      style={[styles.variableItem, { backgroundColor: colors.background }]}
                      onPress={() => handleSelect(v.key)}
                      activeOpacity={0.7}
                    >
                      <View style={styles.variableInfo}>
                        <Text style={[styles.variableKey, { color: colors.primary }]}>
                          {`{{${v.key}}}`}
                        </Text>
                        <ThemedText style={styles.variableLabel}>{v.label}</ThemedText>
                      </View>
                      <ThemedText style={styles.variableExample}>Ej: {v.example}</ThemedText>
                    </TouchableOpacity>
                  ))}
                </View>
              )
            )}

            {/* Info adicional para QR */}
            <View style={[styles.infoBox, { backgroundColor: colors.primary + '10' }]}>
              <ThemedText style={[styles.infoTitle, { color: colors.primary }]}>
                💡 Uso del código QR
              </ThemedText>
              <ThemedText style={styles.infoText}>
                La variable {'{{qr.url}}'} devuelve la URL de una imagen PNG del código QR.
                {'\n\n'}
                Úsala en una etiqueta img:{'\n'}
                <Text style={styles.codeText}>{'<img src="{{qr.url}}" width="200" />'}</Text>
              </ThemedText>
            </View>
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  container: {
    maxHeight: '80%',
    borderTopLeftRadius: BorderRadius.xl,
    borderTopRightRadius: BorderRadius.xl,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: Spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(0,0,0,0.1)',
  },
  title: {
    fontSize: FontSizes.lg,
    fontWeight: 'bold',
  },
  closeButtonContainer: {
    padding: Spacing.sm,
  },
  closeButton: {
    fontSize: 20,
  },
  content: {
    padding: Spacing.md,
  },
  category: {
    marginBottom: Spacing.lg,
  },
  categoryHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    marginBottom: Spacing.sm,
  },
  categoryIcon: {
    fontSize: 20,
  },
  categoryTitle: {
    fontSize: FontSizes.md,
    fontWeight: 'bold',
  },
  variableItem: {
    padding: Spacing.md,
    borderRadius: BorderRadius.md,
    marginBottom: Spacing.xs,
  },
  variableInfo: {
    marginBottom: 4,
  },
  variableKey: {
    fontSize: FontSizes.sm,
    fontWeight: '600',
    fontFamily: 'monospace',
    marginBottom: 2,
  },
  variableLabel: {
    fontSize: FontSizes.sm,
  },
  variableExample: {
    fontSize: FontSizes.xs,
    opacity: 0.6,
    fontStyle: 'italic',
  },
  infoBox: {
    padding: Spacing.md,
    borderRadius: BorderRadius.md,
    marginBottom: Spacing.xl,
  },
  infoTitle: {
    fontSize: FontSizes.sm,
    fontWeight: '600',
    marginBottom: Spacing.xs,
  },
  infoText: {
    fontSize: FontSizes.xs,
    lineHeight: 18,
  },
  codeText: {
    fontFamily: 'monospace',
  },
});
