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
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import 'react-native-reanimated';

import { useColorScheme } from '@/hooks/use-color-scheme';
import { AppProvider } from '@/contexts/AppContext';

export default function RootLayout() {
  const colorScheme = useColorScheme();

  return (
    // AppProvider: Proporciona contexto global (modo, dirección, operador) a toda la app
    <AppProvider>
      {/* ThemeProvider: Aplica tema claro/oscuro a la navegación */}
      <ThemeProvider value={colorScheme === 'dark' ? DarkTheme : DefaultTheme}>
        {/* Stack Navigator: Navegación entre pantallas con transiciones */}
        <Stack>
          {/* Pantalla principal: sin header porque tiene logo propio */}
          <Stack.Screen name="index" options={{ headerShown: false }} />

          {/* Pantalla de scanner con header personalizado */}
          <Stack.Screen name="scanner" options={{ title: 'Escanear QR' }} />

          {/* Dashboard con header estándar */}
          <Stack.Screen name="dashboard" options={{ title: 'Dashboard' }} />

          {/* Administración con header estándar */}
          <Stack.Screen name="admin" options={{ title: 'Administración' }} />
        </Stack>

        {/* StatusBar: adapta color automáticamente según el tema */}
        <StatusBar style="auto" />
      </ThemeProvider>
    </AppProvider>
  );
}
