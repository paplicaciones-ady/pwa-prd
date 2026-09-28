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
 * Solo los 9 dígitos del NIT, sin el de verificación. `clients.document_number`
 * no guarda el DV, así que la búsqueda y las comparaciones deben usar esto.
 */
export function stripNitDv(value: string): string {
  return (value.match(/\d/g) ?? []).join('').slice(0, 9);
}

/**
 * Valida el NIT digitado en el flujo de crédito: 9 dígitos de cuerpo y,
 * opcionalmente, un 10º que sea el dígito de verificación correcto.
 *
 * Nota: la DIAN también emite NIT de 8 dígitos. Acá se exige cuerpo de 9
 * porque es lo que devuelve `clients.document_number` en la búsqueda; si
 * empiezan a aparecer NIT de 8, hay que relajar la longitud mínima.
 */
export function validateNit(value: string): NitValidation {
  if (!/^\d*$/.test(value)) {
    return { ok: false, error: 'El NIT solo puede contener dígitos.' };
  }
  if (value.length === 0) {
    return { ok: false, error: 'Ingresa el NIT del cliente.' };
  }
  if (value.length < 9) {
    return { ok: false, error: 'El NIT debe tener 9 dígitos, más el de verificación.' };
  }
  if (value.length === 9) {
    return { ok: true, error: '' };
  }
  if (value.length > 10) {
    return { ok: false, error: 'El NIT no puede tener más de 10 dígitos.' };
  }
  const expected = calcNitDv(value.slice(0, 9));
  return expected === value[9]
    ? { ok: true, error: '' }
    : { ok: false, error: `El dígito de verificación es ${expected}. Revisa el NIT.` };
}
