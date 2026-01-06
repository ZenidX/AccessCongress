/**
 * Cloud Function: Enviar emails a todos los participantes de un evento
 */

import { onCall, HttpsError } from 'firebase-functions/v2/https';
import { sendBulkEmails } from '../services/emailService';

export const sendBulkEmail = onCall(
  {
    region: 'europe-west1',
    secrets: ['RESEND_API_KEY'],
    timeoutSeconds: 540, // 9 minutos para procesar muchos emails
    memory: '512MiB',
  },
  async (request) => {
    // Verificar autenticación
    if (!request.auth) {
      throw new HttpsError('unauthenticated', 'Usuario no autenticado');
    }

    const { eventId, templateId, filterOptions } = request.data;

    // Validar parámetros requeridos
    if (!eventId) {
      throw new HttpsError('invalid-argument', 'eventId es requerido');
    }

    // Obtener API key del secreto
    const apiKey = process.env.RESEND_API_KEY;
    if (!apiKey) {
      throw new HttpsError('internal', 'API key de Resend no configurada');
    }

    try {
      const result = await sendBulkEmails(
        eventId,
        templateId || null,
        request.auth.uid,
        apiKey,
        filterOptions
      );

      return result;
    } catch (error: any) {
      console.error('Error sending bulk emails:', error);
      throw new HttpsError('internal', error.message || 'Error al enviar emails');
    }
  }
);
