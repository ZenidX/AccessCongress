/**
 * OptionSelector - Selector de opciones con botones
 *
 * Componente genérico para seleccionar entre múltiples opciones
 * Muestra botones horizontales con opción activa destacada
 * Útil para modo, dirección, roles, etc.
 */

import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { BorderRadius, Spacing } from '@/constants/theme';

export interface SelectorOption<T = string> {
  value: T;
  label: string;
  icon?: string;
  color?: string;
}

interface OptionSelectorProps<T = string> {
  options: SelectorOption<T>[];
  selected: T;
  onSelect: (value: T) => void;
  style?: any;
  disabled?: boolean;
}

export function OptionSelector<T = string>({
  options,
  selected,
  onSelect,
  style,
  disabled = false,
}: OptionSelectorProps<T>) {
  return (
    <View style={[styles.container, style]}>
      {options.map((option) => {
        const isActive = option.value === selected;

        return (
          <TouchableOpacity
            key={String(option.value)}
            style={[
              styles.optionButton,
              isActive && styles.optionButtonActive,
              isActive && option.color && { backgroundColor: option.color },
            ]}
            onPress={() => onSelect(option.value)}
            disabled={disabled}
            activeOpacity={0.7}
          >
            {option.icon && (
              <Text style={styles.optionIcon}>{option.icon}</Text>
            )}
            <Text
              style={[
                styles.optionText,
                isActive && styles.optionTextActive,
              ]}
            >
              {option.label}
            </Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    gap: Spacing.sm,
    flexWrap: 'wrap',
  },
  optionButton: {
    flex: 1,
    minWidth: 100,
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing.sm,
    borderRadius: BorderRadius.md,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(0,0,0,0.05)',
    flexDirection: 'row',
    gap: Spacing.xs,
  },
  optionButtonActive: {
    // El color se aplica dinámicamente desde props
  },
  optionIcon: {
    fontSize: 18,
  },
  optionText: {
    fontSize: 14,
    fontWeight: '600',
    color: 'rgba(0,0,0,0.7)',
  },
  optionTextActive: {
    color: '#fff',
    fontWeight: 'bold',
  },
});
