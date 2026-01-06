/**
 * Event Context
 *
 * Manages the current event selection and available events for the user
 * Events are filtered based on user role and organization
 */

import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  ReactNode,
} from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Event } from '@/types/event';
import { useAuth } from './AuthContext';
import {
  getEventsByOrganization,
  getEventsByIds,
  subscribeToOrganizationEvents,
} from '@/services/eventService';
import { getAllOrganizations } from '@/services/organizationService';

const CURRENT_EVENT_KEY = '@AccessCongress:currentEventId';

interface EventContextType {
  /** Currently selected event */
  currentEvent: Event | null;
  /** Set the current event */
  setCurrentEvent: (event: Event | null) => void;
  /** All events available to the user */
  availableEvents: Event[];
  /** Loading state */
  isLoadingEvents: boolean;
  /** Error state */
  eventsError: string | null;
  /** Refresh events list */
  refreshEvents: () => Promise<void>;
  /** Select event by ID */
  selectEventById: (eventId: string) => void;
  /** Clear current event selection */
  clearCurrentEvent: () => void;
}

const EventContext = createContext<EventContextType | undefined>(undefined);

interface EventProviderProps {
  children: ReactNode;
}

export function EventProvider({ children }: EventProviderProps) {
  const { user, isSuperAdmin } = useAuth();
  const [currentEvent, setCurrentEventState] = useState<Event | null>(null);
  const [availableEvents, setAvailableEvents] = useState<Event[]>([]);
  const [isLoadingEvents, setIsLoadingEvents] = useState(true);
  const [eventsError, setEventsError] = useState<string | null>(null);

  // Load saved event ID from AsyncStorage
  const loadSavedEventId = useCallback(async (): Promise<string | null> => {
    try {
      const savedEventId = await AsyncStorage.getItem(CURRENT_EVENT_KEY);
      return savedEventId;
    } catch (error) {
      console.error('Error loading saved event ID:', error);
      return null;
    }
  }, []);

  // Save current event ID to AsyncStorage
  const saveCurrentEventId = useCallback(async (eventId: string | null) => {
    try {
      if (eventId) {
        await AsyncStorage.setItem(CURRENT_EVENT_KEY, eventId);
      } else {
        await AsyncStorage.removeItem(CURRENT_EVENT_KEY);
      }
    } catch (error) {
      console.error('Error saving current event ID:', error);
    }
  }, []);

  // Set current event and persist to storage
  const setCurrentEvent = useCallback(
    (event: Event | null) => {
      setCurrentEventState(event);
      saveCurrentEventId(event?.id || null);
    },
    [saveCurrentEventId]
  );

  // Select event by ID from available events
  const selectEventById = useCallback(
    (eventId: string) => {
      const event = availableEvents.find((e) => e.id === eventId);
      if (event) {
        setCurrentEvent(event);
      }
    },
    [availableEvents, setCurrentEvent]
  );

  // Clear current event
  const clearCurrentEvent = useCallback(() => {
    setCurrentEvent(null);
  }, [setCurrentEvent]);

  // Fetch events based on user role
  const fetchEvents = useCallback(async () => {
    if (!user) {
      setAvailableEvents([]);
      setCurrentEventState(null);
      setIsLoadingEvents(false);
      return;
    }

    setIsLoadingEvents(true);
    setEventsError(null);

    try {
      let events: Event[] = [];

      if (isSuperAdmin()) {
        // Super admin: fetch all events from all organizations
        const orgs = await getAllOrganizations();
        const allEventsPromises = orgs.map((org) =>
          getEventsByOrganization(org.id)
        );
        const allEventsArrays = await Promise.all(allEventsPromises);
        events = allEventsArrays.flat();
      } else if (
        user.role === 'admin_responsable' ||
        user.role === 'admin'
      ) {
        // Admin roles: fetch events from their organization
        if (user.organizationId) {
          events = await getEventsByOrganization(user.organizationId);
        }
      } else if (user.role === 'controlador') {
        // Controller: fetch only assigned events
        if (user.assignedEventIds && user.assignedEventIds.length > 0) {
          events = await getEventsByIds(user.assignedEventIds);
        }
      }

      // Sort by date (most recent first)
      events.sort((a, b) => b.date - a.date);
      setAvailableEvents(events);

      // Restore saved event or select first available
      const savedEventId = await loadSavedEventId();
      if (savedEventId) {
        const savedEvent = events.find((e) => e.id === savedEventId);
        if (savedEvent) {
          setCurrentEventState(savedEvent);
        } else if (events.length > 0) {
          // Saved event not available anymore, select first
          setCurrentEvent(events[0]);
        }
      } else if (events.length > 0) {
        // No saved event, select first
        setCurrentEvent(events[0]);
      }
    } catch (error: any) {
      console.error('Error fetching events:', error);
      setEventsError(error.message || 'Error al cargar eventos');
    } finally {
      setIsLoadingEvents(false);
    }
  }, [user, isSuperAdmin, loadSavedEventId, setCurrentEvent]);

  // Refresh events
  const refreshEvents = useCallback(async () => {
    await fetchEvents();
  }, [fetchEvents]);

  // Fetch events when user changes
  useEffect(() => {
    fetchEvents();
  }, [fetchEvents]);

  // Set up real-time subscription for organization events
  useEffect(() => {
    if (!user || isSuperAdmin()) {
      // Super admin doesn't use real-time updates (too many events)
      return;
    }

    if (
      (user.role === 'admin_responsable' || user.role === 'admin') &&
      user.organizationId
    ) {
      // Subscribe to organization events
      const unsubscribe = subscribeToOrganizationEvents(
        user.organizationId,
        (events) => {
          events.sort((a, b) => b.date - a.date);
          setAvailableEvents(events);

          // Update current event if it was modified
          if (currentEvent) {
            const updatedEvent = events.find((e) => e.id === currentEvent.id);
            if (updatedEvent) {
              setCurrentEventState(updatedEvent);
            } else {
              // Current event was deleted, select first available
              if (events.length > 0) {
                setCurrentEvent(events[0]);
              } else {
                setCurrentEvent(null);
              }
            }
          }
        }
      );

      return () => unsubscribe();
    }
  }, [user, isSuperAdmin, currentEvent, setCurrentEvent]);

  return (
    <EventContext.Provider
      value={{
        currentEvent,
        setCurrentEvent,
        availableEvents,
        isLoadingEvents,
        eventsError,
        refreshEvents,
        selectEventById,
        clearCurrentEvent,
      }}
    >
      {children}
    </EventContext.Provider>
  );
}

export function useEvent() {
  const context = useContext(EventContext);
  if (context === undefined) {
    throw new Error('useEvent must be used within an EventProvider');
  }
  return context;
}

/**
 * Hook to get the current event ID
 * Returns null if no event is selected
 */
export function useCurrentEventId(): string | null {
  const { currentEvent } = useEvent();
  return currentEvent?.id || null;
}

/**
 * Hook to require a current event
 * Throws an error if no event is selected
 */
export function useRequiredEvent(): Event {
  const { currentEvent } = useEvent();
  if (!currentEvent) {
    throw new Error('No event selected. Please select an event first.');
  }
  return currentEvent;
}
