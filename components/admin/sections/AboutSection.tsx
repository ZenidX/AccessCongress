/**
 * AboutSection Component
 *
 * Displays information about the application:
 * - Organization info
 * - Developer info
 * - Technical details
 */

import React from 'react';
import { View, StyleSheet, Image, useWindowDimensions } from 'react-native';
import { ThemedText } from '@/components/themed/themed-text';
import { Colors, BorderRadius, Spacing, Shadows, FontSizes } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';

const developerImage = require('@/assets/images/developer.png');

const BREAKPOINT = 600; // Width below which we switch to mobile layout

export function AboutSection() {
  const colorScheme = useColorScheme();
  const { width } = useWindowDimensions();
  const isNarrow = width < BREAKPOINT;

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
        {/* Main layout: content left, image right (on wide screens) */}
        <View style={[styles.mainContainer, isNarrow && styles.mainContainerNarrow]}>
          {/* Content column */}
          <View style={[styles.contentColumn, isNarrow && styles.contentColumnNarrow]}>
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

            {/* Mobile: Image between title and info */}
            {isNarrow && (
              <Image source={developerImage} style={styles.developerImageMobile} />
            )}

            <View style={styles.developerInfo}>
              <ThemedText style={styles.developerName}>Xavi Lara</ThemedText>
              <ThemedText style={styles.developerRole}>AI & IT Analyst</ThemedText>
              <ThemedText style={styles.developerRole}>I+D+i Consultant</ThemedText>
              <ThemedText style={styles.developerRole}>Software Architect</ThemedText>
              <ThemedText style={styles.developerRole}>Full Stack Web Developer</ThemedText>
              <ThemedText style={styles.developerRole}>AI & IT Teacher & Tutor</ThemedText>
              <ThemedText style={[styles.infoText, { marginTop: Spacing.md }]}>
                zenid77@gmail.com
              </ThemedText>
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

          {/* Image column - only on wide screens */}
          {!isNarrow && (
            <View style={styles.imageColumn}>
              <Image source={developerImage} style={styles.developerImageDesktop} />
            </View>
          )}
        </View>
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
    overflow: 'hidden',
  },
  infoText: {
    fontSize: FontSizes.md,
    lineHeight: 22,
  },
  infoBold: {
    fontWeight: 'bold',
  },
  mainContainer: {
    flexDirection: 'row',
    alignItems: 'stretch',
  },
  mainContainerNarrow: {
    flexDirection: 'column',
  },
  contentColumn: {
    flex: 1,
    paddingRight: Spacing.xl,
  },
  contentColumnNarrow: {
    paddingRight: 0,
  },
  imageColumn: {
    width: 280,
    marginLeft: Spacing.lg,
    marginTop: -Spacing.lg,
    marginBottom: -Spacing.lg,
    marginRight: -Spacing.lg,
  },
  developerImageDesktop: {
    width: '100%',
    height: '100%',
    resizeMode: 'contain',
  },
  developerImageMobile: {
    width: '100%',
    height: 350,
    resizeMode: 'contain',
    borderRadius: BorderRadius.md,
    marginBottom: Spacing.md,
  },
  developerInfo: {
    marginBottom: Spacing.sm,
  },
  developerName: {
    fontSize: FontSizes.xl,
    fontWeight: 'bold',
    marginBottom: Spacing.sm,
  },
  developerRole: {
    fontSize: FontSizes.sm,
    opacity: 0.8,
    marginTop: 2,
  },
});
