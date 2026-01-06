/**
 * Script temporal para agregar roles a usuarios existentes en Firebase Auth
 *
 * Este script solo crea los documentos en Firestore con los roles
 * para los usuarios que ya existen en Firebase Authentication
 */

const { initializeApp } = require('firebase/app');
const { getFirestore, doc, setDoc } = require('firebase/firestore');

// Configuración de Firebase
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
const db = getFirestore(app);

// Usuarios con sus UIDs de Firebase Auth
const usersToFix = [
  {
    uid: 'eiYpDzEhjpZZpZxJMdWWnLBB06G3',
    email: 'admin@impuls.org',
    username: 'admin',
    role: 'administrador',
  },
  {
    uid: 'oBYo4wUnZJTqDhQHKLeRHRXzQiJ2',
    email: 'control@impuls.org',
    username: 'controlador',
    role: 'controlador',
  },
];

async function fixUserRoles() {
  console.log('🔧 Agregando roles en Firestore para usuarios existentes...\n');

  for (const user of usersToFix) {
    try {
      // Crear documento de usuario en Firestore con rol
      await setDoc(doc(db, 'users', user.uid), {
        username: user.username,
        email: user.email,
        role: user.role,
        createdAt: new Date().toISOString(),
      });

      console.log(`✅ Rol agregado para: ${user.email} (${user.role})\n`);
    } catch (error) {
      console.error(`❌ Error agregando rol para ${user.email}:`, error.message, '\n');
    }
  }

  console.log('✅ Proceso completado!\n');
  console.log('Ahora puedes iniciar sesión con:');
  console.log('- Admin: admin@impuls.org / admin123');
  console.log('- Control: control@impuls.org / control123');

  process.exit(0);
}

fixUserRoles();
