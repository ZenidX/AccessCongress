/**
 * Cloud Function: Crear usuario en Auth y Firestore
 *
 * Usa el Admin SDK para crear usuarios sin cambiar la sesión del admin.
 * Esto resuelve el problema de que createUserWithEmailAndPassword
 * cambia automáticamente la sesión al nuevo usuario.
 */

import { onCall, HttpsError } from 'firebase-functions/v2/https';
import * as admin from 'firebase-admin';

const USERS_COLLECTION = 'users';

// Roles que pueden crear usuarios
const ADMIN_ROLES = ['super_admin', 'admin_responsable', 'admin'];

interface CreateUserRequest {
  email: string;
  password: string;
  username: string;
  role: string; // Will be validated at runtime
  organizationId: string | null;
}

export const createUser = onCall(
  {
    region: 'europe-west1',
  },
  async (request) => {
    // 1. Verificar autenticación
    if (!request.auth) {
      throw new HttpsError('unauthenticated', 'Usuario no autenticado');
    }

    const callerUid = request.auth.uid;
    const { email, password, username, role, organizationId } = request.data as CreateUserRequest;

    // 2. Validar parámetros
    if (!email || !password || !username || !role) {
      throw new HttpsError('invalid-argument', 'Faltan campos requeridos: email, password, username, role');
    }

    // 3. No permitir crear super_admin
    if (role === 'super_admin') {
      throw new HttpsError('permission-denied', 'No se puede crear un super administrador');
    }

    // 4. Validar longitud de contraseña
    if (password.length < 6) {
      throw new HttpsError('invalid-argument', 'La contraseña debe tener al menos 6 caracteres');
    }

    try {
      const db = admin.firestore();

      // 5. Verificar que el llamador es admin
      const callerDoc = await db.collection(USERS_COLLECTION).doc(callerUid).get();
      if (!callerDoc.exists) {
        throw new HttpsError('permission-denied', 'Usuario llamador no encontrado en la base de datos');
      }

      const callerData = callerDoc.data();
      const callerRole = callerData?.role;
      const callerOrgId = callerData?.organizationId;

      // Check if caller is super admin by email
      const isSuperAdmin = request.auth.token.email?.toLowerCase() === 'zenid77@gmail.com';

      if (!isSuperAdmin && (!callerRole || !ADMIN_ROLES.includes(callerRole))) {
        throw new HttpsError('permission-denied', 'No tienes permisos para crear usuarios');
      }

      // 6. Verificar jerarquía de roles
      if (!isSuperAdmin) {
        if (callerRole === 'admin_responsable') {
          // admin_responsable solo puede crear admin y controlador en su organización
          if (!['admin', 'controlador'].includes(role)) {
            throw new HttpsError('permission-denied', 'Solo puedes crear administradores o controladores');
          }
          if (organizationId !== callerOrgId) {
            throw new HttpsError('permission-denied', 'Solo puedes crear usuarios en tu organización');
          }
        } else if (callerRole === 'admin') {
          // admin solo puede crear controlador en su organización
          if (role !== 'controlador') {
            throw new HttpsError('permission-denied', 'Solo puedes crear controladores');
          }
          if (organizationId !== callerOrgId) {
            throw new HttpsError('permission-denied', 'Solo puedes crear usuarios en tu organización');
          }
        }
      }

      // 7. Crear usuario en Firebase Auth
      const userRecord = await admin.auth().createUser({
        email,
        password,
        displayName: username,
      });

      console.log(`✅ Usuario ${email} creado en Auth con UID: ${userRecord.uid}`);

      // 8. Crear documento en Firestore
      const now = Date.now();
      const userData = {
        uid: userRecord.uid,
        email,
        username,
        role,
        organizationId,
        assignedEventIds: [],
        createdAt: now,
        createdBy: callerUid,
        updatedAt: now,
      };

      await db.collection(USERS_COLLECTION).doc(userRecord.uid).set(userData);
      console.log(`✅ Documento de usuario creado en Firestore`);

      // 9. Si es admin_responsable, actualizar su organizationId a su propio UID
      if (role === 'admin_responsable') {
        await db.collection(USERS_COLLECTION).doc(userRecord.uid).update({
          organizationId: userRecord.uid,
          updatedAt: Date.now(),
        });
        console.log(`✅ OrganizationId actualizado para admin_responsable`);
      }

      return {
        success: true,
        message: `Usuario ${email} creado correctamente`,
        uid: userRecord.uid,
      };

    } catch (error: any) {
      console.error('Error creando usuario:', error);

      if (error instanceof HttpsError) {
        throw error;
      }

      // Errores específicos de Firebase Auth
      if (error.code === 'auth/email-already-exists') {
        throw new HttpsError('already-exists', 'El email ya está en uso');
      }
      if (error.code === 'auth/invalid-email') {
        throw new HttpsError('invalid-argument', 'El email no es válido');
      }
      if (error.code === 'auth/weak-password') {
        throw new HttpsError('invalid-argument', 'La contraseña es demasiado débil');
      }

      throw new HttpsError('internal', error.message || 'Error al crear usuario');
    }
  }
);
