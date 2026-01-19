/**
 * User Service
 *
 * Functions for managing users with Firebase Authentication and Firestore
 * Supports multi-tenant role hierarchy:
 * - super_admin: Full system access
 * - admin_responsable: Organization owner
 * - admin: Manages controllers in their organization
 * - controlador: Operates assigned events only
 *
 * NOTE: Creating users with the client SDK changes the active session.
 * This service handles re-authentication of the admin after creating users.
 * For production, consider using Firebase Admin SDK via Cloud Functions.
 */

// Note: Firebase Auth imports removed - user creation now uses Cloud Functions
import {
  collection,
  doc,
  setDoc,
  getDoc,
  getDocs,
  deleteDoc,
  updateDoc,
  query,
  where,
  orderBy,
  arrayUnion,
  arrayRemove,
} from 'firebase/firestore';
import { httpsCallable } from 'firebase/functions';
import { auth, db, functions } from '@/config/firebase';

// ============================================
// Custom Claims Management
// ============================================

/**
 * Refresh the current user's ID token to get updated Custom Claims
 * Call this after user data (role, organization, events) is modified
 */
export async function refreshCurrentUserToken(): Promise<void> {
  const currentUser = auth.currentUser;
  if (!currentUser) {
    console.warn('No hay usuario autenticado para refrescar token');
    return;
  }

  try {
    // Force token refresh to get updated claims
    await currentUser.getIdToken(true);
    console.log('✅ Token refrescado con nuevos Custom Claims');
  } catch (error) {
    console.error('Error refrescando token:', error);
    throw new Error('No se pudo refrescar el token');
  }
}

/**
 * Call Cloud Function to sync Custom Claims for current user
 * Then refresh the token locally
 */
export async function syncAndRefreshClaims(): Promise<void> {
  try {
    const refreshClaimsFn = httpsCallable<
      Record<string, never>,
      { success: boolean; message: string; claims: { role: string; orgId: string | null; events: string[] } }
    >(functions, 'refreshUserClaims');

    const result = await refreshClaimsFn({});

    if (result.data.success) {
      // Force local token refresh to get the updated claims
      await refreshCurrentUserToken();
      console.log('✅ Claims sincronizados:', result.data.claims);
    }
  } catch (error) {
    console.error('Error sincronizando claims:', error);
    // Don't throw - claims will be synced by the Firestore trigger eventually
  }
}

import {
  UserRole,
  User,
  CreateUserData,
  UpdateUserData,
  canManageRole,
  getCreatableRoles,
  SUPER_ADMIN_EMAIL,
} from '@/types/user';

// Re-export for backward compatibility
export type { User as UserData } from '@/types/user';

const USERS_COLLECTION = 'users';

/**
 * Get all users (for super_admin only)
 */
export async function getAllUsers(): Promise<User[]> {
  try {
    const usersRef = collection(db, USERS_COLLECTION);
    const q = query(usersRef, orderBy('createdAt', 'desc'));
    const querySnapshot = await getDocs(q);

    const users: User[] = [];
    querySnapshot.forEach((doc) => {
      const data = doc.data();
      users.push({
        uid: doc.id,
        email: data.email || '',
        username: data.username || '',
        role: data.role || 'controlador',
        organizationId: data.organizationId || null,
        assignedEventIds: data.assignedEventIds || [],
        createdAt: data.createdAt || Date.now(),
        createdBy: data.createdBy,
        updatedAt: data.updatedAt,
      });
    });

    return users;
  } catch (error) {
    console.error('Error getting users:', error);
    throw new Error('No se pudieron obtener los usuarios');
  }
}

/**
 * Get users by organization
 */
export async function getUsersByOrganization(orgId: string): Promise<User[]> {
  try {
    const usersRef = collection(db, USERS_COLLECTION);
    // Simple query without orderBy to avoid requiring composite index
    const q = query(
      usersRef,
      where('organizationId', '==', orgId)
    );
    const querySnapshot = await getDocs(q);

    const users: User[] = [];
    querySnapshot.forEach((doc) => {
      const data = doc.data();
      users.push({
        uid: doc.id,
        email: data.email || '',
        username: data.username || '',
        role: data.role || 'controlador',
        organizationId: data.organizationId || null,
        assignedEventIds: data.assignedEventIds || [],
        createdAt: data.createdAt || Date.now(),
        createdBy: data.createdBy,
        updatedAt: data.updatedAt,
      });
    });

    // Sort in memory by createdAt descending
    users.sort((a, b) => b.createdAt - a.createdAt);

    return users;
  } catch (error) {
    console.error('Error getting users by organization:', error);
    throw new Error('No se pudieron obtener los usuarios de la organización');
  }
}

/**
 * Get controllers by organization
 */
export async function getControllersByOrganization(orgId: string): Promise<User[]> {
  try {
    const usersRef = collection(db, USERS_COLLECTION);
    const q = query(
      usersRef,
      where('organizationId', '==', orgId),
      where('role', '==', 'controlador')
    );
    const querySnapshot = await getDocs(q);

    const users: User[] = [];
    querySnapshot.forEach((doc) => {
      const data = doc.data();
      users.push({
        uid: doc.id,
        email: data.email || '',
        username: data.username || '',
        role: 'controlador',
        organizationId: data.organizationId || null,
        assignedEventIds: data.assignedEventIds || [],
        createdAt: data.createdAt || Date.now(),
        createdBy: data.createdBy,
        updatedAt: data.updatedAt,
      });
    });

    return users;
  } catch (error) {
    console.error('Error getting controllers:', error);
    throw new Error('No se pudieron obtener los controladores');
  }
}

/**
 * Create a new user in Firebase Auth and Firestore
 *
 * Uses a Cloud Function with Admin SDK to create users without
 * changing the current session (unlike createUserWithEmailAndPassword).
 *
 * @param email - Email for the new user
 * @param password - Password for the new user
 * @param username - Display name
 * @param role - User role
 * @param organizationId - Organization ID (null for super_admin)
 * @param _adminEmail - (deprecated, not needed with Cloud Function)
 * @param _adminPassword - (deprecated, not needed with Cloud Function)
 * @param _createdByUid - (deprecated, Cloud Function uses caller's UID)
 * @returns UID of the created user
 */
export async function createUser(
  email: string,
  password: string,
  username: string,
  role: UserRole,
  organizationId: string | null,
  _adminEmail?: string,
  _adminPassword?: string,
  _createdByUid?: string
): Promise<string> {
  try {
    // Prevent creating super_admin
    if (role === 'super_admin') {
      throw new Error('No se puede crear un super administrador');
    }

    const createUserFn = httpsCallable<
      { email: string; password: string; username: string; role: UserRole; organizationId: string | null },
      { success: boolean; message: string; uid: string }
    >(functions, 'createUser');

    const result = await createUserFn({
      email,
      password,
      username,
      role,
      organizationId,
    });

    if (!result.data.success) {
      throw new Error(result.data.message || 'Error al crear usuario');
    }

    console.log('Usuario creado:', result.data.message);
    return result.data.uid;

  } catch (error: any) {
    console.error('Error creating user:', error);

    // Extract error message from Cloud Functions error
    const message = error.message || error.details || 'No se pudo crear el usuario';
    throw new Error(message);
  }
}

/**
 * Get user data by UID
 */
export async function getUserData(uid: string): Promise<User | null> {
  try {
    const userRef = doc(db, USERS_COLLECTION, uid);
    const userDoc = await getDoc(userRef);

    if (userDoc.exists()) {
      const data = userDoc.data();
      return {
        uid: userDoc.id,
        email: data.email || '',
        username: data.username || '',
        role: data.role || 'controlador',
        organizationId: data.organizationId || null,
        assignedEventIds: data.assignedEventIds || [],
        createdAt: data.createdAt || Date.now(),
        createdBy: data.createdBy,
        updatedAt: data.updatedAt,
      };
    }

    return null;
  } catch (error) {
    console.error('Error getting user data:', error);
    throw new Error('No se pudieron obtener los datos del usuario');
  }
}

/**
 * Update user role
 * Uses Cloud Function to handle special cases like admin_responsable promotion.
 */
export async function updateUserRole(uid: string, role: UserRole): Promise<void> {
  try {
    // Prevent setting super_admin role
    if (role === 'super_admin') {
      throw new Error('No se puede asignar el rol de super administrador');
    }

    const updateRoleFn = httpsCallable<
      { targetUid: string; newRole: UserRole },
      { success: boolean; message: string; newOrganizationId: string | null; assignedEventsCount: number }
    >(functions, 'updateUserRole');

    const result = await updateRoleFn({
      targetUid: uid,
      newRole: role,
    });

    if (!result.data.success) {
      throw new Error(result.data.message || 'Error al actualizar rol');
    }

    console.log('Rol actualizado:', result.data.message);

    // If updating the current user, refresh their token
    if (auth.currentUser?.uid === uid) {
      await refreshCurrentUserToken();
    }
  } catch (error: any) {
    console.error('Error updating role:', error);
    const message = error.message || error.details || 'No se pudo actualizar el rol del usuario';
    throw new Error(message);
  }
}

/**
 * Update user data
 */
export async function updateUser(uid: string, data: UpdateUserData): Promise<void> {
  try {
    // Prevent setting super_admin role
    if (data.role === 'super_admin') {
      throw new Error('No se puede asignar el rol de super administrador');
    }

    const userRef = doc(db, USERS_COLLECTION, uid);
    await updateDoc(userRef, {
      ...data,
      updatedAt: Date.now(),
    });
  } catch (error) {
    console.error('Error updating user:', error);
    throw new Error('No se pudo actualizar el usuario');
  }
}

/**
 * Assign events to a user (replace all assignments)
 * NOTE: Custom Claims will be auto-synced by Cloud Function trigger.
 */
export async function assignEventsToUser(
  uid: string,
  eventIds: string[]
): Promise<void> {
  try {
    const userRef = doc(db, USERS_COLLECTION, uid);
    await updateDoc(userRef, {
      assignedEventIds: eventIds,
      updatedAt: Date.now(),
    });

    // If updating the current user, refresh their token
    if (auth.currentUser?.uid === uid) {
      setTimeout(() => refreshCurrentUserToken(), 1500);
    }
  } catch (error) {
    console.error('Error assigning events:', error);
    throw new Error('No se pudieron asignar los eventos');
  }
}

/**
 * Add a single event to user's assignments
 * NOTE: Custom Claims will be auto-synced by Cloud Function trigger.
 */
export async function addEventToUser(uid: string, eventId: string): Promise<void> {
  try {
    const userRef = doc(db, USERS_COLLECTION, uid);
    await updateDoc(userRef, {
      assignedEventIds: arrayUnion(eventId),
      updatedAt: Date.now(),
    });

    // If updating the current user, refresh their token
    if (auth.currentUser?.uid === uid) {
      setTimeout(() => refreshCurrentUserToken(), 1500);
    }
  } catch (error) {
    console.error('Error adding event to user:', error);
    throw new Error('No se pudo agregar el evento al usuario');
  }
}

/**
 * Remove a single event from user's assignments
 * NOTE: Custom Claims will be auto-synced by Cloud Function trigger.
 */
export async function removeEventFromUser(uid: string, eventId: string): Promise<void> {
  try {
    const userRef = doc(db, USERS_COLLECTION, uid);
    await updateDoc(userRef, {
      assignedEventIds: arrayRemove(eventId),
      updatedAt: Date.now(),
    });

    // If updating the current user, refresh their token
    if (auth.currentUser?.uid === uid) {
      setTimeout(() => refreshCurrentUserToken(), 1500);
    }
  } catch (error) {
    console.error('Error removing event from user:', error);
    throw new Error('No se pudo quitar el evento del usuario');
  }
}

/**
 * Get users assigned to a specific event
 */
export async function getUsersAssignedToEvent(eventId: string): Promise<User[]> {
  try {
    const usersRef = collection(db, USERS_COLLECTION);
    const q = query(
      usersRef,
      where('assignedEventIds', 'array-contains', eventId)
    );
    const querySnapshot = await getDocs(q);

    const users: User[] = [];
    querySnapshot.forEach((doc) => {
      const data = doc.data();
      users.push({
        uid: doc.id,
        email: data.email || '',
        username: data.username || '',
        role: data.role || 'controlador',
        organizationId: data.organizationId || null,
        assignedEventIds: data.assignedEventIds || [],
        createdAt: data.createdAt || Date.now(),
        createdBy: data.createdBy,
        updatedAt: data.updatedAt,
      });
    });

    return users;
  } catch (error) {
    console.error('Error getting users for event:', error);
    throw new Error('No se pudieron obtener los usuarios del evento');
  }
}

/**
 * Delete user completely (Auth + Firestore)
 *
 * Uses a Cloud Function with Admin SDK to delete the user from:
 * 1. Firebase Auth (requires Admin SDK)
 * 2. Firestore users collection
 *
 * For admin_responsable: Also deletes all events, participants, and users in their organization
 */
export async function deleteUserFromFirestore(uid: string): Promise<string> {
  try {
    const deleteUserFn = httpsCallable<
      { targetUid: string },
      {
        success: boolean;
        message: string;
        cascade?: { events: number; participants: number; users: number };
      }
    >(functions, 'deleteUser');

    const result = await deleteUserFn({ targetUid: uid });

    if (!result.data.success) {
      throw new Error(result.data.message || 'Error al eliminar usuario');
    }

    console.log('Usuario eliminado:', result.data.message);
    return result.data.message;
  } catch (error: any) {
    console.error('Error deleting user:', error);

    // Extraer mensaje de error de Cloud Functions
    const message = error.message || error.details || 'No se pudo eliminar el usuario';
    throw new Error(message);
  }
}

/**
 * Check if user can access an event
 */
export async function canUserAccessEvent(
  uid: string,
  eventId: string
): Promise<boolean> {
  const user = await getUserData(uid);
  if (!user) return false;

  // Super admin can access all
  if (user.email.toLowerCase() === SUPER_ADMIN_EMAIL.toLowerCase()) {
    return true;
  }

  // Controllers check assigned events
  if (user.role === 'controlador') {
    return user.assignedEventIds.includes(eventId);
  }

  // Admin roles have access via organization (checked at service level)
  return true;
}

/**
 * Update user's organization
 */
export async function updateUserOrganization(
  uid: string,
  organizationId: string | null
): Promise<void> {
  try {
    const userRef = doc(db, USERS_COLLECTION, uid);
    await updateDoc(userRef, {
      organizationId,
      updatedAt: Date.now(),
    });
  } catch (error) {
    console.error('Error updating user organization:', error);
    throw new Error('No se pudo actualizar la organización del usuario');
  }
}

/**
 * Check if email is available (not already in use)
 */
export async function isEmailAvailable(email: string): Promise<boolean> {
  try {
    const usersRef = collection(db, USERS_COLLECTION);
    const q = query(usersRef, where('email', '==', email.toLowerCase()));
    const querySnapshot = await getDocs(q);
    return querySnapshot.empty;
  } catch (error) {
    console.error('Error checking email availability:', error);
    return false;
  }
}

/**
 * Get users that can be managed by the current user based on role hierarchy
 *
 * - super_admin: sees ALL users
 * - admin_responsable: sees admins and controllers in their organization
 * - admin: sees only controllers in their organization
 * - controlador: cannot manage users
 */
export async function getManageableUsers(
  currentUserRole: UserRole,
  currentUserOrgId: string | null,
  currentUserUid: string
): Promise<User[]> {
  try {
    // Super admin can see all users
    if (currentUserRole === 'super_admin') {
      return getAllUsers();
    }

    // Also check by email for super admin (fallback)
    const currentUserData = await getUserData(currentUserUid);
    if (currentUserData?.email?.toLowerCase() === SUPER_ADMIN_EMAIL.toLowerCase()) {
      return getAllUsers();
    }

    // Admin responsable sees admins and controllers in their organization
    if (currentUserRole === 'admin_responsable' && currentUserOrgId) {
      return getUsersByOrganization(currentUserOrgId);
    }

    // Admin sees only controllers in their organization
    if (currentUserRole === 'admin' && currentUserOrgId) {
      const orgUsers = await getUsersByOrganization(currentUserOrgId);
      // Admin can only see controllers
      return orgUsers.filter(u => u.role === 'controlador');
    }

    // Controlador cannot manage users
    return [];
  } catch (error) {
    console.error('Error getting manageable users:', error);
    throw new Error('No se pudieron obtener los usuarios');
  }
}

/**
 * Get users created by a specific user (for hierarchy tracking)
 */
export async function getUsersCreatedBy(creatorUid: string): Promise<User[]> {
  try {
    const usersRef = collection(db, USERS_COLLECTION);
    // Simple query without orderBy to avoid requiring composite index
    const q = query(
      usersRef,
      where('createdBy', '==', creatorUid)
    );
    const querySnapshot = await getDocs(q);

    const users: User[] = [];
    querySnapshot.forEach((doc) => {
      const data = doc.data();
      users.push({
        uid: doc.id,
        email: data.email || '',
        username: data.username || '',
        role: data.role || 'controlador',
        organizationId: data.organizationId || null,
        assignedEventIds: data.assignedEventIds || [],
        createdAt: data.createdAt || Date.now(),
        createdBy: data.createdBy,
        updatedAt: data.updatedAt,
      });
    });

    // Sort in memory by createdAt descending
    users.sort((a, b) => b.createdAt - a.createdAt);

    return users;
  } catch (error) {
    console.error('Error getting users created by:', error);
    throw new Error('No se pudieron obtener los usuarios');
  }
}
