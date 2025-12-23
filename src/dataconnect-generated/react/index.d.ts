import { AddAttendanceRecordData, AddAttendanceRecordVariables, GetParticipantStatusData, GetParticipantStatusVariables, UpdateParticipantInscriptionData, UpdateParticipantInscriptionVariables, ListEventsData } from '../';
import { UseDataConnectQueryResult, useDataConnectQueryOptions, UseDataConnectMutationResult, useDataConnectMutationOptions} from '@tanstack-query-firebase/react/data-connect';
import { UseQueryResult, UseMutationResult} from '@tanstack/react-query';
import { DataConnect } from 'firebase/data-connect';
import { FirebaseError } from 'firebase/app';


export function useAddAttendanceRecord(options?: useDataConnectMutationOptions<AddAttendanceRecordData, FirebaseError, AddAttendanceRecordVariables>): UseDataConnectMutationResult<AddAttendanceRecordData, AddAttendanceRecordVariables>;
export function useAddAttendanceRecord(dc: DataConnect, options?: useDataConnectMutationOptions<AddAttendanceRecordData, FirebaseError, AddAttendanceRecordVariables>): UseDataConnectMutationResult<AddAttendanceRecordData, AddAttendanceRecordVariables>;

export function useGetParticipantStatus(vars: GetParticipantStatusVariables, options?: useDataConnectQueryOptions<GetParticipantStatusData>): UseDataConnectQueryResult<GetParticipantStatusData, GetParticipantStatusVariables>;
export function useGetParticipantStatus(dc: DataConnect, vars: GetParticipantStatusVariables, options?: useDataConnectQueryOptions<GetParticipantStatusData>): UseDataConnectQueryResult<GetParticipantStatusData, GetParticipantStatusVariables>;

export function useUpdateParticipantInscription(options?: useDataConnectMutationOptions<UpdateParticipantInscriptionData, FirebaseError, UpdateParticipantInscriptionVariables>): UseDataConnectMutationResult<UpdateParticipantInscriptionData, UpdateParticipantInscriptionVariables>;
export function useUpdateParticipantInscription(dc: DataConnect, options?: useDataConnectMutationOptions<UpdateParticipantInscriptionData, FirebaseError, UpdateParticipantInscriptionVariables>): UseDataConnectMutationResult<UpdateParticipantInscriptionData, UpdateParticipantInscriptionVariables>;

export function useListEvents(options?: useDataConnectQueryOptions<ListEventsData>): UseDataConnectQueryResult<ListEventsData, undefined>;
export function useListEvents(dc: DataConnect, options?: useDataConnectQueryOptions<ListEventsData>): UseDataConnectQueryResult<ListEventsData, undefined>;
