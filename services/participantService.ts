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
