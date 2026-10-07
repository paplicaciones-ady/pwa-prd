/**
 * Pesos de la DIAN (Orden Administrativa 4 de 1989) invertidos para aplicarse
 * de izquierda a derecha. Misma tabla que frontend/src/shared/utils/validators.ts:
 * el front valida para dar feedback inmediato, el backend vuelve a validar
 * porque el DV que se guarda no puede depender de lo que diga el cliente.
 */
const NIT_WEIGHTS = [71, 67, 59, 53, 47, 43, 41, 37, 29, 23, 19, 17, 13, 7, 3];

/** Longitudes de cuerpo (sin DV) que la DIAN admite: NIT de 9, cédulas de 8 o 10… */
export const NIT_MIN_DIGITS = 8;
export const NIT_MAX_DIGITS = 15;

/** Dígito de verificación (módulo 11) de un cuerpo de NIT. */
export function calcNitDv(body: string): string {
  const weights = NIT_WEIGHTS.slice(NIT_WEIGHTS.length - body.length);
  const sum = body.split('').reduce((acc, digit, i) => acc + Number(digit) * weights[i], 0);
  const remainder = sum % 11;
  return String(remainder >= 2 ? 11 - remainder : remainder);
}

/**
 * ¿`nit` es un NIT completo (cuerpo + DV, solo dígitos) con el DV correcto?
 * Es el formato en que se digita y se guarda un NIT en toda la app (9014902765).
 */
export function isValidFullNit(nit: string): boolean {
  if (!/^\d+$/.test(nit)) return false;
  const body = nit.slice(0, -1);
  if (body.length < NIT_MIN_DIGITS || body.length > NIT_MAX_DIGITS) return false;
  return calcNitDv(body) === nit.slice(-1);
}
