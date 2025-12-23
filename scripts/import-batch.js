/**
 * Script de importación por lotes a Firestore usando Firebase client SDK
 * Requiere tener el proyecto configurado
 */

const { initializeApp } = require('firebase/app');
const { getFirestore, collection, doc, setDoc, getDocs, writeBatch } = require('firebase/firestore');
const fs = require('fs');
const path = require('path');

// Configuración de Firebase (desde config/firebase.ts)
const firebaseConfig = {
  apiKey: "AIzaSyDINril47qM50B2S5VuTDwGh4w4ZLRSd4w",
  authDomain: "accesscongress.firebaseapp.com",
  projectId: "accesscongress",
  storageBucket: "accesscongress.firebasestorage.app",
  messagingSenderId: "211521207592",
  appId: "1:211521207592:web:1bd581d39b2740259ca41d"
};

console.log('🔥 Iniciando importación a Firestore (Web SDK)...\n');

// Inicializar Firebase
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

// Leer datos
const dataPath = path.join(__dirname, '..', 'participants-data.json');
const participants = JSON.parse(fs.readFileSync(dataPath, 'utf8'));

console.log(`📊 Total de participantes a importar: ${participants.length}\n`);

async function importParticipants() {
  const batchSize = 500;
  let imported = 0;
  let errors = 0;

  console.log('⏳ Importando participantes...\n');

  for (let i = 0; i < participants.length; i += batchSize) {
    const batch = writeBatch(db);
    const currentBatch = participants.slice(i, i + batchSize);

    currentBatch.forEach(participant => {
      const docRef = doc(db, 'participants', participant.dni);
      const data = {
        dni: participant.dni,
        nombre: participant.nombre,
        permisos: participant.permisos,
        estado: participant.estado,
        timestamp_registro: participant.timestamp_registro,
        ultima_actualizacion: participant.ultima_actualizacion
      };

      batch.set(docRef, data, { merge: true });
    });

    try {
      await batch.commit();
      imported += currentBatch.length;
      console.log(`✅ Importados ${imported}/${participants.length} participantes`);
    } catch (error) {
      errors += currentBatch.length;
      console.error(`❌ Error en lote:`, error.message);
    }
  }

  console.log(`\n📊 Resumen:`);
  console.log(`   ✅ Exitosos: ${imported}`);
  console.log(`   ❌ Errores: ${errors}\n`);

  return { imported, errors };
}

async function verifyData() {
  console.log('🔍 Verificando datos...\n');

  try {
    const snapshot = await getDocs(collection(db, 'participants'));
    console.log(`✅ Total en Firestore: ${snapshot.size}\n`);

    console.log('📋 Muestra de 5 participantes:\n');
    let count = 0;
    snapshot.forEach(doc => {
      if (count < 5) {
        const data = doc.data();
        console.log(`${count + 1}. ${data.nombre} (${doc.id})`);
        console.log(`   Permisos: Aula=${data.permisos?.aula_magna}, Master=${data.permisos?.master_class}, Cena=${data.permisos?.cena}\n`);
        count++;
      }
    });

    console.log('🌐 Ver en Firebase Console:');
    console.log('   https://console.firebase.google.com/project/accesscongress/firestore/data/participants\n');

  } catch (error) {
    console.error('❌ Error al verificar:', error.message);
  }
}

async function main() {
  try {
    const result = await importParticipants();
    if (result.imported > 0) {
      await verifyData();
    }
    process.exit(0);
  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  }
}

main();
