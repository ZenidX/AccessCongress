/**
 * Participant Service
 *
 * Manages participants in Firebase Firestore with multi-event support.
 * All functions require an eventId to scope data to the correct event.
 *
 * Data structure:
 * - events/{eventId}/participants/{dni}
 * - events/{eventId}/access_logs/{logId}
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
  deleteDoc,
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

// Collection path helpers
const getParticipantsCollection = (eventId: string) =>
  `events/${eventId}/participants`;
const getAccessLogsCollection = (eventId: string) =>
  `events/${eventId}/access_logs`;

// Legacy collection names (for backward compatibility during migration)
const LEGACY_PARTICIPANTS_COLLECTION = 'participants';
const LEGACY_ACCESS_LOGS_COLLECTION = 'access_logs';

/**
 * Get participant by DNI
 */
export async function getParticipantByDNI(
  dni: string,
  eventId?: string
): Promise<Participant | null> {
  try {
    // If no eventId, use legacy collection (backward compatibility)
    const collectionPath = eventId
      ? getParticipantsCollection(eventId)
      : LEGACY_PARTICIPANTS_COLLECTION;

    const docRef = doc(db, collectionPath, dni);
    const docSnap = await getDoc(docRef);

    if (docSnap.exists()) {
      return docSnap.data() as Participant;
    }
    return null;
  } catch (error) {
    console.error('Error getting participant:', error);
    throw error;
  }
}

/**
 * Get all participants for an event
 */
export async function getAllParticipants(eventId?: string): Promise<Participant[]> {
  try {
    const collectionPath = eventId
      ? getParticipantsCollection(eventId)
      : LEGACY_PARTICIPANTS_COLLECTION;

    const querySnapshot = await getDocs(collection(db, collectionPath));
    const participants: Participant[] = [];

    querySnapshot.forEach((doc) => {
      participants.push(doc.data() as Participant);
    });

    // Sort by name
    participants.sort((a, b) => a.nombre.localeCompare(b.nombre));

    return participants;
  } catch (error) {
    console.error('Error getting participants:', error);
    throw error;
  }
}

/**
 * Delete a participant and all their access logs
 */
export async function deleteParticipant(
  dni: string,
  eventId?: string
): Promise<void> {
  try {
    const collectionPath = eventId
      ? getParticipantsCollection(eventId)
      : LEGACY_PARTICIPANTS_COLLECTION;

    // Delete participant document
    const docRef = doc(db, collectionPath, dni);
    await deleteDoc(docRef);
    console.log(`✅ Participant ${dni} deleted successfully`);

    // Delete all access logs for this participant
    const logsCollectionPath = eventId
      ? getAccessLogsCollection(eventId)
      : LEGACY_ACCESS_LOGS_COLLECTION;

    const logsQuery = query(
      collection(db, logsCollectionPath),
      where('dni', '==', dni)
    );
    const logsSnapshot = await getDocs(logsQuery);

    if (!logsSnapshot.empty) {
      const batch = writeBatch(db);
      logsSnapshot.docs.forEach((logDoc) => {
        batch.delete(logDoc.ref);
      });
      await batch.commit();
      console.log(`✅ Deleted ${logsSnapshot.size} access logs for participant ${dni}`);
    }
  } catch (error) {
    console.error('Error deleting participant:', error);
    throw error;
  }
}

/**
 * Get or validate participant from QR data
 * Permissions are fetched from Firestore, not from QR
 */
export async function upsertParticipantFromQR(
  qrData: QRData,
  eventId?: string
): Promise<Participant> {
  try {
    const existingParticipant = await getParticipantByDNI(qrData.dni, eventId);

    // Participant MUST exist in Firestore (imported from Excel)
    if (!existingParticipant) {
      throw new Error(
        `Participante con DNI ${qrData.dni} no encontrado en la base de datos. Debe importarse primero.`
      );
    }

    // Verify name matches (optional, but good practice)
    if (existingParticipant.nombre.toLowerCase() !== qrData.nombre.toLowerCase()) {
      console.warn(
        `Name in QR (${qrData.nombre}) doesn't match Firestore (${existingParticipant.nombre})`
      );
    }

    // Update last update timestamp
    const collectionPath = eventId
      ? getParticipantsCollection(eventId)
      : LEGACY_PARTICIPANTS_COLLECTION;

    const docRef = doc(db, collectionPath, qrData.dni);
    await updateDoc(docRef, {
      ultima_actualizacion: Date.now(),
    });

    return existingParticipant;
  } catch (error) {
    console.error('Error getting participant:', error);
    throw error;
  }
}

/**
 * Update participant status
 */
export async function updateParticipantStatus(
  dni: string,
  modo: AccessMode,
  direccion: AccessDirection,
  eventId?: string
): Promise<void> {
  try {
    const collectionPath = eventId
      ? getParticipantsCollection(eventId)
      : LEGACY_PARTICIPANTS_COLLECTION;

    const docRef = doc(db, collectionPath, dni);
    const updates: any = {
      ultima_actualizacion: Date.now(),
    };

    switch (modo) {
      case 'registro':
        updates['estado.registrado'] = true;
        updates.timestamp_registro = Date.now();
        break;

      case 'aula_magna':
        updates['estado.en_aula_magna'] = direccion === 'entrada';
        break;

      case 'master_class':
        updates['estado.en_master_class'] = direccion === 'entrada';
        break;

      case 'cena':
        updates['estado.en_cena'] = direccion === 'entrada';
        break;
    }

    await updateDoc(docRef, updates);
  } catch (error) {
    console.error('Error updating status:', error);
    throw error;
  }
}

/**
 * Log access attempt
 */
export async function logAccess(
  dni: string,
  nombre: string,
  modo: AccessMode,
  direccion: AccessDirection,
  exito: boolean,
  mensaje: string,
  operador: string = 'sistema',
  operadorUid: string = '',
  eventId?: string,
  participante?: Participant | null
): Promise<void> {
  try {
    const collectionPath = eventId
      ? getAccessLogsCollection(eventId)
      : LEGACY_ACCESS_LOGS_COLLECTION;

    const logRef = doc(collection(db, collectionPath));
    const log: AccessLog = {
      id: logRef.id,
      dni,
      nombre,
      modo,
      direccion,
      timestamp: Date.now(),
      operador,
      operadorUid,
      exito,
      mensaje,
      eventId: eventId || '',
      // Include additional participant info if available
      email: participante?.email,
      telefono: participante?.telefono,
      escuela: participante?.escuela,
      cargo: participante?.cargo,
      haPagado: participante?.haPagado,
      permisos: participante?.permisos,
    };

    await setDoc(logRef, log);
  } catch (error) {
    console.error('Error logging access:', error);
    // Don't throw to avoid blocking the flow
  }
}

/**
 * Subscribe to participants in a specific location
 */
export function subscribeToLocationParticipants(
  location: 'aula_magna' | 'master_class' | 'cena',
  callback: (participants: Participant[]) => void,
  eventId?: string
): Unsubscribe {
  const collectionPath = eventId
    ? getParticipantsCollection(eventId)
    : LEGACY_PARTICIPANTS_COLLECTION;

  const stateField = `estado.en_${location}`;
  const q = query(collection(db, collectionPath), where(stateField, '==', true));

  return onSnapshot(q, (snapshot) => {
    const participants = snapshot.docs.map((doc) => doc.data() as Participant);
    callback(participants);
  });
}

/**
 * Subscribe to registered participants
 */
export function subscribeToRegisteredParticipants(
  callback: (participants: Participant[]) => void,
  eventId?: string
): Unsubscribe {
  const collectionPath = eventId
    ? getParticipantsCollection(eventId)
    : LEGACY_PARTICIPANTS_COLLECTION;

  const q = query(
    collection(db, collectionPath),
    where('estado.registrado', '==', true)
  );

  return onSnapshot(q, (snapshot) => {
    const participants = snapshot.docs.map((doc) => doc.data() as Participant);
    callback(participants);
  });
}

// Helper to get a value from a row object with case-insensitive and fuzzy key matching
const getValueFromRow = (row: any, keys: string[]): string => {
  for (const key of keys) {
    if (row[key] !== undefined) return String(row[key]);
  }
  // Check for case-insensitive matches
  const rowKeys = Object.keys(row);
  for (const key of keys) {
    const lowerKey = key.toLowerCase();
    for (const rowKey of rowKeys) {
      if (rowKey.toLowerCase() === lowerKey) {
        return String(row[rowKey]);
      }
    }
  }
  return '';
};

const isPositiveValue = (value: string): boolean => {
  const lowerValue = value.toLowerCase();
  return (
    lowerValue === 'si' ||
    lowerValue === 'sí' ||
    lowerValue === '1' ||
    lowerValue === 'yes' ||
    lowerValue === 'true'
  );
};

export type ImportMode = 'replace' | 'merge';

/**
 * Import participants from CSV
 * @param csvData - CSV content as string
 * @param eventId - Event ID to import to
 * @param mode - 'replace' deletes existing data first, 'merge' adds/updates
 */
export async function importParticipantsFromCSV(
  csvData: string,
  eventId?: string,
  mode: ImportMode = 'merge'
): Promise<number> {
  try {
    const collectionPath = eventId
      ? getParticipantsCollection(eventId)
      : LEGACY_PARTICIPANTS_COLLECTION;

    // If replace mode, delete all existing participants first
    if (mode === 'replace' && eventId) {
      const existingDocs = await getDocs(collection(db, collectionPath));
      const deleteBatch = writeBatch(db);
      existingDocs.docs.forEach((doc) => {
        deleteBatch.delete(doc.ref);
      });
      await deleteBatch.commit();
    }

    const lines = csvData.trim().split('\n');
    let count = 0;

    const header = lines[0].split(',').map((h) => h.trim().toLowerCase());
    const startIndex = 1; // Assume header is always present

    const skippedRows: { row: number; reason: string; data: any }[] = [];
    const seenDNIs = new Set<string>();
    let duplicateCount = 0;
    let emptyLineCount = 0;

    // Process in batches of 500 (Firestore limit)
    const batchSize = 500;
    for (let i = startIndex; i < lines.length; i += batchSize) {
      const batch = writeBatch(db);
      const chunk = lines.slice(i, Math.min(i + batchSize, lines.length));

      for (let j = 0; j < chunk.length; j++) {
        const line = chunk[j];
        const rowNumber = i + j + 1; // +1 because CSV rows start at 1 (header is row 1)
        const trimmedLine = line.trim();
        if (!trimmedLine) {
          emptyLineCount++;
          continue;
        }

        const values = trimmedLine.split(',').map((s) => s.trim());
        const row = header.reduce((obj, nextKey, index) => {
          obj[nextKey] = values[index];
          return obj;
        }, {} as any);

        const dni = getValueFromRow(row, ['dni']);
        let nombre = getValueFromRow(row, ['nombre', 'name']);
        if (!nombre) {
          const nom = getValueFromRow(row, ['nom']);
          const cognoms = getValueFromRow(row, ['cognoms']);
          nombre = `${nom} ${cognoms}`.trim();
        }

        // Log skipped rows
        if (!dni && !nombre) {
          skippedRows.push({ row: rowNumber, reason: 'DNI y Nombre vacíos', data: row });
          continue;
        }
        if (!dni) {
          skippedRows.push({ row: rowNumber, reason: 'DNI vacío', data: { nombre, ...row } });
          continue;
        }
        if (!nombre) {
          skippedRows.push({ row: rowNumber, reason: 'Nombre vacío', data: { dni, ...row } });
          continue;
        }

        // Check for duplicates
        if (seenDNIs.has(dni)) {
          duplicateCount++;
          console.warn(`⚠️ Fila ${rowNumber}: DNI duplicado "${dni}" - se sobrescribirá`);
        }
        seenDNIs.add(dni);

        const masterClass = getValueFromRow(row, [
          'masterclass',
          'master class',
          'master_class',
        ]);
        const cena = getValueFromRow(row, ['cena', 'dinner']);
        const acceso = getValueFromRow(row, ['acceso', 'access']).toLowerCase();
        const esPresencial = acceso.includes('presencial');

        const participant: Participant = {
          dni,
          nombre,
          email: getValueFromRow(row, ['mail', 'email']),
          telefono: getValueFromRow(row, ['telèfon', 'telefon', 'telefono']),
          entitat: getValueFromRow(row, [
            'entitat/institució',
            'entitat',
            'institució',
            'institucion',
          ]),
          escuela: getValueFromRow(row, [
            "tipus d'escola",
            'tipo de escuela',
            'escuela',
          ]),
          cargo: getValueFromRow(row, [
            'lloc/responsabilitat',
            'cargo',
            'responsabilitat',
          ]),
          acceso: acceso,
          haPagado: isPositiveValue(
            getValueFromRow(row, ['ha pagat?', 'ha pagat', 'ha pagado'])
          ),
          permisos: {
            aula_magna: esPresencial,
            // Solo asignar permisos de master_class y cena si es presencial
            master_class: esPresencial && isPositiveValue(masterClass),
            cena: esPresencial && isPositiveValue(cena),
          },
          estado: {
            registrado: false,
            en_aula_magna: false,
            en_master_class: false,
            en_cena: false,
          },
          ultima_actualizacion: Date.now(),
          eventId: eventId || '',
        };

        const docRef = doc(db, collectionPath, dni);
        batch.set(docRef, participant);
        count++;
      }

      await batch.commit();
    }

    // Log summary
    console.log('\n📊 === RESUMEN DE IMPORTACIÓN CSV ===');
    console.log(`✅ Participantes importados: ${count}`);
    console.log(`⏭️ Filas saltadas: ${skippedRows.length}`);
    console.log(`📭 Líneas vacías: ${emptyLineCount}`);
    console.log(`🔄 DNIs duplicados (sobrescritos): ${duplicateCount}`);
    console.log(`📁 Total líneas en CSV: ${lines.length - 1} (sin cabecera)`);

    if (skippedRows.length > 0) {
      console.log('\n❌ FILAS EXCLUIDAS:');
      skippedRows.forEach(({ row, reason, data }) => {
        console.log(`   Fila ${row}: ${reason}`);
        console.log(`      Datos: ${JSON.stringify(data)}`);
      });
    }

    if (duplicateCount > 0) {
      console.log(`\n⚠️ Nota: ${duplicateCount} DNIs duplicados fueron sobrescritos (solo cuenta el último)`);
      console.log(`   Participantes únicos finales: ${seenDNIs.size}`);
    }

    console.log('====================================\n');

    return count;
  } catch (error) {
    console.error('Error importing participants from CSV:', error);
    throw error;
  }
}

/**
 * Import participants from Excel
 * @param arrayBuffer - Excel file as ArrayBuffer
 * @param eventId - Event ID to import to
 * @param mode - 'replace' deletes existing data first, 'merge' adds/updates
 */
export async function importParticipantsFromExcel(
  arrayBuffer: ArrayBuffer,
  eventId?: string,
  mode: ImportMode = 'merge'
): Promise<number> {
  try {
    const collectionPath = eventId
      ? getParticipantsCollection(eventId)
      : LEGACY_PARTICIPANTS_COLLECTION;

    // If replace mode, delete all existing participants first
    if (mode === 'replace' && eventId) {
      const existingDocs = await getDocs(collection(db, collectionPath));
      const deleteBatch = writeBatch(db);
      existingDocs.docs.forEach((doc) => {
        deleteBatch.delete(doc.ref);
      });
      await deleteBatch.commit();
    }

    const workbook = XLSX.read(arrayBuffer, { type: 'array' });
    const firstSheetName = workbook.SheetNames[0];
    const sheet = workbook.Sheets[firstSheetName];
    const data = XLSX.utils.sheet_to_json(sheet, { defval: '' });

    let count = 0;

    // Process in batches of 500 (Firestore limit)
    const batchSize = 500;
    const rows = data as any[];

    const skippedRows: { row: number; reason: string; data: any }[] = [];
    const seenDNIs = new Set<string>();
    let duplicateCount = 0;

    for (let i = 0; i < rows.length; i += batchSize) {
      const batch = writeBatch(db);
      const chunk = rows.slice(i, Math.min(i + batchSize, rows.length));

      for (let j = 0; j < chunk.length; j++) {
        const row = chunk[j];
        const rowNumber = i + j + 2; // +2 because Excel rows start at 1 and row 1 is header
        const dni = getValueFromRow(row, ['dni']);

        // Build nombre from NOM + COGNOMS or use nombre field
        let nombre = getValueFromRow(row, ['nombre', 'name']);
        if (!nombre) {
          const nom = getValueFromRow(row, ['nom', 'first name']);
          const cognoms = getValueFromRow(row, [
            'cognoms',
            'cognomes',
            'apellidos',
            'last name',
          ]);
          nombre = `${nom} ${cognoms}`.trim();
        }

        // Log skipped rows
        if (!dni && !nombre) {
          skippedRows.push({ row: rowNumber, reason: 'DNI y Nombre vacíos (fila vacía)', data: row });
          continue;
        }
        if (!dni) {
          skippedRows.push({ row: rowNumber, reason: 'DNI vacío', data: { nombre, ...row } });
          continue;
        }
        if (!nombre) {
          skippedRows.push({ row: rowNumber, reason: 'Nombre vacío', data: { dni, ...row } });
          continue;
        }

        // Check for duplicates
        if (seenDNIs.has(dni)) {
          duplicateCount++;
          console.warn(`⚠️ Fila ${rowNumber}: DNI duplicado "${dni}" - se sobrescribirá`);
        }
        seenDNIs.add(dni);

        const masterClass = getValueFromRow(row, [
          'masterclass',
          'master class',
          'master_class',
        ]);
        const cena = getValueFromRow(row, ['cena', 'dinner']);
        const acceso = getValueFromRow(row, ['acceso', 'access']).toLowerCase();
        const esPresencial = acceso.includes('presencial');

        const participant: Participant = {
          dni,
          nombre,
          email: getValueFromRow(row, ['mail', 'email']),
          telefono: getValueFromRow(row, ['telèfon', 'telefon', 'telefono']),
          entitat: getValueFromRow(row, [
            'entitat/institució',
            'entitat',
            'institució',
            'institucion',
          ]),
          escuela: getValueFromRow(row, [
            "tipus d'escola",
            'tipo de escuela',
            'escuela',
          ]),
          cargo: getValueFromRow(row, [
            'lloc/responsabilitat',
            'cargo',
            'responsabilitat',
          ]),
          acceso: acceso,
          haPagado: isPositiveValue(
            getValueFromRow(row, ['ha pagat?', 'ha pagat', 'ha pagado'])
          ),
          permisos: {
            aula_magna: esPresencial,
            // Solo asignar permisos de master_class y cena si es presencial
            master_class: esPresencial && isPositiveValue(masterClass),
            cena: esPresencial && isPositiveValue(cena),
          },
          estado: {
            registrado: false,
            en_aula_magna: false,
            en_master_class: false,
            en_cena: false,
          },
          ultima_actualizacion: Date.now(),
          eventId: eventId || '',
        };

        const docRef = doc(db, collectionPath, dni);
        batch.set(docRef, participant);
        count++;
      }

      await batch.commit();
    }

    // Log summary
    console.log('\n📊 === RESUMEN DE IMPORTACIÓN ===');
    console.log(`✅ Participantes importados: ${count}`);
    console.log(`⏭️ Filas saltadas: ${skippedRows.length}`);
    console.log(`🔄 DNIs duplicados (sobrescritos): ${duplicateCount}`);
    console.log(`📁 Total filas en Excel: ${rows.length}`);

    if (skippedRows.length > 0) {
      console.log('\n❌ FILAS EXCLUIDAS:');
      skippedRows.forEach(({ row, reason, data }) => {
        console.log(`   Fila ${row}: ${reason}`);
        console.log(`      Datos: ${JSON.stringify(data)}`);
      });
    }

    if (duplicateCount > 0) {
      console.log(`\n⚠️ Nota: ${duplicateCount} DNIs duplicados fueron sobrescritos (solo cuenta el último)`);
      console.log(`   Participantes únicos finales: ${seenDNIs.size}`);
    }

    console.log('================================\n');

    return count;
  } catch (error) {
    console.error('Error importing from Excel:', error);
    throw error;
  }
}

/**
 * Reset all participant states (for testing or reset)
 */
export async function resetAllParticipantStates(eventId?: string): Promise<void> {
  try {
    const collectionPath = eventId
      ? getParticipantsCollection(eventId)
      : LEGACY_PARTICIPANTS_COLLECTION;

    const querySnapshot = await getDocs(collection(db, collectionPath));

    // Process in batches of 500
    const batchSize = 500;
    const docs = querySnapshot.docs;

    for (let i = 0; i < docs.length; i += batchSize) {
      const batch = writeBatch(db);
      const chunk = docs.slice(i, Math.min(i + batchSize, docs.length));

      chunk.forEach((document) => {
        batch.update(document.ref, {
          'estado.registrado': false,
          'estado.en_aula_magna': false,
          'estado.en_master_class': false,
          'estado.en_cena': false,
          ultima_actualizacion: Date.now(),
        });
      });

      await batch.commit();
    }
  } catch (error) {
    console.error('Error resetting states:', error);
    throw error;
  }
}

/**
 * Get recent access logs for a specific mode
 */
export async function getRecentAccessLogs(
  modo: AccessMode,
  limitNum: number = 10,
  eventId?: string
): Promise<AccessLog[]> {
  try {
    const collectionPath = eventId
      ? getAccessLogsCollection(eventId)
      : LEGACY_ACCESS_LOGS_COLLECTION;

    const q = query(
      collection(db, collectionPath),
      where('modo', '==', modo),
      where('exito', '==', true),
      orderBy('timestamp', 'desc'),
      limit(limitNum)
    );

    const snapshot = await getDocs(q);
    return snapshot.docs.map((doc) => doc.data() as AccessLog);
  } catch (error) {
    console.error('Error getting recent logs:', error);
    throw error;
  }
}

/**
 * Subscribe to recent access logs in real-time
 */
export function subscribeToRecentAccessLogs(
  modo: AccessMode,
  limitNum: number = 10,
  callback: (logs: AccessLog[]) => void,
  eventId?: string
): Unsubscribe {
  const collectionPath = eventId
    ? getAccessLogsCollection(eventId)
    : LEGACY_ACCESS_LOGS_COLLECTION;

  const q = query(
    collection(db, collectionPath),
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
 * Get access statistics for a specific mode
 */
export async function getAccessStats(
  modo: AccessMode,
  eventId?: string
): Promise<{
  uniqueEntrances: number;
  maxSimultaneous: number;
}> {
  try {
    const participantsPath = eventId
      ? getParticipantsCollection(eventId)
      : LEGACY_PARTICIPANTS_COLLECTION;
    const logsPath = eventId
      ? getAccessLogsCollection(eventId)
      : LEGACY_ACCESS_LOGS_COLLECTION;

    if (modo === 'registro') {
      // For registration, just count registered participants
      const q = query(
        collection(db, participantsPath),
        where('estado.registrado', '==', true)
      );
      const snapshot = await getDocs(q);
      return {
        uniqueEntrances: snapshot.size,
        maxSimultaneous: snapshot.size,
      };
    }

    // For other modes, analyze logs
    const logsQuery = query(
      collection(db, logsPath),
      where('modo', '==', modo),
      where('exito', '==', true),
      orderBy('timestamp', 'asc')
    );

    const logsSnapshot = await getDocs(logsQuery);
    const logs = logsSnapshot.docs.map((doc) => doc.data() as AccessLog);

    // Count unique participants who have entered
    const uniqueDNIs = new Set<string>();
    logs.forEach((log) => {
      if (log.direccion === 'entrada') {
        uniqueDNIs.add(log.dni);
      }
    });

    // Calculate max simultaneous by traversing history
    let maxCount = 0;
    const currentParticipants = new Set<string>();

    logs.forEach((log) => {
      if (log.direccion === 'entrada') {
        currentParticipants.add(log.dni);
        maxCount = Math.max(maxCount, currentParticipants.size);
      } else if (log.direccion === 'salida') {
        currentParticipants.delete(log.dni);
      }
    });

    return {
      uniqueEntrances: uniqueDNIs.size,
      maxSimultaneous: maxCount,
    };
  } catch (error) {
    console.error('Error getting statistics:', error);
    return { uniqueEntrances: 0, maxSimultaneous: 0 };
  }
}

/**
 * Get counts based on permissions
 */
export async function getPermissionBasedCounts(eventId?: string): Promise<{
  registro: number;
  aula_magna: number;
  master_class: number;
  cena: number;
}> {
  try {
    const collectionPath = eventId
      ? getParticipantsCollection(eventId)
      : LEGACY_PARTICIPANTS_COLLECTION;

    const snapshot = await getDocs(collection(db, collectionPath));

    const counts = {
      registro: snapshot.size,
      aula_magna: 0,
      master_class: 0,
      cena: 0,
    };

    snapshot.forEach((doc) => {
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
    console.error('Error getting permission counts:', error);
    return {
      registro: 0,
      aula_magna: 0,
      master_class: 0,
      cena: 0,
    };
  }
}

/**
 * Export all data to Excel
 */
export async function exportDataToExcel(eventId?: string): Promise<string> {
  try {
    const participantsPath = eventId
      ? getParticipantsCollection(eventId)
      : LEGACY_PARTICIPANTS_COLLECTION;
    const logsPath = eventId
      ? getAccessLogsCollection(eventId)
      : LEGACY_ACCESS_LOGS_COLLECTION;

    // Get all participants
    const participantsSnapshot = await getDocs(collection(db, participantsPath));
    const participants = participantsSnapshot.docs.map(
      (doc) => doc.data() as Participant
    );

    // Get all logs (sorted by date)
    const logsQuery = query(collection(db, logsPath), orderBy('timestamp', 'desc'));
    const logsSnapshot = await getDocs(logsQuery);
    const logs = logsSnapshot.docs.map((doc) => doc.data() as AccessLog);

    // Prepare participants data for Excel (matching input format + app fields)
    const participantsData = participants.map((p) => ({
      // Original input format fields
      Nombre: p.nombre,
      DNI: p.dni,
      'Entitat/Institució': p.entitat || '',
      "Tipus d'Escola": p.escuela || '',
      'Lloc/Responsabilitat': p.cargo || '',
      Mail: p.email || '',
      Telèfon: p.telefono || '',
      Acceso: p.acceso || '',
      Master_Class: p.permisos.master_class ? 'Si' : 'No',
      Cena: p.permisos.cena ? 'Si' : 'No',
      'Ha Pagat?': p.haPagado ? 'Si' : 'No',
      // App-specific status fields
      Registrado: p.estado.registrado ? 'Si' : 'No',
      'En Aula Magna': p.estado.en_aula_magna ? 'Si' : 'No',
      'En Master Class': p.estado.en_master_class ? 'Si' : 'No',
      'En Cena': p.estado.en_cena ? 'Si' : 'No',
      'Fecha Registro': p.timestamp_registro
        ? new Date(p.timestamp_registro).toLocaleString('es-ES')
        : '',
      'Última Actualización': new Date(p.ultima_actualizacion).toLocaleString(
        'es-ES'
      ),
    }));

    // Prepare logs data for Excel
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

    // Create Excel workbook
    const wb = XLSX.utils.book_new();

    // Sheet 1: Participants
    const wsParticipants = XLSX.utils.json_to_sheet(participantsData);
    XLSX.utils.book_append_sheet(wb, wsParticipants, 'Participantes');

    // Sheet 2: Logs
    const wsLogs = XLSX.utils.json_to_sheet(logsData);
    XLSX.utils.book_append_sheet(wb, wsLogs, 'Logs de Acceso');

    const fileName = `export_congreso_${new Date().toISOString().split('T')[0]}.xlsx`;

    // Detect platform and use appropriate method
    if (Platform.OS === 'web') {
      // WEB: Download using blob
      const wbout = XLSX.write(wb, { type: 'array', bookType: 'xlsx' });
      const blob = new Blob([wbout], {
        type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      });

      // Create temporary URL and download
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = fileName;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);

      return url;
    } else {
      // MOBILE: Use expo-file-system
      const wbout = XLSX.write(wb, { type: 'array', bookType: 'xlsx' });
      const file = new File(Paths.document, fileName);

      const uint8Array = new Uint8Array(wbout as ArrayBuffer);
      await file.write(uint8Array);

      return file.uri;
    }
  } catch (error) {
    console.error('Error exporting data to Excel:', error);
    throw error;
  }
}

/**
 * Create an individual participant manually
 */
export async function createParticipant(
  participantData: {
    dni: string;
    nombre: string;
    email?: string;
    telefono?: string;
    escuela?: string;
    cargo?: string;
    acceso?: string;
    haPagado?: boolean;
    masterClass?: boolean;
    cena?: boolean;
  },
  eventId?: string
): Promise<void> {
  try {
    const dni = participantData.dni.trim();
    const collectionPath = eventId
      ? getParticipantsCollection(eventId)
      : LEGACY_PARTICIPANTS_COLLECTION;

    // Check if already exists
    const existing = await getParticipantByDNI(dni, eventId);
    if (existing) {
      throw new Error(`Ya existe un participante con DNI ${dni}`);
    }

    const acceso = participantData.acceso || 'presencial';
    const isPresencial = acceso.toLowerCase().includes('presencial');

    const participant: Participant = {
      dni,
      nombre: participantData.nombre.trim(),
      email: participantData.email?.trim() || undefined,
      telefono: participantData.telefono?.trim() || undefined,
      escuela: participantData.escuela?.trim() || undefined,
      cargo: participantData.cargo?.trim() || undefined,
      acceso,
      haPagado: participantData.haPagado || false,
      permisos: {
        aula_magna: isPresencial,
        master_class: participantData.masterClass || false,
        cena: participantData.cena || false,
      },
      estado: {
        registrado: false,
        en_aula_magna: false,
        en_master_class: false,
        en_cena: false,
      },
      ultima_actualizacion: Date.now(),
      eventId: eventId || '',
    };

    const docRef = doc(db, collectionPath, dni);
    await setDoc(docRef, participant);

    console.log(`✅ Participant ${participantData.nombre} created successfully`);
  } catch (error) {
    console.error('Error creating participant:', error);
    throw error;
  }
}

/**
 * Delete all participants and their access logs for an event
 */
export async function deleteAllParticipants(eventId: string): Promise<number> {
  try {
    const batchSize = 500;

    // 1. Delete all participants
    const participantsPath = getParticipantsCollection(eventId);
    const participantsSnapshot = await getDocs(collection(db, participantsPath));

    let deletedParticipants = 0;
    if (!participantsSnapshot.empty) {
      const participantDocs = participantsSnapshot.docs;

      for (let i = 0; i < participantDocs.length; i += batchSize) {
        const batch = writeBatch(db);
        const chunk = participantDocs.slice(i, Math.min(i + batchSize, participantDocs.length));

        chunk.forEach((document) => {
          batch.delete(document.ref);
        });

        await batch.commit();
        deletedParticipants += chunk.length;
      }
      console.log(`✅ Deleted ${deletedParticipants} participants`);
    }

    // 2. Delete all access logs for this event
    const logsPath = getAccessLogsCollection(eventId);
    const logsSnapshot = await getDocs(collection(db, logsPath));

    let deletedLogs = 0;
    if (!logsSnapshot.empty) {
      const logDocs = logsSnapshot.docs;

      for (let i = 0; i < logDocs.length; i += batchSize) {
        const batch = writeBatch(db);
        const chunk = logDocs.slice(i, Math.min(i + batchSize, logDocs.length));

        chunk.forEach((document) => {
          batch.delete(document.ref);
        });

        await batch.commit();
        deletedLogs += chunk.length;
      }
      console.log(`✅ Deleted ${deletedLogs} access logs`);
    }

    return deletedParticipants;
  } catch (error) {
    console.error('Error deleting all participants:', error);
    throw error;
  }
}

/**
 * Get participant count for an event
 */
export async function getParticipantCount(eventId?: string): Promise<number> {
  try {
    const collectionPath = eventId
      ? getParticipantsCollection(eventId)
      : LEGACY_PARTICIPANTS_COLLECTION;

    const snapshot = await getDocs(collection(db, collectionPath));
    return snapshot.size;
  } catch (error) {
    console.error('Error getting participant count:', error);
    return 0;
  }
}
