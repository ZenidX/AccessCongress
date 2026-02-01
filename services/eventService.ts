/**
 * Event Service
 * Handles CRUD operations for events and reset functionality
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
  writeBatch,
  onSnapshot,
  Unsubscribe,
} from 'firebase/firestore';
import { db } from '@/config/firebase';
import {
  Event,
  EventStatus,
  CreateEventData,
  UpdateEventData,
  DEFAULT_EVENT_SETTINGS,
} from '@/types/event';
import { Participant } from '@/types/participant';

const EVENTS_COLLECTION = 'events';

/**
 * Get the participants subcollection path for an event
 */
export function getParticipantsPath(eventId: string): string {
  return `${EVENTS_COLLECTION}/${eventId}/participants`;
}

/**
 * Get the access_logs subcollection path for an event
 */
export function getAccessLogsPath(eventId: string): string {
  return `${EVENTS_COLLECTION}/${eventId}/access_logs`;
}

/**
 * Create a new event
 */
export async function createEvent(
  data: CreateEventData,
  createdByUid: string
): Promise<Event> {
  const eventRef = doc(collection(db, EVENTS_COLLECTION));
  const now = Date.now();

  // Build event object, only including defined optional fields
  const event: Event = {
    id: eventRef.id,
    organizationId: data.organizationId,
    name: data.name,
    date: data.date,
    status: data.status || 'draft',
    settings: {
      ...DEFAULT_EVENT_SETTINGS,
      ...data.settings,
    },
    createdBy: createdByUid,
    createdAt: now,
    updatedAt: now,
  };

  // Only add optional fields if they have values (Firestore doesn't accept undefined)
  if (data.description) event.description = data.description;
  if (data.endDate) event.endDate = data.endDate;
  if (data.location) event.location = data.location;

  await setDoc(eventRef, event);
  return event;
}

/**
 * Get event by ID
 */
export async function getEvent(eventId: string): Promise<Event | null> {
  const eventRef = doc(db, EVENTS_COLLECTION, eventId);
  const eventSnap = await getDoc(eventRef);

  if (!eventSnap.exists()) {
    return null;
  }

  return eventSnap.data() as Event;
}

/**
 * Get all events for an organization
 */
export async function getEventsByOrganization(orgId: string): Promise<Event[]> {
  const q = query(
    collection(db, EVENTS_COLLECTION),
    where('organizationId', '==', orgId),
    orderBy('date', 'desc')
  );

  const snapshot = await getDocs(q);
  return snapshot.docs.map((doc) => doc.data() as Event);
}

/**
 * Get events by status for an organization
 */
export async function getEventsByStatus(
  orgId: string,
  status: EventStatus
): Promise<Event[]> {
  const q = query(
    collection(db, EVENTS_COLLECTION),
    where('organizationId', '==', orgId),
    where('status', '==', status),
    orderBy('date', 'desc')
  );

  const snapshot = await getDocs(q);
  return snapshot.docs.map((doc) => doc.data() as Event);
}

/**
 * Get active events for an organization
 */
export async function getActiveEvents(orgId: string): Promise<Event[]> {
  return getEventsByStatus(orgId, 'active');
}

/**
 * Get all events (for super admin)
 */
export async function getAllEvents(): Promise<Event[]> {
  const q = query(
    collection(db, EVENTS_COLLECTION),
    orderBy('date', 'desc')
  );

  const snapshot = await getDocs(q);
  return snapshot.docs.map((doc) => doc.data() as Event);
}

/**
 * Get events assigned to a user (for controllers)
 * Uses individual document fetches instead of list queries
 * to work with security rules that check assignedEventIds
 */
export async function getEventsByIds(eventIds: string[]): Promise<Event[]> {
  if (eventIds.length === 0) return [];

  const events: Event[] = [];

  // Fetch each document individually to comply with security rules
  for (const eventId of eventIds) {
    try {
      const eventDoc = await getDoc(doc(db, EVENTS_COLLECTION, eventId));
      if (eventDoc.exists()) {
        events.push(eventDoc.data() as Event);
      }
    } catch (error) {
      console.warn(`Could not fetch event ${eventId}:`, error);
    }
  }

  return events;
}

/**
 * Update event
 */
export async function updateEvent(
  eventId: string,
  data: UpdateEventData
): Promise<void> {
  const eventRef = doc(db, EVENTS_COLLECTION, eventId);

  const updateData: any = {
    ...data,
    updatedAt: Date.now(),
  };

  // Handle nested settings update
  if (data.settings) {
    const currentEvent = await getEvent(eventId);
    if (currentEvent) {
      updateData.settings = {
        ...currentEvent.settings,
        ...data.settings,
      };
    }
  }

  await updateDoc(eventRef, updateData);
}

/**
 * Update event status
 */
export async function updateEventStatus(
  eventId: string,
  status: EventStatus
): Promise<void> {
  await updateEvent(eventId, { status });
}

/**
 * Delete event and all its subcollections
 * WARNING: This is a destructive operation
 */
export async function deleteEvent(eventId: string): Promise<void> {
  // Delete participants subcollection
  const participantsRef = collection(db, getParticipantsPath(eventId));
  const participantsSnap = await getDocs(participantsRef);

  const batch1 = writeBatch(db);
  participantsSnap.docs.forEach((doc) => {
    batch1.delete(doc.ref);
  });
  await batch1.commit();

  // Delete access_logs subcollection
  const logsRef = collection(db, getAccessLogsPath(eventId));
  const logsSnap = await getDocs(logsRef);

  const batch2 = writeBatch(db);
  logsSnap.docs.forEach((doc) => {
    batch2.delete(doc.ref);
  });
  await batch2.commit();

  // Delete the event document
  const eventRef = doc(db, EVENTS_COLLECTION, eventId);
  await deleteDoc(eventRef);
}

/**
 * Reset event - Daily reset
 * Sets all estado fields to false (registrado, en_aula_magna, en_master_class, en_cena)
 * Does NOT delete access logs
 */
export async function resetEventDaily(eventId: string): Promise<number> {
  const participantsRef = collection(db, getParticipantsPath(eventId));
  const snapshot = await getDocs(participantsRef);

  if (snapshot.empty) return 0;

  // Process in batches of 500 (Firestore limit)
  const batchSize = 500;
  let processed = 0;

  for (let i = 0; i < snapshot.docs.length; i += batchSize) {
    const batch = writeBatch(db);
    const chunk = snapshot.docs.slice(i, i + batchSize);

    chunk.forEach((docSnap) => {
      batch.update(docSnap.ref, {
        'estado.registrado': false,
        'estado.en_aula_magna': false,
        'estado.en_master_class': false,
        'estado.en_cena': false,
        timestamp_registro: null,
        ultima_actualizacion: Date.now(),
      });
    });

    await batch.commit();
    processed += chunk.length;
  }

  return processed;
}

/**
 * Reset event - Total reset
 * Sets all estado fields to false AND deletes all access logs
 * Used when you want to start fresh with all history cleared
 */
export async function resetEventTotal(eventId: string): Promise<{ participants: number; logs: number }> {
  // 1. Reset all participant states
  const participantsRef = collection(db, getParticipantsPath(eventId));
  const participantsSnapshot = await getDocs(participantsRef);

  let participantsProcessed = 0;

  if (!participantsSnapshot.empty) {
    const batchSize = 500;

    for (let i = 0; i < participantsSnapshot.docs.length; i += batchSize) {
      const batch = writeBatch(db);
      const chunk = participantsSnapshot.docs.slice(i, i + batchSize);

      chunk.forEach((docSnap) => {
        batch.update(docSnap.ref, {
          'estado.registrado': false,
          'estado.en_aula_magna': false,
          'estado.en_master_class': false,
          'estado.en_cena': false,
          timestamp_registro: null,
          ultima_actualizacion: Date.now(),
        });
      });

      await batch.commit();
      participantsProcessed += chunk.length;
    }
  }

  // 2. Delete all access logs
  const logsRef = collection(db, getAccessLogsPath(eventId));
  const logsSnapshot = await getDocs(logsRef);

  let logsDeleted = 0;

  if (!logsSnapshot.empty) {
    const batchSize = 500;

    for (let i = 0; i < logsSnapshot.docs.length; i += batchSize) {
      const batch = writeBatch(db);
      const chunk = logsSnapshot.docs.slice(i, i + batchSize);

      chunk.forEach((docSnap) => {
        batch.delete(docSnap.ref);
      });

      await batch.commit();
      logsDeleted += chunk.length;
    }
  }

  return { participants: participantsProcessed, logs: logsDeleted };
}

/**
 * Get participant count for an event
 */
export async function getEventParticipantCount(eventId: string): Promise<number> {
  const participantsRef = collection(db, getParticipantsPath(eventId));
  const snapshot = await getDocs(participantsRef);
  return snapshot.size;
}

/**
 * Get registered participant count for an event
 */
export async function getEventRegisteredCount(eventId: string): Promise<number> {
  const q = query(
    collection(db, getParticipantsPath(eventId)),
    where('estado.registrado', '==', true)
  );
  const snapshot = await getDocs(q);
  return snapshot.size;
}

/**
 * Subscribe to events for an organization (real-time)
 */
export function subscribeToOrganizationEvents(
  orgId: string,
  callback: (events: Event[]) => void
): Unsubscribe {
  const q = query(
    collection(db, EVENTS_COLLECTION),
    where('organizationId', '==', orgId),
    orderBy('date', 'desc')
  );

  return onSnapshot(q, (snapshot) => {
    const events = snapshot.docs.map((doc) => doc.data() as Event);
    callback(events);
  });
}

/**
 * Subscribe to a single event (real-time)
 */
export function subscribeToEvent(
  eventId: string,
  callback: (event: Event | null) => void
): Unsubscribe {
  const eventRef = doc(db, EVENTS_COLLECTION, eventId);

  return onSnapshot(eventRef, (docSnap) => {
    if (docSnap.exists()) {
      callback(docSnap.data() as Event);
    } else {
      callback(null);
    }
  });
}

/**
 * Check if event name is unique within organization
 */
export async function isEventNameUnique(
  orgId: string,
  name: string,
  excludeEventId?: string
): Promise<boolean> {
  const q = query(
    collection(db, EVENTS_COLLECTION),
    where('organizationId', '==', orgId),
    where('name', '==', name)
  );

  const snapshot = await getDocs(q);

  if (excludeEventId) {
    return snapshot.docs.every((doc) => doc.id !== excludeEventId);
  }

  return snapshot.empty;
}

/**
 * Clone an event (without participants)
 */
export async function cloneEvent(
  sourceEventId: string,
  newName: string,
  createdByUid: string
): Promise<Event> {
  const sourceEvent = await getEvent(sourceEventId);

  if (!sourceEvent) {
    throw new Error('Source event not found');
  }

  return createEvent(
    {
      organizationId: sourceEvent.organizationId,
      name: newName,
      description: sourceEvent.description,
      date: Date.now(), // Set to current date
      location: sourceEvent.location,
      status: 'draft',
      settings: sourceEvent.settings,
    },
    createdByUid
  );
}
