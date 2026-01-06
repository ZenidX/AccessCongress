/**
 * Card - Contenedor genérico con tema
 *
 * Contenedor reutilizable con bordes redondeados, sombra y tema
 * Puede ser clickeable o estático
 */

import React, { ReactNode } from 'react';
import { View, TouchableOpacity, StyleSheet } from 'react-native';
import { Colors, BorderRadius, Spacing, Shadows } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';

interface CardProps {
  children: ReactNode;
  onPress?: () => void;
  style?: any;
  backgroundColor?: string;
  padding?: number;
  shadow?: 'none' | 'light' | 'medium' | 'strong';
}

export function Card({
  children,
  onPress,
  style,
  backgroundColor,
  padding = Spacing.lg,
  shadow = 'light',
}: CardProps) {
  const colorScheme = useColorScheme();

  const bgColor = backgroundColor || (
    colorScheme === 'dark'
      ? Colors.dark.cardBackground
      : Colors.light.cardBackground
  );

  const getShadowStyle = () => {
    switch (shadow) {
      case 'none':
        return {};
      case 'light':
        return Shadows.light;
      case 'medium':
        return Shadows.medium;
      case 'strong':
        return Shadows.strong;
      default:
        return Shadows.light;
    }
  };

  const cardStyle = [
    styles.card,
    getShadowStyle(),
    {
      backgroundColor: bgColor,
      padding,
    },
    style,
  ];

  if (onPress) {
    return (
      <TouchableOpacity
        style={cardStyle}
        onPress={onPress}
        activeOpacity={0.7}
      >
        {children}
      </TouchableOpacity>
    );
  }

  return <View style={cardStyle}>{children}</View>;
}

const styles = StyleSheet.create({
  card: {
    borderRadius: BorderRadius.md,
    marginBottom: Spacing.md,
  },
});
