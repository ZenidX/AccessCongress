/**
 * Script de prueba para importar Excel y verificar datos completos
 */

const { initializeApp } = require('firebase/app');
const { getFirestore, collection, getDocs } = require('firebase/firestore');
const XLSX = require('xlsx');
const path = require('path');

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

async function testImportedData() {
  console.log('🔍 Verificando datos importados en Firestore\n');

  try {
    const snapshot = await getDocs(collection(db, 'participants'));
    console.log(`📊 Total de participantes: ${snapshot.size}\n`);

    if (snapshot.size === 0) {
      console.log('⚠️  No hay participantes. Importa el Excel primero.\n');
      process.exit(0);
    }

    // Mostrar 3 ejemplos completos
    console.log('📋 EJEMPLOS DE DATOS COMPLETOS:\n');
    let count = 0;
    snapshot.forEach(doc => {
      if (count < 3) {
        const data = doc.data();
        console.log(`${count + 1}. ${data.nombre} (${doc.id})`);
        console.log(`   Email: ${data.email || 'N/A'}`);
        console.log(`   Teléfono: ${data.telefono || 'N/A'}`);
        console.log(`   Escuela: ${data.escuela || 'N/A'}`);
        console.log(`   Cargo: ${data.cargo || 'N/A'}`);
        console.log(`   Acceso: ${data.acceso || 'N/A'}`);
        console.log(`   Ha pagado: ${data.haPagado ? 'Sí' : 'No'}`);
        console.log('   Permisos:');
        console.log(`     Aula Magna: ${data.permisos?.aula_magna ? 'Sí' : 'No'}`);
        console.log(`     Master Class: ${data.permisos?.master_class ? 'Sí' : 'No'}`);
        console.log(`     Cena: ${data.permisos?.cena ? 'Sí' : 'No'}`);
        console.log('');
        count++;
      }
    });

    // Estadísticas
    let conEmail = 0;
    let conTelefono = 0;
    let conEscuela = 0;
    let conCargo = 0;
    let hanPagado = 0;
    let conAccesoPresencial = 0;

    snapshot.forEach(doc => {
      const data = doc.data();
      if (data.email) conEmail++;
      if (data.telefono) conTelefono++;
      if (data.escuela) conEscuela++;
      if (data.cargo) conCargo++;
      if (data.haPagado) hanPagado++;
      if (data.acceso?.toLowerCase().includes('presencial')) conAccesoPresencial++;
    });

    console.log('📈 ESTADÍSTICAS DE DATOS:');
    console.log(`   Con email: ${conEmail}/${snapshot.size}`);
    console.log(`   Con teléfono: ${conTelefono}/${snapshot.size}`);
    console.log(`   Con escuela: ${conEscuela}/${snapshot.size}`);
    console.log(`   Con cargo: ${conCargo}/${snapshot.size}`);
    console.log(`   Han pagado: ${hanPagado}/${snapshot.size}`);
    console.log(`   Acceso presencial: ${conAccesoPresencial}/${snapshot.size}\n`);

  } catch (error) {
    console.error('❌ Error:', error.message);
  }

  process.exit(0);
}

testImportedData();
