# Funcionalidades de AccessCongress

Plataforma completa de control de acceso multi-evento y multi-tenant para congresos educativos.

---

## 1. Autenticación y Gestión de Usuarios

### 1.1 Autenticación
- Inicio de sesión con Firebase Auth
- Cierre de sesión
- Persistencia de sesión

### 1.2 Jerarquía de Roles (4 niveles)

| Rol | Descripción | Alcance |
|-----|-------------|---------|
| `super_admin` | Administrador del sistema | Acceso total, gestión de organizaciones |
| `admin_responsable` | Propietario de organización | Gestión completa de su organización |
| `admin` | Gestor de controladores | Crear/gestionar controladores en su organización |
| `controlador` | Operador de eventos | Solo eventos asignados, escaneo QR |

### 1.3 Gestión de Usuarios
- Crear usuarios (vía Cloud Functions)
- Editar datos de usuario
- Cambiar rol de usuario (respetando jerarquía)
- Eliminar usuarios (Auth + Firestore)
- Listar usuarios por organización
- Filtrar por rol

### 1.4 Asignación de Eventos a Controladores
- Asignar múltiples eventos a un controlador
- Agregar/quitar eventos individuales
- Verificar acceso a evento específico
- Listar controladores asignados a un evento

---

## 2. Sistema Multi-Tenant (Organizaciones)

### 2.1 Gestión de Organizaciones
- Crear organización (solo super_admin)
- Editar datos de organización
- Eliminar organización
- Validar nombre único
- Suscripción en tiempo real a cambios

### 2.2 Aislamiento de Datos
- Cada organización tiene sus propios:
  - Usuarios
  - Eventos
  - Participantes
  - Plantillas de email
- Filtrado automático por organización según rol

---

## 3. Gestión de Eventos

### 3.1 CRUD de Eventos
- Crear evento con configuración personalizada
- Editar datos del evento
- Eliminar evento (incluyendo subcollections)
- Clonar evento (sin participantes)
- Validar nombre único

### 3.2 Estados de Evento

| Estado | Descripción |
|--------|-------------|
| `draft` | Borrador, en preparación |
| `active` | Evento activo, permite escaneo |
| `completed` | Evento finalizado |
| `archived` | Archivado |

### 3.3 Configuración de Modos de Acceso
- **Registro**: Check-in inicial
- **Aula Magna**: Acceso al auditorio principal
- **Master Class**: Acceso a sesiones especiales (con permiso)
- **Cena**: Acceso a cena (con permiso)

### 3.4 Reset de Eventos
- **Reset diario**: Reinicia ubicaciones, mantiene registro
- **Reset total**: Reinicia todo a estado inicial

### 3.5 Estadísticas de Evento
- Total de participantes importados
- Participantes registrados
- Estadísticas por modo de acceso

---

## 4. Gestión de Participantes

### 4.1 Importación de Datos

#### Formatos soportados
- CSV (comma-separated values)
- Excel (.xlsx, .xls)

#### Modos de importación
- **Replace**: Elimina datos existentes antes de importar
- **Merge**: Agrega nuevos, actualiza existentes

#### Campos detectados automáticamente
| Campo | Variantes aceptadas |
|-------|---------------------|
| DNI | DNI, Dni, dni, ID, NIF |
| Nombre | Nombre, Name, Nombre Completo |
| Email | Email, Correo, Mail |
| Teléfono | Telefono, Teléfono, Phone |
| Escuela | Escuela, Entidad, Centro |
| Cargo | Cargo, Puesto, Position |
| Master Class | MasterClass, Master Class, MC |
| Cena | Cena, Dinner |
| Acceso | Acceso, Access |
| Ha Pagado | HaPagado, Ha Pagado, Pagado |

#### Manejo de errores
- Detección de duplicados
- Reporte de filas saltadas
- Información de líneas vacías
- Fallback para campos faltantes

### 4.2 Exportación de Datos
- Exportar a Excel (.xlsx)
- Dos hojas:
  - Datos de participantes
  - Logs de acceso

### 4.3 Gestión Individual
- Crear participante manualmente
- Editar datos de participante
- Eliminar participante
- Eliminar todos los participantes

### 4.4 Permisos de Participante
- Aula Magna (por defecto: true)
- Master Class (requiere permiso)
- Cena (requiere permiso)

### 4.5 Estados de Participante
- `registrado`: Ha hecho check-in
- `en_aula_magna`: Actualmente en Aula Magna
- `en_master_class`: Actualmente en Master Class
- `en_cena`: Actualmente en Cena

---

## 5. Sistema de Escaneo QR

### 5.1 Flujo de Escaneo
1. Seleccionar modo (registro, aula_magna, etc.)
2. Seleccionar dirección (entrada/salida)
3. Escanear código QR
4. Validar participante en Firestore
5. Aplicar reglas de negocio
6. Actualizar estado
7. Registrar log de acceso

### 5.2 Validaciones por Modo

| Modo | Validaciones |
|------|--------------|
| Registro | No registrado previamente |
| Aula Magna | Registrado, no dentro (entrada) / dentro (salida) |
| Master Class | Registrado, tiene permiso, no dentro (entrada) / dentro (salida) |
| Cena | Registrado, tiene permiso, no dentro (entrada) / dentro (salida) |

### 5.3 Contenido del QR
```json
{
  "dni": "12345678A",
  "nombre": "Juan Pérez"
}
```
> Los permisos se validan contra Firestore, no están en el QR.

---

## 6. Sistema de Invitaciones por Email

### 6.1 Plantillas de Email
- Crear plantillas personalizadas
- Editor HTML con preview
- Variables dinámicas
- Establecer plantilla por defecto
- Plantilla predeterminada con branding Impuls

### 6.2 Variables Disponibles

#### Variables de Evento
- `{{evento_nombre}}`
- `{{evento_fecha}}`
- `{{evento_ubicacion}}`
- `{{evento_descripcion}}`

#### Variables de Participante
- `{{participante_nombre}}`
- `{{participante_email}}`
- `{{participante_dni}}`
- `{{participante_escuela}}`
- `{{participante_cargo}}`

#### Variables de QR
- `{{qr_url}}` - URL del código QR generado

### 6.3 Envío de Emails
- Envío individual a participante
- Envío masivo con filtros:
  - Solo participantes con email
  - Excluir ya enviados
- Envío vía Cloud Functions

### 6.4 Seguimiento
- Log de todos los envíos
- Estados: pending, sent, failed
- Historial por participante
- Verificar si ya recibió email

---

## 7. Logs y Auditoría

### 7.1 Logs de Acceso
Cada intento de escaneo registra:
- DNI y nombre del participante
- Modo y dirección
- Timestamp
- Operador (UID y nombre)
- Resultado (éxito/fallo)
- Mensaje de validación
- Datos adicionales (email, escuela, cargo, etc.)

### 7.2 Consultas de Logs
- Últimos N logs exitosos
- Logs por participante
- Suscripción en tiempo real

### 7.3 Estadísticas de Acceso
- Entradas únicas por modo
- Máximo simultáneo
- Conteo actual en ubicación

---

## 8. Dashboard en Tiempo Real

### 8.1 Funcionalidades
- Selector de modo de acceso
- Selector de dirección (entrada/salida)
- Botón de escaneo QR
- Cámara inline (web)

### 8.2 Estadísticas en Vivo
- Participantes actualmente en ubicación
- Porcentaje de asistencia
- Máximo simultáneo alcanzado
- Total que han entrado
- Previstos (con permiso)

### 8.3 Lista de Últimos Accesos
- Nombre y DNI
- Email, entidad, cargo
- Dirección (entrada/salida)
- Hora del acceso
- Badges de permisos

---

## 9. Panel de Administración

### 9.1 Secciones

| Sección | Funcionalidades |
|---------|-----------------|
| Mi Perfil | Información del usuario actual |
| Eventos | Gestión completa de eventos |
| Invitaciones | Plantillas y envío de emails |
| Participantes | Importar, exportar, gestionar |
| Usuarios | Crear, editar, asignar eventos |
| Acerca de | Información de la aplicación |

### 9.2 Navegación
- Sidebar colapsable (desktop)
- Drawer modal (móvil)
- Indicador de sección activa

---

## 10. Sincronización Multi-Dispositivo

### 10.1 Suscripciones en Tiempo Real
- Cambios en eventos
- Participantes por ubicación
- Participantes registrados
- Logs de acceso recientes

### 10.2 Casos de Uso
- Múltiples puntos de control simultáneos
- Dashboard central de monitoreo
- Actualizaciones instantáneas entre dispositivos

---

## 11. Estructura de Datos (Firestore)

### 11.1 Colecciones Principales

```
organizations/
  {organizationId}/
    name, description, createdBy, createdAt, updatedAt

users/
  {uid}/
    email, username, role, organizationId, assignedEventIds
    createdAt, createdBy, updatedAt

events/
  {eventId}/
    name, description, date, endDate, location, status
    organizationId, settings, createdBy, createdAt, updatedAt

    participants/          (subcollection)
      {dni}/
        nombre, email, telefono, escuela, cargo
        permisos, estado, acceso, haPagado
        timestamp_registro, ultima_actualizacion

    access_logs/           (subcollection)
      {logId}/
        dni, nombre, modo, direccion, timestamp
        operador, operadorUid, exito, mensaje

    emailTemplates/        (subcollection)
      {templateId}/
        name, subject, bodyHtml, isDefault

    emailLogs/             (subcollection)
      {logId}/
        templateId, participantDni, status, sentAt
```

---

## 12. Tecnologías Utilizadas

### Frontend
- React Native / Expo
- Expo Router (navegación)
- TypeScript

### Backend
- Firebase Authentication
- Cloud Firestore
- Cloud Functions (europe-west1)
- Firebase Hosting

### Librerías Principales
- expo-camera (escaneo QR)
- xlsx (importación/exportación Excel)
- react-native-safe-area-context
- @react-native-async-storage/async-storage

---

## 13. Seguridad

### 13.1 Autenticación
- Firebase Auth con email/password
- Tokens JWT automáticos

### 13.2 Autorización
- Roles jerárquicos
- Permisos granulares (19 tipos)
- Validación en servicios
- Cloud Functions para operaciones sensibles

### 13.3 Aislamiento de Datos
- Filtrado por organización
- Acceso basado en rol
- Eventos asignados para controladores

---

## 14. Flujos de Trabajo Principales

### 14.1 Preparar Evento
1. Crear evento
2. Importar participantes (CSV/Excel)
3. Crear plantilla de email
4. Enviar invitaciones
5. Activar evento

### 14.2 Control de Acceso
1. Controlador inicia sesión
2. Selecciona evento asignado
3. Selecciona modo y dirección
4. Escanea QR de participantes
5. Sistema valida y registra

### 14.3 Monitoreo
1. Abrir dashboard
2. Ver estadísticas en tiempo real
3. Revisar últimos accesos
4. Cambiar entre modos para ver diferentes ubicaciones

### 14.4 Post-Evento
1. Exportar datos a Excel
2. Revisar logs de acceso
3. Reset o archivar evento
