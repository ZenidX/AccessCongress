const XLSX = require('xlsx');
const fs = require('fs');
const path = require('path');

// Leer el archivo Excel
const excelPath = path.join(__dirname, '..', 'Excel pruebas Control de acceso.xlsx');
const workbook = XLSX.readFile(excelPath);
const sheetName = workbook.SheetNames[0];
const sheet = workbook.Sheets[sheetName];
const data = XLSX.utils.sheet_to_json(sheet, { defval: '' });

console.log(`📊 Procesando ${data.length} participantes del Excel...\n`);

// Función para limpiar DNI
function cleanDNI(dni, email) {
  if (!dni || dni === '???' || dni.trim() === '') {
    // Usar email como identificador temporal
    return email.split('@')[0].toUpperCase().replace(/[^A-Z0-9]/g, '');
  }

  // Limpiar anotaciones como "(RUN, no DNI)"
  const cleanedDNI = dni.replace(/\s*\(.*?\)\s*/g, '').trim();

  return cleanedDNI;
}

// Función para determinar permisos según formato
function getPermissions(formato) {
  const formatoLower = (formato || '').toLowerCase().trim();

  if (formatoLower.includes('coctel')) {
    // "Presencial + coctel"
    return {
      aula_magna: true,
      master_class: false,
      cena: true
    };
  } else if (formatoLower.includes('ife')) {
    // "Presencial IFE 50%"
    return {
      aula_magna: true,
      master_class: true,
      cena: false
    };
  } else if (formatoLower.includes('presencial')) {
    // "Presencial"
    return {
      aula_magna: true,
      master_class: false,
      cena: false
    };
  } else if (formatoLower.includes('online')) {
    // "Online" - sin permisos físicos
    return {
      aula_magna: false,
      master_class: false,
      cena: false
    };
  } else {
    // Por defecto
    return {
      aula_magna: true,
      master_class: false,
      cena: false
    };
  }
}

// Procesar datos
const participants = [];
const csvRows = [['DNI', 'Nombre', 'MasterClass', 'Cena']]; // Header para CSV Firestore
const invalidDNIs = [];
const duplicateDNIs = new Map();

data.forEach((row, index) => {
  const nombre = row['NOM'] || '';
  const cognoms = row['COGNOMS'] || '';
  const dniRaw = row['DNI'] || '';
  const mail = row['MAIL'] || '';
  const formato = row['FORMAT'] || '';

  // Construir nombre completo: NOM COGNOMS
  const nombreCompleto = `${nombre} ${cognoms}`.trim();

  if (!nombreCompleto) {
    console.warn(`⚠️  Fila ${index + 2}: Nombre vacío, omitiendo...`);
    return;
  }

  // Limpiar DNI
  const dni = cleanDNI(dniRaw, mail);

  if (!dni) {
    invalidDNIs.push({ fila: index + 2, nombre: nombreCompleto, dni: dniRaw, mail });
    console.warn(`⚠️  Fila ${index + 2}: DNI inválido para ${nombreCompleto}`);
    return;
  }

  // Detectar duplicados
  if (duplicateDNIs.has(dni)) {
    duplicateDNIs.set(dni, duplicateDNIs.get(dni) + 1);
    console.warn(`⚠️  Fila ${index + 2}: DNI duplicado: ${dni} (${nombreCompleto})`);
  } else {
    duplicateDNIs.set(dni, 1);
  }

  // Obtener permisos
  const permisos = getPermissions(formato);

  // Agregar participante
  participants.push({
    dni,
    nombre: nombreCompleto,
    permisos,
    estado: {
      registrado: false,
      en_aula_magna: false,
      en_master_class: false,
      en_cena: false
    },
    timestamp_registro: null,
    ultima_actualizacion: null,
    // Metadatos adicionales (no en el modelo, solo para referencia)
    _metadata: {
      email: mail,
      entidad: row['ENTITAT/INSTITUCIÓ'] || '',
      formato: formato,
      telefono: row['TELÈFON'] || ''
    }
  });

  // Agregar fila CSV para Firestore (formato existente)
  csvRows.push([
    dni,
    nombreCompleto,
    permisos.master_class ? 'Si' : 'No',
    permisos.cena ? 'Si' : 'No'
  ]);
});

console.log(`\n✅ Procesamiento completado:`);
console.log(`   - Total procesados: ${participants.length}`);
console.log(`   - DNIs inválidos: ${invalidDNIs.length}`);
console.log(`   - DNIs duplicados: ${Array.from(duplicateDNIs.entries()).filter(([k, v]) => v > 1).length}`);

// Estadísticas de permisos
const stats = {
  aula_magna: participants.filter(p => p.permisos.aula_magna).length,
  master_class: participants.filter(p => p.permisos.master_class).length,
  cena: participants.filter(p => p.permisos.cena).length,
  online: participants.filter(p => !p.permisos.aula_magna && !p.permisos.master_class && !p.permisos.cena).length
};

console.log(`\n📊 Estadísticas de permisos:`);
console.log(`   - Aula Magna: ${stats.aula_magna}`);
console.log(`   - Master Class: ${stats.master_class}`);
console.log(`   - Cena: ${stats.cena}`);
console.log(`   - Solo Online: ${stats.online}`);

// Guardar CSV para Firestore
const csvContent = csvRows.map(row => row.join(',')).join('\n');
const csvPath = path.join(__dirname, '..', 'participants-import.csv');
fs.writeFileSync(csvPath, csvContent, 'utf8');
console.log(`\n💾 CSV guardado: ${csvPath}`);

// Guardar JSON completo
const jsonPath = path.join(__dirname, '..', 'participants-data.json');
fs.writeFileSync(jsonPath, JSON.stringify(participants, null, 2), 'utf8');
console.log(`💾 JSON guardado: ${jsonPath}`);

// Generar seed data para Data Connect (GraphQL)
const seedDataPath = path.join(__dirname, '..', 'dataconnect', 'seed_data_real.gql');
let seedContent = `# Datos reales de participantes - Generado automáticamente\n`;
seedContent += `# Total: ${participants.length} participantes\n\n`;
seedContent += `mutation ImportRealParticipants @transaction @auth(level: NO_ACCESS) {\n`;
seedContent += `  participant_insertMany(data: [\n`;

participants.slice(0, 20).forEach((p, index) => {
  seedContent += `    {\n`;
  seedContent += `      dni: "${p.dni.replace(/"/g, '\\"')}",\n`;
  seedContent += `      nombre: "${p.nombre.replace(/"/g, '\\"')}",\n`;
  seedContent += `      permisos: {\n`;
  seedContent += `        aula_magna: ${p.permisos.aula_magna},\n`;
  seedContent += `        master_class: ${p.permisos.master_class},\n`;
  seedContent += `        cena: ${p.permisos.cena}\n`;
  seedContent += `      },\n`;
  seedContent += `      estado: {\n`;
  seedContent += `        registrado: false,\n`;
  seedContent += `        en_aula_magna: false,\n`;
  seedContent += `        en_master_class: false,\n`;
  seedContent += `        en_cena: false\n`;
  seedContent += `      },\n`;
  seedContent += `      timestamp_registro: null,\n`;
  seedContent += `      ultima_actualizacion: null\n`;
  seedContent += `    }${index < Math.min(participants.length, 20) - 1 ? ',' : ''}\n`;
});

seedContent += `  ])\n`;
seedContent += `}\n`;
seedContent += `\n# NOTA: Solo se incluyeron los primeros 20 participantes como muestra.\n`;
seedContent += `# Total en el Excel: ${participants.length} participantes\n`;

fs.writeFileSync(seedDataPath, seedContent, 'utf8');
console.log(`💾 Seed Data guardado: ${seedDataPath} (primeros 20 participantes)\n`);

// Mostrar muestra de datos
console.log(`\n📋 Muestra de 5 participantes procesados:\n`);
participants.slice(0, 5).forEach((p, i) => {
  console.log(`${i + 1}. ${p.nombre}`);
  console.log(`   DNI: ${p.dni}`);
  console.log(`   Permisos: Aula=${p.permisos.aula_magna}, Master=${p.permisos.master_class}, Cena=${p.permisos.cena}`);
  console.log(`   Email: ${p._metadata.email}`);
  console.log(`   Formato: ${p._metadata.formato}\n`);
});

// Mostrar DNIs inválidos si hay
if (invalidDNIs.length > 0) {
  console.log(`\n⚠️  DNIs inválidos encontrados (${invalidDNIs.length}):\n`);
  invalidDNIs.slice(0, 10).forEach(item => {
    console.log(`   Fila ${item.fila}: ${item.nombre} - DNI: "${item.dni}" - Email: ${item.mail}`);
  });
  if (invalidDNIs.length > 10) {
    console.log(`   ... y ${invalidDNIs.length - 10} más\n`);
  }
}

// Mostrar duplicados si hay
const duplicates = Array.from(duplicateDNIs.entries()).filter(([k, v]) => v > 1);
if (duplicates.length > 0) {
  console.log(`\n⚠️  DNIs duplicados encontrados (${duplicates.length}):\n`);
  duplicates.forEach(([dni, count]) => {
    console.log(`   ${dni}: ${count} veces`);
  });
}

console.log(`\n✅ Archivos generados:`);
console.log(`   1. participants-import.csv - Para importar a Firestore con la función existente`);
console.log(`   2. participants-data.json - Datos completos en JSON`);
console.log(`   3. dataconnect/seed_data_real.gql - Seed data para Data Connect\n`);
