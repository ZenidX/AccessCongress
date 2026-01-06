/**
 * AboutSection Component
 *
 * Displays information about the application:
 * - Organization info
 * - Developer info
 * - Technical details
 */

import React from 'react';
import { View, StyleSheet } from 'react-native';
import { ThemedText } from '@/components/themed/themed-text';
import { Colors, BorderRadius, Spacing, Shadows, FontSizes } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';

export function AboutSection() {
  const colorScheme = useColorScheme();

  return (
    <View style={styles.section}>
      <ThemedText style={styles.sectionTitle}>ℹ️ Acerca de la Aplicación</ThemedText>

      <View
        style={[
          styles.infoCard,
          Shadows.light,
          {
            backgroundColor: colorScheme === 'dark'
              ? Colors.dark.cardBackground
              : Colors.light.lightBackground,
          },
        ]}
      >
        <ThemedText style={styles.sectionHeader}>
          Impuls Educació
        </ThemedText>

        <ThemedText style={styles.infoText}>
          <ThemedText style={styles.infoBold}>Organización: </ThemedText>
          Impuls Educació es una organización dedicada a la formación y educación.
        </ThemedText>

        <ThemedText style={[styles.infoText, { marginTop: 15 }]}>
          <ThemedText style={styles.infoBold}>Web: </ThemedText>
          https://impulseducacio.org/
        </ThemedText>

        <ThemedText style={[styles.sectionHeader, { marginTop: Spacing.xxl }]}>
          Desarrollador
        </ThemedText>

        <ThemedText style={styles.infoText}>
          <ThemedText style={styles.infoBold}>Aplicación desarrollada por: </ThemedText>
          Xavi Lara
        </ThemedText>

        <ThemedText style={[styles.infoText, { marginTop: 15 }]}>
          <ThemedText style={styles.infoBold}>Contacto: </ThemedText>
          zenid77@gmail.com
        </ThemedText>

        <ThemedText style={[styles.sectionHeader, { marginTop: Spacing.xxl }]}>
          Información Técnica
        </ThemedText>

        <ThemedText style={styles.infoText}>
          <ThemedText style={styles.infoBold}>Versión: </ThemedText> 1.0.0
        </ThemedText>

        <ThemedText style={[styles.infoText, { marginTop: 10 }]}>
          <ThemedText style={styles.infoBold}>Tecnologías:</ThemedText>
          {'\n'}• React Native + Expo
          {'\n'}• Firebase (Authentication, Firestore, Hosting)
          {'\n'}• TypeScript
        </ThemedText>
      </View>
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
  sectionHeader: {
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
    lineHeight: 22,
  },
  infoBold: {
    fontWeight: 'bold',
  },
});
