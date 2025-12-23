# GEMINI.md

## Project Overview

This is a React Native application built with Expo for managing access to a congress. The app allows operators to scan QR codes from participants to grant them access to different areas like "Aula Magna", "Master Class", or "Cena". It uses Firebase Firestore as a real-time database to store participant data and access logs.

The application has the following main screens:

*   **Home:** Main screen with options to navigate to the scanner, dashboard, and admin panel.
*   **Scanner:** Allows operators to scan participant QR codes and validates their access based on their permissions and the selected access mode.
*   **Dashboard:** Provides a real-time overview of the event, including the number of registered participants and the current number of attendees in each area.
*   **Admin:** Offers administrative functionalities like importing participants in bulk from CSV or Excel files and resetting the status of all participants.

## Building and Running

### Prerequisites

*   Node.js and npm installed.
*   Expo CLI installed (`npm install -g expo-cli`).
*   An Expo Go account and the Expo Go app on your mobile device (for testing on a physical device).
*   A Firebase project with Firestore enabled.

### Setup

1.  **Install dependencies:**
    ```bash
    npm install
    ```

2.  **Configure Firebase:**
    *   Open `config/firebase.ts`.
    *   Replace the placeholder Firebase configuration with your own project's configuration.

### Running the application

*   **Start the development server:**
    ```bash
    npx expo start
    ```

*   **Run on Android:**
    ```bash
    npm run android
    ```

*   **Run on iOS:**
    ```bash
    npm run ios
    ```

*   **Run on Web:**
    ```bash
    npm run web
    ```

### Testing

The project does not have a dedicated test suite. However, you can test the application manually using the Expo Go app.

## Development Conventions

*   **File-based routing:** The project uses Expo's file-based routing. The file and folder structure inside the `app` directory defines the navigation of the app.
*   **TypeScript:** The project is written in TypeScript.
*   **ESLint:** The project uses ESLint for code linting. You can run the linter with `npm run lint`.
*   **Firebase:** The application is tightly integrated with Firebase Firestore for data storage and real-time updates. The `services/participantService.ts` file contains most of the logic for interacting with Firestore.
*   **Context API:** The `contexts/AppContext.tsx` file provides a global context for sharing the access mode, direction, and operator across different screens.
*   **UI Components:** The `components` directory contains reusable UI components. The project uses `@expo/vector-icons` and a custom `IconSymbol` component for icons.
*   **Data model:** The data model for participants and access logs is defined in `types/participant.ts` and the GraphQL schema in `dataconnect/schema/schema.gql`.
*   **Excel and CSV import:** The application supports importing participant data from Excel and CSV files. The logic for this is in `services/participantService.ts`.
