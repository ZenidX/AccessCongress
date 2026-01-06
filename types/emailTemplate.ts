/**
 * Tipos para el sistema de plantillas de email
 */

/**
 * Plantilla de email almacenada en Firestore
 * Path: events/{eventId}/emailTemplates/{templateId}
 */
export interface EmailTemplate {
  id: string;
  eventId: string;
  name: string;                    // Nombre descriptivo: "Invitación Principal"
  subject: string;                 // Asunto con variables: "Bienvenido a {{evento.nombre}}"
  bodyHtml: string;                // Cuerpo HTML con variables
  isDefault: boolean;              // Si es la plantilla por defecto del evento
  createdAt: number;
  updatedAt: number;
  createdBy: string;               // UID del usuario que la creó
}

/**
 * Datos para crear una nueva plantilla
 */
export type CreateEmailTemplateData = Omit<EmailTemplate, 'id' | 'createdAt' | 'updatedAt'>;

/**
 * Datos para actualizar una plantilla
 */
export type UpdateEmailTemplateData = Partial<Omit<EmailTemplate, 'id' | 'eventId' | 'createdAt' | 'createdBy'>>;

/**
 * Registro de envío de email
 * Path: events/{eventId}/emailLogs/{logId}
 */
export interface EmailLog {
  id: string;
  eventId: string;
  templateId: string;
  participantDni: string;
  participantEmail: string;
  participantNombre: string;
  status: 'pending' | 'sent' | 'failed';
  resendMessageId?: string;        // ID de Resend para tracking
  sentAt?: number;
  error?: string;
  createdAt: number;
  createdBy: string;               // UID del operador
}

/**
 * Variable disponible para plantillas
 */
export interface EmailTemplateVariable {
  key: string;                     // Ej: "evento.nombre"
  label: string;                   // Ej: "Nombre del evento"
  category: 'evento' | 'participante' | 'qr';
  example: string;                 // Valor de ejemplo para preview
}

/**
 * Variables disponibles predefinidas para plantillas
 */
export const EMAIL_TEMPLATE_VARIABLES: EmailTemplateVariable[] = [
  // Evento
  { key: 'evento.nombre', label: 'Nombre del evento', category: 'evento', example: 'Congreso Educativo 2025' },
  { key: 'evento.fecha', label: 'Fecha del evento', category: 'evento', example: '15 de marzo de 2025' },
  { key: 'evento.ubicacion', label: 'Ubicación del evento', category: 'evento', example: 'Barcelona, España' },
  { key: 'evento.descripcion', label: 'Descripción del evento', category: 'evento', example: 'Evento anual de educación...' },

  // Participante
  { key: 'participante.nombre', label: 'Nombre completo', category: 'participante', example: 'Juan García Pérez' },
  { key: 'participante.email', label: 'Email', category: 'participante', example: 'juan@ejemplo.com' },
  { key: 'participante.dni', label: 'DNI', category: 'participante', example: '12345678A' },
  { key: 'participante.escuela', label: 'Escuela/Institución', category: 'participante', example: 'Escola ABC' },
  { key: 'participante.cargo', label: 'Cargo/Responsabilidad', category: 'participante', example: 'Director' },

  // QR
  { key: 'qr.url', label: 'URL del código QR', category: 'qr', example: 'https://api.qrserver.com/...' },
];

/**
 * Resultado del envío de un email individual
 */
export interface SendEmailResult {
  success: boolean;
  messageId?: string;
  error?: string;
}

/**
 * Resultado del envío masivo de emails
 */
export interface BulkSendResult {
  success: boolean;
  totalCount: number;
  sentCount: number;
  failedCount: number;
  errors: Array<{ dni: string; error: string }>;
}

/**
 * Opciones de filtrado para envío masivo
 */
export interface BulkSendFilterOptions {
  onlyWithEmail?: boolean;
  excludeAlreadySent?: boolean;
}

/**
 * Plantilla HTML por defecto para nuevas plantillas
 */
export const DEFAULT_EMAIL_TEMPLATE_HTML = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
  <div style="background-color: #00a4e1; padding: 20px; text-align: center;">
    <h1 style="color: white; margin: 0;">{{evento.nombre}}</h1>
  </div>

  <div style="padding: 20px;">
    <p>Estimado/a <strong>{{participante.nombre}}</strong>,</p>

    <p>Te confirmamos tu inscripción al evento <strong>{{evento.nombre}}</strong>.</p>

    <div style="background-color: #f5f5f5; padding: 15px; border-radius: 8px; margin: 20px 0;">
      <p style="margin: 5px 0;"><strong>Fecha:</strong> {{evento.fecha}}</p>
      <p style="margin: 5px 0;"><strong>Lugar:</strong> {{evento.ubicacion}}</p>
    </div>

    <h3 style="color: #00a4e1;">Tu código QR de acceso:</h3>
    <p style="text-align: center;">
      <img src="{{qr.url}}" alt="Código QR de acceso" width="200" style="border: 1px solid #ddd; padding: 10px;" />
    </p>
    <p style="text-align: center; color: #666; font-size: 14px;">
      Presenta este código QR en la entrada del evento
    </p>
  </div>

  <div style="border-top: 1px solid #eee; padding-top: 20px; margin-top: 20px; color: #666; font-size: 12px;">
    <p>Este email ha sido enviado automáticamente. Por favor, no respondas a este mensaje.</p>
    <p>© Impuls Educació - <a href="https://impulseducacio.org">impulseducacio.org</a></p>
  </div>
</body>
</html>
`.trim();
