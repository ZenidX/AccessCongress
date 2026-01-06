/**
 * Layout raíz de la aplicación
 *
 * Configura la estructura base de navegación y providers globales:
 * - AppProvider: Contexto global para compartir modo, dirección y operador
 * - ThemeProvider: Tema de navegación (claro/oscuro) para React Navigation
 * - Stack Navigator: Navegación tipo stack entre pantallas
 *
 * Pantallas configuradas:
 * - index: Pantalla principal (sin header)
 * - scanner: Escáner de QR
 * - dashboard: Dashboard en tiempo real
 * - admin: Panel de administración
 */

import { DarkTheme, DefaultTheme, ThemeProvider } from '@react-navigation/native';
import { Stack, useRouter, useSegments, useRootNavigationState } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import 'react-native-reanimated';
import { useEffect } from 'react';

import { useColorScheme } from '@/hooks/use-color-scheme';
import { AppProvider } from '@/contexts/AppContext';
import { AuthProvider, useAuth } from '@/contexts/AuthContext';
import { EventProvider } from '@/contexts/EventContext';

function InitialLayout() {
  const { user, isLoading } = useAuth();
  const segments = useSegments();
  const router = useRouter();
  const rootNavigationState = useRootNavigationState();

  useEffect(() => {
    if (isLoading || !rootNavigationState?.key) {
      // Esperar a que la autenticación y la navegación estén listas
      return;
    }

    const currentSegment = segments[0];
    const isPublicRoute = segments.length === 0 || currentSegment === 'dashboard';

    if (user) {
      // Admin access: super_admin, admin_responsable, admin (NOT controlador)
      const hasAdminAccess = ['super_admin', 'admin_responsable', 'admin'].includes(user.role);
      if (currentSegment === 'admin' && !hasAdminAccess) {
        router.replace('/');
      }
    } else {
      if (!isPublicRoute) {
        router.replace('/');
      }
    }
  }, [user, isLoading, segments, router, rootNavigationState?.key]);

  return (
    <Stack>
      <Stack.Screen name="index" options={{ headerShown: false }} />
      <Stack.Screen name="scanner" options={{ title: 'Escanear QR' }} />
      <Stack.Screen name="dashboard" options={{ title: 'Dashboard' }} />
      <Stack.Screen name="admin" options={{ title: 'Administración' }} />
    </Stack>
  );
}

export default function RootLayout() {
  const colorScheme = useColorScheme();

  return (
    <AuthProvider>
      <EventProvider>
        <AppProvider>
          <ThemeProvider value={colorScheme === 'dark' ? DarkTheme : DefaultTheme}>
            <InitialLayout />
            <StatusBar style="auto" />
          </ThemeProvider>
        </AppProvider>
      </EventProvider>
    </AuthProvider>
  );
}
