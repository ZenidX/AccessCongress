/**
 * Pantalla principal - Home
 *
 * Pantalla de bienvenida simple con acceso directo a:
 * - Dashboard: Monitoreo en tiempo real de asistentes
 * - Administración: Gestión de participantes y configuración
 */

import React from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Image,
} from 'react-native';
import { useRouter } from 'expo-router';
import { ThemedView } from '@/components/themed/themed-view';
import { ThemedText } from '@/components/themed/themed-text';
import { Colors, BorderRadius, Shadows, Spacing } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { ImpulsWave } from '@/components/visuals/wave-divider';
import { LoginButton } from '@/components/forms/LoginButton';
import { useAuth } from '@/contexts/AuthContext';

export default function HomeScreen() {
  const router = useRouter();
  const colorScheme = useColorScheme();
  const { user } = useAuth();

  // Debug: mostrar el usuario actual
  console.log('🏠 Index: Usuario actual:', user);

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
            style={styles.logo}
            resizeMode="contain"
          />
          <Text style={styles.titleWhite}>Control de Acceso</Text>
          <Text style={styles.subtitleWhite}>Congreso 2025</Text>
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
          Bienvenido al sistema de control de acceso
        </ThemedText>

        {/* Botones principales */}
        <View style={styles.mainButtons}>
          {/* Botón Dashboard */}
          <TouchableOpacity
            style={[
              styles.mainButton,
              Shadows.strong,
              {
                backgroundColor:
                  colorScheme === 'dark' ? Colors.dark.primary : Colors.light.primary,
              },
            ]}
            onPress={handleGoToDashboard}
            activeOpacity={0.8}
          >
            <Text style={styles.mainButtonIcon}>📊</Text>
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
                },
              ]}
              onPress={handleGoToAdmin}
              activeOpacity={0.8}
            >
              <Text style={styles.mainButtonIcon}>⚙️</Text>
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
  mainButton: {
    padding: Spacing.xxl,
    borderRadius: BorderRadius.lg,
    alignItems: 'center',
    minHeight: 160,
    justifyContent: 'center',
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
