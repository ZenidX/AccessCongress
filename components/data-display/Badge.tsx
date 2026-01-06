/**
 * Badge - Etiqueta pequeña con color
 *
 * Componente pequeño para mostrar estados, permisos o categorías
 * Ej: MC, Cena, Admin, Control, Entrada, Salida
 */

import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { BorderRadius, Spacing } from '@/constants/theme';

type BadgeVariant = 'primary' | 'success' | 'error' | 'warning' | 'info' | 'custom';

interface BadgeProps {
  label: string;
  variant?: BadgeVariant;
  color?: string; // Color personalizado (solo si variant='custom')
  style?: any;
}

export function Badge({ label, variant = 'primary', color, style }: BadgeProps) {
  const getBackgroundColor = () => {
    if (variant === 'custom' && color) return color;

    switch (variant) {
      case 'primary':
        return '#00a1e4';
      case 'success':
        return '#4caf50';
      case 'error':
        return '#f44336';
      case 'warning':
        return '#ffaf00';
      case 'info':
        return '#2196f3';
      default:
        return '#00a1e4';
    }
  };

  return (
    <View style={[styles.badge, { backgroundColor: getBackgroundColor() }, style]}>
      <Text style={styles.badgeText}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    paddingHorizontal: Spacing.sm,
    paddingVertical: Spacing.xs,
    borderRadius: BorderRadius.sm,
    alignSelf: 'flex-start',
  },
  badgeText: {
    fontSize: 11,
    fontWeight: 'bold',
    color: '#fff',
  },
});
