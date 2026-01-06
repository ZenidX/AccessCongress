/**
 * Cloud Function: Enviar email a un participante específico
 */

import { onCall, HttpsError } from 'firebase-functions/v2/https';
import { sendEmailToParticipant } from '../services/emailService';

export const sendSingleEmail = onCall(
  {
    region: 'europe-west1',
    secrets: ['RESEND_API_KEY'],
  },
  async (request) => {
    // Verificar autenticación
    if (!request.auth) {
      throw new HttpsError('unauthenticated', 'Usuario no autenticado');
    }

    const { eventId, participantDni, templateId } = request.data;

    // Validar parámetros requeridos
    if (!eventId) {
      throw new HttpsError('invalid-argument', 'eventId es requerido');
    }
    if (!participantDni) {
      throw new HttpsError('invalid-argument', 'participantDni es requerido');
    }

    // Obtener API key del secreto
    const apiKey = process.env.RESEND_API_KEY;
    if (!apiKey) {
      throw new HttpsError('internal', 'API key de Resend no configurada');
    }

    try {
      const result = await sendEmailToParticipant(
        eventId,
        participantDni,
        templateId || null,
        request.auth.uid,
        apiKey
      );

      return result;
    } catch (error: any) {
      console.error('Error sending email:', error);
      throw new HttpsError('internal', error.message || 'Error al enviar email');
    }
  }
);
