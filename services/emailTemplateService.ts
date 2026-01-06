/**
 * Servicio de plantillas de email - CRUD en Firestore
 * Path: events/{eventId}/emailTemplates/{templateId}
 */

import {
  collection,
  doc,
  getDocs,
  getDoc,
  addDoc,
  updateDoc,
  deleteDoc,
  query,
  where,
  orderBy,
  writeBatch,
} from 'firebase/firestore';
import { db } from '@/config/firebase';
import {
  EmailTemplate,
  CreateEmailTemplateData,
  UpdateEmailTemplateData,
  EmailLog,
} from '@/types/emailTemplate';

/**
 * Obtiene todas las plantillas de un evento
 */
export async function getTemplatesByEvent(eventId: string): Promise<EmailTemplate[]> {
  const templatesRef = collection(db, `events/${eventId}/emailTemplates`);
  const q = query(templatesRef, orderBy('createdAt', 'desc'));
  const snapshot = await getDocs(q);

  return snapshot.docs.map((doc) => ({
    id: doc.id,
    ...doc.data(),
  })) as EmailTemplate[];
}

/**
 * Obtiene una plantilla específica
 */
export async function getTemplate(eventId: string, templateId: string): Promise<EmailTemplate | null> {
  const templateRef = doc(db, `events/${eventId}/emailTemplates/${templateId}`);
  const snapshot = await getDoc(templateRef);

  if (!snapshot.exists()) {
    return null;
  }

  return {
    id: snapshot.id,
    ...snapshot.data(),
  } as EmailTemplate;
}

/**
 * Obtiene la plantilla por defecto de un evento
 */
export async function getDefaultTemplate(eventId: string): Promise<EmailTemplate | null> {
  const templatesRef = collection(db, `events/${eventId}/emailTemplates`);
  const q = query(templatesRef, where('isDefault', '==', true));
  const snapshot = await getDocs(q);

  if (snapshot.empty) {
    return null;
  }

  const doc = snapshot.docs[0];
  return {
    id: doc.id,
    ...doc.data(),
  } as EmailTemplate;
}

/**
 * Crea una nueva plantilla
 */
export async function createTemplate(data: CreateEmailTemplateData): Promise<EmailTemplate> {
  const { eventId, ...templateData } = data;
  const templatesRef = collection(db, `events/${eventId}/emailTemplates`);

  const now = Date.now();
  const newTemplate = {
    ...templateData,
    eventId,
    createdAt: now,
    updatedAt: now,
  };

  // Si es la primera plantilla o se marca como default, actualizar otras
  if (newTemplate.isDefault) {
    await clearDefaultTemplates(eventId);
  }

  const docRef = await addDoc(templatesRef, newTemplate);

  return {
    id: docRef.id,
    ...newTemplate,
  } as EmailTemplate;
}

/**
 * Actualiza una plantilla existente
 */
export async function updateTemplate(
  eventId: string,
  templateId: string,
  data: UpdateEmailTemplateData
): Promise<void> {
  const templateRef = doc(db, `events/${eventId}/emailTemplates/${templateId}`);

  // Si se marca como default, limpiar otras
  if (data.isDefault) {
    await clearDefaultTemplates(eventId, templateId);
  }

  await updateDoc(templateRef, {
    ...data,
    updatedAt: Date.now(),
  });
}

/**
 * Elimina una plantilla
 */
export async function deleteTemplate(eventId: string, templateId: string): Promise<void> {
  const templateRef = doc(db, `events/${eventId}/emailTemplates/${templateId}`);
  await deleteDoc(templateRef);
}

/**
 * Establece una plantilla como por defecto
 */
export async function setDefaultTemplate(eventId: string, templateId: string): Promise<void> {
  // Limpiar otros defaults
  await clearDefaultTemplates(eventId, templateId);

  // Establecer este como default
  const templateRef = doc(db, `events/${eventId}/emailTemplates/${templateId}`);
  await updateDoc(templateRef, {
    isDefault: true,
    updatedAt: Date.now(),
  });
}

/**
 * Limpia el flag isDefault de todas las plantillas excepto la especificada
 */
async function clearDefaultTemplates(eventId: string, excludeTemplateId?: string): Promise<void> {
  const templatesRef = collection(db, `events/${eventId}/emailTemplates`);
  const q = query(templatesRef, where('isDefault', '==', true));
  const snapshot = await getDocs(q);

  const batch = writeBatch(db);
  snapshot.docs.forEach((docSnap) => {
    if (docSnap.id !== excludeTemplateId) {
      batch.update(docSnap.ref, { isDefault: false, updatedAt: Date.now() });
    }
  });

  await batch.commit();
}

/**
 * Obtiene los logs de envío de email de un evento
 */
export async function getEmailLogs(eventId: string, limit: number = 100): Promise<EmailLog[]> {
  const logsRef = collection(db, `events/${eventId}/emailLogs`);
  const q = query(logsRef, orderBy('createdAt', 'desc'));
  const snapshot = await getDocs(q);

  return snapshot.docs.slice(0, limit).map((doc) => ({
    id: doc.id,
    ...doc.data(),
  })) as EmailLog[];
}

/**
 * Obtiene los logs de envío para un participante específico
 */
export async function getEmailLogsByParticipant(
  eventId: string,
  participantDni: string
): Promise<EmailLog[]> {
  const logsRef = collection(db, `events/${eventId}/emailLogs`);
  const q = query(
    logsRef,
    where('participantDni', '==', participantDni),
    orderBy('createdAt', 'desc')
  );
  const snapshot = await getDocs(q);

  return snapshot.docs.map((doc) => ({
    id: doc.id,
    ...doc.data(),
  })) as EmailLog[];
}

/**
 * Verifica si un participante ya recibió un email
 */
export async function hasParticipantReceivedEmail(
  eventId: string,
  participantDni: string
): Promise<boolean> {
  const logsRef = collection(db, `events/${eventId}/emailLogs`);
  const q = query(
    logsRef,
    where('participantDni', '==', participantDni),
    where('status', '==', 'sent')
  );
  const snapshot = await getDocs(q);

  return !snapshot.empty;
}
