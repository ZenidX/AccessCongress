/**
 * Servicio para gestionar participantes en Firebase Firestore
 */

import {
  collection,
  doc,
  getDoc,
  setDoc,
  updateDoc,
  onSnapshot,
  query,
  where,
  Unsubscribe,
  getDocs,
  writeBatch,
  orderBy,
  limit,
} from 'firebase/firestore';
import { db } from '@/config/firebase';
import {
  Participant,
  QRData,
  AccessMode,
  AccessDirection,
  AccessLog,
  ParticipantStatus,
} from '@/types/participant';
import * as XLSX from 'xlsx';
import { Paths, File } from 'expo-file-system';
import { Platform } from 'react-native';

const PARTICIPANTS_COLLECTION = 'participants';
const ACCESS_LOGS_COLLECTION = 'access_logs';

/**
 * Obtener participante por DNI
 */
export async function getParticipantByDNI(dni: string): Promise<Participant | null> {
  try {
    const docRef = doc(db, PARTICIPANTS_COLLECTION, dni);
    const docSnap = await getDoc(docRef);

    if (docSnap.exists()) {
      return docSnap.data() as Participant;
    }
    return null;
  } catch (error) {
    console.error('Error obteniendo participante:', error);
    throw error;
  }
}

/**
 * Crear o actualizar participante desde datos del QR
 */
export async function upsertParticipantFromQR(qrData: QRData): Promise<Participant> {
  try {
    const existingParticipant = await getParticipantByDNI(qrData.dni);

    const participant: Participant = existingParticipant || {
      dni: qrData.dni,
      nombre: qrData.nombre,
      permisos: qrData.permisos,
      estado: {
        registrado: false,
        en_aula_magna: false,
        en_master_class: false,
        en_cena: false,
      },
      ultima_actualizacion: Date.now(),
    };

    // Si ya existe, solo actualizamos nombre y permisos por si cambiaron
    if (existingParticipant) {
      participant.nombre = qrData.nombre;
      participant.permisos = qrData.permisos;
      participant.ultima_actualizacion = Date.now();
    }

    const docRef = doc(db, PARTICIPANTS_COLLECTION, qrData.dni);
    await setDoc(docRef, participant);

    return participant;
  } catch (error) {
    console.error('Error creando/actualizando participante:', error);
    throw error;
  }
}

/**
 * Actualizar estado del participante
 */
export async function updateParticipantStatus(
  dni: string,
  modo: AccessMode,
  direccion: AccessDirection
): Promise<void> {
  try {
    const docRef = doc(db, PARTICIPANTS_COLLECTION, dni);
    const updates: Partial<Participant> = {
      ultima_actualizacion: Date.now(),
    };

    switch (modo) {
      case 'registro':
        updates.estado = { registrado: true } as ParticipantStatus;
        updates.timestamp_registro = Date.now();
        break;

      case 'aula_magna':
        updates[`estado.en_aula_magna`] = direccion === 'entrada';
        break;

      case 'master_class':
        updates[`estado.en_master_class`] = direccion === 'entrada';
        break;

      case 'cena':
        updates[`estado.en_cena`] = direccion === 'entrada';
        break;
    }

    await updateDoc(docRef, updates as any);
  } catch (error) {
    console.error('Error actualizando estado:', error);
    throw error;
  }
}

/**
 * Registrar log de acceso
 */
export async function logAccess(
  dni: string,
  nombre: string,
  modo: AccessMode,
  direccion: AccessDirection,
  exito: boolean,
  mensaje: string,
  operador: string = 'sistema'
): Promise<void> {
  try {
    const logRef = doc(collection(db, ACCESS_LOGS_COLLECTION));
    const log: AccessLog = {
      id: logRef.id,
      dni,
      nombre,
      modo,
      direccion,
      timestamp: Date.now(),
      operador,
      exito,
      mensaje,
    };

    await setDoc(logRef, log);
  } catch (error) {
    console.error('Error registrando log:', error);
    // No lanzamos error para no bloquear el flujo
  }
}

/**
 * Escuchar cambios en participantes en una ubicación específica
 */
export function subscribeToLocationParticipants(
  location: 'aula_magna' | 'master_class' | 'cena',
  callback: (participants: Participant[]) => void
): Unsubscribe {
  const stateField = `estado.en_${location}`;
  const q = query(
    collection(db, PARTICIPANTS_COLLECTION),
    where(stateField, '==', true)
  );

  return onSnapshot(q, (snapshot) => {
    const participants = snapshot.docs.map((doc) => doc.data() as Participant);
    callback(participants);
  });
}

/**
 * Obtener todos los participantes registrados
 */
export function subscribeToRegisteredParticipants(
  callback: (participants: Participant[]) => void
): Unsubscribe {
  const q = query(
    collection(db, PARTICIPANTS_COLLECTION),
    where('estado.registrado', '==', true)
  );

  return onSnapshot(q, (snapshot) => {
    const participants = snapshot.docs.map((doc) => doc.data() as Participant);
    callback(participants);
  });
}

/**
 * Cargar participantes desde CSV (para administración)
 */
export async function importParticipantsFromCSV(csvData: string): Promise<number> {
  try {
    const lines = csvData.trim().split('\n');
    const batch = writeBatch(db);
    let count = 0;

    // Saltar cabecera si existe
    const startIndex = lines[0].toLowerCase().includes('dni') ? 1 : 0;

    for (let i = startIndex; i < lines.length; i++) {
      const line = lines[i].trim();
      if (!line) continue;

      // Formato esperado: DNI,Nombre,MasterClass,Cena
      const [dni, nombre, masterClass, cena] = line.split(',').map((s) => s.trim());

      if (!dni || !nombre) continue;

      const participant: Participant = {
        dni,
        nombre,
        permisos: {
          aula_magna: true, // Todos tienen acceso
          master_class: masterClass?.toLowerCase() === 'si' || masterClass === '1',
          cena: cena?.toLowerCase() === 'si' || cena === '1',
        },
        estado: {
          registrado: false,
          en_aula_magna: false,
          en_master_class: false,
          en_cena: false,
        },
        ultima_actualizacion: Date.now(),
      };

      const docRef = doc(db, PARTICIPANTS_COLLECTION, dni);
      batch.set(docRef, participant);
      count++;
    }

    await batch.commit();
    return count;
  } catch (error) {
    console.error('Error importando participantes:', error);
    throw error;
  }
}

/**
 * Cargar participantes desde archivo Excel (XLSX/XLS)
 */
export async function importParticipantsFromExcel(arrayBuffer: ArrayBuffer): Promise<number> {
  try {
    // Leer el archivo Excel
    const workbook = XLSX.read(arrayBuffer, { type: 'array' });

    // Obtener la primera hoja
    const sheetName = workbook.SheetNames[0];
    const sheet = workbook.Sheets[sheetName];

    // Convertir a JSON
    const data = XLSX.utils.sheet_to_json(sheet, { defval: '' });

    const batch = writeBatch(db);
    let count = 0;

    for (const row of data as any[]) {
      // Buscar las columnas independientemente del nombre exacto
      // Intentar encontrar DNI (puede estar como DNI, dni, etc.)
      const dni = row['DNI'] || row['dni'] || row['Dni'] || '';
      const nombre = row['NOM'] || row['COGNOMS'] || row['Nombre'] || row['nombre'] ||
                     `${row['NOM'] || ''} ${row['COGNOMS'] || ''}`.trim();

      // Permisos
      const masterClassRaw = row['MasterClass'] || row['MASTER CLASS'] || row['Master Class'] ||
                             row['masterclass'] || '';
      const cenaRaw = row['Cena'] || row['cena'] || row['CENA'] || '';

      if (!dni || !nombre) continue;

      // Convertir permisos a booleano
      const masterClass = String(masterClassRaw).toLowerCase() === 'si' ||
                         String(masterClassRaw) === '1' ||
                         String(masterClassRaw).toLowerCase() === 'yes';
      const cena = String(cenaRaw).toLowerCase() === 'si' ||
                  String(cenaRaw) === '1' ||
                  String(cenaRaw).toLowerCase() === 'yes';

      const participant: Participant = {
        dni,
        nombre,
        permisos: {
          aula_magna: true, // Todos tienen acceso
          master_class: masterClass,
          cena: cena,
        },
        estado: {
          registrado: false,
          en_aula_magna: false,
          en_master_class: false,
          en_cena: false,
        },
        ultima_actualizacion: Date.now(),
      };

      const docRef = doc(db, PARTICIPANTS_COLLECTION, dni);
      batch.set(docRef, participant);
      count++;
    }

    await batch.commit();
    return count;
  } catch (error) {
    console.error('Error importando desde Excel:', error);
    throw error;
  }
}

/**
 * Limpiar todos los estados (útil para testing o reset)
 */
export async function resetAllParticipantStates(): Promise<void> {
  try {
    const querySnapshot = await getDocs(collection(db, PARTICIPANTS_COLLECTION));
    const batch = writeBatch(db);

    querySnapshot.forEach((document) => {
      batch.update(document.ref, {
        'estado.registrado': false,
        'estado.en_aula_magna': false,
        'estado.en_master_class': false,
        'estado.en_cena': false,
        ultima_actualizacion: Date.now(),
      });
    });

    await batch.commit();
  } catch (error) {
    console.error('Error reseteando estados:', error);
    throw error;
  }
}

/**
 * Obtener los últimos N accesos de un modo específico
 */
export async function getRecentAccessLogs(
  modo: AccessMode,
  limitNum: number = 10
): Promise<AccessLog[]> {
  try {
    const q = query(
      collection(db, ACCESS_LOGS_COLLECTION),
      where('modo', '==', modo),
      where('exito', '==', true),
      orderBy('timestamp', 'desc'),
      limit(limitNum)
    );

    const snapshot = await getDocs(q);
    return snapshot.docs.map((doc) => doc.data() as AccessLog);
  } catch (error) {
    console.error('Error obteniendo logs recientes:', error);
    throw error;
  }
}

/**
 * Suscribirse a los últimos accesos en tiempo real
 */
export function subscribeToRecentAccessLogs(
  modo: AccessMode,
  limitNum: number = 10,
  callback: (logs: AccessLog[]) => void
): Unsubscribe {
  const q = query(
    collection(db, ACCESS_LOGS_COLLECTION),
    where('modo', '==', modo),
    where('exito', '==', true),
    orderBy('timestamp', 'desc'),
    limit(limitNum)
  );

  return onSnapshot(q, (snapshot) => {
    const logs = snapshot.docs.map((doc) => doc.data() as AccessLog);
    callback(logs);
  });
}

/**
 * Obtener estadísticas de acceso para un modo específico
 * Retorna: total de entradas únicas (participantes que han entrado al menos una vez)
 */
export async function getAccessStats(modo: AccessMode): Promise<{
  uniqueEntrances: number;
  maxSimultaneous: number;
}> {
  try {
    if (modo === 'registro') {
      // Para registro, simplemente contamos los registrados
      const q = query(
        collection(db, PARTICIPANTS_COLLECTION),
        where('estado.registrado', '==', true)
      );
      const snapshot = await getDocs(q);
      return {
        uniqueEntrances: snapshot.size,
        maxSimultaneous: snapshot.size, // El máximo es igual al total (solo se registra una vez)
      };
    }

    // Para otras salas, necesitamos analizar los logs
    const logsQuery = query(
      collection(db, ACCESS_LOGS_COLLECTION),
      where('modo', '==', modo),
      where('exito', '==', true),
      orderBy('timestamp', 'asc')
    );

    const logsSnapshot = await getDocs(logsQuery);
    const logs = logsSnapshot.docs.map((doc) => doc.data() as AccessLog);

    // Contar participantes únicos que han entrado
    const uniqueDNIs = new Set<string>();
    logs.forEach((log) => {
      if (log.direccion === 'entrada') {
        uniqueDNIs.add(log.dni);
      }
    });

    // Calcular máximo simultáneo recorriendo el historial
    let currentCount = 0;
    let maxCount = 0;
    const currentParticipants = new Set<string>();

    logs.forEach((log) => {
      if (log.direccion === 'entrada') {
        currentParticipants.add(log.dni);
        currentCount = currentParticipants.size;
        maxCount = Math.max(maxCount, currentCount);
      } else if (log.direccion === 'salida') {
        currentParticipants.delete(log.dni);
        currentCount = currentParticipants.size;
      }
    });

    return {
      uniqueEntrances: uniqueDNIs.size,
      maxSimultaneous: maxCount,
    };
  } catch (error) {
    console.error('Error obteniendo estadísticas:', error);
    return { uniqueEntrances: 0, maxSimultaneous: 0 };
  }
}

/**
 * Obtiene los recuentos totales de participantes basados en permisos.
 * Retorna un objeto con el total para cada categoría.
 */
export async function getPermissionBasedCounts(): Promise<{
  registro: number;
  aula_magna: number;
  master_class: number;
  cena: number;
}> {
  try {
    const snapshot = await getDocs(collection(db, PARTICIPANTS_COLLECTION));

    const counts = {
      registro: snapshot.size,
      aula_magna: 0,
      master_class: 0,
      cena: 0,
    };

    snapshot.forEach(doc => {
      const participant = doc.data() as Participant;
      if (participant.permisos) {
        if (participant.permisos.aula_magna) {
          counts.aula_magna++;
        }
        if (participant.permisos.master_class) {
          counts.master_class++;
        }
        if (participant.permisos.cena) {
          counts.cena++;
        }
      }
    });

    return counts;
  } catch (error) {
    console.error('Error obteniendo recuentos por permisos:', error);
    return {
      registro: 0,
      aula_magna: 0,
      master_class: 0,
      cena: 0,
    };
  }
}

/**
 * Exportar todos los datos a Excel
 * Genera un archivo con dos hojas:
 * - Participantes: todos los participantes con sus datos y estados
 * - Logs: historial completo de accesos
 *
 * @returns URI del archivo Excel generado
 */
export async function exportDataToExcel(): Promise<string> {
  try {
    // Obtener todos los participantes
    const participantsSnapshot = await getDocs(collection(db, PARTICIPANTS_COLLECTION));
    const participants = participantsSnapshot.docs.map((doc) => doc.data() as Participant);

    // Obtener todos los logs (ordenados por fecha)
    const logsQuery = query(
      collection(db, ACCESS_LOGS_COLLECTION),
      orderBy('timestamp', 'desc')
    );
    const logsSnapshot = await getDocs(logsQuery);
    const logs = logsSnapshot.docs.map((doc) => doc.data() as AccessLog);

    // Preparar datos de participantes para Excel
    const participantsData = participants.map((p) => ({
      DNI: p.dni,
      Nombre: p.nombre,
      'Permiso MasterClass': p.permisos.master_class ? 'Si' : 'No',
      'Permiso Cena': p.permisos.cena ? 'Si' : 'No',
      Registrado: p.estado.registrado ? 'Si' : 'No',
      'En Aula Magna': p.estado.en_aula_magna ? 'Si' : 'No',
      'En Master Class': p.estado.en_master_class ? 'Si' : 'No',
      'En Cena': p.estado.en_cena ? 'Si' : 'No',
      'Fecha Registro': p.timestamp_registro
        ? new Date(p.timestamp_registro).toLocaleString('es-ES')
        : '',
      'Última Actualización': new Date(p.ultima_actualizacion).toLocaleString('es-ES'),
    }));

    // Preparar datos de logs para Excel
    const logsData = logs.map((log) => ({
      DNI: log.dni,
      Nombre: log.nombre,
      Modo: log.modo,
      Dirección: log.direccion || 'N/A',
      Fecha: new Date(log.timestamp).toLocaleString('es-ES'),
      Operador: log.operador,
      Éxito: log.exito ? 'Si' : 'No',
      Mensaje: log.mensaje,
    }));

    // Crear libro de Excel
    const wb = XLSX.utils.book_new();

    // Hoja 1: Participantes
    const wsParticipants = XLSX.utils.json_to_sheet(participantsData);
    XLSX.utils.book_append_sheet(wb, wsParticipants, 'Participantes');

    // Hoja 2: Logs
    const wsLogs = XLSX.utils.json_to_sheet(logsData);
    XLSX.utils.book_append_sheet(wb, wsLogs, 'Logs de Acceso');

    const fileName = `export_congreso_${new Date().toISOString().split('T')[0]}.xlsx`;

    // Detectar plataforma y usar el método apropiado
    if (Platform.OS === 'web') {
      // WEB: Descargar usando blob
      const wbout = XLSX.write(wb, { type: 'array', bookType: 'xlsx' });
      const blob = new Blob([wbout], {
        type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      });

      // Crear URL temporal y descargar
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = fileName;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);

      return url; // Retornar URL para confirmar éxito
    } else {
      // MÓVIL: Usar expo-file-system
      const wbout = XLSX.write(wb, { type: 'array', bookType: 'xlsx' });
      const file = new File(Paths.document, fileName);

      const uint8Array = new Uint8Array(wbout as ArrayBuffer);
      await file.write(uint8Array);

      return file.uri;
    }
  } catch (error) {
    console.error('Error exportando datos a Excel:', error);
    throw error;
  }
}
