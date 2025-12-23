const admin = require('firebase-admin');
const fs = require('fs');
const path = require('path');

console.log('🔥 Iniciando importación a Firestore...\n');

// Inicializar Firebase Admin con las credenciales del proyecto
// Nota: Requiere estar autenticado con firebase-tools
const projectId = 'accesscongress';

try {
  admin.initializeApp({
    projectId: projectId,
  });
  console.log(`✅ Firebase Admin inicializado (Proyecto: ${projectId})\n`);
} catch (error) {
  console.error('❌ Error al inicializar Firebase Admin:', error.message);
  process.exit(1);
}

const db = admin.firestore();

// Leer datos procesados
const dataPath = path.join(__dirname, '..', 'participants-data.json');
const participants = JSON.parse(fs.readFileSync(dataPath, 'utf8'));

console.log(`📊 Total de participantes a importar: ${participants.length}\n`);

// Función para importar participantes en lotes
async function importParticipants() {
  const batchSize = 500; // Firestore tiene límite de 500 operaciones por batch
  let imported = 0;
  let errors = 0;

  console.log('⏳ Importando participantes a Firestore...\n');

  for (let i = 0; i < participants.length; i += batchSize) {
    const batch = db.batch();
    const currentBatch = participants.slice(i, i + batchSize);

    currentBatch.forEach(participant => {
      // Crear documento con DNI como ID
      const docRef = db.collection('participants').doc(participant.dni);

      // Preparar datos (sin el _metadata que es solo para referencia)
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
      console.error(`❌ Error en lote ${i / batchSize + 1}:`, error.message);
    }
  }

  console.log(`\n📊 Resumen de importación:`);
  console.log(`   ✅ Exitosos: ${imported}`);
  console.log(`   ❌ Errores: ${errors}`);
  console.log(`   📝 Total: ${participants.length}\n`);

  return { imported, errors };
}

// Función para verificar datos importados
async function verifyImport() {
  console.log('🔍 Verificando datos en Firestore...\n');

  try {
    const snapshot = await db.collection('participants').limit(5).get();

    console.log(`📋 Muestra de 5 participantes en Firestore:\n`);

    snapshot.forEach((doc, index) => {
      const data = doc.data();
      console.log(`${index + 1}. ${data.nombre} (${doc.id})`);
      console.log(`   Permisos: Aula=${data.permisos.aula_magna}, Master=${data.permisos.master_class}, Cena=${data.permisos.cena}`);
      console.log(`   Estado: Registrado=${data.estado.registrado}\n`);
    });

    // Contar total
    const countSnapshot = await db.collection('participants').count().get();
    const totalCount = countSnapshot.data().count;

    console.log(`✅ Total de participantes en Firestore: ${totalCount}\n`);

    // Estadísticas de permisos
    const allDocs = await db.collection('participants').get();
    const stats = {
      total: allDocs.size,
      aula_magna: 0,
      master_class: 0,
      cena: 0,
      registrados: 0
    };

    allDocs.forEach(doc => {
      const data = doc.data();
      if (data.permisos.aula_magna) stats.aula_magna++;
      if (data.permisos.master_class) stats.master_class++;
      if (data.permisos.cena) stats.cena++;
      if (data.estado.registrado) stats.registrados++;
    });

    console.log(`📊 Estadísticas de Firestore:`);
    console.log(`   Total: ${stats.total}`);
    console.log(`   Con permiso Aula Magna: ${stats.aula_magna}`);
    console.log(`   Con permiso Master Class: ${stats.master_class}`);
    console.log(`   Con permiso Cena: ${stats.cena}`);
    console.log(`   Ya registrados: ${stats.registrados}\n`);

  } catch (error) {
    console.error('❌ Error al verificar datos:', error.message);
  }
}

// Ejecutar importación
async function main() {
  try {
    const result = await importParticipants();

    if (result.imported > 0) {
      await verifyImport();

      console.log('🎉 Importación completada!\n');
      console.log('🌐 Ver en Firebase Console:');
      console.log(`   https://console.firebase.google.com/project/${projectId}/firestore/data/participants\n`);
    }

    process.exit(result.errors > 0 ? 1 : 0);
  } catch (error) {
    console.error('❌ Error fatal:', error);
    process.exit(1);
  }
}

main();
