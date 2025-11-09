# Control de Acceso - Congreso 2025

Aplicación móvil para control de acceso a un congreso con sincronización en tiempo real entre múltiples dispositivos.

## Características

- ✅ **Registro inicial** de participantes al inicio del congreso
- 🏛️ **Control de acceso al Aula Magna** (entrada/salida)
- 🎓 **Control de acceso a Master Class** (entrada/salida) - Solo participantes autorizados
- 🍽️ **Control de acceso a Cena de Clausura** (entrada/salida) - Solo participantes autorizados
- 📊 **Dashboard en tiempo real** con contador y listado de asistentes por ubicación
- 🔄 **Sincronización automática** entre 4 dispositivos simultáneos
- 📱 **Escaneo de códigos QR** con validación inteligente
- 📁 **Importación de participantes** desde archivo CSV

## Requisitos Previos

1. Node.js instalado
2. Expo CLI instalado (`npm install -g expo-cli`)
3. Cuenta de Firebase (plan gratuito es suficiente)
4. Dispositivo móvil con Expo Go o emulador Android/iOS

## Configuración Inicial

### 1. Instalar dependencias

```bash
cd CongressAccess
npm install
```

### 2. Configurar Firebase

1. Ve a [Firebase Console](https://console.firebase.google.com/)
2. Crea un nuevo proyecto o usa uno existente
3. Agrega una app Web al proyecto
4. Copia las credenciales de configuración
5. Edita el archivo `config/firebase.ts` y reemplaza con tus credenciales:

```typescript
const firebaseConfig = {
  apiKey: "TU_API_KEY",
  authDomain: "TU_PROJECT_ID.firebaseapp.com",
  projectId: "TU_PROJECT_ID",
  storageBucket: "TU_PROJECT_ID.appspot.com",
  messagingSenderId: "TU_MESSAGING_SENDER_ID",
  appId: "TU_APP_ID"
};
```

### 3. Configurar reglas de Firestore

En Firebase Console > Firestore Database > Reglas, usa:

```
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /participants/{document=**} {
      allow read, write: if true;
    }
    match /access_logs/{document=**} {
      allow read, write: if true;
    }
  }
}
```

**Nota**: Para producción, implementa reglas de seguridad más estrictas.

### 4. Iniciar la aplicación

```bash
npx expo start
```

Escanea el QR con Expo Go en tu dispositivo móvil o presiona:
- `a` para Android emulator
- `i` para iOS simulator
- `w` para web browser

## Uso de la Aplicación

### Importar Participantes

1. Abre la aplicación y ve a "⚙️ Administración"
2. Toca "Importar participantes desde CSV"
3. Selecciona tu archivo CSV con el formato correcto

**Formato del CSV:**
```csv
DNI,Nombre,MasterClass,Cena
12345678A,Juan Pérez,Si,Si
87654321B,María García,No,Si
11223344C,Pedro López,Si,No
```

- **DNI**: Documento de identidad del participante
- **Nombre**: Nombre completo
- **MasterClass**: "Si" o "No" (o "1"/"0") - Permiso para master class
- **Cena**: "Si" o "No" (o "1"/"0") - Permiso para cena
- Todos los participantes tienen acceso automático al aula magna

### Generar Códigos QR

Usa el script `tools/generate-qr.html` para generar códigos QR:

1. Abre `tools/generate-qr.html` en un navegador
2. Introduce los datos del participante:
   - DNI
   - Nombre
   - Permisos (Master Class, Cena)
3. Haz clic en "Generar QR"
4. Descarga el código QR generado
5. Imprime o envía al participante

### Modos de Control

#### 1. Registro Inicial
- Escanea el QR del participante
- Valida que esté inscrito y no registrado previamente
- Marca como registrado

#### 2. Control Aula Magna (Entrada/Salida)
- **Entrada**: Valida registro previo y que no esté dentro
- **Salida**: Valida que esté dentro
- Actualiza estado en tiempo real

#### 3. Control Master Class (Entrada/Salida)
- **Entrada**: Valida permiso, registro y que no esté dentro
- **Salida**: Valida que esté dentro
- Solo para participantes autorizados

#### 4. Control Cena (Entrada/Salida)
- **Entrada**: Valida permiso, registro y que no esté dentro
- **Salida**: Valida que esté dentro
- Solo para participantes autorizados

### Ver Dashboard

1. En la pantalla principal, toca "📊 Ver Dashboard"
2. Selecciona la ubicación que quieres monitorear
3. Verás en tiempo real:
   - Número total de asistentes
   - Lista de nombres y DNIs
   - Badges con permisos especiales

## Estructura del Proyecto

```
CongressAccess/
├── app/                    # Pantallas de la aplicación
│   ├── index.tsx          # Pantalla principal - Selección de modo
│   ├── scanner.tsx        # Escáner de QR con validaciones
│   ├── dashboard.tsx      # Dashboard en tiempo real
│   └── admin.tsx          # Administración e importación
├── components/            # Componentes reutilizables
├── config/
│   └── firebase.ts        # Configuración de Firebase
├── contexts/
│   └── AppContext.tsx     # Estado global de la app
├── services/
│   └── participantService.ts  # Servicios de Firestore
├── types/
│   └── participant.ts     # Tipos TypeScript
├── utils/
│   └── validations.ts     # Lógica de validación
└── tools/
    └── generate-qr.html   # Generador de códigos QR
```

## Flujo de Validación

### Registro
- ❌ No inscrito → Rechazado
- ❌ Ya registrado → Rechazado
- ✅ Inscrito y no registrado → Aprobado

### Aula Magna (Entrada)
- ❌ No registrado → Rechazado
- ❌ Ya dentro → Rechazado
- ✅ Registrado y fuera → Aprobado

### Master Class (Entrada)
- ❌ Sin permiso → Rechazado
- ❌ No registrado → Rechazado
- ❌ Ya dentro → Rechazado
- ✅ Con permiso, registrado y fuera → Aprobado

### Cena (Entrada)
- ❌ Sin permiso → Rechazado
- ❌ No registrado → Rechazado
- ❌ Ya dentro → Rechazado
- ✅ Con permiso, registrado y fuera → Aprobado

## Sincronización en Tiempo Real

La aplicación utiliza Firestore Realtime Updates para:
- Sincronizar estados entre 4 dispositivos simultáneos
- Actualizar dashboard automáticamente
- Prevenir duplicados y conflictos

## Solución de Problemas

### Error de permisos de cámara
- Asegúrate de otorgar permisos de cámara en la configuración del dispositivo

### No se sincroniza
- Verifica la conexión a Internet
- Revisa la configuración de Firebase
- Comprueba las reglas de Firestore

### Error al importar CSV
- Verifica que el formato sea correcto
- Asegúrate de que el archivo use codificación UTF-8
- No uses espacios extra en los valores

## Herramientas de Administración

### Resetear Estados
En Administración > "Resetear todos los estados":
- Marca todos los participantes como no registrados
- Marca todos como fuera de todas las ubicaciones
- Útil para testing o nuevo evento

## Logs de Acceso

Todos los intentos de acceso se registran en la colección `access_logs` de Firestore con:
- DNI y nombre del participante
- Modo y dirección (entrada/salida)
- Timestamp
- Éxito o fallo
- Mensaje de validación
- Operador que realizó el control

## Desarrollo

### Agregar nuevas validaciones
Edita `utils/validations.ts` y agrega lógica en la función correspondiente.

### Agregar nuevos modos
1. Actualiza el tipo `AccessMode` en `types/participant.ts`
2. Agrega la opción en `app/index.tsx`
3. Implementa la validación en `utils/validations.ts`
4. Actualiza el servicio en `services/participantService.ts`

## Soporte

Para problemas o dudas sobre la aplicación, revisa:
- Logs de la consola de Expo
- Firebase Console para ver datos en tiempo real
- Firestore Database para inspeccionar documentos
