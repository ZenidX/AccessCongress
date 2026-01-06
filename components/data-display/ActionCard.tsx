/**
 * ActionCard - Card clickeable con ícono, título y descripción
 *
 * Card reutilizable para representar acciones importantes
 * Muestra un ícono grande, título en negrita y descripción
 * Soporta tema oscuro/claro automático
 */

import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { ThemedText } from '../themed/themed-text';
import { Colors, BorderRadius, Spacing, Shadows } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';

interface ActionCardProps {
  icon: string;
  title: string;
  description: string;
  onPress: () => void;
  disabled?: boolean;
  backgroundColor?: string; // Color personalizado (opcional)
  textColor?: string; // Color del texto (opcional, para fondos personalizados)
}

export function ActionCard({
  icon,
  title,
  description,
  onPress,
  disabled = false,
  backgroundColor,
  textColor,
}: ActionCardProps) {
  const colorScheme = useColorScheme();

  const bgColor = backgroundColor || (
    colorScheme === 'dark'
      ? Colors.dark.cardBackground
      : Colors.light.cardBackground
  );

  const titleColor = textColor || Colors.light.text;
  const descriptionColor = textColor || Colors.light.text;

  return (
    <TouchableOpacity
      style={[
        styles.actionCard,
        colorScheme === 'dark' ? Shadows.light : Shadows.light,
        { backgroundColor: bgColor },
      ]}
      onPress={onPress}
      disabled={disabled}
      activeOpacity={0.7}
    >
      <Text style={styles.actionIcon}>{icon}</Text>
      <View style={styles.actionTextContainer}>
        <Text style={[styles.actionTitle, { color: titleColor }]}>
          {title}
        </Text>
        <Text style={[styles.actionDescription, { color: descriptionColor, opacity: textColor ? 0.9 : 0.7 }]}>
          {description}
        </Text>
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
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
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 5,
  },
  actionDescription: {
    fontSize: 14,
  },
});
