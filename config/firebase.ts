/**
 * Configuración de Firebase
 * IMPORTANTE: Reemplaza estos valores con los de tu proyecto Firebase
 */

import { initializeApp } from "firebase/app";
import { getFirestore } from 'firebase/firestore';
import { getAuth } from 'firebase/auth';

// TODO: Reemplazar con tu configuración de Firebase
// Obtén estos valores desde Firebase Console > Project Settings > Web App
const firebaseConfig = {
  apiKey: "AIzaSyDINril47qM50B2S5VuTDwGh4w4ZLRSd4w",
  authDomain: "accesscongress.firebaseapp.com",
  projectId: "accesscongress",
  storageBucket: "accesscongress.firebasestorage.app",
  messagingSenderId: "211521207592",
  appId: "1:211521207592:web:1bd581d39b2740259ca41d",
  measurementId: "G-72RWSE0VCF"
};

// Inicializar Firebase
const app = initializeApp(firebaseConfig);
// Exportar servicios
export const db = getFirestore(app);
export const auth = getAuth(app);


export default app;
