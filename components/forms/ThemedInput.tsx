/**
 * ThemedInput - Input de texto con tema
 *
 * Campo de entrada de texto que se adapta al tema (dark/light)
 * Soporta todos los props de TextInput de React Native
 */

import React from 'react';
import { TextInput, StyleSheet, TextInputProps } from 'react-native';
import { BorderRadius, Spacing } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';

interface ThemedInputProps extends TextInputProps {
  style?: any;
}

export function ThemedInput({ style, ...props }: ThemedInputProps) {
  const colorScheme = useColorScheme();

  const backgroundColor =
    colorScheme === 'dark' ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.05)';
  const textColor = colorScheme === 'dark' ? '#fff' : '#000';
  const placeholderColor =
    colorScheme === 'dark' ? 'rgba(255,255,255,0.5)' : 'rgba(0,0,0,0.5)';

  return (
    <TextInput
      style={[
        styles.input,
        {
          backgroundColor,
          color: textColor,
        },
        style,
      ]}
      placeholderTextColor={placeholderColor}
      {...props}
    />
  );
}

const styles = StyleSheet.create({
  input: {
    borderRadius: BorderRadius.md,
    padding: Spacing.md,
    marginBottom: Spacing.md,
    fontSize: 16,
  },
});
