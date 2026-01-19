/**
 * Cloud Function: Actualizar rol de usuario
 *
 * Maneja la lógica especial cuando se cambia el rol de un usuario:
 * - Si se convierte en admin_responsable: organizationId = su propio UID
 * - Actualiza Custom Claims automáticamente
 */

import { onCall, HttpsError } from 'firebase-functions/v2/https';
import * as admin from 'firebase-admin';

const USERS_COLLECTION = 'users';
const SUPER_ADMIN_EMAIL = 'zenid77@gmail.com';
const ADMIN_ROLES = ['super_admin', 'admin_responsable', 'admin'];

interface UpdateRoleRequest {
  targetUid: string;
  newRole: string;
}

export const updateUserRole = onCall(
  {
    region: 'europe-west1',
  },
  async (request) => {
    // 1. Verificar autenticación
    if (!request.auth) {
      throw new HttpsError('unauthenticated', 'Usuario no autenticado');
    }

    const callerUid = request.auth.uid;
    const { targetUid, newRole } = request.data as UpdateRoleRequest;

    // 2. Validar parámetros
    if (!targetUid || !newRole) {
      throw new HttpsError('invalid-argument', 'targetUid y newRole son requeridos');
    }

    // 3. No permitir asignar super_admin
    if (newRole === 'super_admin') {
      throw new HttpsError('permission-denied', 'No se puede asignar el rol de super administrador');
    }

    // 4. Validar que el rol es válido
    const validRoles = ['admin_responsable', 'admin', 'controlador'];
    if (!validRoles.includes(newRole)) {
      throw new HttpsError('invalid-argument', `Rol inválido: ${newRole}`);
    }

    try {
      const db = admin.firestore();

      // 5. Verificar permisos del llamador
      const callerDoc = await db.collection(USERS_COLLECTION).doc(callerUid).get();
      if (!callerDoc.exists) {
        throw new HttpsError('permission-denied', 'Usuario llamador no encontrado');
      }

      const callerData = callerDoc.data();
      const callerRole = callerData?.role;
      const isSuperAdmin = request.auth.token.email?.toLowerCase() === SUPER_ADMIN_EMAIL.toLowerCase();

      if (!isSuperAdmin && (!callerRole || !ADMIN_ROLES.includes(callerRole))) {
        throw new HttpsError('permission-denied', 'No tienes permisos para cambiar roles');
      }

      // 6. Obtener datos del usuario objetivo
      const targetDoc = await db.collection(USERS_COLLECTION).doc(targetUid).get();
      if (!targetDoc.exists) {
        throw new HttpsError('not-found', 'Usuario objetivo no encontrado');
      }

      const targetData = targetDoc.data()!;
      const currentRole = targetData.role;

      // 7. Verificar jerarquía de roles
      if (currentRole === 'super_admin') {
        throw new HttpsError('permission-denied', 'No se puede modificar un super administrador');
      }

      if (!isSuperAdmin) {
        // Solo super_admin puede crear admin_responsable
        if (newRole === 'admin_responsable') {
          throw new HttpsError('permission-denied', 'Solo el super administrador puede crear administradores responsables');
        }
      }

      // 8. Preparar actualización
      const updateData: Record<string, any> = {
        role: newRole,
        updatedAt: Date.now(),
      };

      // 9. Lógica especial para admin_responsable
      let newOrgId = targetData.organizationId;
      let assignedEvents: string[] = targetData.assignedEventIds || [];

      if (newRole === 'admin_responsable') {
        // Admin responsable: su organizationId es su propio UID
        newOrgId = targetUid;
        updateData.organizationId = newOrgId;
        // Limpiar eventos asignados (admin_responsable tiene acceso a todos sus eventos)
        updateData.assignedEventIds = [];
        assignedEvents = [];
        console.log(`👑 Promoviendo a admin_responsable, organizationId = ${targetUid}`);
      } else if (newRole === 'controlador' && currentRole !== 'controlador') {
        // Si se degrada a controlador, asignar todos los eventos de su organización
        if (newOrgId) {
          const eventsSnapshot = await db
            .collection('events')
            .where('organizationId', '==', newOrgId)
            .get();
          assignedEvents = eventsSnapshot.docs.map((doc) => doc.id);
          updateData.assignedEventIds = assignedEvents;
          console.log(`📋 Asignando ${assignedEvents.length} eventos al nuevo controlador`);
        }
      }

      // 10. Actualizar documento
      await db.collection(USERS_COLLECTION).doc(targetUid).update(updateData);
      console.log(`✅ Rol actualizado: ${currentRole} → ${newRole}`);

      // 11. Actualizar Custom Claims
      await admin.auth().setCustomUserClaims(targetUid, {
        role: newRole,
        orgId: newOrgId,
        events: assignedEvents,
      });
      console.log(`✅ Custom Claims actualizados`);

      return {
        success: true,
        message: `Rol actualizado a ${newRole}`,
        newOrganizationId: newOrgId,
        assignedEventsCount: assignedEvents.length,
      };

    } catch (error: any) {
      console.error('Error actualizando rol:', error);

      if (error instanceof HttpsError) {
        throw error;
      }

      throw new HttpsError('internal', error.message || 'Error al actualizar rol');
    }
  }
);
