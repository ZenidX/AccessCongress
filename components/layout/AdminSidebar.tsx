/**
 * Sidebar Colapsable para Panel de Administración
 *
 * Barra lateral con navegación entre secciones:
 * - Información de usuario
 * - Gestión de participantes
 * - Gestión de usuarios
 * - Acerca de la aplicación
 *
 * Se puede colapsar para mostrar solo iconos o expandir para mostrar texto completo
 */

import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Colors, BorderRadius, Spacing, Shadows } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { ThemedText } from '../themed/themed-text';

export type AdminSection = 'user-info' | 'events' | 'invitations' | 'participants' | 'users' | 'about';

interface SidebarItem {
  id: AdminSection;
  icon: string;
  label: string;
  description: string;
}

const SIDEBAR_ITEMS: SidebarItem[] = [
  {
    id: 'user-info',
    icon: '👤',
    label: 'Mi Perfil',
    description: 'Información del usuario',
  },
  {
    id: 'events',
    icon: '📅',
    label: 'Eventos',
    description: 'Gestión de eventos',
  },
  {
    id: 'invitations',
    icon: '📧',
    label: 'Invitaciones',
    description: 'Gestión de mailing',
  },
  {
    id: 'participants',
    icon: '📊',
    label: 'Participantes',
    description: 'Gestión de participantes',
  },
  {
    id: 'users',
    icon: '👥',
    label: 'Usuarios',
    description: 'Gestión de usuarios',
  },
  {
    id: 'about',
    icon: 'ℹ️',
    label: 'Acerca de',
    description: 'Información de la app',
  },
];

interface AdminSidebarProps {
  isCollapsed: boolean;
  onToggleCollapse: () => void;
  selectedSection: AdminSection;
  onSelectSection: (section: AdminSection) => void;
}

export function AdminSidebar({
  isCollapsed,
  onToggleCollapse,
  selectedSection,
  onSelectSection,
}: AdminSidebarProps) {
  const colorScheme = useColorScheme();

  return (
    <View
      style={[
        styles.sidebar,
        {
          width: isCollapsed ? 80 : 240,
          backgroundColor:
            colorScheme === 'dark' ? Colors.dark.cardBackground : Colors.light.cardBackground,
        },
        Shadows.medium,
      ]}
    >
      {/* Header con botón de colapsar y título */}
      <View style={styles.sidebarHeader}>
        <TouchableOpacity
          style={[
            styles.collapseButton,
            {
              backgroundColor:
                colorScheme === 'dark' ? Colors.dark.primary : Colors.light.primary,
            },
          ]}
          onPress={onToggleCollapse}
        >
          <Text style={styles.collapseIcon}>☰</Text>
        </TouchableOpacity>

        {!isCollapsed && (
          <ThemedText style={styles.sidebarTitle}>Administración</ThemedText>
        )}
      </View>

      {/* Lista de secciones */}
      <View style={styles.sidebarContent}>
        {SIDEBAR_ITEMS.map((item) => (
          <TouchableOpacity
            key={item.id}
            style={[
              styles.sidebarItem,
              selectedSection === item.id && {
                backgroundColor:
                  colorScheme === 'dark'
                    ? 'rgba(0, 161, 228, 0.2)'
                    : 'rgba(0, 161, 228, 0.1)',
                borderLeftWidth: 4,
                borderLeftColor:
                  colorScheme === 'dark' ? Colors.dark.primary : Colors.light.primary,
              },
            ]}
            onPress={() => onSelectSection(item.id)}
            activeOpacity={0.7}
          >
            <Text style={styles.sidebarItemIcon}>{item.icon}</Text>

            {!isCollapsed && (
              <View style={styles.sidebarItemText}>
                <ThemedText style={styles.sidebarItemLabel}>{item.label}</ThemedText>
                <ThemedText style={styles.sidebarItemDescription}>
                  {item.description}
                </ThemedText>
              </View>
            )}
          </TouchableOpacity>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  sidebar: {
    height: '100%',
    paddingTop: Spacing.md,
  },
  sidebarHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    paddingHorizontal: Spacing.md,
    marginBottom: Spacing.lg,
  },
  collapseButton: {
    width: 40,
    height: 40,
    borderRadius: BorderRadius.full,
    alignItems: 'center',
    justifyContent: 'center',
  },
  collapseIcon: {
    fontSize: 16,
    color: '#fff',
  },
  sidebarTitle: {
    fontSize: 18,
    fontWeight: 'bold',
  },
  sidebarContent: {
    flex: 1,
    gap: Spacing.xs,
  },
  sidebarItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing.md,
    gap: Spacing.sm,
    minHeight: 60,
  },
  sidebarItemIcon: {
    fontSize: 28,
  },
  sidebarItemText: {
    flex: 1,
  },
  sidebarItemLabel: {
    fontSize: 14,
    fontWeight: 'bold',
    marginBottom: 2,
  },
  sidebarItemDescription: {
    fontSize: 11,
    opacity: 0.6,
  },
});
