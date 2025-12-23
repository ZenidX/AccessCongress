/**
 * Script para importar participantes usando Firebase CLI
 * Este script genera comandos que usan firebase-tools directamente
 */

const fs = require('fs');
const path = require('path');

// Leer datos procesados
const dataPath = path.join(__dirname, '..', 'participants-data.json');
const participants = JSON.parse(fs.readFileSync(dataPath, 'utf8'));

console.log('📊 Generando script de importación...\n');
console.log(`Total de participantes: ${participants.length}\n`);

// Generar un archivo de datos para importación
const firestoreData = {};

participants.forEach(participant => {
  const data = {
    dni: participant.dni,
    nombre: participant.nombre,
    permisos: participant.permisos,
    estado: participant.estado,
    timestamp_registro: participant.timestamp_registro,
    ultima_actualizacion: participant.ultima_actualizacion
  };

  firestoreData[participant.dni] = data;
});

// Guardar como JSON para importación manual
const outputPath = path.join(__dirname, '..', 'firestore-import.json');
const firestoreExportFormat = {
  __collections__: {
    participants: firestoreData
  }
};

fs.writeFileSync(outputPath, JSON.stringify(firestoreExportFormat, null, 2), 'utf8');

console.log(`✅ Archivo de importación generado: firestore-import.json`);
console.log(`\n📝 Para importar a Firestore, ejecuta:\n`);
console.log(`   npx -y firebase-tools@latest firestore:delete --all-collections -P accesscongress`);
console.log(`   (Opcional: limpiar colecciones existentes)\n`);
console.log(`O importar directamente los datos usando el Firebase SDK web...\n`);

// Generar script de importación alternativo usando Firebase Web SDK
const webImportScript = `
// Script de importación usando Firebase Web SDK
// Ejecutar en la app o en una página web con Firebase inicializado

import { collection, doc, setDoc } from 'firebase/firestore';
import { db } from './config/firebase';

const participants = ${JSON.stringify(participants.slice(0, 5), null, 2)};
// ... (total: ${participants.length} participantes)

async function importToFirestore() {
  console.log('Importando ${participants.length} participantes...');

  for (const participant of participants) {
    const data = {
      dni: participant.dni,
      nombre: participant.nombre,
      permisos: participant.permisos,
      estado: participant.estado,
      timestamp_registro: participant.timestamp_registro,
      ultima_actualizacion: participant.ultima_actualizacion
    };

    await setDoc(doc(db, 'participants', participant.dni), data, { merge: true });
    console.log(\`Importado: \${participant.nombre}\`);
  }

  console.log('✅ Importación completada!');
}

importToFirestore();
`;

const webScriptPath = path.join(__dirname, '..', 'import-web-sdk.txt');
fs.writeFileSync(webScriptPath, webImportScript, 'utf8');

console.log(`✅ Script web generado: import-web-sdk.txt\n`);

// Imprimir instrucciones
console.log('═'.repeat(60));
console.log('  OPCIONES DE IMPORTACIÓN');
console.log('═'.repeat(60));
console.log('\n1️⃣  OPCIÓN 1: Usar la función de importación de la app');
console.log('   - Abre la app en el panel de Admin');
console.log('   - Sube el archivo: participants-import.csv');
console.log('   - Presiona "Importar"\n');

console.log('2️⃣  OPCIÓN 2: Importar manualmente con Firebase Console');
console.log('   - Ve a: https://console.firebase.google.com/project/accesscongress/firestore');
console.log('   - Crea documentos manualmente en la colección "participants"\n');

console.log('3️⃣  OPCIÓN 3: Usar script batch (crear script separado)');
console.log('   - Ver instrucciones a continuación\n');

console.log('═'.repeat(60));
