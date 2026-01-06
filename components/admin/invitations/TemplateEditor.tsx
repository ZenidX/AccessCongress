/**
 * Editor de plantillas de email
 *
 * Permite editar el asunto y cuerpo HTML de una plantilla.
 * Incluye selector de variables y preview del email.
 */

import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Modal,
  Alert,
  Platform,
} from 'react-native';
import { WebView } from 'react-native-webview';
import { ThemedText } from '@/components/themed/themed-text';
import { Colors, BorderRadius, Spacing, Shadows, FontSizes } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import {
  EmailTemplate,
  EMAIL_TEMPLATE_VARIABLES,
  DEFAULT_EMAIL_TEMPLATE_HTML,
} from '@/types/emailTemplate';
import { Event } from '@/types/event';
import { VariableInserter } from './VariableInserter';

interface TemplateEditorProps {
  template: EmailTemplate | null;
  event: Event;
  onSave: (data: Partial<EmailTemplate>) => void;
  onCancel: () => void;
  loading: boolean;
}

export function TemplateEditor({
  template,
  event,
  onSave,
  onCancel,
  loading,
}: TemplateEditorProps) {
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme ?? 'light'];

  const [name, setName] = useState(template?.name || '');
  const [subject, setSubject] = useState(template?.subject || 'Invitación a {{evento.nombre}}');
  const [bodyHtml, setBodyHtml] = useState(template?.bodyHtml || DEFAULT_EMAIL_TEMPLATE_HTML);
  const [showVariables, setShowVariables] = useState(false);
  const [activeField, setActiveField] = useState<'subject' | 'body'>('body');
  const [showPreview, setShowPreview] = useState(false);

  // Referencias para los inputs
  const [subjectCursorPos, setSubjectCursorPos] = useState(0);
  const [bodyCursorPos, setBodyCursorPos] = useState(0);

  const insertVariable = (variable: string) => {
    const variableText = `{{${variable}}}`;

    if (activeField === 'subject') {
      const newSubject =
        subject.slice(0, subjectCursorPos) +
        variableText +
        subject.slice(subjectCursorPos);
      setSubject(newSubject);
    } else {
      const newBody =
        bodyHtml.slice(0, bodyCursorPos) +
        variableText +
        bodyHtml.slice(bodyCursorPos);
      setBodyHtml(newBody);
    }
    setShowVariables(false);
  };

  const handleSave = () => {
    if (!name.trim()) {
      Alert.alert('Error', 'El nombre de la plantilla es obligatorio');
      return;
    }
    if (!subject.trim()) {
      Alert.alert('Error', 'El asunto del email es obligatorio');
      return;
    }
    if (!bodyHtml.trim()) {
      Alert.alert('Error', 'El cuerpo del email es obligatorio');
      return;
    }

    onSave({
      name: name.trim(),
      subject: subject.trim(),
      bodyHtml: bodyHtml,
    });
  };

  // Generar preview reemplazando variables con ejemplos
  const getPreviewHtml = () => {
    let html = bodyHtml;
    let subjectPreview = subject;

    // Variables de ejemplo
    const examples: Record<string, string> = {
      'evento.nombre': event.name || 'Congreso Educativo',
      'evento.fecha': event.date
        ? new Date(event.date).toLocaleDateString('es-ES', {
            weekday: 'long',
            year: 'numeric',
            month: 'long',
            day: 'numeric',
          })
        : '15 de marzo de 2025',
      'evento.ubicacion': event.location || 'Barcelona',
      'evento.descripcion': event.description || 'Descripción del evento...',
      'participante.nombre': 'Juan García Pérez',
      'participante.email': 'juan@ejemplo.com',
      'participante.dni': '12345678A',
      'participante.escuela': 'Escola ABC',
      'participante.cargo': 'Director',
      'qr.url': `https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${event.id || 'event'}/12345678A`,
    };

    Object.entries(examples).forEach(([key, value]) => {
      const regex = new RegExp(`\\{\\{\\s*${key.replace('.', '\\.')}\\s*\\}\\}`, 'g');
      html = html.replace(regex, value);
      subjectPreview = subjectPreview.replace(regex, value);
    });

    return { html, subject: subjectPreview };
  };

  return (
    <ScrollView style={styles.container} showsVerticalScrollIndicator={false}>
      <ThemedText style={styles.title}>
        {template ? '✏️ Editar Plantilla' : '➕ Nueva Plantilla'}
      </ThemedText>

      {/* Nombre de la plantilla */}
      <View style={styles.field}>
        <ThemedText style={styles.label}>Nombre de la plantilla *</ThemedText>
        <TextInput
          style={[
            styles.input,
            { backgroundColor: colors.cardBackground, color: colors.text, borderColor: colors.border },
          ]}
          value={name}
          onChangeText={setName}
          placeholder="Ej: Invitación principal"
          placeholderTextColor={colors.text + '60'}
        />
      </View>

      {/* Asunto */}
      <View style={styles.field}>
        <View style={styles.labelRow}>
          <ThemedText style={styles.label}>Asunto del email *</ThemedText>
          <TouchableOpacity
            onPress={() => {
              setActiveField('subject');
              setShowVariables(true);
            }}
            style={[styles.insertVarButton, { backgroundColor: colors.primary + '20' }]}
          >
            <Text style={[styles.insertVarButtonText, { color: colors.primary }]}>+ Variable</Text>
          </TouchableOpacity>
        </View>
        <TextInput
          style={[
            styles.input,
            { backgroundColor: colors.cardBackground, color: colors.text, borderColor: colors.border },
          ]}
          value={subject}
          onChangeText={setSubject}
          placeholder="Ej: Invitación a {{evento.nombre}}"
          placeholderTextColor={colors.text + '60'}
          onFocus={() => setActiveField('subject')}
          onSelectionChange={(e) => setSubjectCursorPos(e.nativeEvent.selection.start)}
        />
      </View>

      {/* Editor de cuerpo */}
      <View style={styles.field}>
        <View style={styles.labelRow}>
          <ThemedText style={styles.label}>Cuerpo del email (HTML)</ThemedText>
          <View style={styles.labelButtons}>
            <TouchableOpacity
              onPress={() => {
                setActiveField('body');
                setShowVariables(true);
              }}
              style={[styles.insertVarButton, { backgroundColor: colors.primary + '20' }]}
            >
              <Text style={[styles.insertVarButtonText, { color: colors.primary }]}>+ Variable</Text>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={() => setShowPreview(true)}
              style={[styles.previewButton, { backgroundColor: colors.success + '20' }]}
            >
              <Text style={[styles.previewButtonText, { color: colors.success }]}>👁️ Preview</Text>
            </TouchableOpacity>
          </View>
        </View>

        <TextInput
          style={[
            styles.textArea,
            { backgroundColor: colors.cardBackground, color: colors.text, borderColor: colors.border },
          ]}
          value={bodyHtml}
          onChangeText={setBodyHtml}
          placeholder="Escribe el contenido HTML del email..."
          placeholderTextColor={colors.text + '60'}
          multiline
          numberOfLines={Platform.OS === 'web' ? 20 : undefined}
          textAlignVertical="top"
          onFocus={() => setActiveField('body')}
          onSelectionChange={(e) => setBodyCursorPos(e.nativeEvent.selection.start)}
        />
      </View>

      {/* Ayuda de QR */}
      <View style={[styles.helpBox, { backgroundColor: colors.primary + '10' }]}>
        <ThemedText style={[styles.helpTitle, { color: colors.primary }]}>
          💡 Para incluir el código QR:
        </ThemedText>
        <ThemedText style={styles.helpText}>
          Usa la variable {'{{qr.url}}'} como src de una imagen:{'\n'}
          <Text style={styles.codeText}>{'<img src="{{qr.url}}" alt="QR" width="200" />'}</Text>
        </ThemedText>
      </View>

      {/* Variables comunes */}
      <View style={[styles.helpBox, { backgroundColor: colors.cardBackground }]}>
        <ThemedText style={styles.helpTitle}>📋 Variables disponibles:</ThemedText>
        <View style={styles.variableChips}>
          {EMAIL_TEMPLATE_VARIABLES.slice(0, 6).map((v) => (
            <TouchableOpacity
              key={v.key}
              style={[styles.variableChip, { backgroundColor: colors.background }]}
              onPress={() => insertVariable(v.key)}
            >
              <Text style={[styles.variableChipText, { color: colors.text }]}>
                {`{{${v.key}}}`}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>

      {/* Botones */}
      <View style={styles.actions}>
        <TouchableOpacity
          style={[styles.button, styles.cancelButton, { borderColor: colors.border }]}
          onPress={onCancel}
          disabled={loading}
        >
          <Text style={[styles.cancelButtonText, { color: colors.text }]}>Cancelar</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.button, styles.saveButton, { backgroundColor: colors.success }]}
          onPress={handleSave}
          disabled={loading}
        >
          <Text style={styles.saveButtonText}>
            {loading ? 'Guardando...' : '💾 Guardar Plantilla'}
          </Text>
        </TouchableOpacity>
      </View>

      {/* Vista previa inline - click para ampliar */}
      <TouchableOpacity
        style={[styles.inlinePreviewContainer, { borderColor: colors.border }]}
        onPress={() => setShowPreview(true)}
        activeOpacity={0.8}
      >
        <View style={styles.inlinePreviewHeader}>
          <ThemedText style={styles.inlinePreviewTitle}>👁️ Vista Previa</ThemedText>
          <Text style={[styles.inlinePreviewHint, { color: colors.primary }]}>
            Toca para ampliar
          </Text>
        </View>

        <View style={[styles.inlinePreviewSubject, { borderColor: colors.border }]}>
          <Text style={[styles.inlinePreviewSubjectLabel, { color: colors.text + '80' }]}>
            Asunto:
          </Text>
          <ThemedText style={styles.inlinePreviewSubjectText} numberOfLines={1}>
            {getPreviewHtml().subject}
          </ThemedText>
        </View>

        <View style={styles.inlinePreviewBody}>
          {Platform.OS === 'web' ? (
            <div
              style={{
                padding: 12,
                backgroundColor: '#fff',
                borderRadius: 8,
                pointerEvents: 'none',
              }}
              dangerouslySetInnerHTML={{ __html: getPreviewHtml().html }}
            />
          ) : (
            <View style={styles.inlinePreviewWebView}>
              <WebView
                source={{ html: wrapHtmlForPreview(getPreviewHtml().html) }}
                style={styles.webView}
                scrollEnabled={false}
                scalesPageToFit={false}
                showsVerticalScrollIndicator={false}
              />
            </View>
          )}
        </View>
      </TouchableOpacity>

      {/* Modal de variables */}
      <VariableInserter
        visible={showVariables}
        onClose={() => setShowVariables(false)}
        onSelect={insertVariable}
      />

      {/* Modal de preview */}
      <Modal visible={showPreview} animationType="slide" transparent>
        <View style={styles.previewOverlay}>
          <View style={[styles.previewContainer, { backgroundColor: colors.cardBackground }]}>
            <View style={styles.previewHeader}>
              <ThemedText style={styles.previewTitle}>👁️ Vista Previa</ThemedText>
              <TouchableOpacity onPress={() => setShowPreview(false)}>
                <Text style={styles.closeButton}>✕</Text>
              </TouchableOpacity>
            </View>

            <View style={styles.previewSubject}>
              <ThemedText style={styles.previewLabel}>Asunto:</ThemedText>
              <ThemedText style={styles.previewSubjectText}>{getPreviewHtml().subject}</ThemedText>
            </View>

            <View style={styles.previewContent}>
              {Platform.OS === 'web' ? (
                <ScrollView style={{ flex: 1 }}>
                  <div
                    style={{ padding: 16, backgroundColor: '#fff' }}
                    dangerouslySetInnerHTML={{ __html: getPreviewHtml().html }}
                  />
                </ScrollView>
              ) : (
                <WebView
                  source={{ html: wrapHtmlForPreview(getPreviewHtml().html) }}
                  style={styles.modalWebView}
                  scalesPageToFit={false}
                  showsVerticalScrollIndicator={true}
                />
              )}
            </View>
          </View>
        </View>
      </Modal>
    </ScrollView>
  );
}

function stripHtml(html: string): string {
  return html
    .replace(/<[^>]*>/g, '\n')
    .replace(/\n+/g, '\n')
    .trim();
}

/**
 * Wraps HTML content for WebView preview with proper viewport and base styles
 */
function wrapHtmlForPreview(html: string): string {
  return `
    <!DOCTYPE html>
    <html>
      <head>
        <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0">
        <style>
          body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            font-size: 14px;
            line-height: 1.5;
            color: #333;
            padding: 12px;
            margin: 0;
            background-color: #fff;
          }
          img {
            max-width: 100%;
            height: auto;
          }
          table {
            width: 100% !important;
          }
        </style>
      </head>
      <body>
        ${html}
      </body>
    </html>
  `;
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  title: {
    fontSize: FontSizes.xl,
    fontWeight: 'bold',
    marginBottom: Spacing.lg,
  },
  field: {
    marginBottom: Spacing.md,
  },
  label: {
    fontSize: FontSizes.sm,
    fontWeight: '600',
    marginBottom: Spacing.xs,
  },
  labelRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: Spacing.xs,
  },
  labelButtons: {
    flexDirection: 'row',
    gap: Spacing.sm,
  },
  input: {
    borderWidth: 1,
    borderRadius: BorderRadius.md,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    fontSize: FontSizes.md,
  },
  textArea: {
    borderWidth: 1,
    borderRadius: BorderRadius.md,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    fontSize: FontSizes.sm,
    fontFamily: Platform.OS === 'web' ? 'monospace' : undefined,
    minHeight: 300,
  },
  insertVarButton: {
    paddingHorizontal: Spacing.sm,
    paddingVertical: 4,
    borderRadius: BorderRadius.sm,
  },
  insertVarButtonText: {
    fontSize: FontSizes.xs,
    fontWeight: '600',
  },
  previewButton: {
    paddingHorizontal: Spacing.sm,
    paddingVertical: 4,
    borderRadius: BorderRadius.sm,
  },
  previewButtonText: {
    fontSize: FontSizes.xs,
    fontWeight: '600',
  },
  helpBox: {
    padding: Spacing.md,
    borderRadius: BorderRadius.md,
    marginBottom: Spacing.md,
  },
  helpTitle: {
    fontSize: FontSizes.sm,
    fontWeight: '600',
    marginBottom: Spacing.xs,
  },
  helpText: {
    fontSize: FontSizes.xs,
    lineHeight: 18,
  },
  codeText: {
    fontFamily: Platform.OS === 'web' ? 'monospace' : undefined,
    backgroundColor: 'rgba(0,0,0,0.05)',
  },
  variableChips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.xs,
    marginTop: Spacing.xs,
  },
  variableChip: {
    paddingHorizontal: Spacing.sm,
    paddingVertical: 4,
    borderRadius: BorderRadius.sm,
  },
  variableChipText: {
    fontSize: FontSizes.xs,
    fontFamily: Platform.OS === 'web' ? 'monospace' : undefined,
  },
  actions: {
    flexDirection: 'row',
    gap: Spacing.md,
    marginTop: Spacing.lg,
    marginBottom: Spacing.xl,
  },
  button: {
    flex: 1,
    paddingVertical: Spacing.md,
    borderRadius: BorderRadius.md,
    alignItems: 'center',
  },
  cancelButton: {
    borderWidth: 1,
  },
  cancelButtonText: {
    fontSize: FontSizes.md,
    fontWeight: '600',
  },
  saveButton: {},
  saveButtonText: {
    color: '#fff',
    fontSize: FontSizes.md,
    fontWeight: '600',
  },
  previewOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    padding: Spacing.md,
  },
  previewContainer: {
    flex: 1,
    maxHeight: '90%',
    borderRadius: BorderRadius.lg,
    ...Shadows.medium,
  },
  previewHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: Spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  previewTitle: {
    fontSize: FontSizes.lg,
    fontWeight: 'bold',
  },
  closeButton: {
    fontSize: 24,
    padding: Spacing.sm,
  },
  previewSubject: {
    padding: Spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  previewLabel: {
    fontSize: FontSizes.xs,
    opacity: 0.6,
    marginBottom: 4,
  },
  previewSubjectText: {
    fontSize: FontSizes.md,
    fontWeight: '600',
  },
  previewContent: {
    flex: 1,
  },
  previewBox: {
    padding: Spacing.md,
  },
  previewNote: {
    fontSize: FontSizes.xs,
    fontStyle: 'italic',
    opacity: 0.6,
    marginBottom: Spacing.md,
  },
  previewTextContent: {
    fontSize: FontSizes.sm,
    lineHeight: 22,
  },
  // Inline preview styles
  inlinePreviewContainer: {
    borderWidth: 1,
    borderRadius: BorderRadius.lg,
    marginBottom: Spacing.xl,
    overflow: 'hidden',
  },
  inlinePreviewHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: Spacing.md,
    backgroundColor: 'rgba(0,0,0,0.03)',
  },
  inlinePreviewTitle: {
    fontSize: FontSizes.md,
    fontWeight: '600',
  },
  inlinePreviewHint: {
    fontSize: FontSizes.xs,
  },
  inlinePreviewSubject: {
    padding: Spacing.md,
    borderBottomWidth: 1,
    backgroundColor: 'rgba(0,0,0,0.01)',
  },
  inlinePreviewSubjectLabel: {
    fontSize: FontSizes.xs,
    marginBottom: 2,
  },
  inlinePreviewSubjectText: {
    fontSize: FontSizes.sm,
    fontWeight: '600',
  },
  inlinePreviewBody: {
    // Sin maxHeight - el alto depende del contenido
  },
  inlinePreviewBodyContent: {
    padding: Spacing.md,
    backgroundColor: '#fff',
  },
  inlinePreviewBodyText: {
    fontSize: FontSizes.sm,
    lineHeight: 20,
  },
  inlinePreviewWebView: {
    minHeight: 200,
    backgroundColor: '#fff',
    borderBottomLeftRadius: BorderRadius.lg,
    borderBottomRightRadius: BorderRadius.lg,
    overflow: 'hidden',
  },
  webView: {
    flex: 1,
    minHeight: 200,
    backgroundColor: '#fff',
  },
  modalWebView: {
    flex: 1,
    backgroundColor: '#fff',
  },
});
