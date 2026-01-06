/**
 * ThemedModal - Modal genérico con tema
 *
 * Modal con overlay oscuro y contenido centrado
 * Se adapta automáticamente al tema (dark/light)
 */

import React, { ReactNode } from 'react';
import { Modal, View, StyleSheet } from 'react-native';
import { Colors, BorderRadius, Spacing } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';

interface ThemedModalProps {
  visible: boolean;
  onClose: () => void;
  children: ReactNode;
  animationType?: 'none' | 'slide' | 'fade';
  maxWidth?: number;
}

export function ThemedModal({
  visible,
  onClose,
  children,
  animationType = 'fade',
  maxWidth = 500,
}: ThemedModalProps) {
  const colorScheme = useColorScheme();

  return (
    <Modal
      visible={visible}
      transparent
      animationType={animationType}
      onRequestClose={onClose}
    >
      <View style={styles.overlay}>
        <View
          style={[
            styles.content,
            {
              backgroundColor:
                colorScheme === 'dark'
                  ? Colors.dark.cardBackground
                  : Colors.light.cardBackground,
              maxWidth,
            },
          ]}
        >
          {children}
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  content: {
    width: '90%',
    padding: Spacing.lg,
    borderRadius: BorderRadius.lg,
  },
});
