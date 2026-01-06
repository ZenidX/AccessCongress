/**
 * Migration Script: Migrate existing data to multi-event structure
 *
 * This script migrates existing data from the legacy structure to the new
 * multi-event, multi-tenant structure:
 *
 * 1. Creates "Impuls Educació" organization
 * 2. Creates default event "Congreso 2025"
 * 3. Moves participants from /participants to /events/{eventId}/participants
 * 4. Moves access_logs from /access_logs to /events/{eventId}/access_logs
 * 5. Updates super admin user document
 *
 * Usage: node scripts/migrate-to-events.js
 *
 * IMPORTANT: Run this script ONCE to migrate existing data.
 * Make a backup of your Firestore data before running!
 */

const admin = require('firebase-admin');

// Initialize Firebase Admin SDK
// You need to download serviceAccountKey.json from Firebase Console
// Project Settings > Service Accounts > Generate New Private Key
let serviceAccount;
try {
  serviceAccount = require('../serviceAccountKey.json');
} catch (error) {
  console.error('Error: serviceAccountKey.json not found!');
  console.error('Download it from Firebase Console:');
  console.error('Project Settings > Service Accounts > Generate New Private Key');
  console.error('Save it as serviceAccountKey.json in the project root.');
  process.exit(1);
}

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
});

const db = admin.firestore();

// Configuration
const SUPER_ADMIN_EMAIL = 'zenid77@gmail.com';
const ORG_NAME = 'Impuls Educació';
const EVENT_NAME = 'Congreso 2025';
const BATCH_SIZE = 500;

async function migrate() {
  console.log('Starting migration to multi-event structure...\n');

  try {
    // Step 1: Create organization
    console.log('Step 1: Creating organization...');
    const orgRef = db.collection('organizations').doc();
    const orgId = orgRef.id;
    const now = Date.now();

    await orgRef.set({
      id: orgId,
      name: ORG_NAME,
      description: 'Organización principal de Impuls Educació',
      createdBy: 'migration-script',
      createdAt: now,
      updatedAt: now,
    });
    console.log(`  Created organization: ${ORG_NAME} (${orgId})`);

    // Step 2: Create default event
    console.log('\nStep 2: Creating default event...');
    const eventRef = db.collection('events').doc();
    const eventId = eventRef.id;

    await eventRef.set({
      id: eventId,
      organizationId: orgId,
      name: EVENT_NAME,
      description: 'Evento migrado desde estructura legacy',
      date: now,
      status: 'active',
      settings: {
        accessModes: ['registro', 'aula_magna', 'master_class', 'cena'],
      },
      createdBy: 'migration-script',
      createdAt: now,
      updatedAt: now,
    });
    console.log(`  Created event: ${EVENT_NAME} (${eventId})`);

    // Step 3: Migrate participants
    console.log('\nStep 3: Migrating participants...');
    const participantsSnapshot = await db.collection('participants').get();
    const totalParticipants = participantsSnapshot.size;
    console.log(`  Found ${totalParticipants} participants to migrate`);

    if (totalParticipants > 0) {
      let batch = db.batch();
      let batchCount = 0;
      let migratedCount = 0;

      for (const doc of participantsSnapshot.docs) {
        const participantData = doc.data();
        const newParticipantRef = db
          .collection('events')
          .doc(eventId)
          .collection('participants')
          .doc(doc.id);

        batch.set(newParticipantRef, {
          ...participantData,
          eventId: eventId,
          migratedAt: now,
        });

        batchCount++;
        migratedCount++;

        // Commit batch when reaching limit
        if (batchCount >= BATCH_SIZE) {
          await batch.commit();
          console.log(`  Migrated ${migratedCount}/${totalParticipants} participants`);
          batch = db.batch();
          batchCount = 0;
        }
      }

      // Commit remaining items
      if (batchCount > 0) {
        await batch.commit();
        console.log(`  Migrated ${migratedCount}/${totalParticipants} participants`);
      }
    }

    // Step 4: Migrate access logs
    console.log('\nStep 4: Migrating access logs...');
    const logsSnapshot = await db.collection('access_logs').get();
    const totalLogs = logsSnapshot.size;
    console.log(`  Found ${totalLogs} access logs to migrate`);

    if (totalLogs > 0) {
      let batch = db.batch();
      let batchCount = 0;
      let migratedCount = 0;

      for (const doc of logsSnapshot.docs) {
        const logData = doc.data();
        const newLogRef = db
          .collection('events')
          .doc(eventId)
          .collection('access_logs')
          .doc(doc.id);

        batch.set(newLogRef, {
          ...logData,
          eventId: eventId,
          migratedAt: now,
        });

        batchCount++;
        migratedCount++;

        // Commit batch when reaching limit
        if (batchCount >= BATCH_SIZE) {
          await batch.commit();
          console.log(`  Migrated ${migratedCount}/${totalLogs} access logs`);
          batch = db.batch();
          batchCount = 0;
        }
      }

      // Commit remaining items
      if (batchCount > 0) {
        await batch.commit();
        console.log(`  Migrated ${migratedCount}/${totalLogs} access logs`);
      }
    }

    // Step 5: Update super admin user
    console.log('\nStep 5: Updating super admin user...');
    const usersSnapshot = await db
      .collection('users')
      .where('email', '==', SUPER_ADMIN_EMAIL)
      .get();

    if (!usersSnapshot.empty) {
      const userDoc = usersSnapshot.docs[0];
      await userDoc.ref.update({
        role: 'super_admin',
        organizationId: null, // Super admin has no organization
        assignedEventIds: [], // Super admin can access all events
        updatedAt: now,
      });
      console.log(`  Updated super admin: ${SUPER_ADMIN_EMAIL}`);
    } else {
      console.log(`  Super admin user not found: ${SUPER_ADMIN_EMAIL}`);
      console.log('  You may need to create this user manually.');
    }

    // Summary
    console.log('\n========================================');
    console.log('Migration completed successfully!');
    console.log('========================================');
    console.log(`\nSummary:`);
    console.log(`  Organization ID: ${orgId}`);
    console.log(`  Event ID: ${eventId}`);
    console.log(`  Participants migrated: ${totalParticipants}`);
    console.log(`  Access logs migrated: ${totalLogs}`);
    console.log('\nNote: Legacy collections (participants, access_logs) were NOT deleted.');
    console.log('You can delete them manually after verifying the migration.');
    console.log('\nNext steps:');
    console.log('1. Verify data in Firebase Console');
    console.log('2. Test the app with the new event structure');
    console.log('3. Delete legacy collections if migration is successful');

  } catch (error) {
    console.error('\nMigration failed:', error);
    process.exit(1);
  }

  process.exit(0);
}

// Run migration
migrate();
