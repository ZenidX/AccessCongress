/**
 * Componente de Login
 *
 * Muestra el estado de autenticación en la esquina superior derecha
 * - Si no está autenticado: botón para iniciar sesión
 * - Si está autenticado: un botón con nombre/rol que abre un menú desplegable
 */

import React, { useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  Modal,
  TextInput,
  StyleSheet,
  Alert,
  Platform,
} from 'react-native';
import { useAuth } from '@/contexts/AuthContext';
import { Colors, BorderRadius, Spacing, Shadows } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { useResponsiveLayout } from '@/hooks/useResponsiveLayout';
import { RoleBadge } from '../data-display/RoleBadge';

export function LoginButton() {
  const { user, login, logout } = useAuth();
  const colorScheme = useColorScheme();
  const { isMobile } = useResponsiveLayout();
  const [showLoginModal, setShowLoginModal] = useState(false);
  const [showUserMenu, setShowUserMenu] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);

  const handleLogin = async () => {
    if (!email || !password) {
      if (Platform.OS === 'web') {
        window.alert('Por favor ingresa email y contraseña');
      } else {
        Alert.alert('Error', 'Por favor ingresa email y contraseña');
      }
      return;
    }

    setLoading(true);
    const result = await login(email, password);
    setLoading(false);

    if (result.success) {
      setShowLoginModal(false);
      setEmail('');
      setPassword('');
    } else {
      // Mostrar mensaje de error controlado (no error de Expo)
      const errorMessage = result.errorMessage || 'Error al iniciar sesión';
      if (Platform.OS === 'web') {
        window.alert(errorMessage);
      } else {
        Alert.alert('Error de autenticación', errorMessage);
      }
    }
  };

  const handleLogout = () => {
    setShowUserMenu(false); // Cierra el menú antes de confirmar

    if (Platform.OS === 'web') {
      if (window.confirm('¿Estás seguro que deseas cerrar sesión?')) {
        logout();
      }
    } else {
      Alert.alert(
        'Cerrar sesión',
        '¿Estás seguro que deseas cerrar sesión?',
        [
          { text: 'Cancelar', style: 'cancel' },
          {
            text: 'Cerrar sesión',
            style: 'destructive',
            onPress: logout,
          },
        ]
      );
    }
  };

  if (user) {
    return (
      <>
        <TouchableOpacity
          style={[
            styles.userDisplayButton,
            isMobile && styles.userDisplayButtonMobile,
          ]}
          onPress={() => setShowUserMenu(!showUserMenu)}
        >
          <Text
            style={[styles.usernameDisplay, isMobile && styles.usernameDisplayMobile]}
            numberOfLines={isMobile ? 2 : 1}
          >
            {user.username}
          </Text>
          <RoleBadge role={user.role} size={isMobile ? 'small' : 'medium'} />
        </TouchableOpacity>

        {/* Modal para el menú de usuario - siempre por encima de todo */}
        <Modal
          visible={showUserMenu}
          transparent
          animationType="none"
          onRequestClose={() => setShowUserMenu(false)}
        >
          <TouchableOpacity
            style={styles.userMenuOverlay}
            activeOpacity={1}
            onPress={() => setShowUserMenu(false)}
          >
            <View
              style={[
                styles.userMenuContent,
                colorScheme === 'dark' ? Shadows.strong : Shadows.strong,
                {
                  backgroundColor:
                    colorScheme === 'dark'
                      ? Colors.dark.cardBackground
                      : Colors.light.cardBackground,
                },
              ]}
            >
              <View style={styles.userMenuHeader}>
                <Text style={[styles.userMenuUsername, { color: colorScheme === 'dark' ? '#fff' : Colors.light.text }]}>
                  {user.username}
                </Text>
                <Text style={[styles.userMenuEmail, { color: colorScheme === 'dark' ? '#fff' : Colors.light.text }]}>
                  {user.email}
                </Text>
              </View>
              <TouchableOpacity
                style={styles.userMenuLogoutButton}
                onPress={handleLogout}
              >
                <Text style={styles.userMenuLogoutText}>Cerrar Sesión</Text>
              </TouchableOpacity>
            </View>
          </TouchableOpacity>
        </Modal>
      </>
    );
  }

  // Usuario no autenticado
  return (
    <>
      <TouchableOpacity
        style={[
          styles.loginButton,
          isMobile && styles.loginButtonMobile,
          {
            backgroundColor:
              colorScheme === 'dark' ? Colors.dark.primary : Colors.light.primary,
          },
          Shadows.medium,
        ]}
        onPress={() => setShowLoginModal(true)}
      >
        <Text style={[styles.loginButtonText, isMobile && styles.loginButtonTextMobile]}>
          {isMobile ? '👤' : '👤 Iniciar sesión'}
        </Text>
      </TouchableOpacity>
      {/* Modal de login */}
      <Modal
        visible={showLoginModal}
        transparent
        animationType="fade"
        onRequestClose={() => setShowLoginModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View
            style={[
              styles.modalContent,
              {
                backgroundColor:
                  colorScheme === 'dark'
                    ? Colors.dark.cardBackground
                    : Colors.light.background,
              },
            ]}
          >
            <Text style={styles.modalTitle}>Iniciar sesión</Text>

            <TextInput
              style={[
                styles.input,
                {
                  backgroundColor:
                    colorScheme === 'dark'
                      ? 'rgba(255,255,255,0.1)'
                      : 'rgba(0,0,0,0.05)',
                  color: colorScheme === 'dark' ? '#fff' : '#000',
                },
              ]}
              placeholder="Email"
              placeholderTextColor={
                colorScheme === 'dark' ? 'rgba(255,255,255,0.5)' : 'rgba(0,0,0,0.5)'
              }
              value={email}
              onChangeText={setEmail}
              autoCapitalize="none"
              autoCorrect={false}
              keyboardType="email-address"
            />

            <TextInput
              style={[
                styles.input,
                {
                  backgroundColor:
                    colorScheme === 'dark'
                      ? 'rgba(255,255,255,0.1)'
                      : 'rgba(0,0,0,0.05)',
                  color: colorScheme === 'dark' ? '#fff' : '#000',
                },
              ]}
              placeholder="Contraseña"
              placeholderTextColor={
                colorScheme === 'dark' ? 'rgba(255,255,255,0.5)' : 'rgba(0,0,0,0.5)'
              }
              value={password}
              onChangeText={setPassword}
              secureTextEntry
              autoCapitalize="none"
              autoCorrect={false}
            />

            <View style={styles.modalButtons}>
              <TouchableOpacity
                style={[
                  styles.modalButton,
                  styles.cancelButton,
                  { backgroundColor: 'rgba(0,0,0,0.1)' },
                ]}
                onPress={() => {
                  setShowLoginModal(false);
                  setEmail('');
                  setPassword('');
                }}
              >
                <Text style={styles.cancelButtonText}>Cancelar</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[
                  styles.modalButton,
                  styles.confirmButton,
                  {
                    backgroundColor:
                      colorScheme === 'dark' ? Colors.dark.primary : Colors.light.primary,
                  },
                ]}
                onPress={handleLogin}
                disabled={loading}
              >
                <Text style={styles.confirmButtonText}>
                  {loading ? 'Iniciando...' : 'Iniciar sesión'}
                </Text>
              </TouchableOpacity>
            </View>

            {/* Credenciales de prueba */}
            <View style={styles.credentialsInfo}>
              <Text style={styles.credentialsTitle}>Credenciales de prueba:</Text>
              <Text style={styles.credentialsText}>Admin: Admin@impulseducacio.org / Admin123</Text>
              <Text style={styles.credentialsText}>Control: Control@impulseducacio.org / Control123</Text>
            </View>
          </View>
        </View>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  loginButton: {
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.md,
    borderRadius: BorderRadius.full,
  },
  loginButtonMobile: {
    paddingHorizontal: Spacing.sm,
    minWidth: 44,
    minHeight: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  loginButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: 'bold',
  },
  loginButtonTextMobile: {
    fontSize: 20,
  },
  userDisplayButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.md,
    borderRadius: BorderRadius.full,
  },
  userDisplayButtonMobile: {
    flexDirection: 'column',
    alignItems: 'flex-end',
    gap: 4,
    maxWidth: 120,
    paddingVertical: Spacing.xs,
    paddingHorizontal: Spacing.sm,
  },
  usernameDisplay: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#fff',
  },
  usernameDisplayMobile: {
    fontSize: 12,
    textAlign: 'right',
  },
  roleBadgeDisplay: {
    paddingHorizontal: Spacing.xs,
    paddingVertical: 2,
    borderRadius: BorderRadius.sm,
  },
  roleTextDisplay: {
    fontSize: 10,
    fontWeight: 'bold',
    color: '#fff',
  },
  userMenuOverlay: {
    flex: 1,
    paddingTop: 60, // Espacio desde arriba para que aparezca debajo del botón
    paddingRight: Spacing.md,
    alignItems: 'flex-end',
  },
  userMenuContent: {
    width: 200,
    borderRadius: BorderRadius.md,
    overflow: 'hidden',
  },
  userMenuHeader: {
    padding: Spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(0,0,0,0.1)',
  },
  userMenuUsername: {
    fontSize: 14,
    fontWeight: 'bold',
    color: Colors.light.text,
  },
  userMenuEmail: {
    fontSize: 12,
    color: Colors.light.text,
    opacity: 0.6,
    marginTop: 4,
  },
  userMenuLogoutButton: {
    padding: Spacing.md,
    backgroundColor: Colors.light.error,
  },
  userMenuLogoutText: {
    color: '#fff',
    fontWeight: 'bold',
    textAlign: 'center',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContent: {
    width: '90%',
    maxWidth: 400,
    borderRadius: BorderRadius.lg,
    padding: Spacing.xl,
  },
  modalTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: Spacing.lg,
    textAlign: 'center',
    color: Colors.light.text,
  },
  input: {
    borderRadius: BorderRadius.md,
    padding: Spacing.md,
    marginBottom: Spacing.md,
    fontSize: 16,
  },
  modalButtons: {
    flexDirection: 'row',
    gap: Spacing.md,
    marginTop: Spacing.md,
  },
  modalButton: {
    flex: 1,
    padding: Spacing.md,
    borderRadius: BorderRadius.md,
    alignItems: 'center',
  },
  cancelButton: {},
  cancelButtonText: {
    fontSize: 16,
    fontWeight: 'bold',
    color: Colors.light.text,
  },
  confirmButton: {},
  confirmButtonText: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#fff',
  },
  credentialsInfo: {
    marginTop: Spacing.lg,
    padding: Spacing.md,
    backgroundColor: 'rgba(0,0,0,0.05)',
    borderRadius: BorderRadius.md,
  },
  credentialsTitle: {
    fontSize: 12,
    fontWeight: 'bold',
    marginBottom: Spacing.xs,
    color: Colors.light.text,
  },
  credentialsText: {
    fontSize: 11,
    color: Colors.light.text,
    opacity: 0.7,
  },
});
