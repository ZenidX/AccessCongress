/**
 * AboutSection Component
 *
 * Displays information about the application:
 * - Organization info
 * - Developer info
 * - Technical details
 */

import React from 'react';
import { View, StyleSheet, Image } from 'react-native';
import { ThemedText } from '@/components/themed/themed-text';
import { Colors, BorderRadius, Spacing, Shadows, FontSizes } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';

const developerImage = require('@/assets/images/developer.png');

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

        <View style={styles.developerContainer}>
          <Image source={developerImage} style={styles.developerImage} />
          <View style={styles.developerInfo}>
            <ThemedText style={styles.developerName}>Xavi Lara</ThemedText>
            <ThemedText style={styles.developerRole}>Full Stack Developer</ThemedText>
            <ThemedText style={[styles.infoText, { marginTop: Spacing.sm }]}>
              zenid77@gmail.com
            </ThemedText>
          </View>
        </View>

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
  developerContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.lg,
  },
  developerImage: {
    width: 100,
    height: 120,
    borderRadius: BorderRadius.md,
    resizeMode: 'cover',
  },
  developerInfo: {
    flex: 1,
  },
  developerName: {
    fontSize: FontSizes.lg,
    fontWeight: 'bold',
  },
  developerRole: {
    fontSize: FontSizes.md,
    opacity: 0.7,
    marginTop: 2,
  },
});
