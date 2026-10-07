/**
 * Pesos de la DIAN (Orden Administrativa 4 de 1989). La serie oficial es
 * 3,7,13,17,19,23,29,37,41,43,47,53,59,67,71 aplicada de derecha a izquierda;
 * aquí está invertida para poder tomar los últimos N valores y aplicarlos de
 * izquierda a derecha. Para un NIT de 9 dígitos corresponden 41,37,29,23,19,
 * 17,13,7,3.
 */
const NIT_WEIGHTS = [71, 67, 59, 53, 47, 43, 41, 37, 29, 23, 19, 17, 13, 7, 3];
/** Longitudes que la DIAN documenta: NIT de 8, 9 o hasta 15 dígitos. */
const NIT_MIN_DIGITS = 8;
const NIT_MAX_DIGITS = 15;

export interface NitValidation {
  ok: boolean;
  error: string;
}

/**
 * Dígito de verificación de un NIT o cédula colombiano (módulo 11). Devuelve
 * '' si la entrada no tiene una longitud soportada.
 */
export function calcNitDv(body: string): string {
  if (!/^\d+$/.test(body) || body.length < NIT_MIN_DIGITS || body.length > NIT_MAX_DIGITS) return '';
  const weights = NIT_WEIGHTS.slice(NIT_WEIGHTS.length - body.length);
  const sum = body.split('').reduce((acc, digit, i) => acc + Number(digit) * weights[i], 0);
  const remainder = sum % 11;
  return String(remainder >= 2 ? 11 - remainder : remainder);
}

/**
 * Número de documento de un cliente tal como se guarda: sin '-', espacios ni
 * puntos (el DV va aparte). Misma regla que valida el backend.
 */
export const sanitizeDocumentNumber = (value: string) => value.replace(/[^0-9A-Za-z]/g, '');

/**
 * ¿`nit` es un NIT completo (cuerpo + DV, solo dígitos) con el DV correcto?
 * Así se digita y se guarda un NIT en toda la app: 9014902765, sin '-'.
 */
export function isValidFullNit(nit: string): boolean {
  if (!/^\d+$/.test(nit)) return false;
  const body = nit.slice(0, -1);
  return body.length >= NIT_MIN_DIGITS && body.length <= NIT_MAX_DIGITS && calcNitDv(body) === nit.slice(-1);
}

/** Lo que se admite al escribir un NIT: solo dígitos (va completo, con DV y sin '-'). */
export function sanitizeNitInput(value: string): string {
  return value.replace(/\D/g, '');
}

/**
 * Número para prellenar la creación de un cliente desde el estudio: el mismo
 * digitado (NIT completo de una jurídica, o la cédula de una natural).
 */
export const documentForNewClient = (value: string) => value;

/** Nombre del documento que se digita en el estudio según el tipo de persona. */
export const idLabel = (personType: string) => (personType === 'juridica' ? 'NIT' : 'número de identificación');

/**
 * Valida lo digitado en el estudio de crédito (solo dígitos, sin '-'):
 *   Persona jurídica: NIT completo, con su DV al final. El DV se comprueba
 *   desde que el número tiene la longitud mínima; con cliente seleccionado debe
 *   ser su NIT tal cual.
 *   Persona natural: número de identificación (cédula) sin DV; con cliente
 *   seleccionado debe ser su cédula.
 * El backend vuelve a validarlo (backend/src/modules/credits/nit.ts).
 */
export function validateNit(value: string, documentNumber?: string, personType = 'natural'): NitValidation {
  const juridica = personType === 'juridica';
  const label = idLabel(personType);
  if (value.length === 0) {
    return { ok: false, error: `Ingresa el ${label} del cliente.` };
  }
  if (!/^\d+$/.test(value)) {
    return {
      ok: false,
      error: juridica ? "El NIT va completo, con DV y sin '-'." : "El número de identificación va sin DV ni '-', solo dígitos.",
    };
  }

  if (!juridica) {
    if (value.length < 5) return { ok: false, error: 'El número de identificación está incompleto.' };
    if (documentNumber && value !== documentNumber) {
      return { ok: false, error: 'El número de identificación no corresponde al cliente seleccionado.' };
    }
    return { ok: true, error: '' };
  }

  if (value.length <= NIT_MIN_DIGITS || value.length > NIT_MAX_DIGITS + 1) {
    return { ok: false, error: 'El NIT va completo: número más dígito de verificación (DV).' };
  }
  // Con cliente seleccionado se distingue "olvidó el DV" de "DV equivocado".
  if (documentNumber && value === documentNumber.slice(0, -1)) {
    return { ok: false, error: 'Falta el dígito de verificación (DV) al final del NIT.' };
  }
  if (!isValidFullNit(value)) {
    return {
      ok: false,
      error: `El dígito de verificación no coincide: con ese número, el NIT debería terminar en ${calcNitDv(value.slice(0, -1))}.`,
    };
  }
  if (documentNumber && value !== documentNumber) {
    return { ok: false, error: 'El NIT no corresponde al cliente seleccionado.' };
  }
  return { ok: true, error: '' };
}
