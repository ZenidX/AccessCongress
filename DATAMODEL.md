# Data Model - AccessCongress

## Resumen Ejecutivo

Este documento describe el modelo de datos de AccessCongress, implementado tanto en **Firestore** (para operaciones en tiempo real) como en **Firebase Data Connect** (PostgreSQL + GraphQL para consultas complejas y reportes).

## Arquitectura de Datos

```
┌─────────────────────────────────────────────────────────┐
│                  APLICACIÓN MÓVIL                       │
│              (React Native + Expo)                      │
└───────────────┬────────────────────┬────────────────────┘
                │                    │
                │                    │
    ┌───────────▼──────────┐    ┌───▼──────────────────┐
    │    FIRESTORE         │    │  DATA CONNECT        │
    │  (Tiempo Real)       │    │  (PostgreSQL)        │
    │                      │    │                      │
    │  • participants/     │    │  • Participant       │
    │  • access_logs/      │    │  • AccessLog         │
    └──────────────────────┘    └──────────────────────┘
           Real-time                  Queries & Reports
           Sync & Updates             Complex Analytics
```

## Entidades Principales

### 1. Participant (Participante)

**Descripción**: Representa un participante del congreso con sus permisos y estado actual.

**Campos**:
```
┌──────────────────────────────────────────────────────┐
│ Participant                                          │
├──────────────────────────────────────────────────────┤
│ 🔑 dni: String (Primary Key)                        │
│ 📝 nombre: String                                    │
│                                                      │
│ 📋 permisos: {                                       │
│    ✓ aula_magna: Boolean                            │
│    ✓ master_class: Boolean                          │
│    ✓ cena: Boolean                                   │
│ }                                                    │
│                                                      │
│ 📍 estado: {                                         │
│    ✓ registrado: Boolean                            │
│    ✓ en_aula_magna: Boolean                         │
│    ✓ en_master_class: Boolean                       │
│    ✓ en_cena: Boolean                               │
│ }                                                    │
│                                                      │
│ 🕒 timestamp_registro: Int (Unix timestamp)         │
│ 🕒 ultima_actualizacion: Int (Unix timestamp)       │
└──────────────────────────────────────────────────────┘
```

**Ejemplo**:
```json
{
  "dni": "12345678A",
  "nombre": "Juan Pérez García",
  "permisos": {
    "aula_magna": true,
    "master_class": true,
    "cena": true
  },
  "estado": {
    "registrado": true,
    "en_aula_magna": true,
    "en_master_class": false,
    "en_cena": false
  },
  "timestamp_registro": 1703145600,
  "ultima_actualizacion": 1703149200
}
```

### 2. AccessLog (Registro de Acceso)

**Descripción**: Auditoría de todos los intentos de acceso (exitosos y fallidos).

**Campos**:
```
┌──────────────────────────────────────────────────────┐
│ AccessLog                                            │
├──────────────────────────────────────────────────────┤
│ 🆔 dni: String                                       │
│ 📝 nombre: String                                    │
│ 🚪 modo: String                                      │
│    ("registro" | "aula_magna" |                      │
│     "master_class" | "cena")                         │
│ ➡️  direccion: String?                               │
│    ("entrada" | "salida" | null)                     │
│ 🕒 timestamp: Int (Unix timestamp)                   │
│ 👤 operador: String?                                 │
│ ✅ exito: Boolean                                    │
│ 💬 mensaje: String?                                  │
└──────────────────────────────────────────────────────┘
```

**Ejemplo**:
```json
{
  "dni": "12345678A",
  "nombre": "Juan Pérez García",
  "modo": "aula_magna",
  "direccion": "entrada",
  "timestamp": 1703149200,
  "operador": "Operador 2",
  "exito": true,
  "mensaje": "Acceso a Aula Magna concedido"
}
```

## Flujo de Datos

### Registro de Participante
```
1. QR Escaneado
   ↓
2. Validar datos QR
   ↓
3. Crear/Actualizar Participant
   • estado.registrado = true
   • timestamp_registro = now
   ↓
4. Crear AccessLog
   • modo = "registro"
   • exito = true
```

### Entrada a Ubicación (Ej: Aula Magna)
```
1. QR Escaneado
   ↓
2. Validar:
   • Participante registrado
   • Tiene permiso (permisos.aula_magna)
   • No está ya dentro (estado.en_aula_magna = false)
   ↓
3. Actualizar Participant
   • estado.en_aula_magna = true
   • ultima_actualizacion = now
   ↓
4. Crear AccessLog
   • modo = "aula_magna"
   • direccion = "entrada"
   • exito = true
```

### Salida de Ubicación
```
1. QR Escaneado
   ↓
2. Validar:
   • Participante está dentro (estado.en_aula_magna = true)
   ↓
3. Actualizar Participant
   • estado.en_aula_magna = false
   • ultima_actualizacion = now
   ↓
4. Crear AccessLog
   • modo = "aula_magna"
   • direccion = "salida"
   • exito = true
```

## Modos de Acceso

| Modo | Requiere Registro | Requiere Permiso | Validación |
|------|------------------|------------------|------------|
| `registro` | ❌ No | ❌ No | Solo una vez |
| `aula_magna` | ✅ Sí | ✅ `permisos.aula_magna` | Estado actual |
| `master_class` | ✅ Sí | ✅ `permisos.master_class` | Estado actual |
| `cena` | ✅ Sí | ✅ `permisos.cena` | Estado actual |

## Reglas de Negocio

### Validaciones
1. **DNI único**: Cada participante tiene un DNI único
2. **Registro obligatorio**: Debe registrarse antes de acceder a ubicaciones
3. **Permisos**: Solo puede acceder a ubicaciones con permiso
4. **No duplicados**: No puede estar en dos ubicaciones simultáneamente
5. **Estado consistente**: entrada/salida debe alternar correctamente

### Auditoría
- **Todos los intentos se registran**: Tanto exitosos como fallidos
- **Información completa**: Quién, cuándo, dónde, resultado
- **Trazabilidad**: Operador responsable de cada acción

## Operaciones GraphQL

### Queries Principales

```graphql
# Buscar participante
GetParticipantByDNI(dni: "12345678A")

# Listar por ubicación
ListParticipantsInAulaMagna()
ListParticipantsInMasterClass()
ListParticipantsInCena()

# Estadísticas
GetLocationStats()

# Historial
GetAccessLogsByDNI(dni: "12345678A")
ListRecentAccessLogs(limit: 100)
```

### Mutations Principales

```graphql
# Registrar participante
RegisterParticipant(
  dni: "12345678A",
  nombre: "Juan Pérez",
  aula_magna: true,
  master_class: true,
  cena: false,
  timestamp: 1703145600
)

# Actualizar estado
UpdateParticipantStatus(
  dni: "12345678A",
  en_aula_magna: true,
  en_master_class: false,
  en_cena: false,
  timestamp: 1703149200
)

# Registrar log
LogAccessAttempt(
  dni: "12345678A",
  nombre: "Juan Pérez",
  modo: "aula_magna",
  direccion: "entrada",
  timestamp: 1703149200,
  operador: "Operador 1",
  exito: true,
  mensaje: "Acceso concedido"
)
```

## Escalabilidad

### Firestore
- **Ventajas**: Real-time sync, offline support, multi-device
- **Uso**: Operaciones de lectura/escritura en la app móvil
- **Límites**: ~1 millón de documentos (suficiente para el proyecto)

### Data Connect (PostgreSQL)
- **Ventajas**: Consultas complejas, joins, agregaciones, reportes
- **Uso**: Analytics, dashboards, exportaciones
- **Límites**: Millones de registros sin problema

## Próximos Pasos

1. ✅ **Esquema definido**
2. ✅ **Operaciones GraphQL creadas**
3. ⏳ **Desplegar a Firebase**
4. ⏳ **Generar SDK de JavaScript**
5. ⏳ **Integrar con la app móvil**
6. ⏳ **Crear dashboard de reportes**

## Referencias

- [Esquema GraphQL](./dataconnect/schema/schema.gql)
- [Operaciones disponibles](./dataconnect/example/queries.gql)
- [Documentación detallada](./dataconnect/README.md)
- [Firebase Data Connect Docs](https://firebase.google.com/docs/data-connect)
