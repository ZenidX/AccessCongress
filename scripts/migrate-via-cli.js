/**
 * Migration Script using Firebase CLI authentication
 *
 * This script uses the Firebase CLI's authentication to migrate data.
 * No serviceAccountKey.json needed - uses your existing Firebase login.
 */

const { execSync } = require('child_process');

const PROJECT_ID = 'accesscongress';
const SUPER_ADMIN_UID = 'xcx9PnzhBcMgPrnuqKUZpByyKln2';

// Generate IDs
const orgId = 'org_' + Date.now();
const eventId = 'evt_' + Date.now();
const now = Date.now();

// Organization document
const orgDoc = {
  fields: {
    id: { stringValue: orgId },
    name: { stringValue: 'Impuls Educació' },
    description: { stringValue: 'Organización principal de Impuls Educació' },
    createdBy: { stringValue: 'migration-script' },
    createdAt: { integerValue: now.toString() },
    updatedAt: { integerValue: now.toString() }
  }
};

// Event document
const eventDoc = {
  fields: {
    id: { stringValue: eventId },
    organizationId: { stringValue: orgId },
    name: { stringValue: 'Congreso 2025' },
    description: { stringValue: 'Evento migrado desde estructura legacy' },
    date: { integerValue: now.toString() },
    status: { stringValue: 'active' },
    settings: {
      mapValue: {
        fields: {
          accessModes: {
            arrayValue: {
              values: [
                { stringValue: 'registro' },
                { stringValue: 'aula_magna' },
                { stringValue: 'master_class' },
                { stringValue: 'cena' }
              ]
            }
          }
        }
      }
    },
    createdBy: { stringValue: 'migration-script' },
    createdAt: { integerValue: now.toString() },
    updatedAt: { integerValue: now.toString() }
  }
};

// Super admin user update
const userDoc = {
  fields: {
    uid: { stringValue: SUPER_ADMIN_UID },
    email: { stringValue: 'zenid77@gmail.com' },
    username: { stringValue: 'Super Admin' },
    role: { stringValue: 'super_admin' },
    organizationId: { nullValue: null },
    assignedEventIds: { arrayValue: { values: [] } },
    createdAt: { integerValue: now.toString() },
    updatedAt: { integerValue: now.toString() }
  }
};

async function runFirebaseCommand(cmd) {
  try {
    const result = execSync(`npx firebase-tools ${cmd}`, {
      encoding: 'utf8',
      cwd: process.cwd(),
      stdio: ['pipe', 'pipe', 'pipe']
    });
    return result;
  } catch (error) {
    console.error('Command failed:', error.message);
    throw error;
  }
}

async function migrate() {
  console.log('Starting migration...\n');
  console.log('Organization ID:', orgId);
  console.log('Event ID:', eventId);
  console.log('Super Admin UID:', SUPER_ADMIN_UID);
  console.log('');

  // Write documents using firebase-tools emulator or REST API
  // Since firebase-tools doesn't have direct document write,
  // we'll output the commands to run manually or use the REST API

  console.log('=== Migration Data ===\n');

  console.log('1. Create organization document at: organizations/' + orgId);
  console.log(JSON.stringify(orgDoc, null, 2));
  console.log('');

  console.log('2. Create event document at: events/' + eventId);
  console.log(JSON.stringify(eventDoc, null, 2));
  console.log('');

  console.log('3. Update user document at: users/' + SUPER_ADMIN_UID);
  console.log(JSON.stringify(userDoc, null, 2));
  console.log('');

  console.log('=== IDs for your app ===');
  console.log('Organization ID:', orgId);
  console.log('Event ID:', eventId);
  console.log('');
  console.log('Use these IDs in the Firebase Console to create the documents manually,');
  console.log('or the app will create them automatically when you use the Events section.');
}

migrate().catch(console.error);
