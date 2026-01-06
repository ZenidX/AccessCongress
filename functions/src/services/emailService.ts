/**
 * Servicio de envío de emails con Resend
 */

import { Resend } from 'resend';
import * as admin from 'firebase-admin';
import { processTemplate } from './templateService';
import { generateQRUrl } from './qrService';

const db = admin.firestore();

// Configuración del remitente
// En desarrollo usa el dominio de prueba de Resend
// En producción, cambiar a un dominio verificado
const FROM_EMAIL = 'AccessCongress <onboarding@resend.dev>';

interface SendEmailResult {
  success: boolean;
  messageId?: string;
  error?: string;
}

interface BulkSendResult {
  success: boolean;
  totalCount: number;
  sentCount: number;
  failedCount: number;
  errors: Array<{ dni: string; error: string }>;
}

/**
 * Envía un email a un participante específico
 */
export async function sendEmailToParticipant(
  eventId: string,
  participantDni: string,
  templateId: string | null,
  operatorUid: string,
  apiKey: string
): Promise<SendEmailResult> {
  const resend = new Resend(apiKey);

  try {
    // Obtener datos del evento
    const eventDoc = await db.collection('events').doc(eventId).get();
    if (!eventDoc.exists) {
      throw new Error('Evento no encontrado');
    }
    const event = eventDoc.data()!;

    // Obtener participante
    const participantDoc = await db
      .collection(`events/${eventId}/participants`)
      .doc(participantDni)
      .get();
    if (!participantDoc.exists) {
      throw new Error('Participante no encontrado');
    }
    const participant = participantDoc.data()!;

    if (!participant.email) {
      throw new Error('El participante no tiene email registrado');
    }

    // Obtener plantilla
    let template: any;
    if (templateId) {
      const templateDoc = await db
        .collection(`events/${eventId}/emailTemplates`)
        .doc(templateId)
        .get();
      if (!templateDoc.exists) {
        throw new Error('Plantilla no encontrada');
      }
      template = { id: templateDoc.id, ...templateDoc.data() };
    } else {
      // Buscar plantilla por defecto
      const templatesSnap = await db
        .collection(`events/${eventId}/emailTemplates`)
        .where('isDefault', '==', true)
        .limit(1)
        .get();

      if (templatesSnap.empty) {
        throw new Error('No hay plantilla de email configurada para este evento. Crea una plantilla primero.');
      }
      template = { id: templatesSnap.docs[0].id, ...templatesSnap.docs[0].data() };
    }

    // Generar URL del QR
    const qrContent = `${eventId}/${participantDni}`;
    const qrUrl = generateQRUrl(qrContent, 200);

    // Procesar plantilla con variables
    const { subject, html } = processTemplate(template, event, participant, qrUrl);

    // Enviar email
    const result = await resend.emails.send({
      from: FROM_EMAIL,
      to: participant.email,
      subject: subject,
      html: html,
    });

    // Registrar envío exitoso
    await db.collection(`events/${eventId}/emailLogs`).add({
      eventId,
      templateId: template.id,
      participantDni,
      participantEmail: participant.email,
      participantNombre: participant.nombre || '',
      status: 'sent',
      resendMessageId: result.data?.id,
      sentAt: Date.now(),
      createdAt: Date.now(),
      createdBy: operatorUid,
    });

    return { success: true, messageId: result.data?.id };

  } catch (error: any) {
    // Registrar error
    await db.collection(`events/${eventId}/emailLogs`).add({
      eventId,
      templateId: templateId || 'default',
      participantDni,
      participantEmail: '',
      participantNombre: '',
      status: 'failed',
      error: error.message,
      createdAt: Date.now(),
      createdBy: operatorUid,
    });

    return { success: false, error: error.message };
  }
}

/**
 * Envía emails a todos los participantes con email de un evento
 */
export async function sendBulkEmails(
  eventId: string,
  templateId: string | null,
  operatorUid: string,
  apiKey: string,
  filterOptions?: { onlyWithEmail?: boolean; excludeAlreadySent?: boolean }
): Promise<BulkSendResult> {
  const results: BulkSendResult = {
    success: true,
    totalCount: 0,
    sentCount: 0,
    failedCount: 0,
    errors: [],
  };

  try {
    // Obtener todos los participantes con email
    let query = db.collection(`events/${eventId}/participants`);
    const participantsSnap = await query.get();

    const participantsWithEmail = participantsSnap.docs.filter(
      (doc) => doc.data().email && doc.data().email.trim() !== ''
    );

    results.totalCount = participantsWithEmail.length;

    if (results.totalCount === 0) {
      return {
        ...results,
        success: false,
        errors: [{ dni: '', error: 'No hay participantes con email' }],
      };
    }

    // Si se solicita excluir ya enviados, obtener lista de DNIs ya enviados
    let alreadySentDnis = new Set<string>();
    if (filterOptions?.excludeAlreadySent) {
      const logsSnap = await db
        .collection(`events/${eventId}/emailLogs`)
        .where('status', '==', 'sent')
        .get();
      logsSnap.docs.forEach((doc) => {
        alreadySentDnis.add(doc.data().participantDni);
      });
    }

    // Enviar emails uno por uno (con delay para evitar rate limiting)
    for (const doc of participantsWithEmail) {
      const dni = doc.id;

      // Saltar si ya se envió
      if (filterOptions?.excludeAlreadySent && alreadySentDnis.has(dni)) {
        continue;
      }

      try {
        const result = await sendEmailToParticipant(
          eventId,
          dni,
          templateId,
          operatorUid,
          apiKey
        );

        if (result.success) {
          results.sentCount++;
        } else {
          results.failedCount++;
          results.errors.push({ dni, error: result.error || 'Error desconocido' });
        }

        // Pequeño delay para evitar rate limiting (100ms entre emails)
        await new Promise((resolve) => setTimeout(resolve, 100));

      } catch (error: any) {
        results.failedCount++;
        results.errors.push({ dni, error: error.message });
      }
    }

    results.success = results.failedCount === 0;
    return results;

  } catch (error: any) {
    return {
      ...results,
      success: false,
      errors: [{ dni: '', error: error.message }],
    };
  }
}
