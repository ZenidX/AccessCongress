# Database Structure - AccessCongress

Este documento describe la estructura de la base de datos Firestore para el sistema AccessCongress.

## Modelo Simplificado

**El admin_responsable ES la organización.** No existe una colección separada de `organizations`.

```
admin_responsable.uid = organizationId para todos los usuarios de esa organización
```

## Resumen de Colecciones

```
Firestore Database
├── users/                  # Usuarios del sistema (incluye admin_responsables = organizaciones)
├── events/                 # Eventos por organización
│   ├── participants/       # Participantes del evento (subcollection)
│   └── access_logs/        # Logs de acceso del evento (subcollection)
├── participants/           # [LEGACY] Participantes (colección raíz)
└── access_logs/            # [LEGACY] Logs de acceso (colección raíz)
```

---

## Jerarquía de Roles

```
super_admin (zenid77@gmail.com)
│   └── Acceso total al sistema
│
└── admin_responsable ════════════════════╗
    │   └── ES LA ORGANIZACIÓN            ║
    │       (su UID = organizationId)     ║
    │                                     ║
    └── admin ◄───────────────────────────╝
        │   └── organizationId = UID del admin_responsable
        │
        └── controlador ◄─────────────────╝
                └── organizationId = UID del admin_responsable
```

---

## Colecciones

### 1. `users/{uid}`

Usuarios del sistema. **Los admin_responsables son las organizaciones.**

| Campo | Tipo | Descripción |
|-------|------|-------------|
| `uid` | string | UID de Firebase Auth (igual al ID del documento) |
| `email` | string | Email del usuario |
| `username` | string | Nombre para mostrar (para admin_responsable = nombre de la "organización") |
| `role` | string | Rol: `super_admin`, `admin_responsable`, `admin`, `controlador` |
| `organizationId` | string \| null | **UID del admin_responsable** (null solo para super_admin) |
| `assignedEventIds` | string[] | IDs de eventos asignados (principalmente para controladores) |
| `createdAt` | number | Timestamp de creación |
| `createdBy` | string \| null | UID del usuario que lo creó |
| `updatedAt` | number | Timestamp de última actualización |

#### Reglas de organizationId:

| Rol | organizationId |
|-----|----------------|
| `super_admin` | `null` |
| `admin_responsable` | **Su propio UID** (self-reference) |
| `admin` | UID del admin_responsable de su organización |
| `controlador` | UID del admin_responsable de su organización |

**Ejemplo - Admin Responsable (ES la organización):**
```json
{
  "uid": "eiYpDzEhjpZZpZxJMdWWnLBB06G3",
  "email": "admin@impuls.org",
  "username": "Impuls Educació",
  "role": "admin_responsable",
  "organizationId": "eiYpDzEhjpZZpZxJMdWWnLBB06G3",  // ← Su propio UID
  "assignedEventIds": [],
  "createdAt": 1735039832637,
  "createdBy": null,
  "updatedAt": 1767704783520
}
```

**Ejemplo - Controlador:**
```json
{
  "uid": "vR5JfqYU6kc8roFn8wBbsivlG2W2",
  "email": "miriam99@impuls.org",
  "username": "Miriam",
  "role": "controlador",
  "organizationId": "eiYpDzEhjpZZpZxJMdWWnLBB06G3",  // ← UID del admin_responsable
  "assignedEventIds": ["event123"],
  "createdAt": 1767703577173,
  "createdBy": "eiYpDzEhjpZZpZxJMdWWnLBB06G3",
  "updatedAt": 1767704784156
}
```

---

### 2. `events/{eventId}`

Eventos gestionados por cada organización.

| Campo | Tipo | Descripción |
|-------|------|-------------|
| `id` | string | ID del evento (igual al ID del documento) |
| `organizationId` | string | **UID del admin_responsable** propietario |
| `name` | string | Nombre del evento |
| `description` | string | Descripción del evento |
| `date` | number | Fecha del evento (Unix timestamp) |
| `status` | string | Estado: `draft`, `active`, `completed`, `archived` |
| `settings` | object | Configuración del evento |
| `settings.accessModes` | string[] | Modos de acceso habilitados |
| `createdBy` | string | UID del creador |
| `createdAt` | number | Timestamp de creación |
| `updatedAt` | number | Timestamp de última actualización |

**Ejemplo:**
```json
{
  "id": "abc123",
  "organizationId": "eiYpDzEhjpZZpZxJMdWWnLBB06G3",  // ← UID del admin_responsable
  "name": "Congreso Educación 2026",
  "description": "Evento anual de educación",
  "date": 1767830400000,
  "status": "active",
  "settings": {
    "accessModes": ["registro", "aula_magna", "master_class", "cena"]
  },
  "createdBy": "eiYpDzEhjpZZpZxJMdWWnLBB06G3",
  "createdAt": 1767704000000,
  "updatedAt": 1767704000000
}
```

---

### 3. `events/{eventId}/participants/{participantId}`

Participantes de un evento específico (subcollection).

| Campo | Tipo | Descripción |
|-------|------|-------------|
| `dni` | string | DNI del participante (usado como ID) |
| `nombre` | string | Nombre completo |
| `email` | string | Email (opcional) |
| `telefono` | string | Teléfono (opcional) |
| `escuela` | string | Tipo de escuela (opcional) |
| `cargo` | string | Cargo/Responsabilidad (opcional) |
| `acceso` | string | Tipo de acceso: `presencial`, `online` |
| `haPagado` | boolean | Si ha pagado |
| `permisos` | object | Permisos de acceso a zonas |
| `permisos.aula_magna` | boolean | Acceso a Aula Magna |
| `permisos.master_class` | boolean | Acceso a Master Class |
| `permisos.cena` | boolean | Acceso a Cena |
| `estado` | object | Estado actual del participante |
| `estado.registrado` | boolean | Si está registrado |
| `estado.en_aula_magna` | boolean | Si está en Aula Magna |
| `estado.en_master_class` | boolean | Si está en Master Class |
| `estado.en_cena` | boolean | Si está en Cena |
| `eventId` | string | ID del evento (redundante para queries) |
| `timestamp_registro` | number | Timestamp del primer registro |
| `ultima_actualizacion` | number | Timestamp de última actualización |

**Ejemplo:**
```json
{
  "dni": "12345678A",
  "nombre": "Juan Pérez García",
  "email": "juan@email.com",
  "permisos": {
    "aula_magna": true,
    "master_class": true,
    "cena": false
  },
  "estado": {
    "registrado": true,
    "en_aula_magna": false,
    "en_master_class": false,
    "en_cena": false
  },
  "eventId": "abc123",
  "timestamp_registro": 1767704500000,
  "ultima_actualizacion": 1767705000000
}
```

---

### 4. `events/{eventId}/access_logs/{logId}`

Logs de intentos de acceso para un evento (subcollection).

| Campo | Tipo | Descripción |
|-------|------|-------------|
| `dni` | string | DNI del participante |
| `nombre` | string | Nombre del participante |
| `modo` | string | Modo: `registro`, `aula_magna`, `master_class`, `cena` |
| `direccion` | string | Dirección: `entrada`, `salida` |
| `timestamp` | number | Timestamp del intento |
| `operador` | string | Nombre del operador |
| `operadorUid` | string | UID del operador |
| `exito` | boolean | Si el acceso fue exitoso |
| `mensaje` | string | Mensaje de resultado |
| `eventId` | string | ID del evento |

---

## Relaciones Simplificadas

```
┌─────────────────────────────────────────┐
│              users                       │
│  ┌─────────────────────────────────┐    │
│  │   admin_responsable             │    │
│  │   (uid = organizationId)        │◄───┼─── ES LA ORGANIZACIÓN
│  └─────────────────────────────────┘    │
│           │                              │
│           │ organizationId = uid         │
│           ▼                              │
│  ┌─────────────────────────────────┐    │
│  │   admin / controlador           │    │
│  └─────────────────────────────────┘    │
└─────────────────────────────────────────┘
            │
            │ organizationId = admin_responsable.uid
            ▼
┌─────────────────────────────────────────┐
│              events                      │
│  organizationId = admin_responsable.uid │
└────────────────┬────────────────────────┘
                 │ 1:N
                 ▼
┌─────────────────────────────────────────┐
│         participants (subcollection)    │
└────────────────┬────────────────────────┘
                 │ 1:N
                 ▼
┌─────────────────────────────────────────┐
│         access_logs (subcollection)     │
└─────────────────────────────────────────┘
```

---

## Queries Comunes

### Obtener todos los usuarios de una organización:
```javascript
// organizationId = UID del admin_responsable
const q = query(
  collection(db, 'users'),
  where('organizationId', '==', adminResponsableUid)
);
```

### Obtener eventos de una organización:
```javascript
const q = query(
  collection(db, 'events'),
  where('organizationId', '==', adminResponsableUid)
);
```

### Obtener todos los admin_responsables (= todas las organizaciones):
```javascript
const q = query(
  collection(db, 'users'),
  where('role', '==', 'admin_responsable')
);
```

---

## Índices Requeridos

```json
{
  "indexes": [
    {
      "collectionGroup": "users",
      "fields": [
        { "fieldPath": "organizationId", "order": "ASCENDING" },
        { "fieldPath": "createdAt", "order": "DESCENDING" }
      ]
    },
    {
      "collectionGroup": "users",
      "fields": [
        { "fieldPath": "organizationId", "order": "ASCENDING" },
        { "fieldPath": "role", "order": "ASCENDING" }
      ]
    },
    {
      "collectionGroup": "events",
      "fields": [
        { "fieldPath": "organizationId", "order": "ASCENDING" },
        { "fieldPath": "date", "order": "DESCENDING" }
      ]
    }
  ]
}
```

---

## Reglas de Seguridad (Resumen)

| Colección | super_admin | admin_responsable | admin | controlador |
|-----------|-------------|-------------------|-------|-------------|
| users | CRUD | CRUD (own org) | Read/Create controladores | Read own |
| events | CRUD | CRUD (own org) | CRUD (own org) | Read (assigned) |
| participants | CRUD | CRUD (own events) | CRUD (own events) | Read/Update (assigned) |
| access_logs | Read | Read (own events) | Read (own events) | Read/Create (assigned) |

---

## Tipos de Reset de Evento

### Reset Diario
- Mantiene `estado.registrado = true`
- Limpia `estado.en_aula_magna = false`
- Limpia `estado.en_master_class = false`
- **NO toca** `estado.en_cena`

### Reset Total
- Limpia todo: `registrado`, `en_aula_magna`, `en_master_class`, `en_cena` = `false`

---

## Modos de Acceso

| Modo | Descripción | Requiere Permiso |
|------|-------------|------------------|
| `registro` | Check-in inicial | No |
| `aula_magna` | Acceso a Aula Magna | `permisos.aula_magna` |
| `master_class` | Acceso a Master Class | `permisos.master_class` |
| `cena` | Acceso a Cena | `permisos.cena` |

---

## Notas Importantes

1. **Super Admin Hardcoded**: El email `zenid77@gmail.com` siempre tiene rol `super_admin`
2. **Admin Responsable = Organización**: No existe colección separada de `organizations`
3. **organizationId**: Siempre es el UID del admin_responsable de esa organización
4. **DNI como ID**: Los participantes usan el DNI como ID del documento
5. **Timestamps**: Todos los timestamps son Unix milliseconds (`Date.now()`)
6. **Subcollections**: Los participantes y logs están dentro de eventos para mejor aislamiento
