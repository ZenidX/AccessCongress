/**
 * Tipos de datos para participantes del congreso
 */

export type AccessMode = 'registro' | 'aula_magna' | 'master_class' | 'cena';

export type AccessDirection = 'entrada' | 'salida';

export interface ParticipantPermissions {
  aula_magna: boolean;      // Todos tienen acceso
  master_class: boolean;    // Solo algunos
  cena: boolean;            // Solo algunos
}

export interface ParticipantStatus {
  registrado: boolean;
  en_aula_magna: boolean;
  en_master_class: boolean;
  en_cena: boolean;
}

export interface Participant {
  dni: string;
  nombre: string;
  email?: string; // MAIL
  telefono?: string; // TELÈFON
  escuela?: string; // TIPUS D'ESCOLA
  cargo?: string; // LLOC/RESPONSABILITAT
  acceso?: string; // ACCESO (Presencial/Online)
  haPagado?: boolean; // HA PAGAT?
  permisos: ParticipantPermissions;
  estado: ParticipantStatus;
  timestamp_registro?: number;
  ultima_actualizacion: number;
  /** Event ID this participant belongs to (for multi-event system) */
  eventId: string;
}

export interface QRData {
  dni: string;
  nombre: string;
  permisos?: ParticipantPermissions; // Opcional - se consulta en Firestore
}

export interface AccessLog {
  id: string;
  dni: string;
  nombre: string;
  modo: AccessMode;
  direccion: AccessDirection;
  timestamp: number;
  operador: string;
  /** UID of the user who performed the scan */
  operadorUid: string;
  exito: boolean;
  mensaje?: string;
  /** Event ID this log belongs to (for multi-event system) */
  eventId: string;
  // Información adicional del participante
  email?: string;
  telefono?: string;
  escuela?: string;
  cargo?: string;
  haPagado?: boolean;
  permisos?: ParticipantPermissions;
}

export interface ValidationResult {
  valido: boolean;
  mensaje: string;
  participante?: Participant;
}
