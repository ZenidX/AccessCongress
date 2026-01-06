/**
 * PersonCard - Card para mostrar información de persona
 *
 * Card reutilizable para participantes, usuarios, logs, etc.
 * Muestra nombre, identificador y badges opcionales
 */

import React, { ReactNode } from 'react';
import { View, StyleSheet } from 'react-native';
import { ThemedText } from '../themed/themed-text';
import { Colors, BorderRadius, Spacing, Shadows } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';

interface PersonCardProps {
  name: string;
  identifier?: string; // DNI, email, etc.
  badges?: ReactNode; // Badges opcionales (ej: MC, Cena)
  metadata?: ReactNode; // Información adicional
  style?: any;
}

export function PersonCard({
  name,
  identifier,
  badges,
  metadata,
  style,
}: PersonCardProps) {
  const colorScheme = useColorScheme();

  return (
    <View
      style={[
        styles.card,
        colorScheme === 'dark' ? Shadows.light : Shadows.light,
        {
          backgroundColor:
            colorScheme === 'dark'
              ? Colors.dark.cardBackground
              : Colors.light.cardBackground,
        },
        style,
      ]}
    >
      <View style={styles.info}>
        <ThemedText style={styles.name}>{name}</ThemedText>
        {identifier && (
          <ThemedText style={styles.identifier}>{identifier}</ThemedText>
        )}
        {metadata && <View style={styles.metadata}>{metadata}</View>}
      </View>

      {badges && <View style={styles.badges}>{badges}</View>}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: Spacing.md,
    borderRadius: BorderRadius.md,
    marginBottom: Spacing.sm,
  },
  info: {
    flex: 1,
  },
  name: {
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 4,
  },
  identifier: {
    fontSize: 14,
    opacity: 0.7,
  },
  metadata: {
    marginTop: Spacing.xs,
  },
  badges: {
    flexDirection: 'row',
    gap: Spacing.xs,
    flexWrap: 'wrap',
    marginLeft: Spacing.sm,
  },
});
