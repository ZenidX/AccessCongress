const XLSX = require('xlsx');
const path = require('path');

// Leer el archivo Excel
const excelPath = path.join(__dirname, '..', 'Excel pruebas Control de acceso.xlsx');
const workbook = XLSX.readFile(excelPath);

// Obtener la primera hoja
const sheetName = workbook.SheetNames[0];
const sheet = workbook.Sheets[sheetName];

// Convertir a JSON
const data = XLSX.utils.sheet_to_json(sheet, { defval: '' });

// Mostrar información
console.log('=== INFORMACIÓN DEL EXCEL ===');
console.log('Hoja:', sheetName);
console.log('Total de filas:', data.length);
console.log('\n=== COLUMNAS DETECTADAS ===');
if (data.length > 0) {
  const columns = Object.keys(data[0]);
  columns.forEach((col, index) => {
    console.log(`${index + 1}. ${col}`);
  });
}

console.log('\n=== PRIMERAS 5 FILAS (MUESTRA) ===');
data.slice(0, 5).forEach((row, index) => {
  console.log(`\nFila ${index + 1}:`);
  console.log(JSON.stringify(row, null, 2));
});

console.log('\n=== TODAS LAS FILAS (JSON) ===');
console.log(JSON.stringify(data, null, 2));
