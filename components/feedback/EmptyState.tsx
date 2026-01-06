/**
 * EmptyState - Estado vacío con ícono y mensaje
 *
 * Muestra un mensaje amigable cuando no hay datos
 * Incluye un ícono grande y texto descriptivo
 */

import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { ThemedText } from '../themed/themed-text';
import { Spacing } from '@/constants/theme';

interface EmptyStateProps {
  icon?: string; // Emoji o ícono
  message: string;
  style?: any;
}

export function EmptyState({
  icon = '📋',
  message,
  style,
}: EmptyStateProps) {
  return (
    <View style={[styles.container, style]}>
      <Text style={styles.icon}>{icon}</Text>
      <ThemedText style={styles.message}>{message}</ThemedText>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: Spacing.xxl,
  },
  icon: {
    fontSize: 64,
    marginBottom: Spacing.md,
  },
  message: {
    fontSize: 16,
    opacity: 0.6,
    textAlign: 'center',
  },
});
