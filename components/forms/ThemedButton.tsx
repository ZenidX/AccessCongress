/**
 * ThemedButton - Botón con tema automático
 *
 * Botón reutilizable que se adapta al tema (dark/light)
 * Soporta diferentes variantes (primary, secondary, danger)
 * Puede incluir ícono opcional
 */

import React from 'react';
import { Text, TouchableOpacity, StyleSheet, View } from 'react-native';
import { Colors, BorderRadius, Spacing, Shadows } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';

type ButtonVariant = 'primary' | 'secondary' | 'danger' | 'success' | 'ghost';
type ButtonSize = 'small' | 'medium' | 'large';

interface ThemedButtonProps {
  title: string;
  onPress: () => void;
  variant?: ButtonVariant;
  size?: ButtonSize;
  icon?: string;
  disabled?: boolean;
  fullWidth?: boolean;
  loading?: boolean;
  style?: any;
}

export function ThemedButton({
  title,
  onPress,
  variant = 'primary',
  size = 'medium',
  icon,
  disabled = false,
  fullWidth = false,
  loading = false,
  style,
}: ThemedButtonProps) {
  const colorScheme = useColorScheme();

  const getBackgroundColor = () => {
    if (disabled) return 'rgba(0,0,0,0.2)';

    switch (variant) {
      case 'primary':
        return colorScheme === 'dark' ? Colors.dark.primary : Colors.light.primary;
      case 'secondary':
        return colorScheme === 'dark' ? Colors.dark.accent : Colors.light.accent;
      case 'danger':
        return Colors.light.error;
      case 'success':
        return Colors.light.success;
      case 'ghost':
        return 'transparent';
      default:
        return colorScheme === 'dark' ? Colors.dark.primary : Colors.light.primary;
    }
  };

  const getTextColor = () => {
    if (variant === 'ghost') {
      return colorScheme === 'dark' ? Colors.dark.primary : Colors.light.primary;
    }
    return '#fff';
  };

  const getPadding = () => {
    switch (size) {
      case 'small':
        return { paddingVertical: Spacing.sm, paddingHorizontal: Spacing.md };
      case 'medium':
        return { paddingVertical: Spacing.md, paddingHorizontal: Spacing.lg };
      case 'large':
        return { paddingVertical: Spacing.lg, paddingHorizontal: Spacing.xl };
      default:
        return { paddingVertical: Spacing.md, paddingHorizontal: Spacing.lg };
    }
  };

  const getFontSize = () => {
    switch (size) {
      case 'small':
        return 14;
      case 'medium':
        return 16;
      case 'large':
        return 18;
      default:
        return 16;
    }
  };

  return (
    <TouchableOpacity
      style={[
        styles.button,
        variant !== 'ghost' && Shadows.medium,
        {
          backgroundColor: getBackgroundColor(),
          ...getPadding(),
        },
        fullWidth && styles.fullWidth,
        disabled && styles.disabled,
        variant === 'ghost' && styles.ghost,
        style,
      ]}
      onPress={onPress}
      disabled={disabled || loading}
      activeOpacity={0.8}
    >
      <View style={styles.content}>
        {icon && <Text style={[styles.icon, { fontSize: getFontSize() + 4 }]}>{icon}</Text>}
        <Text style={[styles.text, { color: getTextColor(), fontSize: getFontSize() }]}>
          {loading ? 'Cargando...' : title}
        </Text>
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  button: {
    borderRadius: BorderRadius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  fullWidth: {
    width: '100%',
  },
  disabled: {
    opacity: 0.5,
  },
  ghost: {
    borderWidth: 2,
    borderColor: Colors.light.primary,
  },
  content: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
  },
  icon: {
    marginRight: Spacing.xs,
  },
  text: {
    fontWeight: 'bold',
  },
});
