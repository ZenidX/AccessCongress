/**
 * Cloud Functions para AccessCongress
 * Sistema de envío de emails con Resend
 */

import * as admin from 'firebase-admin';

// Inicializar Firebase Admin
admin.initializeApp();

// Exportar funciones
export { sendSingleEmail } from './functions/sendSingleEmail';
export { sendBulkEmail } from './functions/sendBulkEmail';
