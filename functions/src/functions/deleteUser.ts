/**
 * Cloud Function: Eliminar usuario de Auth y Firestore
 *
 * Esta función usa el Admin SDK para eliminar usuarios de Firebase Auth,
 * algo que no es posible hacer desde el cliente SDK.
 */

import { onCall, HttpsError } from 'firebase-functions/v2/https';
import * as admin from 'firebase-admin';

const USERS_COLLECTION = 'users';

// Roles que pueden eliminar usuarios
const ADMIN_ROLES = ['super_admin', 'admin_responsable', 'admin'];

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

      if (!callerRole || !ADMIN_ROLES.includes(callerRole)) {
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

      // admin_responsable solo puede eliminar admin y controlador
      if (callerRole === 'admin_responsable' && targetRole === 'admin_responsable') {
        throw new HttpsError('permission-denied', 'No puedes eliminar a otro administrador responsable');
      }

      // admin solo puede eliminar controlador
      if (callerRole === 'admin' && targetRole !== 'controlador') {
        throw new HttpsError('permission-denied', 'Solo puedes eliminar controladores');
      }

      // 7. Eliminar de Firebase Auth
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

      // 8. Eliminar de Firestore
      if (targetDoc.exists) {
        await db.collection(USERS_COLLECTION).doc(targetUid).delete();
        console.log(`✅ Usuario ${targetUid} eliminado de Firestore`);
      }

      return {
        success: true,
        message: `Usuario ${targetEmail} eliminado correctamente`,
        deletedUid: targetUid,
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
