/**
 * RoleBadge Component
 *
 * A reusable UI component to display a user's role with
 * consistent styling across the application.
 * Supports the 4-level role hierarchy:
 * - super_admin
 * - admin_responsable
 * - admin
 * - controlador
 */
import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { UserRole } from '@/types/user';
import { BorderRadius, Spacing } from '@/constants/theme';

interface RoleBadgeProps {
  role: UserRole;
  size?: 'small' | 'medium' | 'large';
}

// Role labels for display
const ROLE_LABELS: Record<UserRole, string> = {
  'super_admin': 'Super Admin',
  'admin_responsable': 'Admin Resp.',
  'admin': 'Admin',
  'controlador': 'Control',
};

// Role colors for badges
const ROLE_COLORS: Record<UserRole, string> = {
  'super_admin': '#9b51e0', // Purple
  'admin_responsable': '#00a4e1', // Blue
  'admin': '#ffaf00', // Orange
  'controlador': '#4caf50', // Green
};

export function RoleBadge({ role, size = 'small' }: RoleBadgeProps) {
  const fontSize = size === 'small' ? 10 : size === 'medium' ? 12 : 14;
  const padding = size === 'small' ? 2 : size === 'medium' ? 4 : 6;

  return (
    <View
      style={[
        styles.badge,
        {
          backgroundColor: ROLE_COLORS[role] || '#888',
          paddingVertical: padding,
        },
      ]}
    >
      <Text style={[styles.text, { fontSize }]}>
        {ROLE_LABELS[role] || role}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    paddingHorizontal: Spacing.xs,
    borderRadius: BorderRadius.sm,
  },
  text: {
    fontWeight: 'bold',
    color: '#fff',
  },
});
