# Interacciones de AccessCongress

Documento detallado que describe cada interacción del usuario y lo que ocurre en el sistema.

---

## 1. Autenticación

### 1.1 Iniciar Sesión

**Pantalla:** Modal de login (desde cualquier pantalla)

**Interacción del usuario:**
1. Pulsa el botón "Iniciar sesión" en el header
2. Introduce email y contraseña
3. Pulsa "Iniciar sesión"

**Lo que ocurre en el sistema:**
1. `AuthContext.login(email, password)` es llamado
2. Firebase Auth valida las credenciales
3. Si es válido:
   - Se obtiene el `uid` del usuario
   - Se consulta `users/{uid}` en Firestore para obtener datos del perfil
   - Se guarda el usuario en el estado global (`AuthContext`)
   - Se cierra el modal
4. Si falla:
   - Se muestra mensaje de error específico (credenciales inválidas, usuario no encontrado, etc.)

**Datos involucrados:**
```
Firebase Auth → uid, email
Firestore users/{uid} → username, role, organizationId, assignedEventIds
```

---

### 1.2 Cerrar Sesión

**Interacción del usuario:**
1. Pulsa sobre su nombre en el header
2. Se abre menú desplegable
3. Pulsa "Cerrar Sesión"
4. Confirma en el diálogo

**Lo que ocurre en el sistema:**
1. `AuthContext.logout()` es llamado
2. `firebase.auth().signOut()` cierra la sesión en Firebase
3. Se limpia el estado del usuario en `AuthContext`
4. Se limpia el evento actual en `EventContext`
5. Se redirige a la pantalla de inicio

---

## 2. Selección de Evento

### 2.1 Mostrar Selector de Eventos

**Pantalla:** Dashboard o Admin (modal automático)

**Cuándo aparece:**
- Al entrar al dashboard sin evento seleccionado
- Al pulsar en el banner del evento actual

**Lo que ocurre en el sistema:**
1. `EventContext` detecta que no hay `currentEvent`
2. Se llama a `loadAvailableEvents()`:
   - **Super admin:** `getAllEvents()` → todos los eventos
   - **Admin/Admin responsable:** `getEventsByOrganization(organizationId)`
   - **Controlador:** `getEventsByIds(assignedEventIds)`
3. Se ordenan por fecha (más reciente primero)
4. Se muestra el modal con la lista

---

### 2.2 Seleccionar un Evento

**Interacción del usuario:**
1. Pulsa sobre una tarjeta de evento en el selector

**Lo que ocurre en el sistema:**
1. `EventContext.setCurrentEvent(event)` es llamado
2. Se guarda el evento en el estado global
3. Se persiste el `eventId` en `AsyncStorage` para recuperarlo al reabrir la app
4. Se cierra el modal del selector
5. Se actualizan las suscripciones de Firestore para el nuevo evento:
   - Participantes por ubicación
   - Logs de acceso recientes
   - Estadísticas

---

## 3. Dashboard - Control de Acceso

### 3.1 Seleccionar Modo de Acceso

**Pantalla:** Dashboard

**Interacción del usuario:**
1. Pulsa el botón de hamburguesa (móvil) o directamente un modo (web)
2. Selecciona: Registro, Aula Magna, Master Class, o Cena

**Lo que ocurre en el sistema:**
1. `setSelectedMode(mode)` actualiza el estado local
2. Se cancela la suscripción anterior de participantes
3. Se crea nueva suscripción según el modo:
   - **Registro:** `subscribeToRegisteredParticipants(callback, eventId)`
   - **Otros:** `subscribeToLocationParticipants(mode, callback, eventId)`
4. Se actualizan las estadísticas llamando a `getAccessStats(mode, eventId)`
5. Se actualiza la suscripción de logs: `subscribeToRecentAccessLogs(mode, 10, callback, eventId)`

**Datos que cambian en pantalla:**
- Lista de participantes en esa ubicación
- Estadísticas (ahora mismo, máximo, han entrado, previstos)
- Últimos accesos de ese modo

---

### 3.2 Seleccionar Dirección (Entrada/Salida)

**Pantalla:** Dashboard (solo visible si modo ≠ registro)

**Interacción del usuario:**
1. Pulsa "⬇️ Entrada" o "⬆️ Salida"

**Lo que ocurre en el sistema:**
1. `setScanDirection(direction)` actualiza el estado local
2. El valor se guarda para usar en el próximo escaneo
3. No hay cambios en las suscripciones ni datos mostrados

---

### 3.3 Abrir Escáner QR

**Pantalla:** Dashboard → Scanner

**Interacción del usuario:**
1. Pulsa "📷 Escanear QR" (o "Abrir Escáner" en web)

**Lo que ocurre en el sistema:**
1. Verifica que el usuario esté autenticado
2. Si no está autenticado: muestra alerta y no continúa
3. Si está autenticado:
   - `AppContext.setModo(selectedMode)` guarda el modo
   - `AppContext.setDireccion(scanDirection)` guarda la dirección
   - `router.push('/scanner')` navega a la pantalla del escáner

---

### 3.4 Escanear Código QR

**Pantalla:** Scanner

**Interacción del usuario:**
1. Apunta la cámara al código QR
2. El sistema detecta automáticamente el código

**Lo que ocurre en el sistema:**

**Paso 1: Parsear QR**
```javascript
// Contenido del QR
{ "dni": "12345678A", "nombre": "Juan Pérez" }
```

**Paso 2: Buscar participante en Firestore**
```javascript
upsertParticipantFromQR(qrData, eventId)
// Consulta: events/{eventId}/participants/{dni}
```

**Paso 3: Validar según modo y dirección**

| Modo | Dirección | Validaciones |
|------|-----------|--------------|
| registro | - | `!estado.registrado` |
| aula_magna | entrada | `estado.registrado && !estado.en_aula_magna` |
| aula_magna | salida | `estado.registrado && estado.en_aula_magna` |
| master_class | entrada | `estado.registrado && permisos.master_class && !estado.en_master_class` |
| master_class | salida | `estado.registrado && permisos.master_class && estado.en_master_class` |
| cena | entrada | `estado.registrado && permisos.cena && !estado.en_cena` |
| cena | salida | `estado.registrado && permisos.cena && estado.en_cena` |

**Paso 4: Si es válido, actualizar estado**
```javascript
updateParticipantStatus(dni, modo, direccion, eventId)
// Actualiza: events/{eventId}/participants/{dni}
// Campos: estado.{campo}, ultima_actualizacion
```

**Paso 5: Registrar log de acceso**
```javascript
logAccess({
  dni, nombre, modo, direccion,
  timestamp: Date.now(),
  operador: user.username,
  operadorUid: user.uid,
  exito: true/false,
  mensaje: "Entrada registrada" / "Error: ...",
  eventId,
  // Datos adicionales del participante
  email, telefono, escuela, cargo, haPagado, permisos
})
// Crea: events/{eventId}/access_logs/{autoId}
```

**Paso 6: Mostrar resultado**
- ✅ Verde: Acceso permitido + datos del participante
- ❌ Rojo: Acceso denegado + motivo

---

### 3.5 Ver Estadísticas en Tiempo Real

**Pantalla:** Dashboard

**Lo que muestra:**

| Indicador | Cálculo |
|-----------|---------|
| Ahora mismo | Participantes con `estado.en_{modo} = true` |
| Máximo | Mayor valor histórico de simultáneos (de logs) |
| Han entrado | Entradas únicas (DNIs distintos en logs de entrada) |
| Previstos | Participantes con `permisos.{modo} = true` |
| % Asistencia | (Registrados / Total importados) × 100 |

**Actualización:**
- Cada vez que llega un nuevo log, se recalculan las estadísticas
- Suscripción en tiempo real a `access_logs` ordenados por timestamp

---

## 4. Gestión de Participantes

### 4.1 Importar desde CSV/Excel

**Pantalla:** Admin → Participantes

**Interacción del usuario:**
1. Pulsa "Importar Participantes"
2. Selecciona modo: "Reemplazar" o "Agregar/Actualizar"
3. Selecciona archivo CSV o Excel
4. Confirma la importación

**Lo que ocurre en el sistema:**

**Paso 1: Leer archivo**
```javascript
// CSV: se parsea línea por línea
// Excel: se usa librería xlsx para leer
```

**Paso 2: Detectar columnas**
- Busca headers conocidos (DNI, Nombre, Email, etc.)
- Mapea variantes (ej: "Correo" → email)

**Paso 3: Procesar filas**
```javascript
for (cada fila) {
  // Validar DNI (obligatorio)
  if (!dni) → añadir a skippedRows

  // Normalizar datos
  const participante = {
    dni: normalizarDNI(fila.dni),
    nombre: fila.nombre || 'Sin nombre',
    email: fila.email || '',
    telefono: fila.telefono || '',
    escuela: fila.escuela || '',
    cargo: fila.cargo || '',
    acceso: parseBoolean(fila.acceso, true),
    haPagado: parseBoolean(fila.haPagado, false),
    permisos: {
      aula_magna: true, // siempre true
      master_class: parseBoolean(fila.masterClass, false),
      cena: parseBoolean(fila.cena, false)
    },
    estado: {
      registrado: false,
      en_aula_magna: false,
      en_master_class: false,
      en_cena: false
    }
  }

  // Detectar duplicados
  if (dniSet.has(dni)) → añadir a duplicates
}
```

**Paso 4: Escribir en Firestore**
```javascript
// Si modo = 'replace':
await deleteAllParticipants(eventId)

// Batch write (máx 500 por batch)
const batch = firestore.batch()
participantes.forEach(p => {
  const ref = doc(db, `events/${eventId}/participants/${p.dni}`)
  batch.set(ref, p, { merge: modo === 'merge' })
})
await batch.commit()
```

**Paso 5: Mostrar reporte**
```
✅ Importados: 150
⚠️ Duplicados: 3
⏭️ Filas saltadas: 2
📝 Líneas vacías: 5
```

---

### 4.2 Exportar a Excel

**Pantalla:** Admin → Participantes

**Interacción del usuario:**
1. Pulsa "Exportar Datos"

**Lo que ocurre en el sistema:**

**Paso 1: Obtener datos**
```javascript
// Participantes
const participants = await getAllParticipants(eventId)

// Logs de acceso
const logs = await getRecentAccessLogs(modo, 1000, eventId)
```

**Paso 2: Crear Excel con 2 hojas**
```javascript
const workbook = XLSX.utils.book_new()

// Hoja 1: Participantes
const participantsSheet = XLSX.utils.json_to_sheet(participants.map(p => ({
  DNI: p.dni,
  Nombre: p.nombre,
  Email: p.email,
  Teléfono: p.telefono,
  Escuela: p.escuela,
  Cargo: p.cargo,
  'Master Class': p.permisos.master_class ? 'Sí' : 'No',
  'Cena': p.permisos.cena ? 'Sí' : 'No',
  'Registrado': p.estado.registrado ? 'Sí' : 'No',
  // ...
})))

// Hoja 2: Logs
const logsSheet = XLSX.utils.json_to_sheet(logs)

XLSX.utils.book_append_sheet(workbook, participantsSheet, 'Participantes')
XLSX.utils.book_append_sheet(workbook, logsSheet, 'Accesos')
```

**Paso 3: Descargar archivo**
```javascript
XLSX.writeFile(workbook, `${eventName}_datos.xlsx`)
```

---

### 4.3 Agregar Participante Manual

**Pantalla:** Admin → Participantes

**Interacción del usuario:**
1. Pulsa "Agregar Participante"
2. Rellena formulario (DNI obligatorio, resto opcional)
3. Marca permisos (Master Class, Cena)
4. Pulsa "Guardar"

**Lo que ocurre en el sistema:**
```javascript
await createParticipant({
  dni: formData.dni,
  nombre: formData.nombre || 'Sin nombre',
  email: formData.email || '',
  // ... resto de campos
  permisos: {
    aula_magna: true,
    master_class: formData.masterClass,
    cena: formData.cena
  },
  estado: {
    registrado: false,
    en_aula_magna: false,
    en_master_class: false,
    en_cena: false
  },
  eventId
}, eventId)

// Escribe en: events/{eventId}/participants/{dni}
```

---

### 4.4 Eliminar Participante

**Interacción del usuario:**
1. Pulsa icono de papelera en un participante
2. Confirma en el diálogo

**Lo que ocurre en el sistema:**
```javascript
await deleteParticipant(dni, eventId)
// Elimina: events/{eventId}/participants/{dni}
```

---

### 4.5 Reset de Estados

**Pantalla:** Admin → Participantes

**Interacción del usuario:**
1. Pulsa "Reset de Estados"
2. Selecciona tipo:
   - **Reset Diario:** Mantiene `registrado`, resetea ubicaciones
   - **Reset Total:** Resetea todo
3. Confirma

**Lo que ocurre en el sistema:**

**Reset Diario:**
```javascript
// Para cada participante
await updateDoc(ref, {
  'estado.en_aula_magna': false,
  'estado.en_master_class': false,
  'estado.en_cena': false,
  ultima_actualizacion: Date.now()
})
// NO toca estado.registrado
```

**Reset Total:**
```javascript
// Para cada participante
await updateDoc(ref, {
  'estado.registrado': false,
  'estado.en_aula_magna': false,
  'estado.en_master_class': false,
  'estado.en_cena': false,
  timestamp_registro: null,
  ultima_actualizacion: Date.now()
})
```

---

## 5. Gestión de Eventos

### 5.1 Crear Evento

**Pantalla:** Admin → Eventos

**Interacción del usuario:**
1. Pulsa "Crear Evento"
2. Rellena: Nombre, Descripción, Fecha, Ubicación
3. Pulsa "Guardar"

**Lo que ocurre en el sistema:**
```javascript
const eventData = {
  name: formData.name,
  description: formData.description || '',
  date: formData.date.getTime(),
  endDate: formData.endDate?.getTime() || null,
  location: formData.location || '',
  status: 'draft',
  organizationId: user.organizationId,
  settings: {
    accessModes: ['registro', 'aula_magna', 'master_class', 'cena'],
    customModeNames: {}
  },
  createdBy: user.uid,
  createdAt: Date.now(),
  updatedAt: Date.now()
}

const docRef = await addDoc(collection(db, 'events'), eventData)
// Crea: events/{autoId}
```

---

### 5.2 Editar Evento

**Interacción del usuario:**
1. Pulsa icono de editar en un evento
2. Modifica campos
3. Pulsa "Guardar"

**Lo que ocurre en el sistema:**
```javascript
await updateDoc(doc(db, 'events', eventId), {
  name: formData.name,
  description: formData.description,
  date: formData.date.getTime(),
  // ... resto de campos
  updatedAt: Date.now()
})
```

---

### 5.3 Cambiar Estado del Evento

**Interacción del usuario:**
1. Pulsa en el badge de estado
2. Selecciona nuevo estado

**Lo que ocurre en el sistema:**
```javascript
await updateEventStatus(eventId, newStatus)
// Actualiza: events/{eventId}.status
```

**Estados y transiciones:**
```
draft → active → completed → archived
         ↓
      archived
```

---

### 5.4 Eliminar Evento

**Interacción del usuario:**
1. Pulsa icono de eliminar
2. Confirma (doble confirmación para eventos con participantes)

**Lo que ocurre en el sistema:**
```javascript
// 1. Eliminar subcollections
await deleteCollection(`events/${eventId}/participants`)
await deleteCollection(`events/${eventId}/access_logs`)
await deleteCollection(`events/${eventId}/emailTemplates`)
await deleteCollection(`events/${eventId}/emailLogs`)

// 2. Eliminar documento principal
await deleteDoc(doc(db, 'events', eventId))
```

---

### 5.5 Clonar Evento

**Interacción del usuario:**
1. Pulsa "Clonar" en un evento
2. Modifica nombre si desea
3. Confirma

**Lo que ocurre en el sistema:**
```javascript
// Copia datos del evento original
const newEvent = {
  ...originalEvent,
  name: `${originalEvent.name} (copia)`,
  status: 'draft',
  createdAt: Date.now(),
  updatedAt: Date.now()
}

// NO copia participantes, logs, ni plantillas
await addDoc(collection(db, 'events'), newEvent)
```

---

## 6. Sistema de Invitaciones

### 6.1 Crear Plantilla de Email

**Pantalla:** Admin → Invitaciones

**Interacción del usuario:**
1. Pulsa "Nueva Plantilla"
2. Introduce nombre y asunto
3. Edita el HTML del cuerpo
4. Usa el insertador de variables
5. Pulsa "Guardar"

**Lo que ocurre en el sistema:**
```javascript
await createTemplate({
  name: formData.name,
  subject: formData.subject,
  bodyHtml: formData.bodyHtml,
  isDefault: false,
  eventId,
  createdBy: user.uid,
  createdAt: Date.now(),
  updatedAt: Date.now()
})
// Crea: events/{eventId}/emailTemplates/{autoId}
```

---

### 6.2 Insertar Variable en Plantilla

**Interacción del usuario:**
1. Posiciona cursor en el editor HTML
2. Pulsa una variable del panel (ej: "Nombre del participante")

**Lo que ocurre en el sistema:**
```javascript
// Se inserta el placeholder en el cursor
const variable = '{{participante_nombre}}'
editor.insertText(variable)
```

**Variables disponibles:**
| Variable | Se reemplaza por |
|----------|------------------|
| `{{evento_nombre}}` | Nombre del evento |
| `{{evento_fecha}}` | Fecha formateada |
| `{{evento_ubicacion}}` | Ubicación |
| `{{participante_nombre}}` | Nombre del participante |
| `{{participante_dni}}` | DNI |
| `{{participante_email}}` | Email |
| `{{participante_escuela}}` | Escuela/Entidad |
| `{{qr_url}}` | URL de imagen QR generada |

---

### 6.3 Enviar Email Individual

**Pantalla:** Admin → Participantes

**Interacción del usuario:**
1. Pulsa icono de email en un participante
2. Selecciona plantilla
3. Ve preview
4. Pulsa "Enviar"

**Lo que ocurre en el sistema:**

**Paso 1: Generar QR**
```javascript
const qrUrl = await generateQRPreviewUrl({
  dni: participant.dni,
  nombre: participant.nombre
})
// Genera imagen QR como data URL o URL de servicio
```

**Paso 2: Reemplazar variables**
```javascript
let html = template.bodyHtml
html = html.replace(/\{\{participante_nombre\}\}/g, participant.nombre)
html = html.replace(/\{\{participante_dni\}\}/g, participant.dni)
html = html.replace(/\{\{qr_url\}\}/g, qrUrl)
// ... resto de variables
```

**Paso 3: Llamar Cloud Function**
```javascript
const sendEmail = httpsCallable(functions, 'sendEmail')
await sendEmail({
  to: participant.email,
  subject: processedSubject,
  html: processedHtml
})
```

**Paso 4: Registrar log**
```javascript
await addDoc(collection(db, `events/${eventId}/emailLogs`), {
  templateId,
  participantDni: participant.dni,
  participantEmail: participant.email,
  participantNombre: participant.nombre,
  status: 'sent', // o 'failed'
  sentAt: Date.now(),
  createdBy: user.uid
})
```

---

### 6.4 Envío Masivo de Emails

**Pantalla:** Admin → Participantes

**Interacción del usuario:**
1. Pulsa "Enviar Invitaciones"
2. Selecciona plantilla
3. Marca opciones:
   - ☑️ Solo participantes con email
   - ☑️ Excluir los que ya recibieron
4. Pulsa "Enviar a X participantes"

**Lo que ocurre en el sistema:**

**Paso 1: Filtrar participantes**
```javascript
let recipients = participants

if (onlyWithEmail) {
  recipients = recipients.filter(p => p.email && p.email.includes('@'))
}

if (excludeAlreadySent) {
  const sentDnis = await getSentEmailDnis(eventId, templateId)
  recipients = recipients.filter(p => !sentDnis.includes(p.dni))
}
```

**Paso 2: Enviar en lotes**
```javascript
const BATCH_SIZE = 10
for (let i = 0; i < recipients.length; i += BATCH_SIZE) {
  const batch = recipients.slice(i, i + BATCH_SIZE)

  await Promise.all(batch.map(async (participant) => {
    try {
      await sendEmailToParticipant(participant, template, event)
      successCount++
    } catch (error) {
      failedCount++
      // Log error
    }
  }))

  // Pequeña pausa entre lotes para no saturar
  await sleep(1000)
}
```

**Paso 3: Mostrar resultado**
```
✅ Enviados: 145
❌ Fallidos: 3
⏭️ Sin email: 12
```

---

## 7. Gestión de Usuarios

### 7.1 Crear Usuario

**Pantalla:** Admin → Usuarios

**Interacción del usuario:**
1. Pulsa "Crear Usuario"
2. Rellena: Email, Nombre de usuario, Contraseña
3. Selecciona rol (según su jerarquía)
4. Pulsa "Crear"

**Lo que ocurre en el sistema:**

**Paso 1: Validar jerarquía**
```javascript
const creatableRoles = getCreatableRoles(currentUser.role)
if (!creatableRoles.includes(selectedRole)) {
  throw new Error('No tienes permiso para crear este rol')
}
```

**Paso 2: Llamar Cloud Function**
```javascript
// Cloud Function necesaria porque crear usuario en Auth
// requiere permisos de admin
const createUser = httpsCallable(functions, 'createUser')
const result = await createUser({
  email,
  password,
  username,
  role: selectedRole
})
const uid = result.data.uid
```

**Paso 3: Guardar en Firestore**
```javascript
await setDoc(doc(db, 'users', uid), {
  uid,
  email,
  username,
  role: selectedRole,
  organizationId: currentUser.organizationId, // hereda organización
  assignedEventIds: [],
  createdAt: Date.now(),
  createdBy: currentUser.uid,
  updatedAt: Date.now()
})
```

---

### 7.2 Asignar Eventos a Controlador

**Pantalla:** Admin → Usuarios (o Eventos → Asignar)

**Interacción del usuario:**
1. Selecciona un controlador
2. Marca/desmarca eventos de la lista
3. Pulsa "Guardar"

**Lo que ocurre en el sistema:**
```javascript
await assignEventsToUser(controladorUid, selectedEventIds)

// Actualiza: users/{uid}.assignedEventIds = [eventId1, eventId2, ...]
```

**Efecto:**
- El controlador solo verá esos eventos en su selector
- Solo podrá escanear QR en eventos asignados

---

### 7.3 Cambiar Rol de Usuario

**Interacción del usuario:**
1. Pulsa en el badge de rol de un usuario
2. Selecciona nuevo rol
3. Confirma

**Lo que ocurre en el sistema:**

**Validación de jerarquía:**
```javascript
// Solo puede cambiar roles "menores"
// super_admin > admin_responsable > admin > controlador

if (!canManageRole(currentUser.role, targetUser.role)) {
  throw new Error('No puedes gestionar este usuario')
}

if (!canManageRole(currentUser.role, newRole)) {
  throw new Error('No puedes asignar este rol')
}
```

**Actualización:**
```javascript
await updateUserRole(targetUid, newRole)
// Actualiza: users/{uid}.role
```

---

### 7.4 Eliminar Usuario

**Interacción del usuario:**
1. Pulsa icono de eliminar en un usuario
2. Confirma

**Lo que ocurre en el sistema:**

**Paso 1: Validar jerarquía**
```javascript
if (!canManageRole(currentUser.role, targetUser.role)) {
  throw new Error('No puedes eliminar este usuario')
}
```

**Paso 2: Eliminar de Auth (Cloud Function)**
```javascript
const deleteUser = httpsCallable(functions, 'deleteUser')
await deleteUser({ uid: targetUid })
```

**Paso 3: Eliminar de Firestore**
```javascript
await deleteDoc(doc(db, 'users', targetUid))
```

---

## 8. Navegación Móvil

### 8.1 Abrir Menú Lateral (Admin)

**Interacción del usuario:**
1. Pulsa el botón hamburguesa (☰) en el header

**Lo que ocurre en el sistema:**
1. `setMobileDrawerOpen(true)` abre el modal
2. Se renderiza el drawer con animación fade
3. El sidebar aparece desde la izquierda
4. El resto de la pantalla se oscurece (backdrop)

---

### 8.2 Seleccionar Sección en Menú

**Interacción del usuario:**
1. Pulsa una opción del menú (ej: "Participantes")

**Lo que ocurre en el sistema:**
1. `handleSelectSection('participants')` es llamado
2. Se actualiza `selectedSection` en el estado
3. Se llama `onCloseDrawer()` para cerrar el menú
4. El contenido principal cambia al componente correspondiente

---

### 8.3 Cerrar Menú

**Interacción del usuario:**
- Pulsa el botón ✕
- O pulsa en el backdrop oscuro

**Lo que ocurre en el sistema:**
1. `setMobileDrawerOpen(false)`
2. El modal se oculta con animación fade

---

## 9. Flujos Completos

### 9.1 Flujo: Preparar Nuevo Evento

```
1. Admin crea evento (draft)
   └── events/{id} creado

2. Admin importa Excel con participantes
   └── events/{id}/participants/{dni} × N

3. Admin crea plantilla de email
   └── events/{id}/emailTemplates/{id}

4. Admin envía invitaciones masivas
   └── Cloud Function envía emails
   └── events/{id}/emailLogs/{id} × N

5. Admin activa evento
   └── events/{id}.status = 'active'

6. Admin asigna controladores
   └── users/{uid}.assignedEventIds incluye eventId
```

### 9.2 Flujo: Día del Evento

```
1. Controlador inicia sesión
   └── AuthContext carga usuario

2. Controlador selecciona evento
   └── EventContext.currentEvent = evento

3. Controlador selecciona modo "Registro"
   └── Dashboard muestra estadísticas de registro

4. Participante llega, muestra QR

5. Controlador escanea QR
   └── Se parsea QR
   └── Se busca en Firestore
   └── Se valida (no registrado previamente)
   └── Se actualiza estado.registrado = true
   └── Se crea log de acceso
   └── Se muestra ✅ en pantalla

6. Dashboard se actualiza en tiempo real
   └── +1 en contador de registrados
   └── Nuevo log aparece en "Últimos accesos"

7. Participante entra a Aula Magna

8. Controlador cambia a modo "Aula Magna" + "Entrada"

9. Controlador escanea QR
   └── Se valida (registrado + no dentro)
   └── Se actualiza estado.en_aula_magna = true
   └── Se crea log de acceso
```

### 9.3 Flujo: Post-Evento

```
1. Admin exporta datos
   └── Excel con participantes + logs

2. Admin revisa estadísticas finales
   └── Total registrados
   └── Máximo simultáneo por ubicación

3. Admin hace reset total (si hay otro día)
   └── Todos los estados a false
   └── Logs se mantienen

4. O admin archiva evento
   └── events/{id}.status = 'archived'
```

---

## 10. Manejo de Errores

### 10.1 Errores de Escaneo

| Error | Causa | Mensaje mostrado |
|-------|-------|------------------|
| QR inválido | JSON mal formado | "Código QR no válido" |
| No encontrado | DNI no existe en evento | "Participante no encontrado" |
| Ya registrado | `estado.registrado = true` | "Ya está registrado" |
| Sin permiso | `permisos.cena = false` | "No tiene permiso para Cena" |
| Ya dentro | `estado.en_aula_magna = true` | "Ya está en Aula Magna" |
| No está dentro | Salida sin entrada previa | "No está en Aula Magna" |

### 10.2 Errores de Importación

| Error | Causa | Acción |
|-------|-------|--------|
| Sin DNI | Fila sin columna DNI | Se salta la fila |
| DNI duplicado | Mismo DNI en archivo | Se reporta, se usa el último |
| Archivo vacío | Sin datos | Se muestra error |
| Formato inválido | No es CSV/Excel | Se muestra error |

### 10.3 Errores de Email

| Error | Causa | Acción |
|-------|-------|--------|
| Sin email | Participante sin email | Se salta |
| Email inválido | Formato incorrecto | Se intenta, falla |
| Límite API | Demasiados envíos | Reintentar después |
| Cloud Function error | Error del servidor | Log de error |
