# 🚀 Guía de Configuración Rápida

## Paso 1: Configurar Firebase

### 1.1 Crear proyecto Firebase
1. Ve a https://console.firebase.google.com/
2. Haz clic en "Agregar proyecto"
3. Ingresa el nombre: "Congreso Access Control"
4. Acepta los términos y crea el proyecto

### 1.2 Agregar aplicación Web
1. En la página de inicio del proyecto, haz clic en el ícono Web (</>)
2. Registra la app con el nombre "CongressAccess"
3. No marques "Firebase Hosting"
4. Haz clic en "Registrar app"

### 1.3 Copiar credenciales
Verás algo como esto:

```javascript
const firebaseConfig = {
  apiKey: "AIzaSyXXXXXXXXXXXXXXXXXXXXXXXXXXXXX",
  authDomain: "tu-proyecto.firebaseapp.com",
  projectId: "tu-proyecto",
  storageBucket: "tu-proyecto.appspot.com",
  messagingSenderId: "123456789012",
  appId: "1:123456789012:web:xxxxxxxxxxxxx"
};
```

### 1.4 Actualizar archivo de configuración
1. Abre el archivo `config/firebase.ts`
2. Reemplaza los valores `TU_API_KEY`, etc. con tus valores reales
3. Guarda el archivo

### 1.5 Crear base de datos Firestore
1. En Firebase Console, ve a "Firestore Database"
2. Haz clic en "Crear base de datos"
3. Selecciona "Comenzar en modo de prueba"
4. Elige una ubicación cercana (ej: europe-west1)
5. Haz clic en "Habilitar"

### 1.6 Configurar reglas de seguridad
1. Ve a la pestaña "Reglas" en Firestore
2. Reemplaza el contenido con:

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

3. Haz clic en "Publicar"

**⚠️ IMPORTANTE**: Estas reglas permiten acceso total. Para producción, implementa autenticación y reglas más estrictas.

## Paso 2: Instalar y ejecutar la app

### 2.1 Instalar dependencias
```bash
cd CongressAccess
npm install
```

### 2.2 Iniciar la app
```bash
npx expo start
```

### 2.3 Abrir en dispositivo
- **Opción 1 - Dispositivo físico:**
  1. Instala "Expo Go" desde la Play Store o App Store
  2. Escanea el QR que aparece en la terminal

- **Opción 2 - Emulador Android:**
  1. Presiona `a` en la terminal

- **Opción 3 - Simulador iOS:**
  1. Presiona `i` en la terminal (solo Mac)

## Paso 3: Cargar participantes

### 3.1 Preparar archivo CSV
Usa el archivo de ejemplo `tools/ejemplo_participantes.csv` como plantilla:

```csv
DNI,Nombre,MasterClass,Cena
12345678A,Juan Pérez,Si,Si
23456789B,María García,No,Si
```

### 3.2 Importar en la app
1. En la app, toca "⚙️ Administración"
2. Toca "Importar participantes desde CSV"
3. Selecciona tu archivo CSV
4. Espera a que se complete la importación

## Paso 4: Generar códigos QR

### 4.1 Abrir generador
1. Abre el archivo `tools/generate-qr.html` en tu navegador
2. No necesitas conexión a internet (funciona offline)

### 4.2 Generar QRs para cada participante
1. Ingresa DNI y Nombre (deben coincidir con el CSV)
2. Marca los permisos (Master Class, Cena)
3. Haz clic en "Generar Código QR"
4. Descarga el QR generado
5. Repite para cada participante

### 4.3 Distribuir QRs
- Imprime e incluye en acreditaciones
- Envía por email a los participantes
- Genera tarjetas de identificación

## Paso 5: Usar la app el día del evento

### 5.1 Configurar dispositivos
1. Instala la app en 4 dispositivos móviles
2. Verifica conexión a Internet en todos
3. Asigna cada dispositivo a un punto de control:
   - Dispositivo 1: Registro inicial
   - Dispositivo 2: Entrada Aula Magna
   - Dispositivo 3: Entrada Master Class
   - Dispositivo 4: Entrada Cena

### 5.2 Modo de uso
1. Abre la app en cada dispositivo
2. Selecciona el modo correspondiente
3. Para Aula Magna/Master Class/Cena: elige Entrada o Salida
4. Escanea códigos QR de participantes
5. La app valida automáticamente y muestra resultado

### 5.3 Monitorear asistencia
- Desde cualquier dispositivo, toca "📊 Ver Dashboard"
- Selecciona la ubicación a monitorear
- Verás en tiempo real el número de asistentes y sus nombres

## Solución de Problemas Comunes

### ❌ "Error al conectar con Firebase"
**Solución:** Verifica que las credenciales en `config/firebase.ts` sean correctas

### ❌ "Permission denied" en Firestore
**Solución:** Revisa que las reglas de Firestore estén configuradas correctamente

### ❌ "No se puede escanear QR"
**Solución:**
- Otorga permisos de cámara a la app
- Verifica que el QR esté bien iluminado
- Asegúrate de que el QR contenga datos válidos

### ❌ "No se importa el CSV"
**Solución:**
- Verifica el formato del CSV (separado por comas)
- Asegúrate de usar UTF-8 sin BOM
- Comprueba que no haya campos vacíos

### ❌ Los datos no se sincronizan
**Solución:**
- Verifica conexión a Internet en todos los dispositivos
- Reinicia la app
- Comprueba que todos usen la misma base de datos Firebase

## Contacto y Soporte

Si encuentras problemas:
1. Revisa la documentación completa en `README_APP.md`
2. Verifica los logs en la consola de Expo
3. Inspecciona los datos en Firebase Console > Firestore

## Checklist de Preparación

Antes del evento, verifica:

- [ ] Firebase configurado correctamente
- [ ] Participantes importados en Firestore
- [ ] Códigos QR generados para todos
- [ ] 4 dispositivos con la app instalada
- [ ] Permisos de cámara otorgados
- [ ] Conexión a Internet estable
- [ ] Batería completa en todos los dispositivos
- [ ] Personal capacitado en el uso de la app

¡Listo! Tu sistema de control de acceso está configurado. 🎉
