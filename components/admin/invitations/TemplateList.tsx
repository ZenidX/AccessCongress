/**
 * Lista de plantillas de email
 *
 * Muestra todas las plantillas disponibles para un evento con acciones:
 * - Crear nueva
 * - Editar
 * - Eliminar
 * - Establecer como predeterminada
 */

import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
} from 'react-native';
import { ThemedText } from '@/components/themed/themed-text';
import { Colors, BorderRadius, Spacing, Shadows, FontSizes } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { EmailTemplate } from '@/types/emailTemplate';

interface TemplateListProps {
  templates: EmailTemplate[];
  loading: boolean;
  onCreateNew: () => void;
  onEdit: (template: EmailTemplate) => void;
  onDelete: (template: EmailTemplate) => void;
  onSetDefault: (template: EmailTemplate) => void;
  onRefresh: () => void;
}

export function TemplateList({
  templates,
  loading,
  onCreateNew,
  onEdit,
  onDelete,
  onSetDefault,
  onRefresh,
}: TemplateListProps) {
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme ?? 'light'];

  const formatDate = (timestamp: number) => {
    return new Date(timestamp).toLocaleDateString('es-ES', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    });
  };

  return (
    <ScrollView style={styles.container} showsVerticalScrollIndicator={false}>
      {/* Header con acciones */}
      <View style={styles.headerActions}>
        <TouchableOpacity
          style={[styles.createButton, { backgroundColor: colors.success }]}
          onPress={onCreateNew}
        >
          <Text style={styles.createButtonText}>➕ Nueva Plantilla</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.refreshButton, { borderColor: colors.border }]}
          onPress={onRefresh}
          disabled={loading}
        >
          <Text style={styles.refreshButtonText}>{loading ? '⏳' : '🔄'}</Text>
        </TouchableOpacity>
      </View>

      {/* Info box */}
      <View style={[styles.infoBox, { backgroundColor: colors.primary + '10' }]}>
        <Text style={[styles.infoText, { color: colors.primary }]}>
          💡 Las plantillas permiten personalizar los emails de invitación con variables como{' '}
          {'{{participante.nombre}}'}, {'{{evento.fecha}}'} y el código QR {'{{qr.url}}'}.
        </Text>
      </View>

      {/* Lista de plantillas */}
      {loading && templates.length === 0 ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      ) : templates.length === 0 ? (
        <View style={[styles.emptyCard, { backgroundColor: colors.cardBackground }, Shadows.light]}>
          <Text style={styles.emptyIcon}>📭</Text>
          <ThemedText style={styles.emptyTitle}>No hay plantillas</ThemedText>
          <ThemedText style={styles.emptyText}>
            Crea tu primera plantilla de email para enviar invitaciones a los participantes.
          </ThemedText>
        </View>
      ) : (
        <View style={styles.templateList}>
          {templates.map((template) => (
            <View
              key={template.id}
              style={[
                styles.templateCard,
                { backgroundColor: colors.cardBackground },
                template.isDefault && { borderColor: colors.success, borderWidth: 2 },
                Shadows.light,
              ]}
            >
              {/* Header de la tarjeta */}
              <View style={styles.templateHeader}>
                <View style={styles.templateTitleRow}>
                  <ThemedText style={styles.templateName}>{template.name}</ThemedText>
                  {template.isDefault && (
                    <View style={[styles.defaultBadge, { backgroundColor: colors.success }]}>
                      <Text style={styles.defaultBadgeText}>✓ Predeterminada</Text>
                    </View>
                  )}
                </View>
                <ThemedText style={styles.templateDate}>
                  Creada: {formatDate(template.createdAt)}
                </ThemedText>
              </View>

              {/* Asunto */}
              <View style={styles.templateSubject}>
                <ThemedText style={styles.subjectLabel}>Asunto:</ThemedText>
                <ThemedText style={styles.subjectText} numberOfLines={1}>
                  {template.subject}
                </ThemedText>
              </View>

              {/* Preview del contenido */}
              <View style={[styles.previewBox, { backgroundColor: colors.background }]}>
                <ThemedText style={styles.previewText} numberOfLines={3}>
                  {stripHtml(template.bodyHtml)}
                </ThemedText>
              </View>

              {/* Acciones */}
              <View style={styles.templateActions}>
                <TouchableOpacity
                  style={[styles.actionButton, { backgroundColor: colors.primary }]}
                  onPress={() => onEdit(template)}
                >
                  <Text style={styles.actionButtonText}>✏️ Editar</Text>
                </TouchableOpacity>

                {!template.isDefault && (
                  <TouchableOpacity
                    style={[styles.actionButton, { backgroundColor: colors.success }]}
                    onPress={() => onSetDefault(template)}
                  >
                    <Text style={styles.actionButtonText}>⭐ Predeterminar</Text>
                  </TouchableOpacity>
                )}

                <TouchableOpacity
                  style={[styles.actionButton, styles.deleteButton]}
                  onPress={() => onDelete(template)}
                >
                  <Text style={styles.actionButtonText}>🗑️</Text>
                </TouchableOpacity>
              </View>
            </View>
          ))}
        </View>
      )}
    </ScrollView>
  );
}

/**
 * Elimina tags HTML de un string para mostrar preview
 */
function stripHtml(html: string): string {
  return html
    .replace(/<[^>]*>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  headerActions: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: Spacing.md,
  },
  createButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.sm,
    borderRadius: BorderRadius.md,
  },
  createButtonText: {
    color: '#fff',
    fontWeight: '600',
    fontSize: FontSizes.md,
  },
  refreshButton: {
    width: 44,
    height: 44,
    borderRadius: BorderRadius.full,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  refreshButtonText: {
    fontSize: 20,
  },
  infoBox: {
    padding: Spacing.md,
    borderRadius: BorderRadius.md,
    marginBottom: Spacing.md,
  },
  infoText: {
    fontSize: FontSizes.sm,
    lineHeight: 20,
  },
  loadingContainer: {
    padding: Spacing.xl,
    alignItems: 'center',
  },
  emptyCard: {
    padding: Spacing.xl,
    borderRadius: BorderRadius.lg,
    alignItems: 'center',
  },
  emptyIcon: {
    fontSize: 48,
    marginBottom: Spacing.md,
  },
  emptyTitle: {
    fontSize: FontSizes.lg,
    fontWeight: 'bold',
    marginBottom: Spacing.sm,
  },
  emptyText: {
    fontSize: FontSizes.md,
    textAlign: 'center',
    opacity: 0.6,
  },
  templateList: {
    gap: Spacing.md,
  },
  templateCard: {
    borderRadius: BorderRadius.lg,
    padding: Spacing.md,
    marginBottom: Spacing.sm,
  },
  templateHeader: {
    marginBottom: Spacing.sm,
  },
  templateTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    flexWrap: 'wrap',
  },
  templateName: {
    fontSize: FontSizes.lg,
    fontWeight: 'bold',
  },
  defaultBadge: {
    paddingHorizontal: Spacing.sm,
    paddingVertical: 2,
    borderRadius: BorderRadius.full,
  },
  defaultBadgeText: {
    color: '#fff',
    fontSize: FontSizes.xs,
    fontWeight: '600',
  },
  templateDate: {
    fontSize: FontSizes.xs,
    opacity: 0.6,
    marginTop: 4,
  },
  templateSubject: {
    marginBottom: Spacing.sm,
  },
  subjectLabel: {
    fontSize: FontSizes.xs,
    opacity: 0.6,
    marginBottom: 2,
  },
  subjectText: {
    fontSize: FontSizes.sm,
    fontStyle: 'italic',
  },
  previewBox: {
    padding: Spacing.sm,
    borderRadius: BorderRadius.sm,
    marginBottom: Spacing.md,
  },
  previewText: {
    fontSize: FontSizes.xs,
    opacity: 0.7,
    lineHeight: 18,
  },
  templateActions: {
    flexDirection: 'row',
    gap: Spacing.sm,
  },
  actionButton: {
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderRadius: BorderRadius.md,
    flexDirection: 'row',
    alignItems: 'center',
  },
  actionButtonText: {
    color: '#fff',
    fontWeight: '600',
    fontSize: FontSizes.sm,
  },
  deleteButton: {
    backgroundColor: '#f44336',
  },
});
