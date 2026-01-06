/**
 * Organization types for multi-tenant system
 * Each organization is independent and managed by an admin_responsable
 */

export interface Organization {
  id: string;
  name: string;
  description?: string;
  createdBy: string; // UID of admin_responsable who created it
  createdAt: number; // Unix timestamp
  updatedAt: number; // Unix timestamp
}

export interface CreateOrganizationData {
  name: string;
  description?: string;
}

export interface UpdateOrganizationData {
  name?: string;
  description?: string;
}
