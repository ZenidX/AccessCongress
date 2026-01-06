/**
 * UserInfoSection Component
 *
 * Displays current user profile information:
 * - Name, email, role
 * - UID
 */

import React from 'react';
import { View, StyleSheet } from 'react-native';
import { ThemedText } from '@/components/themed/themed-text';
import { RoleBadge } from '@/components/data-display/RoleBadge';
import { Colors, BorderRadius, Spacing, Shadows, FontSizes } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { useAuth } from '@/contexts/AuthContext';

export function UserInfoSection() {
  const colorScheme = useColorScheme();
  const { user } = useAuth();

  return (
    <View style={styles.section}>
      <ThemedText style={styles.sectionTitle}>👤 Mi Perfil</ThemedText>

      {user ? (
        <View
          style={[
            styles.infoCard,
            Shadows.light,
            {
              backgroundColor: colorScheme === 'dark'
                ? Colors.dark.cardBackground
                : Colors.light.cardBackground,
            },
          ]}
        >
          <ThemedText style={styles.infoText}>
            <ThemedText style={styles.infoBold}>Nombre: </ThemedText>
            {user.username}
          </ThemedText>

          <ThemedText style={[styles.infoText, { marginTop: 10 }]}>
            <ThemedText style={styles.infoBold}>Email: </ThemedText>
            {user.email}
          </ThemedText>

          <View style={styles.roleRow}>
            <ThemedText style={[styles.infoText, styles.infoBold]}>Rol: </ThemedText>
            <RoleBadge role={user.role} />
          </View>

          <ThemedText style={[styles.infoText, { marginTop: 10 }]}>
            <ThemedText style={styles.infoBold}>UID: </ThemedText>
            <ThemedText style={styles.infoCode}>{user.uid}</ThemedText>
          </ThemedText>

          {user.organizationId && (
            <ThemedText style={[styles.infoText, { marginTop: 10 }]}>
              <ThemedText style={styles.infoBold}>Organización: </ThemedText>
              <ThemedText style={styles.infoCode}>{user.organizationId}</ThemedText>
            </ThemedText>
          )}
        </View>
      ) : (
        <View style={[styles.infoCard, { backgroundColor: Colors[colorScheme ?? 'light'].cardBackground }]}>
          <ThemedText style={styles.infoText}>
            Cargando información del usuario...
          </ThemedText>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  section: {
    flex: 1,
  },
  sectionTitle: {
    fontSize: FontSizes.lg,
    fontWeight: 'bold',
    marginBottom: Spacing.md,
  },
  infoCard: {
    padding: Spacing.lg,
    borderRadius: BorderRadius.lg,
  },
  infoText: {
    fontSize: FontSizes.md,
  },
  infoBold: {
    fontWeight: 'bold',
  },
  infoCode: {
    fontFamily: 'monospace',
    fontSize: FontSizes.sm,
    opacity: 0.7,
  },
  roleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 10,
  },
});
