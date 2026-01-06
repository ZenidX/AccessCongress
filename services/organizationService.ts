/**
 * Organization Service
 * Handles CRUD operations for organizations in multi-tenant system
 */

import {
  collection,
  doc,
  getDoc,
  getDocs,
  setDoc,
  updateDoc,
  deleteDoc,
  query,
  where,
  orderBy,
  Timestamp,
} from 'firebase/firestore';
import { db } from '@/config/firebase';
import {
  Organization,
  CreateOrganizationData,
  UpdateOrganizationData,
} from '@/types/organization';
import { SUPER_ADMIN_EMAIL } from '@/types/user';

const ORGANIZATIONS_COLLECTION = 'organizations';

/**
 * Create a new organization
 * Only super_admin can create organizations
 */
export async function createOrganization(
  data: CreateOrganizationData,
  createdByUid: string
): Promise<Organization> {
  const orgRef = doc(collection(db, ORGANIZATIONS_COLLECTION));
  const now = Date.now();

  const organization: Organization = {
    id: orgRef.id,
    name: data.name,
    description: data.description,
    createdBy: createdByUid,
    createdAt: now,
    updatedAt: now,
  };

  await setDoc(orgRef, organization);
  return organization;
}

/**
 * Get organization by ID
 */
export async function getOrganization(orgId: string): Promise<Organization | null> {
  const orgRef = doc(db, ORGANIZATIONS_COLLECTION, orgId);
  const orgSnap = await getDoc(orgRef);

  if (!orgSnap.exists()) {
    return null;
  }

  return orgSnap.data() as Organization;
}

/**
 * Get all organizations (for super_admin)
 */
export async function getAllOrganizations(): Promise<Organization[]> {
  const q = query(
    collection(db, ORGANIZATIONS_COLLECTION),
    orderBy('createdAt', 'desc')
  );

  const snapshot = await getDocs(q);
  return snapshot.docs.map((doc) => doc.data() as Organization);
}

/**
 * Get organization by creator UID
 * Used to find the organization of an admin_responsable
 */
export async function getOrganizationByCreator(
  creatorUid: string
): Promise<Organization | null> {
  const q = query(
    collection(db, ORGANIZATIONS_COLLECTION),
    where('createdBy', '==', creatorUid)
  );

  const snapshot = await getDocs(q);
  if (snapshot.empty) {
    return null;
  }

  return snapshot.docs[0].data() as Organization;
}

/**
 * Update organization
 */
export async function updateOrganization(
  orgId: string,
  data: UpdateOrganizationData
): Promise<void> {
  const orgRef = doc(db, ORGANIZATIONS_COLLECTION, orgId);

  await updateDoc(orgRef, {
    ...data,
    updatedAt: Date.now(),
  });
}

/**
 * Delete organization
 * WARNING: This should also delete all related events and data
 * Only super_admin should be able to do this
 */
export async function deleteOrganization(orgId: string): Promise<void> {
  const orgRef = doc(db, ORGANIZATIONS_COLLECTION, orgId);
  await deleteDoc(orgRef);
  // Note: Related events, participants, and logs should be deleted separately
  // Consider using Cloud Functions for cascading deletes
}

/**
 * Check if organization name is unique
 */
export async function isOrganizationNameUnique(name: string): Promise<boolean> {
  const q = query(
    collection(db, ORGANIZATIONS_COLLECTION),
    where('name', '==', name)
  );

  const snapshot = await getDocs(q);
  return snapshot.empty;
}

/**
 * Subscribe to organization changes (real-time)
 */
export function subscribeToOrganization(
  orgId: string,
  callback: (org: Organization | null) => void
): () => void {
  const orgRef = doc(db, ORGANIZATIONS_COLLECTION, orgId);

  const { onSnapshot } = require('firebase/firestore');

  const unsubscribe = onSnapshot(orgRef, (docSnap: any) => {
    if (docSnap.exists()) {
      callback(docSnap.data() as Organization);
    } else {
      callback(null);
    }
  });

  return unsubscribe;
}
