/**
 * Cloud Function: Migrar Custom Claims para usuarios existentes
 *
 * Esta función es para ejecutar UNA VEZ para migrar usuarios
 * que fueron creados antes de implementar Custom Claims.
 *
 * Llamar desde: Firebase Console > Functions > migrateUserClaims > Test
 * O via: curl con token de admin
 */

import { onCall, HttpsError } from 'firebase-functions/v2/https';
import * as admin from 'firebase-admin';

const SUPER_ADMIN_EMAIL = 'zenid77@gmail.com';

export const migrateUserClaims = onCall(
  {
    region: 'europe-west1',
  },
  async (request) => {
    // Solo super_admin puede ejecutar esta migración
    if (!request.auth) {
      throw new HttpsError('unauthenticated', 'Usuario no autenticado');
    }

    const callerEmail = request.auth.token.email?.toLowerCase();
    if (callerEmail !== SUPER_ADMIN_EMAIL.toLowerCase()) {
      throw new HttpsError('permission-denied', 'Solo el super admin puede ejecutar esta migración');
    }

    console.log('🚀 Iniciando migración de Custom Claims...');

    const db = admin.firestore();
    const results = {
      total: 0,
      migrated: 0,
      skipped: 0,
      failed: 0,
      details: [] as string[],
    };

    try {
      const usersSnapshot = await db.collection('users').get();
      results.total = usersSnapshot.size;

      console.log(`📊 Encontrados ${results.total} usuarios`);

      for (const userDoc of usersSnapshot.docs) {
        const userId = userDoc.id;
        const userData = userDoc.data();

        const claims = {
          role: userData.role || 'controlador',
          orgId: userData.organizationId || null,
          events: userData.assignedEventIds || [],
        };

        try {
          // Verificar si el usuario existe en Auth
          await admin.auth().getUser(userId);

          // Establecer claims
          await admin.auth().setCustomUserClaims(userId, claims);

          const detail = `✅ ${userData.email || userId} - Role: ${claims.role}`;
          console.log(detail);
          results.details.push(detail);
          results.migrated++;
        } catch (error: any) {
          if (error.code === 'auth/user-not-found') {
            const detail = `⚠️ ${userData.email || userId} - No existe en Auth`;
            console.log(detail);
            results.details.push(detail);
            results.skipped++;
          } else {
            const detail = `❌ ${userData.email || userId} - Error: ${error.message}`;
            console.log(detail);
            results.details.push(detail);
            results.failed++;
          }
        }
      }

      console.log('✅ Migración completada');
      console.log(`   Migrados: ${results.migrated}`);
      console.log(`   Saltados: ${results.skipped}`);
      console.log(`   Fallidos: ${results.failed}`);

      return {
        success: true,
        message: 'Migración completada',
        results,
      };

    } catch (error: any) {
      console.error('❌ Error en migración:', error);
      throw new HttpsError('internal', error.message || 'Error en migración');
    }
  }
);
