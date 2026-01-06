/**
 * Event types for multi-event system
 * Each event belongs to an organization and has its own participants
 */

import { AccessMode } from './participant';

export type EventStatus = 'draft' | 'active' | 'completed' | 'archived';

export type ResetType = 'daily' | 'total';

export interface EventSettings {
  /** Access modes enabled for this event */
  accessModes: AccessMode[];
  /** Custom names for access modes (optional) */
  customModeNames?: Partial<Record<AccessMode, string>>;
}

export interface Event {
  id: string;
  organizationId: string;
  name: string;
  description?: string;
  date: number; // Unix timestamp
  endDate?: number; // Unix timestamp (optional)
  location?: string;
  status: EventStatus;
  settings: EventSettings;
  createdBy: string; // UID of user who created it
  createdAt: number; // Unix timestamp
  updatedAt: number; // Unix timestamp
}

export interface CreateEventData {
  organizationId: string;
  name: string;
  description?: string;
  date: number;
  endDate?: number;
  location?: string;
  status?: EventStatus;
  settings?: Partial<EventSettings>;
}

export interface UpdateEventData {
  name?: string;
  description?: string;
  date?: number;
  endDate?: number;
  location?: string;
  status?: EventStatus;
  settings?: Partial<EventSettings>;
}

export interface ResetOptions {
  type: ResetType;
  eventId: string;
}

/** Default settings for new events */
export const DEFAULT_EVENT_SETTINGS: EventSettings = {
  accessModes: ['registro', 'aula_magna', 'master_class', 'cena'],
};
