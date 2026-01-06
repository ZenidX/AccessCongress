/**
 * Section - Contenedor de sección con título
 *
 * Agrupa contenido con un título de sección opcional
 * Proporciona espaciado consistente
 */

import React, { ReactNode } from 'react';
import { View, StyleSheet } from 'react-native';
import { ThemedText } from '../themed/themed-text';
import { Spacing } from '@/constants/theme';

interface SectionProps {
  title?: string;
  children: ReactNode;
  style?: any;
}

export function Section({ title, children, style }: SectionProps) {
  return (
    <View style={[styles.section, style]}>
      {title && <ThemedText style={styles.sectionTitle}>{title}</ThemedText>}
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  section: {
    marginBottom: Spacing.xxl,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    marginBottom: Spacing.md,
  },
});
