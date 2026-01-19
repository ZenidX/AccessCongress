/**
 * Pantalla principal - Home
 *
 * Pantalla de bienvenida simple con acceso directo a:
 * - Dashboard: Monitoreo en tiempo real de asistentes
 * - Administración: Gestión de participantes y configuración
 */

import { LoginButton } from '@/components/forms/LoginButton';
import { ThemedText } from '@/components/themed/themed-text';
import { ThemedView } from '@/components/themed/themed-view';
import { ImpulsWave } from '@/components/visuals/wave-divider';
import { BorderRadius, Colors, Shadows, Spacing } from '@/constants/theme';
import { useAuth } from '@/contexts/AuthContext';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { useResponsiveLayout } from '@/hooks/useResponsiveLayout';
import { useRouter } from 'expo-router';
import React from 'react';
import {
  Image,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';

export default function HomeScreen() {
  const router = useRouter();
  const colorScheme = useColorScheme();
  const { isMobile, isWideScreen, getResponsiveValue } = useResponsiveLayout();
  const { user } = useAuth();

  // Debug: mostrar el usuario actual
  console.log('🏠 Index: Usuario actual:', user);

  // Responsive sizes
  const logoSize = getResponsiveValue(
    { width: 160, height: 55 },
    { width: 180, height: 65 },
    { width: 200, height: 70 }
  );
  const titleFontSize = getResponsiveValue(26, 30, 32);
  const subtitleFontSize = getResponsiveValue(16, 18, 20);
  const buttonPadding = getResponsiveValue(Spacing.lg, Spacing.xl, Spacing.xxl);
  const buttonIconSize = getResponsiveValue(48, 56, 64);

  /**
   * Navega a la pantalla del Dashboard en tiempo real
   */
  const handleGoToDashboard = () => {
    router.push('/dashboard');
  };

  /**
   * Navega a la pantalla de Administración
   */
  const handleGoToAdmin = () => {
    router.push('/admin');
  };

  return (
    <ThemedView style={styles.container}>
      {/* Header con logo de Impuls Educació y título */}
      <View style={[styles.header, { backgroundColor: Colors.light.primary }]}>
        <View style={styles.headerContent}>
          <Image
            source={{ uri: 'https://impulseducacio.org/wp-content/uploads/2020/02/logo-web-impuls.png' }}
            style={[styles.logo, logoSize]}
            resizeMode="contain"
          />
          <Text style={[styles.titleWhite, { fontSize: titleFontSize }]}>Control de Acceso</Text>
          <Text style={[styles.subtitleWhite, { fontSize: subtitleFontSize }]}>Congreso 2025</Text>
        </View>
        <View style={styles.loginContainer}>
          <LoginButton />
        </View>
      </View>

      {/* Wave divider: transición de azul Impuls a fondo claro */}
      <ImpulsWave
        topColor={colorScheme === 'dark' ? Colors.dark.background : Colors.light.background}
        bottomColor={colorScheme === 'dark' ? Colors.dark.primary : Colors.light.primary}
        height={80}
        waves={1}
      />

      {/* Contenido principal */}
      <View style={styles.content}>
        <ThemedText style={styles.welcomeText}>
          Bienvenido al control de acceso
        </ThemedText>

        {/* Botones principales */}
        <View style={[styles.mainButtons, isWideScreen && styles.mainButtonsWide]}>
          {/* Botón Dashboard */}
          <TouchableOpacity
            style={[
              styles.mainButton,
              Shadows.strong,
              {
                backgroundColor:
                  colorScheme === 'dark' ? Colors.dark.primary : Colors.light.primary,
                padding: buttonPadding,
              },
              isWideScreen && styles.mainButtonWide,
            ]}
            onPress={handleGoToDashboard}
            activeOpacity={0.8}
          >
            <Text style={[styles.mainButtonIcon, { fontSize: buttonIconSize }]}>📊</Text>
            <Text style={styles.mainButtonText}>Dashboard</Text>
            <Text style={styles.mainButtonDescription}>
              Monitoreo en tiempo real de asistentes
            </Text>
          </TouchableOpacity>

          {/* Botón Administración - Visible para super_admin, admin_responsable, admin */}
          {user?.role && ['super_admin', 'admin_responsable', 'admin'].includes(user.role) && (
            <TouchableOpacity
              style={[
                styles.mainButton,
                Shadows.strong,
                {
                  backgroundColor: colorScheme === 'dark' ? Colors.dark.primary : Colors.light.primary,
                  padding: buttonPadding,
                },
                isWideScreen && styles.mainButtonWide,
              ]}
              onPress={handleGoToAdmin}
              activeOpacity={0.8}
            >
              <Text style={[styles.mainButtonIcon, { fontSize: buttonIconSize }]}>⚙️</Text>
              <Text style={styles.mainButtonText}>Administración</Text>
              <Text style={styles.mainButtonDescription}>
                Gestión de participantes y configuración
              </Text>
            </TouchableOpacity>
          )}
        </View>
      </View>
    </ThemedView>
  );
}

/**
 * Estilos de la home
 * Diseño simple y limpio con botones grandes destacados
 */
const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    paddingTop: 60,
    paddingBottom: Spacing.xl,
    paddingHorizontal: Spacing.lg,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerContent: {
    flex: 1,
    alignItems: 'center',
  },
  loginContainer: {
    position: 'absolute',
    right: Spacing.lg,
    top: 60,
  },
  logo: {
    width: 200,
    height: 70,
    marginBottom: Spacing.lg,
  },
  title: {
    fontSize: 32,
    fontWeight: 'bold',
    marginBottom: 5,
  },
  titleWhite: {
    fontSize: 32,
    fontWeight: 'bold',
    marginBottom: 5,
    color: '#fff',
  },
  subtitle: {
    fontSize: 20,
    opacity: 0.7,
  },
  subtitleWhite: {
    fontSize: 20,
    opacity: 0.9,
    color: '#fff',
  },
  content: {
    flex: 1,
    paddingHorizontal: Spacing.xl,
    justifyContent: 'center',
    paddingBottom: 100,
  },
  welcomeText: {
    fontSize: 18,
    textAlign: 'center',
    marginBottom: Spacing.xxl,
    opacity: 0.8,
  },
  mainButtons: {
    gap: Spacing.xl,
  },
  mainButtonsWide: {
    flexDirection: 'row',
    justifyContent: 'center',
    maxWidth: 800,
    alignSelf: 'center',
    width: '100%',
  },
  mainButton: {
    padding: Spacing.xxl,
    borderRadius: BorderRadius.lg,
    alignItems: 'center',
    minHeight: 160,
    justifyContent: 'center',
  },
  mainButtonWide: {
    flex: 1,
    maxWidth: 350,
  },
  mainButtonIcon: {
    fontSize: 64,
    marginBottom: Spacing.md,
  },
  mainButtonText: {
    color: '#fff',
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: Spacing.xs,
  },
  mainButtonDescription: {
    color: '#fff',
    fontSize: 14,
    opacity: 0.9,
    textAlign: 'center',
  },
});
