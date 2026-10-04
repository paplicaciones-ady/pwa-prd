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
 * ¿`value` es `documentNumber` seguido de un dígito (el DV)? Sirve para que la
 * búsqueda encuentre al cliente cuando ya se digitó el NIT completo:
 * `clients.document_number` no guarda el DV.
 */
export function isDocumentWithDv(value: string, documentNumber: string): boolean {
  return value.length === documentNumber.length + 1 && value.startsWith(documentNumber);
}

/**
 * Cuerpo del NIT (sin DV) para prellenar la creación de un cliente: si el
 * último dígito es un DV válido se quita; si no, se asume que aún no se digitó.
 */
export function nitBody(value: string): string {
  if (value.length > NIT_MIN_DIGITS && calcNitDv(value.slice(0, -1)) === value.slice(-1)) {
    return value.slice(0, -1);
  }
  return value;
}

/**
 * Valida el NIT digitado en el flujo de crédito: documento + dígito de
 * verificación, obligatorio. El cuerpo tiene la longitud del documento (la
 * DIAN admite de 8 a 15 dígitos: NIT de empresa de 9, cédulas de 8 o 10…).
 *
 * Con cliente seleccionado se valida contra su documento, que es el único modo
 * de saber dónde termina el cuerpo. Sin cliente solo se valida la forma. El
 * backend vuelve a comprobarlo (backend/src/modules/credits/nit.ts).
 */
export function validateNit(value: string, documentNumber?: string): NitValidation {
  if (!/^\d*$/.test(value)) {
    return { ok: false, error: 'El NIT solo puede contener dígitos.' };
  }
  if (value.length === 0) {
    return { ok: false, error: 'Ingresa el NIT del cliente.' };
  }
  if (!documentNumber) {
    return value.length > NIT_MIN_DIGITS && value.length <= NIT_MAX_DIGITS + 1
      ? { ok: true, error: '' }
      : { ok: false, error: 'El NIT debe ser el documento del cliente más el dígito de verificación.' };
  }
  if (value === documentNumber) {
    return { ok: false, error: 'Falta el dígito de verificación (DV).' };
  }
  if (!isDocumentWithDv(value, documentNumber)) {
    return { ok: false, error: 'El NIT no corresponde al documento del cliente seleccionado.' };
  }
  const expected = calcNitDv(documentNumber);
  if (!expected) {
    return { ok: false, error: 'El documento del cliente no tiene una longitud de NIT válida.' };
  }
  return expected === value.slice(-1)
    ? { ok: true, error: '' }
    : { ok: false, error: `El dígito de verificación es ${expected}. Revisa el NIT.` };
}
