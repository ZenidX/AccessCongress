# Configuración de Firebase Authentication

## 📋 Resumen de Cambios

Se ha migrado el sistema de autenticación de usuarios hardcodeados a **Firebase Authentication** con roles almacenados en Firestore.

## ✅ Cambios Implementados

### 1. **Restricciones de Acceso por Rol**
- **Administrador**: Acceso completo (Dashboard + Administración)
- **Controlador**: Acceso limitado (solo Dashboard)

**Implementación:**
- Botón de "Administración" solo visible para administradores
- Protección en la pantalla de administración que redirige si no es administrador

### 2. **Migración a Firebase Authentication**
- Login con email y contraseña usando Firebase Auth
- Roles almacenados en Firestore (colección `users`)
- Sesión persistente automática con Firebase

## 🔧 Configuración Necesaria en Firebase Console

Para que el sistema funcione completamente, necesitas **habilitar Firebase Authentication**:

### Paso 1: Habilitar Authentication

1. Ve a [Firebase Console](https://console.firebase.google.com/)
2. Selecciona tu proyecto: **accesscongress**
3. En el menú lateral, haz clic en **"Authentication"**
4. Haz clic en **"Get Started"** (Comenzar)
5. En la pestaña **"Sign-in method"**, habilita **"Email/Password"**:
   - Haz clic en "Email/Password"
   - Activa el primer switch (Email/Password)
   - NO necesitas activar "Email link (passwordless sign-in)"
   - Haz clic en "Save"

### Paso 2: Crear Usuarios de Prueba

Opción A: **Usando el script automatizado** (recomendado)
```bash
node scripts/create-test-users.js
```

Opción B: **Manualmente desde Firebase Console**

1. Ve a Authentication > Users
2. Haz clic en "Add user"
3. Crea el usuario administrador:
   - Email: `admin@impuls.org`
   - Password: `admin123`
   - Haz clic en "Add user"
4. Crea el usuario controlador:
   - Email: `control@impuls.org`
   - Password: `control123`
   - Haz clic en "Add user"

### Paso 3: Agregar Roles en Firestore

Después de crear los usuarios, necesitas agregar sus roles en Firestore:

1. Ve a Firestore Database en Firebase Console
2. Crea una colección llamada **`users`**
3. Para cada usuario, crea un documento con su **UID** (lo ves en Authentication > Users):

**Documento para Admin:**
- ID del documento: `[UID del usuario admin]`
- Campos:
  ```json
  {
    "username": "admin",
    "email": "admin@impuls.org",
    "role": "administrador",
    "createdAt": "[fecha actual]"
  }
  ```

**Documento para Controlador:**
- ID del documento: `[UID del usuario control]`
- Campos:
  ```json
  {
    "username": "controlador",
    "email": "control@impuls.org",
    "role": "controlador",
    "createdAt": "[fecha actual]"
  }
  ```

## 🔐 Credenciales de Prueba

Una vez configurado, puedes usar estas credenciales:

- **Administrador**:
  - Email: `admin@impuls.org`
  - Password: `admin123`
  - Acceso: Dashboard + Administración

- **Controlador**:
  - Email: `control@impuls.org`
  - Password: `control123`
  - Acceso: Solo Dashboard

## 📝 Estructura de Datos

### Colección `users` en Firestore

```typescript
{
  "users": {
    "[uid]": {
      username: string,      // Nombre de usuario para mostrar
      email: string,         // Email del usuario
      role: "administrador" | "controlador",
      createdAt: string      // Fecha de creación (ISO string)
    }
  }
}
```

## 🎯 Cómo Funciona

1. **Login**: El usuario ingresa email y contraseña
2. **Firebase Auth**: Valida las credenciales
3. **Firestore**: Obtiene el rol del usuario desde la colección `users`
4. **App**: Muestra/oculta opciones según el rol

## ⚠️ Notas Importantes

- Si un usuario no tiene documento en Firestore, se asume rol de **controlador** por defecto
- La sesión persiste automáticamente gracias a Firebase
- Los usuarios solo se pueden crear desde Firebase Console o mediante el script
- Para cambiar el rol de un usuario, edita su documento en Firestore

## 🚀 Próximos Pasos (Opcional)

Para mejorar aún más el sistema, podrías:

1. **Agregar recuperación de contraseña** usando Firebase Auth
2. **Crear una pantalla de gestión de usuarios** en el panel de admin
3. **Agregar más roles** (ej: "supervisor", "operador")
4. **Implementar permisos más granulares** por funcionalidad
