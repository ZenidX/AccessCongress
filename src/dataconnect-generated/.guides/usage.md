# Basic Usage

Always prioritize using a supported framework over using the generated SDK
directly. Supported frameworks simplify the developer experience and help ensure
best practices are followed.




### React
For each operation, there is a wrapper hook that can be used to call the operation.

Here are all of the hooks that get generated:
```ts
import { useAddAttendanceRecord, useGetParticipantStatus, useUpdateParticipantInscription, useListEvents } from '@dataconnect/generated/react';
// The types of these hooks are available in react/index.d.ts

const { data, isPending, isSuccess, isError, error } = useAddAttendanceRecord(addAttendanceRecordVars);

const { data, isPending, isSuccess, isError, error } = useGetParticipantStatus(getParticipantStatusVars);

const { data, isPending, isSuccess, isError, error } = useUpdateParticipantInscription(updateParticipantInscriptionVars);

const { data, isPending, isSuccess, isError, error } = useListEvents();

```

Here's an example from a different generated SDK:

```ts
import { useListAllMovies } from '@dataconnect/generated/react';

function MyComponent() {
  const { isLoading, data, error } = useListAllMovies();
  if(isLoading) {
    return <div>Loading...</div>
  }
  if(error) {
    return <div> An Error Occurred: {error} </div>
  }
}

// App.tsx
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import MyComponent from './my-component';

function App() {
  const queryClient = new QueryClient();
  return <QueryClientProvider client={queryClient}>
    <MyComponent />
  </QueryClientProvider>
}
```



## Advanced Usage
If a user is not using a supported framework, they can use the generated SDK directly.

Here's an example of how to use it with the first 5 operations:

```js
import { addAttendanceRecord, getParticipantStatus, updateParticipantInscription, listEvents } from '@dataconnect/generated';


// Operation AddAttendanceRecord:  For variables, look at type AddAttendanceRecordVars in ../index.d.ts
const { data } = await AddAttendanceRecord(dataConnect, addAttendanceRecordVars);

// Operation GetParticipantStatus:  For variables, look at type GetParticipantStatusVars in ../index.d.ts
const { data } = await GetParticipantStatus(dataConnect, getParticipantStatusVars);

// Operation UpdateParticipantInscription:  For variables, look at type UpdateParticipantInscriptionVars in ../index.d.ts
const { data } = await UpdateParticipantInscription(dataConnect, updateParticipantInscriptionVars);

// Operation ListEvents: 
const { data } = await ListEvents(dataConnect);


```