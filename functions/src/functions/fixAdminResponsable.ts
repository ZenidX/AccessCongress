/**
 * Cloud Function: Arreglar admin_responsable existentes
 *
 * Corrige usuarios que fueron promovidos a admin_responsable
 * pero no tienen su organizationId configurado correctamente.
 */

import { onCall, HttpsError } from 'firebase-functions/v2/https';
import * as admin from 'firebase-admin';

const USERS_COLLECTION = 'users';
const SUPER_ADMIN_EMAIL = 'zenid77@gmail.com';

interface FixRequest {
  targetUid?: string; // Si no se especifica, arregla todos
}

export const fixAdminResponsable = onCall(
  {
    region: 'europe-west1',
  },
  async (request) => {
    // Solo super_admin puede ejecutar esto
    if (!request.auth) {
      throw new HttpsError('unauthenticated', 'Usuario no autenticado');
    }

    const callerEmail = request.auth.token.email?.toLowerCase();
    if (callerEmail !== SUPER_ADMIN_EMAIL.toLowerCase()) {
      throw new HttpsError('permission-denied', 'Solo el super admin puede ejecutar esta corrección');
    }

    const { targetUid } = request.data as FixRequest;
    const db = admin.firestore();

    const results = {
      checked: 0,
      fixed: 0,
      details: [] as string[],
    };

    try {
      let usersToFix: admin.firestore.QueryDocumentSnapshot[] = [];

      if (targetUid) {
        // Arreglar usuario específico
        const userDoc = await db.collection(USERS_COLLECTION).doc(targetUid).get();
        if (userDoc.exists && userDoc.data()?.role === 'admin_responsable') {
          usersToFix = [userDoc as admin.firestore.QueryDocumentSnapshot];
        }
      } else {
        // Arreglar todos los admin_responsable
        const snapshot = await db
          .collection(USERS_COLLECTION)
          .where('role', '==', 'admin_responsable')
          .get();
        usersToFix = snapshot.docs;
      }

      results.checked = usersToFix.length;

      for (const userDoc of usersToFix) {
        const userData = userDoc.data();
        const userId = userDoc.id;

        // Verificar si necesita corrección
        if (userData.organizationId !== userId) {
          // Corregir organizationId
          await db.collection(USERS_COLLECTION).doc(userId).update({
            organizationId: userId,
            assignedEventIds: [], // admin_responsable no necesita eventos asignados
            updatedAt: Date.now(),
          });

          // Actualizar Custom Claims
          await admin.auth().setCustomUserClaims(userId, {
            role: 'admin_responsable',
            orgId: userId,
            events: [],
          });

          results.fixed++;
          results.details.push(`✅ ${userData.email}: organizationId corregido a ${userId}`);
          console.log(`✅ Corregido ${userData.email}: organizationId = ${userId}`);
        } else {
          results.details.push(`✓ ${userData.email}: ya correcto`);
        }
      }

      return {
        success: true,
        message: `${results.fixed} de ${results.checked} usuarios corregidos`,
        results,
      };

    } catch (error: any) {
      console.error('Error en corrección:', error);
      throw new HttpsError('internal', error.message || 'Error en corrección');
    }
  }
);
