/**
 * Cloud Function: Eliminar usuario de Auth y Firestore
 *
 * Esta función usa el Admin SDK para eliminar usuarios de Firebase Auth,
 * algo que no es posible hacer desde el cliente SDK.
 *
 * IMPORTANTE: Cuando se elimina un admin_responsable, se eliminan en cascada:
 * - Todos los eventos de su organización
 * - Todos los usuarios (admins, controladores) de su organización
 * - Todos los participantes de los eventos eliminados
 */

import { onCall, HttpsError } from 'firebase-functions/v2/https';
import * as admin from 'firebase-admin';

const USERS_COLLECTION = 'users';
const EVENTS_COLLECTION = 'events';
const PARTICIPANTS_COLLECTION = 'participants';

// Roles que pueden eliminar usuarios
const ADMIN_ROLES = ['super_admin', 'admin_responsable', 'admin'];

/**
 * Elimina en cascada todos los datos de una organización
 * @param db Firestore instance
 * @param organizationId ID de la organización (UID del admin_responsable)
 * @returns Estadísticas de lo eliminado
 */
async function deleteOrganizationCascade(
  db: admin.firestore.Firestore,
  organizationId: string
): Promise<{ events: number; participants: number; users: number }> {
  const stats = { events: 0, participants: 0, users: 0 };

  // 1. Obtener todos los eventos de la organización
  const eventsSnapshot = await db
    .collection(EVENTS_COLLECTION)
    .where('organizationId', '==', organizationId)
    .get();

  // 2. Para cada evento, eliminar sus participantes
  for (const eventDoc of eventsSnapshot.docs) {
    const eventId = eventDoc.id;

    // Eliminar participantes del evento
    const participantsSnapshot = await db
      .collection(EVENTS_COLLECTION)
      .doc(eventId)
      .collection(PARTICIPANTS_COLLECTION)
      .get();

    const participantsBatch = db.batch();
    participantsSnapshot.docs.forEach((doc) => {
      participantsBatch.delete(doc.ref);
      stats.participants++;
    });

    if (participantsSnapshot.size > 0) {
      await participantsBatch.commit();
    }

    // Eliminar el evento
    await eventDoc.ref.delete();
    stats.events++;
    console.log(`🗑️ Evento eliminado: ${eventId} (${participantsSnapshot.size} participantes)`);
  }

  // 3. Obtener todos los usuarios de la organización (excepto el admin_responsable)
  const usersSnapshot = await db
    .collection(USERS_COLLECTION)
    .where('organizationId', '==', organizationId)
    .get();

  // 4. Eliminar usuarios de Auth y Firestore
  for (const userDoc of usersSnapshot.docs) {
    // No eliminar el admin_responsable aquí (se elimina después)
    if (userDoc.id === organizationId) continue;

    const userData = userDoc.data();

    // Eliminar de Firebase Auth
    try {
      await admin.auth().deleteUser(userDoc.id);
      console.log(`🗑️ Usuario eliminado de Auth: ${userData.email}`);
    } catch (authError: any) {
      if (authError.code !== 'auth/user-not-found') {
        console.error(`⚠️ Error eliminando ${userData.email} de Auth:`, authError.message);
      }
    }

    // Eliminar de Firestore
    await userDoc.ref.delete();
    stats.users++;
    console.log(`🗑️ Usuario eliminado de Firestore: ${userData.email}`);
  }

  return stats;
}

export const deleteUser = onCall(
  {
    region: 'europe-west1',
  },
  async (request) => {
    // 1. Verificar autenticación
    if (!request.auth) {
      throw new HttpsError('unauthenticated', 'Usuario no autenticado');
    }

    const callerUid = request.auth.uid;
    const { targetUid } = request.data;

    // 2. Validar parámetros
    if (!targetUid) {
      throw new HttpsError('invalid-argument', 'targetUid es requerido');
    }

    // 3. No permitir auto-eliminación
    if (callerUid === targetUid) {
      throw new HttpsError('permission-denied', 'No puedes eliminarte a ti mismo');
    }

    try {
      const db = admin.firestore();

      // 4. Verificar que el llamador es admin
      const callerDoc = await db.collection(USERS_COLLECTION).doc(callerUid).get();
      if (!callerDoc.exists) {
        throw new HttpsError('permission-denied', 'Usuario llamador no encontrado');
      }

      const callerData = callerDoc.data();
      const callerRole = callerData?.role;

      // Check if caller is super admin by email
      const isSuperAdmin = request.auth.token.email?.toLowerCase() === 'zenid77@gmail.com';

      if (!isSuperAdmin && (!callerRole || !ADMIN_ROLES.includes(callerRole))) {
        throw new HttpsError('permission-denied', 'No tienes permisos para eliminar usuarios');
      }

      // 5. Obtener datos del usuario a eliminar
      const targetDoc = await db.collection(USERS_COLLECTION).doc(targetUid).get();
      const targetData = targetDoc.exists ? targetDoc.data() : null;
      const targetRole = targetData?.role;
      const targetEmail = targetData?.email || 'desconocido';

      // 6. Verificar jerarquía de roles
      if (targetRole === 'super_admin') {
        throw new HttpsError('permission-denied', 'No se puede eliminar un super administrador');
      }

      // Super admin can delete anyone (except other super_admins)
      if (!isSuperAdmin) {
        // admin_responsable solo puede eliminar admin y controlador
        if (callerRole === 'admin_responsable' && targetRole === 'admin_responsable') {
          throw new HttpsError('permission-denied', 'No puedes eliminar a otro administrador responsable');
        }

        // admin solo puede eliminar controlador
        if (callerRole === 'admin' && targetRole !== 'controlador') {
          throw new HttpsError('permission-denied', 'Solo puedes eliminar controladores');
        }
      }

      // 7. Si es admin_responsable, eliminar en cascada toda su organización
      let cascadeStats = { events: 0, participants: 0, users: 0 };

      if (targetRole === 'admin_responsable') {
        const organizationId = targetData?.organizationId || targetUid;
        console.log(`🏢 Eliminando organización ${organizationId} en cascada...`);

        cascadeStats = await deleteOrganizationCascade(db, organizationId);

        console.log(`📊 Cascada completada: ${cascadeStats.events} eventos, ${cascadeStats.participants} participantes, ${cascadeStats.users} usuarios`);
      }

      // 8. Eliminar de Firebase Auth
      try {
        await admin.auth().deleteUser(targetUid);
        console.log(`✅ Usuario ${targetUid} eliminado de Auth`);
      } catch (authError: any) {
        // Si el usuario no existe en Auth, continuar con Firestore
        if (authError.code === 'auth/user-not-found') {
          console.log(`⚠️ Usuario ${targetUid} no encontrado en Auth, continuando...`);
        } else {
          throw authError;
        }
      }

      // 9. Eliminar de Firestore
      if (targetDoc.exists) {
        await db.collection(USERS_COLLECTION).doc(targetUid).delete();
        console.log(`✅ Usuario ${targetUid} eliminado de Firestore`);
      }

      // 10. Construir mensaje de respuesta
      let message = `Usuario ${targetEmail} eliminado correctamente`;
      if (targetRole === 'admin_responsable') {
        const parts = [];
        if (cascadeStats.events > 0) parts.push(`${cascadeStats.events} evento(s)`);
        if (cascadeStats.participants > 0) parts.push(`${cascadeStats.participants} participante(s)`);
        if (cascadeStats.users > 0) parts.push(`${cascadeStats.users} usuario(s)`);

        if (parts.length > 0) {
          message += `. También se eliminaron: ${parts.join(', ')}`;
        }
      }

      return {
        success: true,
        message,
        deletedUid: targetUid,
        cascade: targetRole === 'admin_responsable' ? cascadeStats : undefined,
      };

    } catch (error: any) {
      console.error('Error eliminando usuario:', error);

      if (error instanceof HttpsError) {
        throw error;
      }

      throw new HttpsError('internal', error.message || 'Error al eliminar usuario');
    }
  }
);
