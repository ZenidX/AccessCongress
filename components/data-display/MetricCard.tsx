/**
 * MetricCard - Card de métrica con número destacado
 *
 * Muestra un número grande con una etiqueta descriptiva
 * Útil para dashboards y estadísticas
 */

import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { BorderRadius, Spacing, Shadows } from '@/constants/theme';

interface MetricCardProps {
  value: number | string;
  label: string;
  backgroundColor?: string;
  style?: any;
}

export function MetricCard({
  value,
  label,
  backgroundColor = '#00a1e4',
  style,
}: MetricCardProps) {
  return (
    <View
      style={[
        styles.card,
        Shadows.medium,
        { backgroundColor },
        style,
      ]}
    >
      <Text style={styles.value}>{value}</Text>
      <Text style={styles.label}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    flex: 1,
    minWidth: 100,
    padding: Spacing.md,
    borderRadius: BorderRadius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  value: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#fff',
    marginBottom: 4,
  },
  label: {
    fontSize: 12,
    color: '#fff',
    opacity: 0.9,
    textAlign: 'center',
  },
});
