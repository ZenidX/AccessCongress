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
 * En mobile, se renderiza como un drawer modal
 */

import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Modal, Pressable } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
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
  // Mobile drawer props
  isMobile?: boolean;
  isDrawerOpen?: boolean;
  onCloseDrawer?: () => void;
}

export function AdminSidebar({
  isCollapsed,
  onToggleCollapse,
  selectedSection,
  onSelectSection,
  isMobile = false,
  isDrawerOpen = false,
  onCloseDrawer,
}: AdminSidebarProps) {
  const colorScheme = useColorScheme();
  const insets = useSafeAreaInsets();

  // Handle section selection (close drawer on mobile after selection)
  const handleSelectSection = (section: AdminSection) => {
    onSelectSection(section);
    if (isMobile && onCloseDrawer) {
      onCloseDrawer();
    }
  };

  // Sidebar content (shared between inline and drawer modes - used only for desktop)
  const sidebarContent = (
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
      {/* Header con botón de colapsar/cerrar y título */}
      <View style={styles.sidebarHeader}>
        <TouchableOpacity
          style={[
            styles.collapseButton,
            {
              backgroundColor:
                colorScheme === 'dark' ? Colors.dark.primary : Colors.light.primary,
            },
          ]}
          onPress={isMobile ? onCloseDrawer : onToggleCollapse}
        >
          <Text style={styles.collapseIcon}>{isMobile ? '✕' : '☰'}</Text>
        </TouchableOpacity>

        {(isMobile || !isCollapsed) && (
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
            onPress={() => handleSelectSection(item.id)}
            activeOpacity={0.7}
          >
            <Text style={styles.sidebarItemIcon}>{item.icon}</Text>

            {(isMobile || !isCollapsed) && (
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

  // Mobile: render as modal drawer
  if (isMobile) {
    return (
      <Modal
        visible={isDrawerOpen}
        animationType="fade"
        transparent
        onRequestClose={onCloseDrawer}
        statusBarTranslucent
      >
        <View style={[
          styles.drawerOverlay,
          {
            backgroundColor:
              colorScheme === 'dark' ? Colors.dark.cardBackground : Colors.light.cardBackground,
          }
        ]}>
          {/* Sidebar */}
          <View style={[
            styles.drawerSidebar,
            {
              backgroundColor:
                colorScheme === 'dark' ? Colors.dark.cardBackground : Colors.light.cardBackground,
              paddingTop: Math.max(insets.top, Spacing.lg) + Spacing.md,
              paddingBottom: Math.max(insets.bottom, Spacing.md),
            },
            Shadows.strong,
          ]}>
            {/* Header con botón cerrar y título */}
            <View style={styles.sidebarHeader}>
              <TouchableOpacity
                style={[
                  styles.collapseButton,
                  {
                    backgroundColor:
                      colorScheme === 'dark' ? Colors.dark.primary : Colors.light.primary,
                  },
                ]}
                onPress={onCloseDrawer}
              >
                <Text style={styles.collapseIcon}>✕</Text>
              </TouchableOpacity>
              <ThemedText style={styles.sidebarTitle}>Administración</ThemedText>
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
                  onPress={() => handleSelectSection(item.id)}
                  activeOpacity={0.7}
                >
                  <Text style={styles.sidebarItemIcon}>{item.icon}</Text>
                  <View style={styles.sidebarItemText}>
                    <ThemedText style={styles.sidebarItemLabel}>{item.label}</ThemedText>
                    <ThemedText style={styles.sidebarItemDescription}>
                      {item.description}
                    </ThemedText>
                  </View>
                </TouchableOpacity>
              ))}
            </View>
          </View>

          {/* Backdrop para cerrar - ocupa el resto del espacio */}
          <Pressable style={styles.drawerBackdrop} onPress={onCloseDrawer} />
        </View>
      </Modal>
    );
  }

  // Desktop/Tablet: render inline
  return sidebarContent;
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
  // Drawer styles for mobile
  drawerOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    flexDirection: 'row',
  },
  drawerSidebar: {
    width: 280,
    position: 'absolute',
    top: 0,
    left: 0,
    bottom: 0,
  },
  drawerBackdrop: {
    flex: 1,
    marginLeft: 280,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
  },
});
