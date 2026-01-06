/**
 * Sección de Invitaciones - Gestión de plantillas de email
 *
 * Permite crear, editar y gestionar plantillas de email para envío de invitaciones
 * con códigos QR a los participantes de eventos.
 */

import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { ThemedText } from '@/components/themed/themed-text';
import { Colors, BorderRadius, Spacing, Shadows, FontSizes } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { useEvent } from '@/contexts/EventContext';
import { useAuth } from '@/contexts/AuthContext';

import { TemplateList } from './TemplateList';
import { TemplateEditor } from './TemplateEditor';
import { EmailTemplate } from '@/types/emailTemplate';
import {
  getTemplatesByEvent,
  createTemplate,
  updateTemplate,
  deleteTemplate,
  setDefaultTemplate,
} from '@/services/emailTemplateService';

type ViewMode = 'list' | 'create' | 'edit';

export function InvitationsSection() {
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme ?? 'light'];
  const { currentEvent } = useEvent();
  const { user } = useAuth();

  const [viewMode, setViewMode] = useState<ViewMode>('list');
  const [templates, setTemplates] = useState<EmailTemplate[]>([]);
  const [selectedTemplate, setSelectedTemplate] = useState<EmailTemplate | null>(null);
  const [loading, setLoading] = useState(false);

  // Cargar plantillas cuando cambia el evento
  useEffect(() => {
    if (currentEvent?.id) {
      loadTemplates();
    } else {
      setTemplates([]);
    }
  }, [currentEvent?.id]);

  const loadTemplates = async () => {
    if (!currentEvent?.id) return;
    setLoading(true);
    try {
      const data = await getTemplatesByEvent(currentEvent.id);
      setTemplates(data);
    } catch (error) {
      console.error('Error loading templates:', error);
      Alert.alert('Error', 'No se pudieron cargar las plantillas');
    } finally {
      setLoading(false);
    }
  };

  const handleCreateTemplate = () => {
    setSelectedTemplate(null);
    setViewMode('create');
  };

  const handleEditTemplate = (template: EmailTemplate) => {
    setSelectedTemplate(template);
    setViewMode('edit');
  };

  const handleSaveTemplate = async (templateData: Partial<EmailTemplate>) => {
    if (!currentEvent?.id || !user?.uid) return;

    setLoading(true);
    try {
      if (viewMode === 'create') {
        // Si es la primera plantilla, hacerla default
        const isFirst = templates.length === 0;
        await createTemplate({
          ...templateData,
          eventId: currentEvent.id,
          createdBy: user.uid,
          isDefault: isFirst || templateData.isDefault || false,
        } as any);
        Alert.alert('Éxito', 'Plantilla creada correctamente');
      } else if (viewMode === 'edit' && selectedTemplate) {
        await updateTemplate(currentEvent.id, selectedTemplate.id, templateData);
        Alert.alert('Éxito', 'Plantilla actualizada correctamente');
      }
      setViewMode('list');
      loadTemplates();
    } catch (error: any) {
      Alert.alert('Error', error.message || 'No se pudo guardar la plantilla');
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteTemplate = async (template: EmailTemplate) => {
    if (!currentEvent?.id) return;

    Alert.alert(
      'Confirmar eliminación',
      `¿Estás seguro de eliminar la plantilla "${template.name}"?`,
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Eliminar',
          style: 'destructive',
          onPress: async () => {
            setLoading(true);
            try {
              await deleteTemplate(currentEvent.id, template.id);
              loadTemplates();
              Alert.alert('Éxito', 'Plantilla eliminada');
            } catch (error: any) {
              Alert.alert('Error', error.message);
            } finally {
              setLoading(false);
            }
          },
        },
      ]
    );
  };

  const handleSetDefault = async (template: EmailTemplate) => {
    if (!currentEvent?.id) return;

    setLoading(true);
    try {
      await setDefaultTemplate(currentEvent.id, template.id);
      loadTemplates();
      Alert.alert('Éxito', `"${template.name}" es ahora la plantilla por defecto`);
    } catch (error: any) {
      Alert.alert('Error', error.message);
    } finally {
      setLoading(false);
    }
  };

  // Renderizar contenido según el modo
  const renderContent = () => {
    if (!currentEvent) {
      return (
        <View style={styles.emptyState}>
          <Text style={styles.emptyStateIcon}>📧</Text>
          <ThemedText style={styles.emptyStateText}>
            Selecciona un evento en la sección &quot;Eventos&quot; para gestionar las invitaciones
          </ThemedText>
        </View>
      );
    }

    switch (viewMode) {
      case 'list':
        return (
          <TemplateList
            templates={templates}
            loading={loading}
            onCreateNew={handleCreateTemplate}
            onEdit={handleEditTemplate}
            onDelete={handleDeleteTemplate}
            onSetDefault={handleSetDefault}
            onRefresh={loadTemplates}
          />
        );

      case 'create':
      case 'edit':
        return (
          <TemplateEditor
            template={selectedTemplate}
            event={currentEvent}
            onSave={handleSaveTemplate}
            onCancel={() => setViewMode('list')}
            loading={loading}
          />
        );

      default:
        return null;
    }
  };

  return (
    <View style={styles.section}>
      <View style={styles.header}>
        <ThemedText style={styles.sectionTitle}>📧 Invitaciones por Email</ThemedText>
        {currentEvent && viewMode !== 'list' && (
          <TouchableOpacity style={styles.backButton} onPress={() => setViewMode('list')}>
            <Text style={[styles.backButtonText, { color: colors.primary }]}>← Volver</Text>
          </TouchableOpacity>
        )}
      </View>

      {currentEvent && (
        <View style={[styles.eventBanner, { backgroundColor: colors.primary + '15' }]}>
          <Text style={[styles.eventBannerText, { color: colors.primary }]}>
            📅 Evento: {currentEvent.name}
          </Text>
        </View>
      )}

      {renderContent()}

      {loading && (
        <View style={styles.loadingOverlay}>
          <View style={[styles.loadingBox, { backgroundColor: colors.cardBackground }]}>
            <ActivityIndicator size="large" color={colors.primary} />
            <ThemedText style={styles.loadingText}>Cargando...</ThemedText>
          </View>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  section: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: Spacing.md,
  },
  sectionTitle: {
    fontSize: FontSizes.xl,
    fontWeight: 'bold',
  },
  backButton: {
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
  },
  backButtonText: {
    fontSize: FontSizes.md,
    fontWeight: '600',
  },
  eventBanner: {
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderRadius: BorderRadius.md,
    marginBottom: Spacing.md,
  },
  eventBannerText: {
    fontSize: FontSizes.sm,
    fontWeight: '600',
  },
  emptyState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: Spacing.xl,
  },
  emptyStateIcon: {
    fontSize: 64,
    marginBottom: Spacing.md,
  },
  emptyStateText: {
    fontSize: FontSizes.md,
    textAlign: 'center',
    opacity: 0.6,
  },
  loadingOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0, 0, 0, 0.3)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingBox: {
    padding: Spacing.xl,
    borderRadius: BorderRadius.lg,
    alignItems: 'center',
    ...Shadows.medium,
  },
  loadingText: {
    marginTop: Spacing.md,
    fontSize: FontSizes.md,
  },
});
