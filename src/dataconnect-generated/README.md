# Generated TypeScript README
This README will guide you through the process of using the generated JavaScript SDK package for the connector `example`. It will also provide examples on how to use your generated SDK to call your Data Connect queries and mutations.

**If you're looking for the `React README`, you can find it at [`dataconnect-generated/react/README.md`](./react/README.md)**

***NOTE:** This README is generated alongside the generated SDK. If you make changes to this file, they will be overwritten when the SDK is regenerated.*

# Table of Contents
- [**Overview**](#generated-javascript-readme)
- [**Accessing the connector**](#accessing-the-connector)
  - [*Connecting to the local Emulator*](#connecting-to-the-local-emulator)
- [**Queries**](#queries)
  - [*GetParticipantStatus*](#getparticipantstatus)
  - [*ListEvents*](#listevents)
- [**Mutations**](#mutations)
  - [*AddAttendanceRecord*](#addattendancerecord)
  - [*UpdateParticipantInscription*](#updateparticipantinscription)

# Accessing the connector
A connector is a collection of Queries and Mutations. One SDK is generated for each connector - this SDK is generated for the connector `example`. You can find more information about connectors in the [Data Connect documentation](https://firebase.google.com/docs/data-connect#how-does).

You can use this generated SDK by importing from the package `@dataconnect/generated` as shown below. Both CommonJS and ESM imports are supported.

You can also follow the instructions from the [Data Connect documentation](https://firebase.google.com/docs/data-connect/web-sdk#set-client).

```typescript
import { getDataConnect } from 'firebase/data-connect';
import { connectorConfig } from '@dataconnect/generated';

const dataConnect = getDataConnect(connectorConfig);
```

## Connecting to the local Emulator
By default, the connector will connect to the production service.

To connect to the emulator, you can use the following code.
You can also follow the emulator instructions from the [Data Connect documentation](https://firebase.google.com/docs/data-connect/web-sdk#instrument-clients).

```typescript
import { connectDataConnectEmulator, getDataConnect } from 'firebase/data-connect';
import { connectorConfig } from '@dataconnect/generated';

const dataConnect = getDataConnect(connectorConfig);
connectDataConnectEmulator(dataConnect, 'localhost', 9399);
```

After it's initialized, you can call your Data Connect [queries](#queries) and [mutations](#mutations) from your generated SDK.

# Queries

There are two ways to execute a Data Connect Query using the generated Web SDK:
- Using a Query Reference function, which returns a `QueryRef`
  - The `QueryRef` can be used as an argument to `executeQuery()`, which will execute the Query and return a `QueryPromise`
- Using an action shortcut function, which returns a `QueryPromise`
  - Calling the action shortcut function will execute the Query and return a `QueryPromise`

The following is true for both the action shortcut function and the `QueryRef` function:
- The `QueryPromise` returned will resolve to the result of the Query once it has finished executing
- If the Query accepts arguments, both the action shortcut function and the `QueryRef` function accept a single argument: an object that contains all the required variables (and the optional variables) for the Query
- Both functions can be called with or without passing in a `DataConnect` instance as an argument. If no `DataConnect` argument is passed in, then the generated SDK will call `getDataConnect(connectorConfig)` behind the scenes for you.

Below are examples of how to use the `example` connector's generated functions to execute each query. You can also follow the examples from the [Data Connect documentation](https://firebase.google.com/docs/data-connect/web-sdk#using-queries).

## GetParticipantStatus
You can execute the `GetParticipantStatus` query using the following action shortcut function, or by calling `executeQuery()` after calling the following `QueryRef` function, both of which are defined in [dataconnect-generated/index.d.ts](./index.d.ts):
```typescript
getParticipantStatus(vars: GetParticipantStatusVariables): QueryPromise<GetParticipantStatusData, GetParticipantStatusVariables>;

interface GetParticipantStatusRef {
  ...
  /* Allow users to create refs without passing in DataConnect */
  (vars: GetParticipantStatusVariables): QueryRef<GetParticipantStatusData, GetParticipantStatusVariables>;
}
export const getParticipantStatusRef: GetParticipantStatusRef;
```
You can also pass in a `DataConnect` instance to the action shortcut function or `QueryRef` function.
```typescript
getParticipantStatus(dc: DataConnect, vars: GetParticipantStatusVariables): QueryPromise<GetParticipantStatusData, GetParticipantStatusVariables>;

interface GetParticipantStatusRef {
  ...
  (dc: DataConnect, vars: GetParticipantStatusVariables): QueryRef<GetParticipantStatusData, GetParticipantStatusVariables>;
}
export const getParticipantStatusRef: GetParticipantStatusRef;
```

If you need the name of the operation without creating a ref, you can retrieve the operation name by calling the `operationName` property on the getParticipantStatusRef:
```typescript
const name = getParticipantStatusRef.operationName;
console.log(name);
```

### Variables
The `GetParticipantStatus` query requires an argument of type `GetParticipantStatusVariables`, which is defined in [dataconnect-generated/index.d.ts](./index.d.ts). It has the following fields:

```typescript
export interface GetParticipantStatusVariables {
  id: UUIDString;
}
```
### Return Type
Recall that executing the `GetParticipantStatus` query returns a `QueryPromise` that resolves to an object with a `data` property.

The `data` property is an object of type `GetParticipantStatusData`, which is defined in [dataconnect-generated/index.d.ts](./index.d.ts). It has the following fields:
```typescript
export interface GetParticipantStatusData {
  participantStatus?: {
    inAulaMagna: boolean;
    inCenaClausura: boolean;
    inMasterClass: boolean;
    isRegistered: boolean;
    lastUpdateTimestamp?: TimestampString | null;
  };
}
```
### Using `GetParticipantStatus`'s action shortcut function

```typescript
import { getDataConnect } from 'firebase/data-connect';
import { connectorConfig, getParticipantStatus, GetParticipantStatusVariables } from '@dataconnect/generated';

// The `GetParticipantStatus` query requires an argument of type `GetParticipantStatusVariables`:
const getParticipantStatusVars: GetParticipantStatusVariables = {
  id: ..., 
};

// Call the `getParticipantStatus()` function to execute the query.
// You can use the `await` keyword to wait for the promise to resolve.
const { data } = await getParticipantStatus(getParticipantStatusVars);
// Variables can be defined inline as well.
const { data } = await getParticipantStatus({ id: ..., });

// You can also pass in a `DataConnect` instance to the action shortcut function.
const dataConnect = getDataConnect(connectorConfig);
const { data } = await getParticipantStatus(dataConnect, getParticipantStatusVars);

console.log(data.participantStatus);

// Or, you can use the `Promise` API.
getParticipantStatus(getParticipantStatusVars).then((response) => {
  const data = response.data;
  console.log(data.participantStatus);
});
```

### Using `GetParticipantStatus`'s `QueryRef` function

```typescript
import { getDataConnect, executeQuery } from 'firebase/data-connect';
import { connectorConfig, getParticipantStatusRef, GetParticipantStatusVariables } from '@dataconnect/generated';

// The `GetParticipantStatus` query requires an argument of type `GetParticipantStatusVariables`:
const getParticipantStatusVars: GetParticipantStatusVariables = {
  id: ..., 
};

// Call the `getParticipantStatusRef()` function to get a reference to the query.
const ref = getParticipantStatusRef(getParticipantStatusVars);
// Variables can be defined inline as well.
const ref = getParticipantStatusRef({ id: ..., });

// You can also pass in a `DataConnect` instance to the `QueryRef` function.
const dataConnect = getDataConnect(connectorConfig);
const ref = getParticipantStatusRef(dataConnect, getParticipantStatusVars);

// Call `executeQuery()` on the reference to execute the query.
// You can use the `await` keyword to wait for the promise to resolve.
const { data } = await executeQuery(ref);

console.log(data.participantStatus);

// Or, you can use the `Promise` API.
executeQuery(ref).then((response) => {
  const data = response.data;
  console.log(data.participantStatus);
});
```

## ListEvents
You can execute the `ListEvents` query using the following action shortcut function, or by calling `executeQuery()` after calling the following `QueryRef` function, both of which are defined in [dataconnect-generated/index.d.ts](./index.d.ts):
```typescript
listEvents(): QueryPromise<ListEventsData, undefined>;

interface ListEventsRef {
  ...
  /* Allow users to create refs without passing in DataConnect */
  (): QueryRef<ListEventsData, undefined>;
}
export const listEventsRef: ListEventsRef;
```
You can also pass in a `DataConnect` instance to the action shortcut function or `QueryRef` function.
```typescript
listEvents(dc: DataConnect): QueryPromise<ListEventsData, undefined>;

interface ListEventsRef {
  ...
  (dc: DataConnect): QueryRef<ListEventsData, undefined>;
}
export const listEventsRef: ListEventsRef;
```

If you need the name of the operation without creating a ref, you can retrieve the operation name by calling the `operationName` property on the listEventsRef:
```typescript
const name = listEventsRef.operationName;
console.log(name);
```

### Variables
The `ListEvents` query has no variables.
### Return Type
Recall that executing the `ListEvents` query returns a `QueryPromise` that resolves to an object with a `data` property.

The `data` property is an object of type `ListEventsData`, which is defined in [dataconnect-generated/index.d.ts](./index.d.ts). It has the following fields:
```typescript
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
```
### Using `ListEvents`'s action shortcut function

```typescript
import { getDataConnect } from 'firebase/data-connect';
import { connectorConfig, listEvents } from '@dataconnect/generated';


// Call the `listEvents()` function to execute the query.
// You can use the `await` keyword to wait for the promise to resolve.
const { data } = await listEvents();

// You can also pass in a `DataConnect` instance to the action shortcut function.
const dataConnect = getDataConnect(connectorConfig);
const { data } = await listEvents(dataConnect);

console.log(data.events);

// Or, you can use the `Promise` API.
listEvents().then((response) => {
  const data = response.data;
  console.log(data.events);
});
```

### Using `ListEvents`'s `QueryRef` function

```typescript
import { getDataConnect, executeQuery } from 'firebase/data-connect';
import { connectorConfig, listEventsRef } from '@dataconnect/generated';


// Call the `listEventsRef()` function to get a reference to the query.
const ref = listEventsRef();

// You can also pass in a `DataConnect` instance to the `QueryRef` function.
const dataConnect = getDataConnect(connectorConfig);
const ref = listEventsRef(dataConnect);

// Call `executeQuery()` on the reference to execute the query.
// You can use the `await` keyword to wait for the promise to resolve.
const { data } = await executeQuery(ref);

console.log(data.events);

// Or, you can use the `Promise` API.
executeQuery(ref).then((response) => {
  const data = response.data;
  console.log(data.events);
});
```

# Mutations

There are two ways to execute a Data Connect Mutation using the generated Web SDK:
- Using a Mutation Reference function, which returns a `MutationRef`
  - The `MutationRef` can be used as an argument to `executeMutation()`, which will execute the Mutation and return a `MutationPromise`
- Using an action shortcut function, which returns a `MutationPromise`
  - Calling the action shortcut function will execute the Mutation and return a `MutationPromise`

The following is true for both the action shortcut function and the `MutationRef` function:
- The `MutationPromise` returned will resolve to the result of the Mutation once it has finished executing
- If the Mutation accepts arguments, both the action shortcut function and the `MutationRef` function accept a single argument: an object that contains all the required variables (and the optional variables) for the Mutation
- Both functions can be called with or without passing in a `DataConnect` instance as an argument. If no `DataConnect` argument is passed in, then the generated SDK will call `getDataConnect(connectorConfig)` behind the scenes for you.

Below are examples of how to use the `example` connector's generated functions to execute each mutation. You can also follow the examples from the [Data Connect documentation](https://firebase.google.com/docs/data-connect/web-sdk#using-mutations).

## AddAttendanceRecord
You can execute the `AddAttendanceRecord` mutation using the following action shortcut function, or by calling `executeMutation()` after calling the following `MutationRef` function, both of which are defined in [dataconnect-generated/index.d.ts](./index.d.ts):
```typescript
addAttendanceRecord(vars: AddAttendanceRecordVariables): MutationPromise<AddAttendanceRecordData, AddAttendanceRecordVariables>;

interface AddAttendanceRecordRef {
  ...
  /* Allow users to create refs without passing in DataConnect */
  (vars: AddAttendanceRecordVariables): MutationRef<AddAttendanceRecordData, AddAttendanceRecordVariables>;
}
export const addAttendanceRecordRef: AddAttendanceRecordRef;
```
You can also pass in a `DataConnect` instance to the action shortcut function or `MutationRef` function.
```typescript
addAttendanceRecord(dc: DataConnect, vars: AddAttendanceRecordVariables): MutationPromise<AddAttendanceRecordData, AddAttendanceRecordVariables>;

interface AddAttendanceRecordRef {
  ...
  (dc: DataConnect, vars: AddAttendanceRecordVariables): MutationRef<AddAttendanceRecordData, AddAttendanceRecordVariables>;
}
export const addAttendanceRecordRef: AddAttendanceRecordRef;
```

If you need the name of the operation without creating a ref, you can retrieve the operation name by calling the `operationName` property on the addAttendanceRecordRef:
```typescript
const name = addAttendanceRecordRef.operationName;
console.log(name);
```

### Variables
The `AddAttendanceRecord` mutation requires an argument of type `AddAttendanceRecordVariables`, which is defined in [dataconnect-generated/index.d.ts](./index.d.ts). It has the following fields:

```typescript
export interface AddAttendanceRecordVariables {
  eventId: UUIDString;
  participantId: UUIDString;
  action: string;
  timestamp: TimestampString;
}
```
### Return Type
Recall that executing the `AddAttendanceRecord` mutation returns a `MutationPromise` that resolves to an object with a `data` property.

The `data` property is an object of type `AddAttendanceRecordData`, which is defined in [dataconnect-generated/index.d.ts](./index.d.ts). It has the following fields:
```typescript
export interface AddAttendanceRecordData {
  attendanceRecord_insert: AttendanceRecord_Key;
}
```
### Using `AddAttendanceRecord`'s action shortcut function

```typescript
import { getDataConnect } from 'firebase/data-connect';
import { connectorConfig, addAttendanceRecord, AddAttendanceRecordVariables } from '@dataconnect/generated';

// The `AddAttendanceRecord` mutation requires an argument of type `AddAttendanceRecordVariables`:
const addAttendanceRecordVars: AddAttendanceRecordVariables = {
  eventId: ..., 
  participantId: ..., 
  action: ..., 
  timestamp: ..., 
};

// Call the `addAttendanceRecord()` function to execute the mutation.
// You can use the `await` keyword to wait for the promise to resolve.
const { data } = await addAttendanceRecord(addAttendanceRecordVars);
// Variables can be defined inline as well.
const { data } = await addAttendanceRecord({ eventId: ..., participantId: ..., action: ..., timestamp: ..., });

// You can also pass in a `DataConnect` instance to the action shortcut function.
const dataConnect = getDataConnect(connectorConfig);
const { data } = await addAttendanceRecord(dataConnect, addAttendanceRecordVars);

console.log(data.attendanceRecord_insert);

// Or, you can use the `Promise` API.
addAttendanceRecord(addAttendanceRecordVars).then((response) => {
  const data = response.data;
  console.log(data.attendanceRecord_insert);
});
```

### Using `AddAttendanceRecord`'s `MutationRef` function

```typescript
import { getDataConnect, executeMutation } from 'firebase/data-connect';
import { connectorConfig, addAttendanceRecordRef, AddAttendanceRecordVariables } from '@dataconnect/generated';

// The `AddAttendanceRecord` mutation requires an argument of type `AddAttendanceRecordVariables`:
const addAttendanceRecordVars: AddAttendanceRecordVariables = {
  eventId: ..., 
  participantId: ..., 
  action: ..., 
  timestamp: ..., 
};

// Call the `addAttendanceRecordRef()` function to get a reference to the mutation.
const ref = addAttendanceRecordRef(addAttendanceRecordVars);
// Variables can be defined inline as well.
const ref = addAttendanceRecordRef({ eventId: ..., participantId: ..., action: ..., timestamp: ..., });

// You can also pass in a `DataConnect` instance to the `MutationRef` function.
const dataConnect = getDataConnect(connectorConfig);
const ref = addAttendanceRecordRef(dataConnect, addAttendanceRecordVars);

// Call `executeMutation()` on the reference to execute the mutation.
// You can use the `await` keyword to wait for the promise to resolve.
const { data } = await executeMutation(ref);

console.log(data.attendanceRecord_insert);

// Or, you can use the `Promise` API.
executeMutation(ref).then((response) => {
  const data = response.data;
  console.log(data.attendanceRecord_insert);
});
```

## UpdateParticipantInscription
You can execute the `UpdateParticipantInscription` mutation using the following action shortcut function, or by calling `executeMutation()` after calling the following `MutationRef` function, both of which are defined in [dataconnect-generated/index.d.ts](./index.d.ts):
```typescript
updateParticipantInscription(vars: UpdateParticipantInscriptionVariables): MutationPromise<UpdateParticipantInscriptionData, UpdateParticipantInscriptionVariables>;

interface UpdateParticipantInscriptionRef {
  ...
  /* Allow users to create refs without passing in DataConnect */
  (vars: UpdateParticipantInscriptionVariables): MutationRef<UpdateParticipantInscriptionData, UpdateParticipantInscriptionVariables>;
}
export const updateParticipantInscriptionRef: UpdateParticipantInscriptionRef;
```
You can also pass in a `DataConnect` instance to the action shortcut function or `MutationRef` function.
```typescript
updateParticipantInscription(dc: DataConnect, vars: UpdateParticipantInscriptionVariables): MutationPromise<UpdateParticipantInscriptionData, UpdateParticipantInscriptionVariables>;

interface UpdateParticipantInscriptionRef {
  ...
  (dc: DataConnect, vars: UpdateParticipantInscriptionVariables): MutationRef<UpdateParticipantInscriptionData, UpdateParticipantInscriptionVariables>;
}
export const updateParticipantInscriptionRef: UpdateParticipantInscriptionRef;
```

If you need the name of the operation without creating a ref, you can retrieve the operation name by calling the `operationName` property on the updateParticipantInscriptionRef:
```typescript
const name = updateParticipantInscriptionRef.operationName;
console.log(name);
```

### Variables
The `UpdateParticipantInscription` mutation requires an argument of type `UpdateParticipantInscriptionVariables`, which is defined in [dataconnect-generated/index.d.ts](./index.d.ts). It has the following fields:

```typescript
export interface UpdateParticipantInscriptionVariables {
  id: UUIDString;
  isInscribed: boolean;
}
```
### Return Type
Recall that executing the `UpdateParticipantInscription` mutation returns a `MutationPromise` that resolves to an object with a `data` property.

The `data` property is an object of type `UpdateParticipantInscriptionData`, which is defined in [dataconnect-generated/index.d.ts](./index.d.ts). It has the following fields:
```typescript
export interface UpdateParticipantInscriptionData {
  participant_update?: Participant_Key | null;
}
```
### Using `UpdateParticipantInscription`'s action shortcut function

```typescript
import { getDataConnect } from 'firebase/data-connect';
import { connectorConfig, updateParticipantInscription, UpdateParticipantInscriptionVariables } from '@dataconnect/generated';

// The `UpdateParticipantInscription` mutation requires an argument of type `UpdateParticipantInscriptionVariables`:
const updateParticipantInscriptionVars: UpdateParticipantInscriptionVariables = {
  id: ..., 
  isInscribed: ..., 
};

// Call the `updateParticipantInscription()` function to execute the mutation.
// You can use the `await` keyword to wait for the promise to resolve.
const { data } = await updateParticipantInscription(updateParticipantInscriptionVars);
// Variables can be defined inline as well.
const { data } = await updateParticipantInscription({ id: ..., isInscribed: ..., });

// You can also pass in a `DataConnect` instance to the action shortcut function.
const dataConnect = getDataConnect(connectorConfig);
const { data } = await updateParticipantInscription(dataConnect, updateParticipantInscriptionVars);

console.log(data.participant_update);

// Or, you can use the `Promise` API.
updateParticipantInscription(updateParticipantInscriptionVars).then((response) => {
  const data = response.data;
  console.log(data.participant_update);
});
```

### Using `UpdateParticipantInscription`'s `MutationRef` function

```typescript
import { getDataConnect, executeMutation } from 'firebase/data-connect';
import { connectorConfig, updateParticipantInscriptionRef, UpdateParticipantInscriptionVariables } from '@dataconnect/generated';

// The `UpdateParticipantInscription` mutation requires an argument of type `UpdateParticipantInscriptionVariables`:
const updateParticipantInscriptionVars: UpdateParticipantInscriptionVariables = {
  id: ..., 
  isInscribed: ..., 
};

// Call the `updateParticipantInscriptionRef()` function to get a reference to the mutation.
const ref = updateParticipantInscriptionRef(updateParticipantInscriptionVars);
// Variables can be defined inline as well.
const ref = updateParticipantInscriptionRef({ id: ..., isInscribed: ..., });

// You can also pass in a `DataConnect` instance to the `MutationRef` function.
const dataConnect = getDataConnect(connectorConfig);
const ref = updateParticipantInscriptionRef(dataConnect, updateParticipantInscriptionVars);

// Call `executeMutation()` on the reference to execute the mutation.
// You can use the `await` keyword to wait for the promise to resolve.
const { data } = await executeMutation(ref);

console.log(data.participant_update);

// Or, you can use the `Promise` API.
executeMutation(ref).then((response) => {
  const data = response.data;
  console.log(data.participant_update);
});
```

