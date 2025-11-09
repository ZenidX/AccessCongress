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
  permisos: ParticipantPermissions;
  estado: ParticipantStatus;
  timestamp_registro?: number;
  ultima_actualizacion: number;
}

export interface QRData {
  dni: string;
  nombre: string;
  permisos: ParticipantPermissions;
}

export interface AccessLog {
  id: string;
  dni: string;
  nombre: string;
  modo: AccessMode;
  direccion: AccessDirection;
  timestamp: number;
  operador: string;
  exito: boolean;
  mensaje?: string;
}

export interface ValidationResult {
  valido: boolean;
  mensaje: string;
  participante?: Participant;
}
