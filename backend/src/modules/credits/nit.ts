import { BadRequestException } from '@nestjs/common';

/**
 * Pesos de la DIAN (Orden Administrativa 4 de 1989) invertidos para aplicarse
 * de izquierda a derecha. Misma tabla que frontend/src/shared/utils/validators.ts:
 * el front valida para dar feedback inmediato, el backend vuelve a validar
 * porque el DV que se guarda no puede depender de lo que diga el cliente.
 */
const NIT_WEIGHTS = [71, 67, 59, 53, 47, 43, 41, 37, 29, 23, 19, 17, 13, 7, 3];

/** Dígito de verificación (módulo 11) de un cuerpo de NIT. */
export function calcNitDv(body: string): string {
  const weights = NIT_WEIGHTS.slice(NIT_WEIGHTS.length - body.length);
  const sum = body.split('').reduce((acc, digit, i) => acc + Number(digit) * weights[i], 0);
  const remainder = sum % 11;
  return String(remainder >= 2 ? 11 - remainder : remainder);
}

/** Longitudes de cuerpo que la DIAN admite (cédulas de 8 o 10, NIT de 9…). */
const NIT_MIN_DIGITS = 8;
const NIT_MAX_DIGITS = 15;

/**
 * Recibe el NIT digitado (documento + DV, solo dígitos) y lo devuelve en el
 * formato con el que se guarda en `credits.nit`: `900123456-7`.
 *
 * `clients.document_number` no guarda el DV, así que el cuerpo es el documento
 * del cliente elegido: es la única forma de saber dónde termina (una cédula
 * de 10 dígitos + DV y un NIT de 9 + DV no se distinguen por longitud). Esto
 * además impide radicar un crédito de un cliente con el NIT de otro.
 */
export function normalizeNitWithDv(nit: string, clientDocument: string): string {
  const body = (clientDocument.match(/\d/g) ?? []).join('');
  if (body.length < NIT_MIN_DIGITS || body.length > NIT_MAX_DIGITS) {
    throw new BadRequestException('El documento del cliente no tiene una longitud de NIT válida');
  }
  if (nit.length !== body.length + 1 || !nit.startsWith(body)) {
    throw new BadRequestException('El NIT no corresponde al cliente seleccionado');
  }
  const dv = nit.slice(-1);
  const expected = calcNitDv(body);
  if (dv !== expected) {
    throw new BadRequestException(`El dígito de verificación del NIT es ${expected}`);
  }
  return `${body}-${dv}`;
}
