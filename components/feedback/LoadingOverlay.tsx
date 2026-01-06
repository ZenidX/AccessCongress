/**
 * LoadingOverlay - Overlay de carga
 *
 * Muestra un indicador de carga con mensaje
 * Útil para operaciones asíncronas
 */

import React from 'react';
import { View, ActivityIndicator, StyleSheet } from 'react-native';
import { ThemedText } from '../themed/themed-text';
import { Colors, Spacing } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';

interface LoadingOverlayProps {
  message?: string;
  visible?: boolean;
}

export function LoadingOverlay({
  message = 'Cargando...',
  visible = true,
}: LoadingOverlayProps) {
  const colorScheme = useColorScheme();

  if (!visible) return null;

  return (
    <View style={styles.container}>
      <ActivityIndicator
        size="large"
        color={colorScheme === 'dark' ? Colors.dark.primary : Colors.light.primary}
      />
      <ThemedText style={styles.message}>{message}</ThemedText>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    padding: Spacing.xxl,
  },
  message: {
    marginTop: Spacing.md,
    fontSize: 16,
  },
});
