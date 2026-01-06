/**
 * User types for multi-tenant role hierarchy
 *
 * Role hierarchy:
 * - super_admin: Full system access (zenid77@gmail.com)
 * - admin_responsable: Organization owner, independent from other orgs
 * - admin: Manages controllers within their organization
 * - controlador: Operates assigned events only
 */

export type UserRole = 'super_admin' | 'admin_responsable' | 'admin' | 'controlador';

export interface User {
  uid: string;
  email: string;
  username: string;
  role: UserRole;
  /** Organization ID (null for super_admin) */
  organizationId: string | null;
  /** Event IDs assigned to this user (primarily for controllers) */
  assignedEventIds: string[];
  createdAt: number; // Unix timestamp
  createdBy?: string; // UID of user who created this user
  updatedAt?: number; // Unix timestamp
}

export interface CreateUserData {
  email: string;
  username: string;
  role: UserRole;
  organizationId: string | null;
  assignedEventIds?: string[];
}

export interface UpdateUserData {
  username?: string;
  role?: UserRole;
  assignedEventIds?: string[];
}

/** Permissions for each action in the system */
export interface UserPermissions {
  // Organization permissions
  canCreateOrganization: boolean;
  canViewAllOrganizations: boolean;
  canEditOrganization: boolean;
  canDeleteOrganization: boolean;

  // Event permissions
  canCreateEvent: boolean;
  canEditEvent: boolean;
  canDeleteEvent: boolean;
  canResetEvent: boolean;

  // Participant permissions
  canImportParticipants: boolean;
  canExportData: boolean;
  canEditParticipants: boolean;

  // User management permissions
  canCreateUsers: boolean;
  canEditUsers: boolean;
  canDeleteUsers: boolean;
  canAssignEvents: boolean;

  // Operational permissions
  canScanQR: boolean;
  canViewDashboard: boolean;
  canViewLogs: boolean;
}

/** Super admin email (hardcoded for security) */
export const SUPER_ADMIN_EMAIL = 'zenid77@gmail.com';

/**
 * Get permissions based on user role
 */
export function getRolePermissions(role: UserRole): UserPermissions {
  switch (role) {
    case 'super_admin':
      return {
        canCreateOrganization: true,
        canViewAllOrganizations: true,
        canEditOrganization: true,
        canDeleteOrganization: true,
        canCreateEvent: true,
        canEditEvent: true,
        canDeleteEvent: true,
        canResetEvent: true,
        canImportParticipants: true,
        canExportData: true,
        canEditParticipants: true,
        canCreateUsers: true,
        canEditUsers: true,
        canDeleteUsers: true,
        canAssignEvents: true,
        canScanQR: true,
        canViewDashboard: true,
        canViewLogs: true,
      };

    case 'admin_responsable':
      return {
        canCreateOrganization: false, // Only super_admin creates orgs
        canViewAllOrganizations: false,
        canEditOrganization: true, // Own org only
        canDeleteOrganization: false,
        canCreateEvent: true,
        canEditEvent: true,
        canDeleteEvent: true,
        canResetEvent: true,
        canImportParticipants: true,
        canExportData: true,
        canEditParticipants: true,
        canCreateUsers: true, // Can create admins and controllers
        canEditUsers: true,
        canDeleteUsers: true,
        canAssignEvents: true,
        canScanQR: true,
        canViewDashboard: true,
        canViewLogs: true,
      };

    case 'admin':
      return {
        canCreateOrganization: false,
        canViewAllOrganizations: false,
        canEditOrganization: false,
        canDeleteOrganization: false,
        canCreateEvent: true,
        canEditEvent: true,
        canDeleteEvent: false, // Only admin_responsable can delete
        canResetEvent: true,
        canImportParticipants: true,
        canExportData: true,
        canEditParticipants: true,
        canCreateUsers: true, // Only controllers
        canEditUsers: true, // Only controllers
        canDeleteUsers: false,
        canAssignEvents: true,
        canScanQR: true,
        canViewDashboard: true,
        canViewLogs: true,
      };

    case 'controlador':
      return {
        canCreateOrganization: false,
        canViewAllOrganizations: false,
        canEditOrganization: false,
        canDeleteOrganization: false,
        canCreateEvent: false,
        canEditEvent: false,
        canDeleteEvent: false,
        canResetEvent: false,
        canImportParticipants: false,
        canExportData: false,
        canEditParticipants: false,
        canCreateUsers: false,
        canEditUsers: false,
        canDeleteUsers: false,
        canAssignEvents: false,
        canScanQR: true,
        canViewDashboard: true,
        canViewLogs: true, // Read-only logs
      };

    default:
      // Default: no permissions
      return {
        canCreateOrganization: false,
        canViewAllOrganizations: false,
        canEditOrganization: false,
        canDeleteOrganization: false,
        canCreateEvent: false,
        canEditEvent: false,
        canDeleteEvent: false,
        canResetEvent: false,
        canImportParticipants: false,
        canExportData: false,
        canEditParticipants: false,
        canCreateUsers: false,
        canEditUsers: false,
        canDeleteUsers: false,
        canAssignEvents: false,
        canScanQR: false,
        canViewDashboard: false,
        canViewLogs: false,
      };
  }
}

/**
 * Check if a role can manage another role
 */
export function canManageRole(managerRole: UserRole, targetRole: UserRole): boolean {
  const hierarchy: Record<UserRole, number> = {
    'super_admin': 4,
    'admin_responsable': 3,
    'admin': 2,
    'controlador': 1,
  };

  // Can only manage roles below your level
  // Exception: admin can only manage controlador
  if (managerRole === 'admin') {
    return targetRole === 'controlador';
  }

  return hierarchy[managerRole] > hierarchy[targetRole];
}

/**
 * Get roles that a user can create based on their role
 */
export function getCreatableRoles(role: UserRole): UserRole[] {
  switch (role) {
    case 'super_admin':
      return ['admin_responsable', 'admin', 'controlador'];
    case 'admin_responsable':
      return ['admin', 'controlador'];
    case 'admin':
      return ['controlador'];
    default:
      return [];
  }
}
