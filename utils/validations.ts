/**
 * Lógica de validación para cada modo de acceso
 */

import { AccessMode, AccessDirection, Participant, ValidationResult } from '@/types/participant';

export function validateAccess(
  participante: Participant | null,
  modo: AccessMode,
  direccion: AccessDirection
): ValidationResult {
  // Participante no existe en la base de datos
  if (!participante) {
    return {
      valido: false,
      mensaje: '❌ Participante no inscrito en el congreso',
    };
  }

  switch (modo) {
    case 'registro':
      return validateRegistro(participante);

    case 'aula_magna':
      return validateAulaMagna(participante, direccion);

    case 'master_class':
      return validateMasterClass(participante, direccion);

    case 'cena':
      return validateCena(participante, direccion);

    default:
      return {
        valido: false,
        mensaje: '❌ Modo de acceso no reconocido',
      };
  }
}

function validateRegistro(participante: Participant): ValidationResult {
  if (participante.estado.registrado) {
    return {
      valido: false,
      mensaje: '⚠️ Participante ya registrado anteriormente',
      participante,
    };
  }

  return {
    valido: true,
    mensaje: '✅ Registro exitoso',
    participante,
  };
}

function validateAulaMagna(
  participante: Participant,
  direccion: AccessDirection
): ValidationResult {
  // Todos tienen permiso al aula magna
  if (!participante.permisos.aula_magna) {
    return {
      valido: false,
      mensaje: '❌ Sin permiso de acceso al aula magna',
      participante,
    };
  }

  if (!participante.estado.registrado) {
    return {
      valido: false,
      mensaje: '❌ Debe registrarse primero en la entrada del congreso',
      participante,
    };
  }

  if (direccion === 'entrada') {
    if (participante.estado.en_aula_magna) {
      return {
        valido: false,
        mensaje: '⚠️ Ya está dentro del aula magna',
        participante,
      };
    }
    return {
      valido: true,
      mensaje: '✅ Acceso permitido al aula magna',
      participante,
    };
  } else {
    // Salida
    if (!participante.estado.en_aula_magna) {
      return {
        valido: false,
        mensaje: '⚠️ No consta como dentro del aula magna',
        participante,
      };
    }
    return {
      valido: true,
      mensaje: '✅ Salida registrada del aula magna',
      participante,
    };
  }
}

function validateMasterClass(
  participante: Participant,
  direccion: AccessDirection
): ValidationResult {
  if (!participante.permisos.master_class) {
    return {
      valido: false,
      mensaje: '❌ Sin permiso de acceso a la master class',
      participante,
    };
  }

  if (!participante.estado.registrado) {
    return {
      valido: false,
      mensaje: '❌ Debe registrarse primero en la entrada del congreso',
      participante,
    };
  }

  if (direccion === 'entrada') {
    if (participante.estado.en_master_class) {
      return {
        valido: false,
        mensaje: '⚠️ Ya está dentro de la master class',
        participante,
      };
    }
    return {
      valido: true,
      mensaje: '✅ Acceso permitido a la master class',
      participante,
    };
  } else {
    // Salida
    if (!participante.estado.en_master_class) {
      return {
        valido: false,
        mensaje: '⚠️ No consta como dentro de la master class',
        participante,
      };
    }
    return {
      valido: true,
      mensaje: '✅ Salida registrada de la master class',
      participante,
    };
  }
}

function validateCena(
  participante: Participant,
  direccion: AccessDirection
): ValidationResult {
  if (!participante.permisos.cena) {
    return {
      valido: false,
      mensaje: '❌ Sin permiso de acceso a la cena de clausura',
      participante,
    };
  }

  if (!participante.estado.registrado) {
    return {
      valido: false,
      mensaje: '❌ Debe registrarse primero en la entrada del congreso',
      participante,
    };
  }

  if (direccion === 'entrada') {
    if (participante.estado.en_cena) {
      return {
        valido: false,
        mensaje: '⚠️ Ya está dentro de la cena',
        participante,
      };
    }
    return {
      valido: true,
      mensaje: '✅ Acceso permitido a la cena de clausura',
      participante,
    };
  } else {
    // Salida
    if (!participante.estado.en_cena) {
      return {
        valido: false,
        mensaje: '⚠️ No consta como dentro de la cena',
        participante,
      };
    }
    return {
      valido: true,
      mensaje: '✅ Salida registrada de la cena',
      participante,
    };
  }
}
