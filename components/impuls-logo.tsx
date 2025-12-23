/**
 * Logo de Impuls Educació - Componente reutilizable
 */

import React from 'react';
import { Image, StyleSheet, View, ViewStyle } from 'react-native';
import { useColorScheme } from '@/hooks/use-color-scheme';

interface ImpulsLogoProps {
  size?: 'small' | 'medium' | 'large';
  style?: ViewStyle;
}

const LOGO_SIZES = {
  small: { width: 100, height: 34 },
  medium: { width: 140, height: 48 },
  large: { width: 180, height: 60 },
};

export function ImpulsLogo({ size = 'medium', style }: ImpulsLogoProps) {
  const colorScheme = useColorScheme();
  const dimensions = LOGO_SIZES[size];

  // Usa el logo en color para modo claro, podrías usar el gris para modo oscuro
  // pero el logo de color se ve bien en ambos modos
  const logoUrl = 'https://impulseducacio.org/wp-content/uploads/2020/02/logo-web-impuls.png';

  return (
    <View style={[styles.container, style]}>
      <Image
        source={{ uri: logoUrl }}
        style={[styles.logo, dimensions]}
        resizeMode="contain"
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  logo: {
    // Dimensiones dinámicas según el tamaño
  },
});
