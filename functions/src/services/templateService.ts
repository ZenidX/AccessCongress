/**
 * Servicio de procesamiento de plantillas de email
 * Reemplaza variables {{variable}} con valores reales
 */

interface EventData {
  name?: string;
  date?: number;
  endDate?: number;
  location?: string;
  description?: string;
}

interface ParticipantData {
  dni?: string;
  nombre?: string;
  email?: string;
  telefono?: string;
  escuela?: string;
  cargo?: string;
}

/**
 * Formatea un timestamp Unix a fecha legible en español
 */
function formatDate(timestamp: number): string {
  return new Date(timestamp).toLocaleDateString('es-ES', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
}

/**
 * Procesa una plantilla reemplazando todas las variables
 * @param template - Plantilla con subject y bodyHtml
 * @param event - Datos del evento
 * @param participant - Datos del participante
 * @param qrUrl - URL del código QR generado
 * @returns Objeto con subject y html procesados
 */
export function processTemplate(
  template: { subject: string; bodyHtml: string },
  event: EventData,
  participant: ParticipantData,
  qrUrl: string
): { subject: string; html: string } {
  // Mapa de variables disponibles
  const variables: Record<string, string> = {
    'evento.nombre': event.name || '',
    'evento.fecha': event.date ? formatDate(event.date) : '',
    'evento.ubicacion': event.location || '',
    'evento.descripcion': event.description || '',
    'participante.nombre': participant.nombre || '',
    'participante.email': participant.email || '',
    'participante.dni': participant.dni || '',
    'participante.telefono': participant.telefono || '',
    'participante.escuela': participant.escuela || '',
    'participante.cargo': participant.cargo || '',
    'qr.url': qrUrl,
  };

  let subject = template.subject;
  let html = template.bodyHtml;

  // Reemplazar todas las variables {{variable}}
  Object.entries(variables).forEach(([key, value]) => {
    // Regex que permite espacios opcionales dentro de las llaves
    const regex = new RegExp(`\\{\\{\\s*${key.replace('.', '\\.')}\\s*\\}\\}`, 'g');
    subject = subject.replace(regex, value);
    html = html.replace(regex, value);
  });

  return { subject, html };
}

/**
 * Genera una plantilla HTML por defecto
 */
export function getDefaultTemplateHtml(): string {
  return `
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
}
