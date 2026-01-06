/**
 * Script para BORRAR TODOS los participantes de Firestore
 */

const { initializeApp } = require('firebase/app');
const { getFirestore, collection, getDocs, writeBatch, doc } = require('firebase/firestore');

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

async function deleteAllParticipants() {
  console.log('🗑️  BORRANDO TODOS LOS PARTICIPANTES...\n');

  try {
    // Obtener todos los documentos
    const snapshot = await getDocs(collection(db, 'participants'));
    const total = snapshot.size;

    console.log(`📊 Total de participantes a borrar: ${total}\n`);

    if (total === 0) {
      console.log('✅ No hay participantes para borrar.\n');
      return;
    }

    // Firestore permite máximo 500 operaciones por batch
    const batchSize = 500;
    let deleted = 0;

    const docs = [];
    snapshot.forEach(doc => docs.push(doc));

    for (let i = 0; i < docs.length; i += batchSize) {
      const batch = writeBatch(db);
      const currentBatch = docs.slice(i, i + batchSize);

      currentBatch.forEach(docSnapshot => {
        batch.delete(docSnapshot.ref);
      });

      await batch.commit();
      deleted += currentBatch.length;
      console.log(`🗑️  Borrados ${deleted}/${total} participantes`);
    }

    console.log(`\n✅ TODOS LOS PARTICIPANTES HAN SIDO BORRADOS (${deleted} documentos eliminados)\n`);

    // Verificar que está vacío
    const verifySnapshot = await getDocs(collection(db, 'participants'));
    console.log(`🔍 Verificación: ${verifySnapshot.size} participantes restantes\n`);

  } catch (error) {
    console.error('❌ Error al borrar:', error.message);
    process.exit(1);
  }

  process.exit(0);
}

deleteAllParticipants();
