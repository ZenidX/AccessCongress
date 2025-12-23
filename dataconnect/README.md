# Firebase Data Connect - AccessCongress

Este directorio contiene el modelo de datos de Firebase Data Connect (PostgreSQL + GraphQL) para la aplicación AccessCongress.

## Estructura del Proyecto

```
dataconnect/
├── dataconnect.yaml       # Configuración principal del servicio
├── schema/
│   └── schema.gql        # Definición del esquema GraphQL
├── example/
│   ├── connector.yaml    # Configuración del conector
│   └── queries.gql       # Queries y mutations
├── seed_data.gql         # Datos de ejemplo para testing
└── README.md             # Este archivo
```

## Modelo de Datos

### Participant (Participante)
Tabla principal que almacena información de los participantes del congreso.

**Campos:**
- `dni` (String, PRIMARY KEY): DNI del participante
- `nombre` (String): Nombre completo
- `permisos` (Object): Permisos de acceso a diferentes áreas
  - `aula_magna` (Boolean): Permiso para Aula Magna
  - `master_class` (Boolean): Permiso para Master Class
  - `cena` (Boolean): Permiso para Cena de Clausura
- `estado` (Object): Estado actual del participante
  - `registrado` (Boolean): Si está registrado
  - `en_aula_magna` (Boolean): Si está actualmente en Aula Magna
  - `en_master_class` (Boolean): Si está actualmente en Master Class
  - `en_cena` (Boolean): Si está actualmente en Cena
- `timestamp_registro` (Int): Unix timestamp del registro inicial
- `ultima_actualizacion` (Int): Unix timestamp de la última actualización

### AccessLog (Registro de Acceso)
Tabla de auditoría que registra todos los intentos de acceso.

**Campos:**
- `dni` (String): DNI del participante
- `nombre` (String): Nombre del participante
- `modo` (String): Modo de acceso ("registro", "aula_magna", "master_class", "cena")
- `direccion` (String): Dirección del movimiento ("entrada", "salida", null para registro)
- `timestamp` (Int): Unix timestamp del evento
- `operador` (String): Nombre del operador que realizó la acción
- `exito` (Boolean): Si la acción fue exitosa
- `mensaje` (String): Mensaje descriptivo del resultado

## Operaciones Disponibles

### Queries (Consultas)

#### Participantes
- `GetParticipantByDNI`: Obtener un participante por DNI
- `ListAllParticipants`: Listar todos los participantes
- `ListRegisteredParticipants`: Listar solo participantes registrados
- `ListParticipantsInAulaMagna`: Listar participantes en Aula Magna
- `ListParticipantsInMasterClass`: Listar participantes en Master Class
- `ListParticipantsInCena`: Listar participantes en Cena

#### Logs
- `GetAccessLogsByDNI`: Obtener historial de accesos de un participante
- `ListRecentAccessLogs`: Listar logs recientes (con límite)

#### Estadísticas
- `GetLocationStats`: Obtener conteo de participantes por ubicación

### Mutations (Operaciones de Escritura)

- `RegisterParticipant`: Registrar un nuevo participante
- `UpdateParticipantStatus`: Actualizar estado (entradas/salidas)
- `UpdateParticipantPermissions`: Actualizar permisos de acceso
- `LogAccessAttempt`: Registrar un intento de acceso

## Ejemplos de Uso

### Consultar un participante

```graphql
query {
  GetParticipantByDNI(dni: "12345678A") {
    nombre
    permisos {
      aula_magna
      master_class
      cena
    }
    estado {
      en_aula_magna
    }
  }
}
```

### Registrar un participante

```graphql
mutation {
  RegisterParticipant(
    dni: "12345678A",
    nombre: "Juan Pérez",
    aula_magna: true,
    master_class: true,
    cena: false,
    timestamp: 1703145600
  )
}
```

### Actualizar estado (entrada a Aula Magna)

```graphql
mutation {
  UpdateParticipantStatus(
    dni: "12345678A",
    en_aula_magna: true,
    en_master_class: false,
    en_cena: false,
    timestamp: 1703149200
  )
}
```

### Registrar un log de acceso

```graphql
mutation {
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
}
```

## Configuración

### Servicio
- **ID**: `accesscongress`
- **Región**: `us-east4`
- **Base de datos**: `fdcdb` (PostgreSQL)
- **Instancia Cloud SQL**: `accesscongress-fdc`

### Autenticación
Todas las operaciones requieren nivel de autenticación `USER`. Asegúrate de que los usuarios estén autenticados antes de ejecutar queries o mutations.

## Generación de SDK

El conector está configurado para generar un SDK de JavaScript/React en:
- **Output**: `src/dataconnect-generated`
- **Package**: `@dataconnect/generated`

Para generar el SDK, ejecuta:
```bash
firebase dataconnect:sdk:generate
```

## Datos de Ejemplo

Puedes cargar datos de ejemplo ejecutando la mutation en `seed_data.gql`. Esto creará:
- 3 participantes de ejemplo
- 4 logs de acceso de ejemplo

## Integración con Firestore

Este modelo de Data Connect complementa (no reemplaza) el actual sistema de Firestore. Puedes:
- Usar Data Connect para consultas complejas y reportes
- Mantener Firestore para operaciones en tiempo real de la app
- Sincronizar datos entre ambos sistemas según sea necesario

## Próximos Pasos

1. **Deployment**: Desplegar el esquema a Firebase
   ```bash
   firebase deploy --only dataconnect
   ```

2. **Generar SDK**: Generar el SDK de JavaScript para usar en la app
   ```bash
   firebase dataconnect:sdk:generate
   ```

3. **Testing**: Probar las queries y mutations con datos de ejemplo

4. **Migración**: Considerar migrar datos existentes de Firestore a Data Connect si es necesario

## Recursos

- [Firebase Data Connect Docs](https://firebase.google.com/docs/data-connect)
- [GraphQL Docs](https://graphql.org/learn/)
- [Esquema del proyecto](./schema/schema.gql)
- [Operaciones disponibles](./example/queries.gql)
