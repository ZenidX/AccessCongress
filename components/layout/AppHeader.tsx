/**
 * AppHeader - Cabecera de aplicación con logo y login
 *
 * Muestra el logo de Impuls Educació centrado con el botón de login
 * en la esquina superior derecha
 * Puede tener un color de fondo personalizado
 */

import React from 'react';
import { View, Image, StyleSheet } from 'react-native';
import { LoginButton } from '@/components/forms/LoginButton';
import { Spacing } from '@/constants/theme';

interface AppHeaderProps {
  backgroundColor?: string;
  logoSize?: 'small' | 'medium' | 'large';
}

const LOGO_SIZES = {
  small: { width: 120, height: 40 },
  medium: { width: 140, height: 48 },
  large: { width: 200, height: 70 },
};

export function AppHeader({ backgroundColor, logoSize = 'medium' }: AppHeaderProps) {
  const logoStyle = LOGO_SIZES[logoSize];

  return (
    <View style={[styles.headerContainer, backgroundColor && { backgroundColor }]}>
      <View style={styles.logoContainer}>
        <Image
          source={{ uri: 'https://impulseducacio.org/wp-content/uploads/2020/02/logo-web-impuls.png' }}
          style={[styles.logo, logoStyle]}
          resizeMode="contain"
        />
      </View>
      <View style={styles.loginContainer}>
        <LoginButton />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  headerContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.md,
    paddingTop: Spacing.md,
    paddingBottom: Spacing.sm,
  },
  logoContainer: {
    flex: 1,
    alignItems: 'center',
  },
  logo: {
    marginBottom: Spacing.sm,
  },
  loginContainer: {
    position: 'absolute',
    right: Spacing.md,
    top: Spacing.md,
  },
});
