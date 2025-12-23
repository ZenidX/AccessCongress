const { queryRef, executeQuery, mutationRef, executeMutation, validateArgs } = require('firebase/data-connect');

const connectorConfig = {
  connector: 'example',
  service: 'accesscongress',
  location: 'us-east4'
};
exports.connectorConfig = connectorConfig;

const addAttendanceRecordRef = (dcOrVars, vars) => {
  const { dc: dcInstance, vars: inputVars} = validateArgs(connectorConfig, dcOrVars, vars, true);
  dcInstance._useGeneratedSdk();
  return mutationRef(dcInstance, 'AddAttendanceRecord', inputVars);
}
addAttendanceRecordRef.operationName = 'AddAttendanceRecord';
exports.addAttendanceRecordRef = addAttendanceRecordRef;

exports.addAttendanceRecord = function addAttendanceRecord(dcOrVars, vars) {
  return executeMutation(addAttendanceRecordRef(dcOrVars, vars));
};

const getParticipantStatusRef = (dcOrVars, vars) => {
  const { dc: dcInstance, vars: inputVars} = validateArgs(connectorConfig, dcOrVars, vars, true);
  dcInstance._useGeneratedSdk();
  return queryRef(dcInstance, 'GetParticipantStatus', inputVars);
}
getParticipantStatusRef.operationName = 'GetParticipantStatus';
exports.getParticipantStatusRef = getParticipantStatusRef;

exports.getParticipantStatus = function getParticipantStatus(dcOrVars, vars) {
  return executeQuery(getParticipantStatusRef(dcOrVars, vars));
};

const updateParticipantInscriptionRef = (dcOrVars, vars) => {
  const { dc: dcInstance, vars: inputVars} = validateArgs(connectorConfig, dcOrVars, vars, true);
  dcInstance._useGeneratedSdk();
  return mutationRef(dcInstance, 'UpdateParticipantInscription', inputVars);
}
updateParticipantInscriptionRef.operationName = 'UpdateParticipantInscription';
exports.updateParticipantInscriptionRef = updateParticipantInscriptionRef;

exports.updateParticipantInscription = function updateParticipantInscription(dcOrVars, vars) {
  return executeMutation(updateParticipantInscriptionRef(dcOrVars, vars));
};

const listEventsRef = (dc) => {
  const { dc: dcInstance} = validateArgs(connectorConfig, dc, undefined);
  dcInstance._useGeneratedSdk();
  return queryRef(dcInstance, 'ListEvents');
}
listEventsRef.operationName = 'ListEvents';
exports.listEventsRef = listEventsRef;

exports.listEvents = function listEvents(dc) {
  return executeQuery(listEventsRef(dc));
};
