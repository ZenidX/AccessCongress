import { queryRef, executeQuery, mutationRef, executeMutation, validateArgs } from 'firebase/data-connect';

export const connectorConfig = {
  connector: 'example',
  service: 'accesscongress',
  location: 'us-east4'
};

export const addAttendanceRecordRef = (dcOrVars, vars) => {
  const { dc: dcInstance, vars: inputVars} = validateArgs(connectorConfig, dcOrVars, vars, true);
  dcInstance._useGeneratedSdk();
  return mutationRef(dcInstance, 'AddAttendanceRecord', inputVars);
}
addAttendanceRecordRef.operationName = 'AddAttendanceRecord';

export function addAttendanceRecord(dcOrVars, vars) {
  return executeMutation(addAttendanceRecordRef(dcOrVars, vars));
}

export const getParticipantStatusRef = (dcOrVars, vars) => {
  const { dc: dcInstance, vars: inputVars} = validateArgs(connectorConfig, dcOrVars, vars, true);
  dcInstance._useGeneratedSdk();
  return queryRef(dcInstance, 'GetParticipantStatus', inputVars);
}
getParticipantStatusRef.operationName = 'GetParticipantStatus';

export function getParticipantStatus(dcOrVars, vars) {
  return executeQuery(getParticipantStatusRef(dcOrVars, vars));
}

export const updateParticipantInscriptionRef = (dcOrVars, vars) => {
  const { dc: dcInstance, vars: inputVars} = validateArgs(connectorConfig, dcOrVars, vars, true);
  dcInstance._useGeneratedSdk();
  return mutationRef(dcInstance, 'UpdateParticipantInscription', inputVars);
}
updateParticipantInscriptionRef.operationName = 'UpdateParticipantInscription';

export function updateParticipantInscription(dcOrVars, vars) {
  return executeMutation(updateParticipantInscriptionRef(dcOrVars, vars));
}

export const listEventsRef = (dc) => {
  const { dc: dcInstance} = validateArgs(connectorConfig, dc, undefined);
  dcInstance._useGeneratedSdk();
  return queryRef(dcInstance, 'ListEvents');
}
listEventsRef.operationName = 'ListEvents';

export function listEvents(dc) {
  return executeQuery(listEventsRef(dc));
}

