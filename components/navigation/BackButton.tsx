/**
 * BackButton - Botón de navegación hacia atrás
 *
 * Botón flotante o fijo para volver a la pantalla anterior
 * Puede estar posicionado de forma absoluta o relativa
 * En web navega al home, en móvil usa router.back()
 */

import React from 'react';
import { Text, TouchableOpacity, StyleSheet, Platform } from 'react-native';
import { useRouter } from 'expo-router';
import { Colors, BorderRadius, Spacing, Shadows } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';

interface BackButtonProps {
  onPress?: () => void; // Callback personalizado (opcional)
  label?: string; // Texto del botón (default: "← Volver")
  disabled?: boolean;
  style?: any;
}

export function BackButton({
  onPress,
  label = '← Volver',
  disabled = false,
  style,
}: BackButtonProps) {
  const router = useRouter();
  const colorScheme = useColorScheme();

  const handlePress = () => {
    if (onPress) {
      onPress();
    } else {
      // En web, navegar al home. En móvil, volver atrás
      if (Platform.OS === 'web') {
        router.push('/');
      } else {
        router.back();
      }
    }
  };

  return (
    <TouchableOpacity
      style={[
        styles.button,
        Shadows.medium,
        {
          backgroundColor:
            colorScheme === 'dark' ? Colors.dark.primary : Colors.light.primary,
        },
        style,
      ]}
      onPress={handlePress}
      disabled={disabled}
      activeOpacity={0.8}
    >
      <Text style={styles.buttonText}>{label}</Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  button: {
    padding: Spacing.md,
    borderRadius: BorderRadius.full,
    alignItems: 'center',
    justifyContent: 'center',
  },
  buttonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
});
