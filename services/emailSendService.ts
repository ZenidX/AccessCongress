/**
 * Servicio de envío de emails - Llama a Cloud Functions
 */

import { getFunctions, httpsCallable, connectFunctionsEmulator } from 'firebase/functions';
import app from '@/config/firebase';
import {
  SendEmailResult,
  BulkSendResult,
  BulkSendFilterOptions,
} from '@/types/emailTemplate';

// Obtener instancia de functions en la región europe-west1
const functions = getFunctions(app, 'europe-west1');

// Descomentar para desarrollo local con emulador
// connectFunctionsEmulator(functions, 'localhost', 5001);

/**
 * Envía un email a un participante específico
 * @param eventId - ID del evento
 * @param participantDni - DNI del participante
 * @param templateId - ID de la plantilla (opcional, usa la default si no se especifica)
 */
export async function sendEmailToParticipant(
  eventId: string,
  participantDni: string,
  templateId?: string
): Promise<SendEmailResult> {
  try {
    const sendEmail = httpsCallable<
      { eventId: string; participantDni: string; templateId?: string },
      SendEmailResult
    >(functions, 'sendSingleEmail');

    const result = await sendEmail({
      eventId,
      participantDni,
      templateId,
    });

    return result.data;
  } catch (error: any) {
    console.error('Error calling sendSingleEmail:', error);

    // Extraer mensaje de error de Firebase Functions
    const message = error.message || 'Error desconocido al enviar email';
    return {
      success: false,
      error: message,
    };
  }
}

/**
 * Envía emails a todos los participantes con email de un evento
 * @param eventId - ID del evento
 * @param templateId - ID de la plantilla (opcional, usa la default si no se especifica)
 * @param filterOptions - Opciones de filtrado
 */
export async function sendBulkEmails(
  eventId: string,
  templateId?: string,
  filterOptions?: BulkSendFilterOptions
): Promise<BulkSendResult> {
  try {
    const sendBulk = httpsCallable<
      {
        eventId: string;
        templateId?: string;
        filterOptions?: BulkSendFilterOptions;
      },
      BulkSendResult
    >(functions, 'sendBulkEmail');

    const result = await sendBulk({
      eventId,
      templateId,
      filterOptions,
    });

    return result.data;
  } catch (error: any) {
    console.error('Error calling sendBulkEmail:', error);

    // Extraer mensaje de error de Firebase Functions
    const message = error.message || 'Error desconocido al enviar emails';
    return {
      success: false,
      totalCount: 0,
      sentCount: 0,
      failedCount: 0,
      errors: [{ dni: '', error: message }],
    };
  }
}

/**
 * Genera la URL de un código QR (para preview en el frontend)
 * @param eventId - ID del evento
 * @param participantDni - DNI del participante
 * @param size - Tamaño en píxeles (default 200)
 */
export function generateQRPreviewUrl(
  eventId: string,
  participantDni: string,
  size: number = 200
): string {
  const content = `${eventId}/${participantDni}`;
  const encodedContent = encodeURIComponent(content);
  return `https://api.qrserver.com/v1/create-qr-code/?size=${size}x${size}&data=${encodedContent}&format=png`;
}
