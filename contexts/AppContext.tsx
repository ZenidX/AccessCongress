/**
 * Contexto global de la aplicación
 */

import React, { createContext, useContext, useState, ReactNode } from 'react';
import { AccessMode, AccessDirection } from '@/types/participant';

interface AppContextType {
  modo: AccessMode;
  setModo: (modo: AccessMode) => void;
  direccion: AccessDirection;
  setDireccion: (direccion: AccessDirection) => void;
  operador: string;
  setOperador: (operador: string) => void;
}

const AppContext = createContext<AppContextType | undefined>(undefined);

export function AppProvider({ children }: { children: ReactNode }) {
  const [modo, setModo] = useState<AccessMode>('registro');
  const [direccion, setDireccion] = useState<AccessDirection>('entrada');
  const [operador, setOperador] = useState<string>('Operador 1');

  return (
    <AppContext.Provider
      value={{
        modo,
        setModo,
        direccion,
        setDireccion,
        operador,
        setOperador,
      }}
    >
      {children}
    </AppContext.Provider>
  );
}

export function useApp() {
  const context = useContext(AppContext);
  if (context === undefined) {
    throw new Error('useApp must be used within AppProvider');
  }
  return context;
}
