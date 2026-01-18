# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

**CongressAccess** is an Expo/React Native mobile app for real-time congress access control with multi-device synchronization, designed for **Impuls Educació** (https://impulseducacio.org/). The app manages participant registration, entry/exit tracking across multiple locations (Aula Magna, Master Class, Cena), and provides a real-time dashboard for monitoring attendance.

### Branding

The app follows the **Impuls Educació** brand identity:
- **Primary colors**: Impuls Blue (#00a4e1), Impuls Orange (#ffaf00), Impuls Purple (#9b51e0), Impuls Navy (#212934)
- **Typography**: Open Sans (web), system fonts (native)
- **Design style**: Modern, clean with pill-shaped buttons and soft shadows
- **Logo**: Integrated throughout the app using the `ImpulsLogo` component

## Common Commands

### Development
```bash
# Install dependencies
npm install

# Start development server
npm start
# or
npx expo start

# Run on specific platform
npm run android    # Android emulator
npm run ios        # iOS simulator
npm run web        # Web browser
```

### Code Quality
```bash
# Run linter
npm run lint
```

### Project Reset
```bash
# Reset to blank project (moves starter code to app-example/)
npm run reset-project
```

## Architecture Overview

### Core Data Flow

1. **Mode Selection** → User selects scan mode and direction in dashboard
2. **QR Scanning** → Scanner opened from dashboard, QR data parsed (`scanner.tsx`)
3. **Validation** → Business rules checked (`utils/validations.ts`)
4. **State Update** → Firestore document updated (`services/participantService.ts`)
5. **Real-time Sync** → All devices receive update via Firestore subscriptions
6. **Access Logging** → All attempts logged to `access_logs` collection

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

**Collections:**
- `participants/{dni}`: Participant documents
  - `dni`: Primary key (string)
  - `nombre`: Full name
  - `permisos`: Object with `aula_magna`, `master_class`, `cena` booleans
  - `estado`: Object tracking registration and current locations
  - `timestamp_registro`: Unix timestamp of initial registration
  - `ultima_actualizacion`: Unix timestamp of last update

- `access_logs/{id}`: Access attempt logs
  - Auto-generated IDs
  - Contains dni, nombre, modo, direccion, timestamp, operador, exito, mensaje

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

### CSV Import Format

When importing participants via admin panel, CSV must follow this format:
```csv
DNI,Nombre,MasterClass,Cena
12345678A,Juan Pérez,Si,Si
87654321B,María García,No,Si
```

- All participants get `permisos.aula_magna = true` automatically
- MasterClass/Cena: accepts "Si"/"No" or "1"/"0" (case-insensitive)
- Handled in `services/participantService.ts::importParticipantsFromCSV()`

## Firebase Configuration

The Firebase config is in `config/firebase.ts`. For new environments:
1. Create Firebase project at console.firebase.google.com
2. Enable Firestore Database
3. Update `firebaseConfig` object in `config/firebase.ts`
4. Deploy Firestore rules with `firebase deploy --only firestore:rules`

### Security Rules (firestore.rules)

The Firestore security rules are **production-ready** with comprehensive access control:

- **Role-based access**: 4-level hierarchy (super_admin, admin_responsable, admin, controlador)
- **Organization isolation**: Users can only access data within their organization
- **Event-level permissions**: Controllers only access their assigned events
- **Immutable audit logs**: `access_logs` and `emailLogs` cannot be modified or deleted
- **Default deny**: All unspecified paths are blocked

Key rules:
- Super admin is hardcoded by email (`zenid77@gmail.com`)
- Admin roles can manage events/participants in their organization
- Controllers can update participant status (for scanning) but not delete
- Users cannot change their own role or organization

Legacy collections (`/participants`, `/access_logs` at root level) have more permissive rules for backward compatibility.

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

## Platform-Specific Notes

- **iOS**: Requires `expo-camera` permissions in Info.plist (handled by Expo)
- **Android**: Requires `CAMERA` permission (handled by Expo)
- **Web**: Camera access via browser API; QR scanning may have limited functionality
- App primarily designed for **mobile devices** (iOS/Android)

## Branding Components

### ImpulsLogo Component
Location: `components/impuls-logo.tsx`

Reusable component for displaying the Impuls Educació logo:
```tsx
import { ImpulsLogo } from '@/components/impuls-logo';

// Usage
<ImpulsLogo size="large" /> // small | medium | large
```

The logo is displayed on:
- Home screen (index.tsx) - large size
- Dashboard (dashboard.tsx) - medium size
- Admin panel (admin.tsx) - medium size

Logo source: `https://impulseducacio.org/wp-content/uploads/2020/02/logo-web-impuls.png`

### Theme Colors
All Impuls Educació brand colors are defined in `constants/theme.ts`:
- Primary: `#00a4e1` (Impuls Blue)
- Secondary: `#ffaf00` (Impuls Orange)
- Purple: `#9b51e0` (Impuls Purple - used for Cena)
- Accent: `#212934` (Impuls Navy)
- Text: `#48626f` (Impuls Gray)
- Light Background: `#f6f6f6`

Access colors via: `Colors.light.primary` or `Colors.dark.primary`

## External Tools

- `tools/generate-qr.html`: Standalone HTML page for generating participant QR codes (works offline, no dependencies)

## Documentation Files

- `README_APP.md`: Comprehensive user guide in Spanish (features, usage, troubleshooting)
- `INSTRUCCIONES_SETUP.md`: Step-by-step setup guide in Spanish (Firebase config, deployment checklist)
