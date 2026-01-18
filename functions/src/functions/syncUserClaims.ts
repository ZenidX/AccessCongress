/**
 * Cloud Function: Sincronizar Custom Claims de usuario
 *
 * Se ejecuta automáticamente cuando se crea o actualiza un documento de usuario.
 * Almacena role, organizationId y assignedEventIds en el token JWT.
 *
 * Esto elimina la necesidad de leer el documento de usuario en las reglas de
 * seguridad de Firestore, mejorando el rendimiento y reduciendo costos.
 */

import { onDocumentWritten } from 'firebase-functions/v2/firestore';
import { onCall, HttpsError } from 'firebase-functions/v2/https';
import * as admin from 'firebase-admin';

interface UserClaims {
  role: string;
  orgId: string | null;
  events: string[];
}

/**
 * Sincroniza los Custom Claims cuando se escribe un documento de usuario
 */
export const syncUserClaims = onDocumentWritten(
  {
    document: 'users/{userId}',
    region: 'europe-west1',
  },
  async (event) => {
    const userId = event.params.userId;
    const afterData = event.data?.after.exists ? event.data.after.data() : null;

    // Si el usuario fue eliminado, limpiar claims
    if (!afterData) {
      try {
        await admin.auth().setCustomUserClaims(userId, {});
        console.log(`✅ Claims limpiados para usuario eliminado: ${userId}`);
      } catch (error) {
        // El usuario puede no existir en Auth si ya fue eliminado
        console.log(`Usuario ${userId} no encontrado en Auth (probablemente ya eliminado)`);
      }
      return;
    }

    // Construir los claims
    const claims: UserClaims = {
      role: afterData.role || 'controlador',
      orgId: afterData.organizationId || null,
      events: afterData.assignedEventIds || [],
    };

    try {
      await admin.auth().setCustomUserClaims(userId, claims);
      console.log(`✅ Claims sincronizados para ${userId}:`, JSON.stringify(claims));
    } catch (error: any) {
      console.error(`❌ Error sincronizando claims para ${userId}:`, error.message);
      throw error;
    }
  }
);

/**
 * Función callable para forzar la sincronización de claims del usuario actual
 * Útil cuando el frontend necesita asegurar que los claims están actualizados
 */
export const refreshUserClaims = onCall(
  {
    region: 'europe-west1',
  },
  async (request) => {
    if (!request.auth) {
      throw new HttpsError('unauthenticated', 'Usuario no autenticado');
    }

    const userId = request.auth.uid;

    try {
      const db = admin.firestore();
      const userDoc = await db.collection('users').doc(userId).get();

      if (!userDoc.exists) {
        throw new HttpsError('not-found', 'Usuario no encontrado');
      }

      const userData = userDoc.data()!;
      const claims: UserClaims = {
        role: userData.role || 'controlador',
        orgId: userData.organizationId || null,
        events: userData.assignedEventIds || [],
      };

      await admin.auth().setCustomUserClaims(userId, claims);
      console.log(`✅ Claims actualizados para ${userId}:`, JSON.stringify(claims));

      return {
        success: true,
        message: 'Claims actualizados correctamente',
        claims,
      };
    } catch (error: any) {
      console.error('Error refreshing claims:', error);

      if (error instanceof HttpsError) {
        throw error;
      }

      throw new HttpsError('internal', error.message || 'Error al actualizar claims');
    }
  }
);
