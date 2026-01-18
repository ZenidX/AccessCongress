/**
 * Cloud Function: Sincronizar eventos con controladores
 *
 * Cuando se crea un evento, automáticamente se asigna a todos
 * los controladores de la misma organización.
 *
 * Cuando se elimina un evento, se quita de los controladores asignados.
 */

import { onDocumentCreated, onDocumentDeleted } from 'firebase-functions/v2/firestore';
import * as admin from 'firebase-admin';

const USERS_COLLECTION = 'users';

/**
 * Cuando se crea un evento, asignarlo a todos los controladores de la organización
 */
export const onEventCreated = onDocumentCreated(
  {
    document: 'events/{eventId}',
    region: 'europe-west1',
  },
  async (event) => {
    const eventId = event.params.eventId;
    const eventData = event.data?.data();

    if (!eventData) {
      console.log('❌ No hay datos del evento');
      return;
    }

    const organizationId = eventData.organizationId;
    if (!organizationId) {
      console.log('⚠️ Evento sin organizationId, no se asigna a controladores');
      return;
    }

    console.log(`📅 Nuevo evento creado: ${eventId} en organización ${organizationId}`);

    const db = admin.firestore();

    // Buscar todos los controladores de esta organización
    const controllersSnapshot = await db
      .collection(USERS_COLLECTION)
      .where('organizationId', '==', organizationId)
      .where('role', '==', 'controlador')
      .get();

    if (controllersSnapshot.empty) {
      console.log('ℹ️ No hay controladores en esta organización');
      return;
    }

    console.log(`👥 Encontrados ${controllersSnapshot.size} controladores`);

    // Actualizar cada controlador
    const batch = db.batch();
    const updatedControllers: string[] = [];

    for (const controllerDoc of controllersSnapshot.docs) {
      const controllerRef = db.collection(USERS_COLLECTION).doc(controllerDoc.id);
      const currentEvents = controllerDoc.data().assignedEventIds || [];

      // Solo añadir si no está ya asignado
      if (!currentEvents.includes(eventId)) {
        batch.update(controllerRef, {
          assignedEventIds: admin.firestore.FieldValue.arrayUnion(eventId),
          updatedAt: Date.now(),
        });
        updatedControllers.push(controllerDoc.data().email || controllerDoc.id);
      }
    }

    if (updatedControllers.length > 0) {
      await batch.commit();
      console.log(`✅ Evento asignado a ${updatedControllers.length} controladores:`, updatedControllers);
    } else {
      console.log('ℹ️ Todos los controladores ya tenían el evento asignado');
    }
  }
);

/**
 * Cuando se elimina un evento, quitarlo de todos los usuarios que lo tenían asignado
 */
export const onEventDeleted = onDocumentDeleted(
  {
    document: 'events/{eventId}',
    region: 'europe-west1',
  },
  async (event) => {
    const eventId = event.params.eventId;

    console.log(`🗑️ Evento eliminado: ${eventId}`);

    const db = admin.firestore();

    // Buscar todos los usuarios que tienen este evento asignado
    const usersSnapshot = await db
      .collection(USERS_COLLECTION)
      .where('assignedEventIds', 'array-contains', eventId)
      .get();

    if (usersSnapshot.empty) {
      console.log('ℹ️ Ningún usuario tenía este evento asignado');
      return;
    }

    console.log(`👥 Encontrados ${usersSnapshot.size} usuarios con el evento asignado`);

    // Quitar el evento de cada usuario
    const batch = db.batch();
    const updatedUsers: string[] = [];

    for (const userDoc of usersSnapshot.docs) {
      const userRef = db.collection(USERS_COLLECTION).doc(userDoc.id);
      batch.update(userRef, {
        assignedEventIds: admin.firestore.FieldValue.arrayRemove(eventId),
        updatedAt: Date.now(),
      });
      updatedUsers.push(userDoc.data().email || userDoc.id);
    }

    await batch.commit();
    console.log(`✅ Evento quitado de ${updatedUsers.length} usuarios:`, updatedUsers);
  }
);
