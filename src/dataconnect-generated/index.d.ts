import { ConnectorConfig, DataConnect, QueryRef, QueryPromise, MutationRef, MutationPromise } from 'firebase/data-connect';

export const connectorConfig: ConnectorConfig;

export type TimestampString = string;
export type UUIDString = string;
export type Int64String = string;
export type DateString = string;




export interface AccessPermission_Key {
  participantId: UUIDString;
  eventId: UUIDString;
  __typename?: 'AccessPermission_Key';
}

export interface AddAttendanceRecordData {
  attendanceRecord_insert: AttendanceRecord_Key;
}

export interface AddAttendanceRecordVariables {
  eventId: UUIDString;
  participantId: UUIDString;
  action: string;
  timestamp: TimestampString;
}

export interface AttendanceRecord_Key {
  id: UUIDString;
  __typename?: 'AttendanceRecord_Key';
}

export interface Event_Key {
  id: UUIDString;
  __typename?: 'Event_Key';
}

export interface GetParticipantStatusData {
  participantStatus?: {
    inAulaMagna: boolean;
    inCenaClausura: boolean;
    inMasterClass: boolean;
    isRegistered: boolean;
    lastUpdateTimestamp?: TimestampString | null;
  };
}

export interface GetParticipantStatusVariables {
  id: UUIDString;
}

export interface ListEventsData {
  events: ({
    id: UUIDString;
    name: string;
    description?: string | null;
    startTime?: TimestampString | null;
    endTime?: TimestampString | null;
    type: string;
    capacity: number;
  } & Event_Key)[];
}

export interface ParticipantStatus_Key {
  id: UUIDString;
  __typename?: 'ParticipantStatus_Key';
}

export interface Participant_Key {
  id: UUIDString;
  __typename?: 'Participant_Key';
}

export interface UpdateParticipantInscriptionData {
  participant_update?: Participant_Key | null;
}

export interface UpdateParticipantInscriptionVariables {
  id: UUIDString;
  isInscribed: boolean;
}

interface AddAttendanceRecordRef {
  /* Allow users to create refs without passing in DataConnect */
  (vars: AddAttendanceRecordVariables): MutationRef<AddAttendanceRecordData, AddAttendanceRecordVariables>;
  /* Allow users to pass in custom DataConnect instances */
  (dc: DataConnect, vars: AddAttendanceRecordVariables): MutationRef<AddAttendanceRecordData, AddAttendanceRecordVariables>;
  operationName: string;
}
export const addAttendanceRecordRef: AddAttendanceRecordRef;

export function addAttendanceRecord(vars: AddAttendanceRecordVariables): MutationPromise<AddAttendanceRecordData, AddAttendanceRecordVariables>;
export function addAttendanceRecord(dc: DataConnect, vars: AddAttendanceRecordVariables): MutationPromise<AddAttendanceRecordData, AddAttendanceRecordVariables>;

interface GetParticipantStatusRef {
  /* Allow users to create refs without passing in DataConnect */
  (vars: GetParticipantStatusVariables): QueryRef<GetParticipantStatusData, GetParticipantStatusVariables>;
  /* Allow users to pass in custom DataConnect instances */
  (dc: DataConnect, vars: GetParticipantStatusVariables): QueryRef<GetParticipantStatusData, GetParticipantStatusVariables>;
  operationName: string;
}
export const getParticipantStatusRef: GetParticipantStatusRef;

export function getParticipantStatus(vars: GetParticipantStatusVariables): QueryPromise<GetParticipantStatusData, GetParticipantStatusVariables>;
export function getParticipantStatus(dc: DataConnect, vars: GetParticipantStatusVariables): QueryPromise<GetParticipantStatusData, GetParticipantStatusVariables>;

interface UpdateParticipantInscriptionRef {
  /* Allow users to create refs without passing in DataConnect */
  (vars: UpdateParticipantInscriptionVariables): MutationRef<UpdateParticipantInscriptionData, UpdateParticipantInscriptionVariables>;
  /* Allow users to pass in custom DataConnect instances */
  (dc: DataConnect, vars: UpdateParticipantInscriptionVariables): MutationRef<UpdateParticipantInscriptionData, UpdateParticipantInscriptionVariables>;
  operationName: string;
}
export const updateParticipantInscriptionRef: UpdateParticipantInscriptionRef;

export function updateParticipantInscription(vars: UpdateParticipantInscriptionVariables): MutationPromise<UpdateParticipantInscriptionData, UpdateParticipantInscriptionVariables>;
export function updateParticipantInscription(dc: DataConnect, vars: UpdateParticipantInscriptionVariables): MutationPromise<UpdateParticipantInscriptionData, UpdateParticipantInscriptionVariables>;

interface ListEventsRef {
  /* Allow users to create refs without passing in DataConnect */
  (): QueryRef<ListEventsData, undefined>;
  /* Allow users to pass in custom DataConnect instances */
  (dc: DataConnect): QueryRef<ListEventsData, undefined>;
  operationName: string;
}
export const listEventsRef: ListEventsRef;

export function listEvents(): QueryPromise<ListEventsData, undefined>;
export function listEvents(dc: DataConnect): QueryPromise<ListEventsData, undefined>;

