/**
 * Script para crear usuarios de prueba en Firebase Authentication y Firestore
 *
 * Este script crea dos usuarios de prueba:
 * 1. admin@impuls.org - Administrador (acceso completo)
 * 2. control@impuls.org - Controlador (solo dashboard)
 *
 * Instrucciones:
 * 1. Asegúrate de tener las credenciales de Firebase en config/firebase.ts
 * 2. Ejecuta: node scripts/create-test-users.js
 */

const { initializeApp } = require('firebase/app');
const { getAuth, createUserWithEmailAndPassword } = require('firebase/auth');
const { getFirestore, doc, setDoc } = require('firebase/firestore');

// Configuración de Firebase (copia de config/firebase.ts)
const firebaseConfig = {
  apiKey: "AIzaSyDINril47qM50B2S5VuTDwGh4w4ZLRSd4w",
  authDomain: "accesscongress.firebaseapp.com",
  projectId: "accesscongress",
  storageBucket: "accesscongress.firebasestorage.app",
  messagingSenderId: "211521207592",
  appId: "1:211521207592:web:1bd581d39b2740259ca41d",
  measurementId: "G-72RWSE0VCF"
};

// Inicializar Firebase
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

// Usuarios de prueba
const testUsers = [
  {
    email: 'admin@impuls.org',
    password: 'admin123',
    username: 'admin',
    role: 'administrador',
  },
  {
    email: 'control@impuls.org',
    password: 'control123',
    username: 'controlador',
    role: 'controlador',
  },
];

async function createTestUsers() {
  console.log('🔥 Creando usuarios de prueba en Firebase...\n');

  for (const user of testUsers) {
    try {
      // Crear usuario en Firebase Authentication
      const userCredential = await createUserWithEmailAndPassword(
        auth,
        user.email,
        user.password
      );

      console.log(`✅ Usuario creado en Auth: ${user.email}`);

      // Crear documento de usuario en Firestore con rol
      await setDoc(doc(db, 'users', userCredential.user.uid), {
        username: user.username,
        email: user.email,
        role: user.role,
        createdAt: new Date().toISOString(),
      });

      console.log(`✅ Documento creado en Firestore para: ${user.email} (${user.role})\n`);
    } catch (error) {
      if (error.code === 'auth/email-already-in-use') {
        console.log(`ℹ️  Usuario ya existe: ${user.email}\n`);
      } else {
        console.error(`❌ Error creando usuario ${user.email}:`, error.message, '\n');
      }
    }
  }

  console.log('✅ Proceso completado!\n');
  console.log('Credenciales de prueba:');
  console.log('- Admin: admin@impuls.org / admin123');
  console.log('- Control: control@impuls.org / control123');

  process.exit(0);
}

createTestUsers();
