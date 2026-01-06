/**
 * Contexto de Autenticación con Firebase
 *
 * Maneja el estado de autenticación del usuario y su rol usando Firebase Auth
 * Los roles se almacenan en Firestore en la colección 'users'
 *
 * Role hierarchy:
 * - super_admin: Full system access (zenid77@gmail.com)
 * - admin_responsable: Organization owner, independent from other orgs
 * - admin: Manages controllers within their organization
 * - controlador: Operates assigned events only
 */

import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { signInWithEmailAndPassword, signOut, onAuthStateChanged } from 'firebase/auth';
import { doc, getDoc } from 'firebase/firestore';
import { auth, db } from '@/config/firebase';
import {
  UserRole,
  User,
  UserPermissions,
  getRolePermissions,
  SUPER_ADMIN_EMAIL,
} from '@/types/user';

// Re-export types for backward compatibility
export type { UserRole, User } from '@/types/user';

export interface LoginResult {
  success: boolean;
  errorMessage?: string;
}

interface AuthContextType {
  user: User | null;
  isLoading: boolean;
  login: (email: string, password: string) => Promise<LoginResult>;
  logout: () => Promise<void>;
  // Role helpers
  isSuperAdmin: () => boolean;
  isAdminResponsable: () => boolean;
  isAdmin: () => boolean;
  isControlador: () => boolean;
  // Permission helpers
  hasPermission: (permission: keyof UserPermissions) => boolean;
  getPermissions: () => UserPermissions | null;
  // Organization/Event helpers
  canAccessOrganization: (orgId: string) => boolean;
  canAccessEvent: (eventId: string) => boolean;
  // Refresh user data
  refreshUser: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // Fetch user data from Firestore
  const fetchUserData = async (firebaseUser: any): Promise<User | null> => {
    try {
      console.log('🔍 AuthContext: Fetching user data for UID:', firebaseUser.uid);
      const userDoc = await getDoc(doc(db, 'users', firebaseUser.uid));

      // Check if this is the super admin email
      const isSuperAdminEmail = firebaseUser.email?.toLowerCase() === SUPER_ADMIN_EMAIL.toLowerCase();

      if (userDoc.exists()) {
        const userData = userDoc.data();
        console.log('✅ AuthContext: User document found:', userData);

        // If super admin email but role is different, force super_admin role
        const role: UserRole = isSuperAdminEmail
          ? 'super_admin'
          : (userData.role as UserRole) || 'controlador';

        return {
          uid: firebaseUser.uid,
          email: firebaseUser.email || '',
          username: userData.username || firebaseUser.email?.split('@')[0] || '',
          role,
          organizationId: userData.organizationId || null,
          assignedEventIds: userData.assignedEventIds || [],
          createdAt: userData.createdAt || Date.now(),
          createdBy: userData.createdBy,
          updatedAt: userData.updatedAt,
        };
      } else {
        // If no user document exists
        console.log('⚠️ AuthContext: No user document found, using defaults');

        // Super admin email gets super_admin role even without document
        const role: UserRole = isSuperAdminEmail ? 'super_admin' : 'controlador';

        return {
          uid: firebaseUser.uid,
          email: firebaseUser.email || '',
          username: firebaseUser.email?.split('@')[0] || '',
          role,
          organizationId: null,
          assignedEventIds: [],
          createdAt: Date.now(),
        };
      }
    } catch (error) {
      console.error('❌ AuthContext: Error fetching user data:', error);
      return null;
    }
  };

  // Listen to Firebase auth state changes
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      console.log('🔐 AuthContext: onAuthStateChanged triggered', firebaseUser?.email);

      if (firebaseUser) {
        const userData = await fetchUserData(firebaseUser);
        setUser(userData);
      } else {
        console.log('🚪 AuthContext: User not authenticated');
        setUser(null);
      }

      setIsLoading(false);
    });

    return () => unsubscribe();
  }, []);

  // Refresh user data from Firestore
  const refreshUser = useCallback(async () => {
    if (auth.currentUser) {
      const userData = await fetchUserData(auth.currentUser);
      setUser(userData);
    }
  }, []);

  // Login function
  const login = async (email: string, password: string): Promise<LoginResult> => {
    try {
      console.log('🔑 AuthContext: Attempting login with email:', email);
      await signInWithEmailAndPassword(auth, email, password);
      console.log('✅ AuthContext: Login successful, waiting for onAuthStateChanged...');
      return { success: true };
    } catch (error: any) {
      let errorMessage = 'Error al iniciar sesión. Por favor intenta de nuevo.';

      if (error?.code) {
        switch (error.code) {
          case 'auth/invalid-email':
            errorMessage = 'El formato del email es inválido.';
            break;
          case 'auth/user-disabled':
            errorMessage = 'Esta cuenta ha sido deshabilitada.';
            break;
          case 'auth/user-not-found':
            errorMessage = 'No existe una cuenta con este email.';
            break;
          case 'auth/wrong-password':
            errorMessage = 'Contraseña incorrecta.';
            break;
          case 'auth/invalid-credential':
            errorMessage = 'Email o contraseña incorrectos.';
            break;
          case 'auth/too-many-requests':
            errorMessage = 'Demasiados intentos fallidos. Por favor espera un momento.';
            break;
          case 'auth/network-request-failed':
            errorMessage = 'Error de conexión. Verifica tu conexión a internet.';
            break;
          default:
            errorMessage = 'Error al iniciar sesión. Por favor intenta de nuevo.';
        }
      }

      console.log('❌ AuthContext: Login error:', error.code || 'unknown');
      return { success: false, errorMessage };
    }
  };

  // Logout function
  const logout = async () => {
    try {
      await signOut(auth);
    } catch (error) {
      console.error('Error en logout:', error);
    }
  };

  // Role check helpers
  const isSuperAdmin = useCallback(() => {
    return user?.role === 'super_admin';
  }, [user]);

  const isAdminResponsable = useCallback(() => {
    return user?.role === 'admin_responsable';
  }, [user]);

  const isAdmin = useCallback(() => {
    return user?.role === 'admin';
  }, [user]);

  const isControlador = useCallback(() => {
    return user?.role === 'controlador';
  }, [user]);

  // Permission helpers
  const getPermissions = useCallback((): UserPermissions | null => {
    if (!user) return null;
    return getRolePermissions(user.role);
  }, [user]);

  const hasPermission = useCallback(
    (permission: keyof UserPermissions): boolean => {
      if (!user) return false;
      const permissions = getRolePermissions(user.role);
      return permissions[permission];
    },
    [user]
  );

  // Organization access check
  const canAccessOrganization = useCallback(
    (orgId: string): boolean => {
      if (!user) return false;

      // Super admin can access all organizations
      if (user.role === 'super_admin') return true;

      // Other roles can only access their own organization
      return user.organizationId === orgId;
    },
    [user]
  );

  // Event access check
  const canAccessEvent = useCallback(
    (eventId: string): boolean => {
      if (!user) return false;

      // Super admin can access all events
      if (user.role === 'super_admin') return true;

      // Admin responsable and admin can access all events in their organization
      // (This needs to be verified against the event's organizationId)
      if (user.role === 'admin_responsable' || user.role === 'admin') {
        // For now, return true - actual check should be done at the service level
        // comparing event.organizationId with user.organizationId
        return true;
      }

      // Controllers can only access assigned events
      if (user.role === 'controlador') {
        return user.assignedEventIds.includes(eventId);
      }

      return false;
    },
    [user]
  );

  return (
    <AuthContext.Provider
      value={{
        user,
        isLoading,
        login,
        logout,
        isSuperAdmin,
        isAdminResponsable,
        isAdmin,
        isControlador,
        hasPermission,
        getPermissions,
        canAccessOrganization,
        canAccessEvent,
        refreshUser,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
