/**
 * Cloud Functions para AccessCongress
 * - Sistema de envío de emails con Resend
 * - Gestión de usuarios con Admin SDK
 */

import * as admin from 'firebase-admin';

// Inicializar Firebase Admin
admin.initializeApp();

// Exportar funciones de email
export { sendSingleEmail } from './functions/sendSingleEmail';
export { sendBulkEmail } from './functions/sendBulkEmail';

// Exportar funciones de usuarios
export { createUser } from './functions/createUser';
export { deleteUser } from './functions/deleteUser';
export { updateUserRole } from './functions/updateUserRole';
export { fixAdminResponsable } from './functions/fixAdminResponsable';

// Exportar funciones de Custom Claims
export { syncUserClaims, refreshUserClaims } from './functions/syncUserClaims';
export { migrateUserClaims } from './functions/migrateUserClaims';

// Exportar funciones de sincronización de eventos
export { onEventCreated, onEventDeleted } from './functions/syncEventToControllers';
