/**
 * Pantalla de administración
 *
 * Panel de control multi-sección con sidebar navegable:
 * - Gestión de eventos
 * - Gestión de participantes
 * - Gestión de usuarios
 * - Información del perfil
 * - Acerca de
 */

import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
  Image,
  Alert,
} from 'react-native';
import { ThemedView } from '@/components/themed/themed-view';
import { Colors, BorderRadius, Spacing, Shadows, FontSizes } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { LoginButton } from '@/components/forms/LoginButton';
import { useAuth } from '@/contexts/AuthContext';
import { useEvent } from '@/contexts/EventContext';
import { AdminSidebar, AdminSection } from '@/components/layout/AdminSidebar';
import { BackButton } from '@/components/navigation/BackButton';
import {
  EventManager,
  EventForm,
  EventResetModal,
  UserEventAssignment,
  ParticipantsSection,
  UsersSection,
  UserInfoSection,
  AboutSection,
} from '@/components/admin';
import { Event, ResetType } from '@/types/event';

export default function AdminScreen() {
  const colorScheme = useColorScheme();
  const { user } = useAuth();
  const { currentEvent, setCurrentEvent, refreshEvents } = useEvent();

  // Estado del sidebar y sección seleccionada
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [selectedSection, setSelectedSection] = useState<AdminSection>('events');

  // Estado para gestión de eventos
  const [showEventForm, setShowEventForm] = useState(false);
  const [editingEvent, setEditingEvent] = useState<Event | null>(null);
  const [showResetModal, setShowResetModal] = useState(false);
  const [resetEvent, setResetEvent] = useState<Event | null>(null);
  const [showUserAssignment, setShowUserAssignment] = useState(false);
  const [assignmentEvent, setAssignmentEvent] = useState<Event | null>(null);

  // Handlers para eventos
  const handleCreateEvent = () => {
    setEditingEvent(null);
    setShowEventForm(true);
  };

  const handleEditEvent = (event: Event) => {
    setEditingEvent(event);
    setShowEventForm(true);
  };

  const handleResetEvent = (event: Event) => {
    setResetEvent(event);
    setShowResetModal(true);
  };

  const handleAssignUsers = (event: Event) => {
    setAssignmentEvent(event);
    setShowUserAssignment(true);
  };

  const handleEventSaved = (event: Event) => {
    setShowEventForm(false);
    setEditingEvent(null);
    refreshEvents();
  };

  const handleResetComplete = (type: ResetType, count: number) => {
    const typeLabel = type === 'daily' ? 'diario' : 'total';
    Alert.alert(
      'Reset completado',
      `Se ha realizado el reset ${typeLabel}. ${count} participantes actualizados.`
    );
    setShowResetModal(false);
    setResetEvent(null);
  };

  // Renderizar contenido según la sección seleccionada
  const renderSectionContent = () => {
    switch (selectedSection) {
      case 'user-info':
        return <UserInfoSection />;
      case 'events':
        return renderEventsSection();
      case 'participants':
        return <ParticipantsSection />;
      case 'users':
        return <UsersSection />;
      case 'about':
        return <AboutSection />;
      default:
        return null;
    }
  };

  // Sección: Gestión de Eventos
  const renderEventsSection = () => {
    // Show event form
    if (showEventForm) {
      return (
        <EventForm
          event={editingEvent}
          organizationId={user?.organizationId || undefined}
          onSave={handleEventSaved}
          onCancel={() => {
            setShowEventForm(false);
            setEditingEvent(null);
          }}
        />
      );
    }

    // Show user assignment
    if (showUserAssignment && assignmentEvent) {
      return (
        <UserEventAssignment
          event={assignmentEvent}
          onClose={() => {
            setShowUserAssignment(false);
            setAssignmentEvent(null);
          }}
          onAssignmentChange={() => {
            // Could refresh any relevant data here
          }}
        />
      );
    }

    // Show event manager
    return (
      <View style={styles.section}>
        <EventManager
          organizationId={user?.organizationId || undefined}
          onCreateEvent={handleCreateEvent}
          onEditEvent={handleEditEvent}
          onResetEvent={handleResetEvent}
          onAssignUsers={handleAssignUsers}
          onSelectEvent={(event) => {
            setCurrentEvent(event);
          }}
        />

        {/* Current event indicator */}
        {currentEvent && (
          <View style={[
            styles.currentEventBanner,
            { backgroundColor: Colors[colorScheme ?? 'light'].success + '20' }
          ]}>
            <Text style={[styles.currentEventLabel, { color: Colors[colorScheme ?? 'light'].success }]}>
              Evento activo:
            </Text>
            <Text style={[styles.currentEventName, { color: Colors[colorScheme ?? 'light'].text }]}>
              {currentEvent.name}
            </Text>
          </View>
        )}
      </View>
    );
  };

  return (
    <ThemedView style={styles.container}>
      {/* Layout horizontal: Sidebar + Contenido */}
      <View style={styles.mainLayout}>
        {/* Sidebar colapsable */}
        <AdminSidebar
          isCollapsed={sidebarCollapsed}
          onToggleCollapse={() => setSidebarCollapsed(!sidebarCollapsed)}
          selectedSection={selectedSection}
          onSelectSection={setSelectedSection}
        />

        {/* Contenido principal */}
        <View style={styles.mainContent}>
          {/* Header con logo y login */}
          <View style={styles.headerContainer}>
            <View style={styles.logoContainer}>
              <Image
                source={{ uri: 'https://impulseducacio.org/wp-content/uploads/2020/02/logo-web-impuls.png' }}
                style={styles.logo}
                resizeMode="contain"
              />
            </View>
            <View style={styles.loginContainer}>
              <LoginButton />
            </View>
          </View>

          <ScrollView contentContainerStyle={styles.content} style={{ flex: 1 }}>
            {renderSectionContent()}
          </ScrollView>

          {/* Footer para el botón de volver */}
          <View style={styles.footer}>
            <BackButton style={{ margin: 0 }} />
          </View>
        </View>
      </View>

      {/* Modal de reset de evento */}
      <EventResetModal
        visible={showResetModal}
        event={resetEvent}
        onClose={() => {
          setShowResetModal(false);
          setResetEvent(null);
        }}
        onResetComplete={handleResetComplete}
      />
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  mainLayout: {
    flex: 1,
    flexDirection: 'row',
  },
  mainContent: {
    flex: 1,
  },
  headerContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.md,
    paddingBottom: Spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(0,0,0,0.1)',
  },
  logoContainer: {
    flex: 1,
    alignItems: 'flex-start',
  },
  logo: {
    width: 150,
    height: 50,
  },
  loginContainer: {
    flexShrink: 0,
  },
  content: {
    padding: Spacing.lg,
    paddingBottom: Spacing.xxl,
  },
  footer: {
    padding: Spacing.md,
    borderTopWidth: 1,
    borderTopColor: 'rgba(0,0,0,0.1)',
    alignItems: 'center',
  },
  section: {
    flex: 1,
  },
  currentEventBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: Spacing.md,
    borderRadius: BorderRadius.md,
    marginTop: Spacing.lg,
  },
  currentEventLabel: {
    fontSize: FontSizes.sm,
    fontWeight: 'bold',
    marginRight: Spacing.sm,
  },
  currentEventName: {
    fontSize: FontSizes.md,
    fontWeight: '600',
  },
});
