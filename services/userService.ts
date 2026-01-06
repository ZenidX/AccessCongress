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

import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut,
} from 'firebase/auth';
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
import { auth, db } from '@/config/firebase';
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
 * @param email - Email for the new user
 * @param password - Password for the new user
 * @param username - Display name
 * @param role - User role
 * @param organizationId - Organization ID (null for super_admin)
 * @param adminEmail - Admin email for re-authentication
 * @param adminPassword - Admin password for re-authentication
 * @param createdByUid - UID of the user creating this user
 * @returns UID of the created user
 */
export async function createUser(
  email: string,
  password: string,
  username: string,
  role: UserRole,
  organizationId: string | null,
  adminEmail: string,
  adminPassword: string,
  createdByUid?: string
): Promise<string> {
  try {
    // Prevent creating super_admin
    if (role === 'super_admin') {
      throw new Error('No se puede crear un super administrador');
    }

    // 1. Create user in Firebase Auth (this changes active session)
    const userCredential = await createUserWithEmailAndPassword(auth, email, password);
    const newUserUid = userCredential.user.uid;

    // 2. Create document in Firestore
    const now = Date.now();
    await setDoc(doc(db, USERS_COLLECTION, newUserUid), {
      uid: newUserUid,
      email,
      username,
      role,
      organizationId,
      assignedEventIds: [],
      createdAt: now,
      createdBy: createdByUid || null,
      updatedAt: now,
    });

    // 3. Sign out the new user
    await signOut(auth);

    // 4. Re-authenticate the admin
    await signInWithEmailAndPassword(auth, adminEmail, adminPassword);

    return newUserUid;
  } catch (error: any) {
    console.error('Error creating user:', error);

    if (error.code === 'auth/email-already-in-use') {
      throw new Error('El email ya está en uso');
    }
    if (error.code === 'auth/weak-password') {
      throw new Error('La contraseña debe tener al menos 6 caracteres');
    }
    if (error.code === 'auth/invalid-email') {
      throw new Error('El email no es válido');
    }

    throw new Error(`Error al crear usuario: ${error.message}`);
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
 */
export async function updateUserRole(uid: string, role: UserRole): Promise<void> {
  try {
    // Prevent setting super_admin role
    if (role === 'super_admin') {
      throw new Error('No se puede asignar el rol de super administrador');
    }

    const userRef = doc(db, USERS_COLLECTION, uid);
    await updateDoc(userRef, {
      role,
      updatedAt: Date.now(),
    });
  } catch (error) {
    console.error('Error updating role:', error);
    throw new Error('No se pudo actualizar el rol del usuario');
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
  } catch (error) {
    console.error('Error assigning events:', error);
    throw new Error('No se pudieron asignar los eventos');
  }
}

/**
 * Add a single event to user's assignments
 */
export async function addEventToUser(uid: string, eventId: string): Promise<void> {
  try {
    const userRef = doc(db, USERS_COLLECTION, uid);
    await updateDoc(userRef, {
      assignedEventIds: arrayUnion(eventId),
      updatedAt: Date.now(),
    });
  } catch (error) {
    console.error('Error adding event to user:', error);
    throw new Error('No se pudo agregar el evento al usuario');
  }
}

/**
 * Remove a single event from user's assignments
 */
export async function removeEventFromUser(uid: string, eventId: string): Promise<void> {
  try {
    const userRef = doc(db, USERS_COLLECTION, uid);
    await updateDoc(userRef, {
      assignedEventIds: arrayRemove(eventId),
      updatedAt: Date.now(),
    });
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
 * Delete user from Firestore
 *
 * NOTE: This only deletes the Firestore document.
 * The user still exists in Firebase Auth because
 * the client SDK cannot delete other users' accounts.
 *
 * For complete deletion, use Firebase Admin SDK via Cloud Functions.
 */
export async function deleteUserFromFirestore(uid: string): Promise<void> {
  try {
    const userRef = doc(db, USERS_COLLECTION, uid);
    await deleteDoc(userRef);
  } catch (error) {
    console.error('Error deleting user from Firestore:', error);
    throw new Error('No se pudo eliminar el usuario de Firestore');
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
