/**
 * Script para verificar detalles completos de Firestore
 */

const { initializeApp } = require('firebase/app');
const { getFirestore, collection, getDocs, query, orderBy } = require('firebase/firestore');

const firebaseConfig = {
  apiKey: "AIzaSyDINril47qM50B2S5VuTDwGh4w4ZLRSd4w",
  authDomain: "accesscongress.firebaseapp.com",
  projectId: "accesscongress",
  storageBucket: "accesscongress.firebasestorage.app",
  messagingSenderId: "211521207592",
  appId: "1:211521207592:web:1bd581d39b2740259ca41d"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

async function verifyAll() {
  console.log('🔍 Verificación completa de Firestore\n');

  try {
    const snapshot = await getDocs(collection(db, 'participants'));

    console.log(`📊 TOTAL DE PARTICIPANTES: ${snapshot.size}\n`);

    // Agrupar por permisos
    let conAulaMagna = 0;
    let conMasterClass = 0;
    let conCena = 0;
    let registrados = 0;

    const participantes = [];

    snapshot.forEach(doc => {
      const data = doc.data();
      participantes.push({
        dni: doc.id,
        nombre: data.nombre,
        permisos: data.permisos,
        estado: data.estado
      });

      if (data.permisos?.aula_magna) conAulaMagna++;
      if (data.permisos?.master_class) conMasterClass++;
      if (data.permisos?.cena) conCena++;
      if (data.estado?.registrado) registrados++;
    });

    console.log('📋 RESUMEN DE PERMISOS:');
    console.log(`   Aula Magna: ${conAulaMagna}`);
    console.log(`   Master Class: ${conMasterClass}`);
    console.log(`   Cena: ${conCena}`);
    console.log(`   Registrados: ${registrados}\n`);

    console.log('📑 LISTA COMPLETA (ordenada alfabéticamente):\n');
    participantes
      .sort((a, b) => a.nombre.localeCompare(b.nombre))
      .forEach((p, index) => {
        const permisos = [];
        if (p.permisos?.aula_magna) permisos.push('Aula');
        if (p.permisos?.master_class) permisos.push('MC');
        if (p.permisos?.cena) permisos.push('Cena');

        console.log(`${index + 1}. ${p.nombre} (${p.dni}) - ${permisos.join(', ') || 'Sin permisos'}`);
      });

  } catch (error) {
    console.error('❌ Error:', error.message);
  }

  process.exit(0);
}

verifyAll();
