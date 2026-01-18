/**
 * Script de migración: Sincronizar Custom Claims para usuarios existentes
 *
 * Ejecutar con: node scripts/migrate-user-claims.js
 *
 * Este script:
 * 1. Lee todos los usuarios de Firestore
 * 2. Establece sus Custom Claims en Firebase Auth
 *
 * Necesario para usuarios creados antes de implementar Custom Claims.
 */

const admin = require('firebase-admin');

// Inicializar con credenciales del proyecto
// Asegúrate de tener GOOGLE_APPLICATION_CREDENTIALS configurado
// o usa un service account key file
admin.initializeApp({
  projectId: 'accesscongress',
});

const db = admin.firestore();

async function migrateUserClaims() {
  console.log('🚀 Iniciando migración de Custom Claims...\n');

  try {
    // Obtener todos los usuarios
    const usersSnapshot = await db.collection('users').get();

    console.log(`📊 Encontrados ${usersSnapshot.size} usuarios\n`);

    let migrated = 0;
    let failed = 0;
    let skipped = 0;

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

        console.log(`✅ ${userData.email || userId}`);
        console.log(`   Role: ${claims.role}, OrgId: ${claims.orgId}, Events: ${claims.events.length}`);
        migrated++;
      } catch (error) {
        if (error.code === 'auth/user-not-found') {
          console.log(`⚠️  ${userData.email || userId} - No existe en Auth (skipped)`);
          skipped++;
        } else {
          console.log(`❌ ${userData.email || userId} - Error: ${error.message}`);
          failed++;
        }
      }
    }

    console.log('\n' + '='.repeat(50));
    console.log('📈 Resumen de migración:');
    console.log(`   ✅ Migrados: ${migrated}`);
    console.log(`   ⚠️  Saltados: ${skipped}`);
    console.log(`   ❌ Fallidos: ${failed}`);
    console.log('='.repeat(50));

  } catch (error) {
    console.error('❌ Error en migración:', error);
    process.exit(1);
  }
}

// Ejecutar
migrateUserClaims()
  .then(() => {
    console.log('\n✅ Migración completada');
    process.exit(0);
  })
  .catch((error) => {
    console.error('❌ Error fatal:', error);
    process.exit(1);
  });
