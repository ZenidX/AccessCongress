# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

**CongressAccess** is an Expo/React Native mobile app for real-time congress access control with multi-device synchronization, designed for **Impuls Educació** (https://impulseducacio.org/). The app manages participant registration, entry/exit tracking across multiple locations (Aula Magna, Master Class, Cena), and provides a real-time dashboard for monitoring attendance.

The system is **multi-tenant**: organizations can have multiple events, each with their own participants, controllers, and access logs.

### Branding

The app follows the **Impuls Educació** brand identity:
- **Primary colors**: Impuls Blue (#00a4e1), Impuls Orange (#ffaf00), Impuls Purple (#9b51e0), Impuls Navy (#212934)
- **Typography**: Open Sans (web), system fonts (native)
- **Design style**: Modern, clean with pill-shaped buttons and soft shadows
- **Logo**: Integrated throughout the app using the `ImpulsLogo` component

## Common Commands

### Development (Mobile App)
```bash
npm install              # Install dependencies
npm start                # Start Expo dev server (or: npx expo start)
npm run android          # Run on Android emulator
npm run ios              # Run on iOS simulator
npm run web              # Run in web browser
npm run lint             # Run ESLint
```

### Cloud Functions
```bash
cd functions
npm install              # Install functions dependencies
npm run build            # Compile TypeScript
npm run serve            # Build and start emulators
npm run deploy           # Deploy functions to Firebase
npm run logs             # View function logs
```

### Firebase Deployment
```bash
firebase deploy --only firestore:rules    # Deploy security rules
firebase deploy --only functions          # Deploy Cloud Functions
firebase deploy --only hosting            # Deploy web build
firebase deploy                           # Deploy everything
```

## Architecture Overview

### Multi-Tenant Hierarchy

```
super_admin (zenid77@gmail.com)
└── organizations/{orgId}
    └── admin_responsable (organization owner)
        ├── admin (manages controllers)
        │   └── controlador (scans QR codes)
        └── events/{eventId}
            ├── participants/{dni}
            └── access_logs/{logId}
```

**Role hierarchy** (`types/user.ts`):
- `super_admin`: Full system access (hardcoded email)
- `admin_responsable`: Organization owner, can create admins/controllers
- `admin`: Can create controllers, manage events in their org
- `controlador`: Can only scan QR and view dashboard for assigned events

### Core Data Flow

1. **Mode Selection** → User selects scan mode and direction in dashboard
2. **QR Scanning** → Scanner opened from dashboard, QR data parsed (`scanner.tsx`)
3. **Validation** → Business rules checked (`utils/validations.ts`)
4. **State Update** → Firestore document updated (`services/participantService.ts`)
5. **Real-time Sync** → All devices receive update via Firestore subscriptions
6. **Access Logging** → All attempts logged to `events/{eventId}/access_logs`

### Dashboard as Control Center

The dashboard (`app/dashboard.tsx`) serves as the main control center:
- **Scan Controls**: Select mode (registro, aula_magna, master_class, cena) and direction (entrada/salida)
- **QR Scanner**: Button to launch camera scanner with selected mode/direction
- **Real-time Stats**: View current participants in each location
- **Live Updates**: Firestore subscriptions update participant lists automatically
- **ScrollView**: Entire dashboard is scrollable to access all content

Key UI features:
1. **Collapsible Mode Selector**:
   - When collapsed: Shows only the selected mode with an expand icon (▼)
   - When expanded: Shows all 4 mode options to select from
   - Automatically collapses after selecting a mode
   - Color coded: Registro (green), Aula Magna (blue), Master Class (orange), Cena (purple)
2. **Direction Selector**: Choose entrada (entry - dark green #2E7D32) or salida (exit - red #f44336) - only shown when mode is not 'registro'
3. **Scrollable Layout**: Uses ScrollView with map() instead of FlatList for better nested scrolling

### State Management

The app uses a hybrid approach:
- **Global UI State**: React Context (`contexts/AppContext.tsx`) manages current access mode, direction (entrada/salida), and operator name
- **Participant Data**: Firebase Firestore with real-time subscriptions for multi-device sync
- **No Redux/Zustand**: Keep context minimal; Firestore is the source of truth

### Access Modes & Validation

Four access modes with distinct validation rules:

1. **registro**: Initial check-in (no entrada/salida)
   - Validates: Not already registered
   - Updates: `estado.registrado = true`

2. **aula_magna**: Main auditorium access
   - Validates: Already registered, not already inside (entrada) / is inside (salida)
   - Updates: `estado.en_aula_magna`

3. **master_class**: Master class access (permission-based)
   - Validates: Has `permisos.master_class`, already registered, location state
   - Updates: `estado.en_master_class`

4. **cena**: Dinner access (permission-based)
   - Validates: Has `permisos.cena`, already registered, location state
   - Updates: `estado.en_cena`

All validation logic centralized in `utils/validations.ts`.

### Firebase Structure

**Collections (multi-tenant):**
```
/organizations/{orgId}              # Organization documents
/users/{uid}                        # User accounts with role & orgId
/events/{eventId}                   # Event documents with organizationId
  /participants/{dni}               # Participant subcollection per event
  /access_logs/{logId}              # Access logs subcollection per event
  /emailTemplates/{templateId}      # Email templates per event
  /emailLogs/{logId}                # Email send logs per event
```

**Legacy collections** (root level, for backward compatibility):
- `/participants/{dni}` - Used when no eventId provided
- `/access_logs/{id}` - Used when no eventId provided

**Participant document fields:**
- `dni`: Primary key (string)
- `nombre`: Full name
- `email`, `telefono`, `escuela`, `cargo`: Optional profile fields
- `permisos`: Object with `aula_magna`, `master_class`, `cena` booleans
- `estado`: Object tracking registration and current locations
- `eventId`: Reference to parent event

**Real-time subscriptions:**
- `subscribeToLocationParticipants()`: Listens to participants in a specific location
- `subscribeToRegisteredParticipants()`: Listens to all registered participants
- Used in dashboard for live updates

### File-Based Routing

The app uses Expo Router with file-based routing:
- `app/index.tsx`: Home screen - simple home with Dashboard and Admin buttons
- `app/scanner.tsx`: QR scanner with validation UI (launched from dashboard)
- `app/dashboard.tsx`: Main screen with scan controls, real-time stats, and participant lists
- `app/admin.tsx`: Admin panel for CSV import and reset functions
- `app/_layout.tsx`: Root layout with AppProvider and navigation theme

**Important**: The QR scanning functionality is controlled from the dashboard, not from index.

### TypeScript Types

All types defined in `types/participant.ts`:
- `AccessMode`: Union type for the 4 access modes
- `AccessDirection`: 'entrada' | 'salida'
- `Participant`: Main participant interface
- `QRData`: Structure expected from QR codes
- `ValidationResult`: Return type from validation functions
- `AccessLog`: Structure for access attempt logs

### Import Formats (CSV/Excel)

Participants can be imported via CSV or Excel (.xlsx). The import function (`services/participantService.ts`) uses case-insensitive, fuzzy column matching:

**Required columns:** `DNI`, `Nombre` (or `Nom` + `Cognoms`)

**Optional columns:** `Mail`, `Telèfon`, `Entitat/Institució`, `Tipus d'Escola`, `Lloc/Responsabilitat`, `Acceso`, `MasterClass`, `Cena`, `Ha Pagat?`

**Import modes:**
- `merge` (default): Add new participants, update existing by DNI
- `replace`: Delete all existing participants first, then import

**Permission logic:**
- `permisos.aula_magna` = true if `Acceso` contains "presencial"
- `permisos.master_class` = true if MasterClass is "Si"/"Sí"/"1"/"yes"/"true"
- `permisos.cena` = true if Cena is "Si"/"Sí"/"1"/"yes"/"true"

## Firebase Configuration

The Firebase config is in `config/firebase.ts`. For new environments:
1. Create Firebase project at console.firebase.google.com
2. Enable Firestore Database
3. Update `firebaseConfig` object in `config/firebase.ts`
4. Deploy Firestore rules with `firebase deploy --only firestore:rules`

### Cloud Functions (`functions/src/`)

Cloud Functions handle server-side operations requiring Firebase Admin SDK:

**Email Functions:**
- `sendSingleEmail`: Send individual email with QR code to participant (uses Resend)
- `sendBulkEmail`: Batch email sending with progress tracking

**User Management:**
- `createUser`: Create user account with role validation
- `deleteUser`: Delete user and clean up references
- `updateUserRole`: Change user role with hierarchy enforcement

**Custom Claims Sync:**
- `syncUserClaims`: Triggered on user document changes, syncs role/orgId/events to JWT
- `refreshUserClaims`: Manually refresh a user's custom claims
- `migrateUserClaims`: One-time migration for existing users

**Event Sync:**
- `onEventCreated`: Auto-assign new events to organization controllers
- `onEventDeleted`: Clean up event references from user assignments

### Security Rules & Custom Claims

Security rules (`firestore.rules`) use **JWT Custom Claims** for performant authorization:

```javascript
// Custom Claims set by Cloud Functions:
request.auth.token.role    // 'super_admin' | 'admin_responsable' | 'admin' | 'controlador'
request.auth.token.orgId   // Organization ID
request.auth.token.events  // Array of assigned event IDs
```

**Key rule behaviors:**
- Super admin hardcoded by email (`zenid77@gmail.com`)
- Organization isolation via `token.orgId`
- Controllers restricted to their `token.events` array
- Audit logs (`access_logs`, `emailLogs`) are immutable (no update/delete)
- Default deny for all unspecified paths

Legacy collections (`/participants`, `/access_logs` at root level) have permissive rules for backward compatibility.

## Key Implementation Notes

### Multi-Device Synchronization
- App designed for 4 simultaneous devices
- Firestore real-time listeners prevent race conditions
- Each QR scan validates against Firestore (participant must already exist from Excel import)
- `upsertParticipantFromQR()` queries Firestore for participant data and permissions

### QR Code Structure
QR codes contain simplified JSON with only identification data:
```json
{
  "dni": "12345678A",
  "nombre": "Juan Pérez"
}
```

**Important:** Permissions are NOT stored in the QR code. They are validated by querying Firestore using the DNI. This ensures:
- QR codes are simpler and smaller
- Permissions can be updated centrally without regenerating QRs
- Single source of truth (Firestore)

Generated using `tools/generate-qr.html` (offline HTML tool).

### Validation Flow
1. Parse QR data (only DNI + nombre)
2. Query Firestore to get participant data and permissions
3. Validate participant exists in database (must be imported from Excel first)
4. Run validation based on mode + direction + permissions from Firestore
5. If valid: update state + log success
6. If invalid: only log failure (no state change)

This ensures idempotency and proper audit trail.

### Camera Permissions
- Handled in `scanner.tsx` with `Camera.requestCameraPermissionsAsync()`
- User must grant camera permissions on first use
- No fallback; camera is essential for QR scanning

## Services Layer (`services/`)

Client-side services for Firestore operations:

- **participantService.ts**: CRUD for participants, import/export, real-time subscriptions, access logging
- **eventService.ts**: Event CRUD, status management
- **userService.ts**: User queries and updates (auth via Cloud Functions)
- **organizationService.ts**: Organization CRUD
- **emailTemplateService.ts**: Email template management
- **emailSendService.ts**: Client-side email sending via Cloud Functions

All services accept optional `eventId` parameter - when omitted, they use legacy root-level collections.

## Common Modification Patterns

### Adding a New Access Mode
1. Add to `AccessMode` type in `types/participant.ts`
2. Add permission field to `ParticipantPermissions` if needed
3. Add state field to `ParticipantStatus` if tracking location
4. Add validation function in `utils/validations.ts`
5. Add case in `updateParticipantStatus()` in `services/participantService.ts`
6. Add mode option to `MODOS` array in `app/index.tsx`
7. Update CSV import logic if new permission column needed

### Modifying Validation Rules
All validation logic lives in `utils/validations.ts`. Each mode has its own validation function (e.g., `validateAulaMagna()`, `validateMasterClass()`). Return `ValidationResult` with `valido` boolean and user-facing `mensaje` string.

### Adding Dashboard Views
Dashboard uses Firestore subscriptions. To add new views:
1. Use `subscribeToLocationParticipants()` or create new query in `participantService.ts`
2. Return `Unsubscribe` function for cleanup
3. Call in `useEffect` with cleanup on unmount

### Adding a New Cloud Function
1. Create function file in `functions/src/functions/`
2. Export from `functions/src/index.ts`
3. Deploy with `cd functions && npm run deploy`
4. If callable from client, add client-side wrapper in `services/`

## Platform-Specific Notes

- **iOS/Android**: Camera permissions handled by Expo (Info.plist / AndroidManifest)
- **Web**: Camera access via browser API; QR scanning may have limited functionality
- App primarily designed for mobile devices

## Theme & Styling

Brand colors defined in `constants/theme.ts` - access via `Colors.light.primary` etc.
Logo component: `components/visuals/impuls-logo.tsx` with size prop (small/medium/large)

## External Tools

- `tools/generate-qr.html`: Standalone HTML for generating participant QR codes (works offline)
