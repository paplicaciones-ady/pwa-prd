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

/**
 * Recibe el NIT digitado (9 dígitos + DV, ya validado en forma por el DTO),
 * comprueba el DV y lo devuelve en el formato con el que se guarda en
 * `credits.nit`: `900123456-7`.
 *
 * `clients.document_number` no guarda el DV, así que además se exige que el
 * cuerpo coincida con el documento del cliente elegido: sin esto se podría
 * radicar un crédito de un cliente con el NIT de otro.
 */
export function normalizeNitWithDv(nit: string, clientDocument: string): string {
  const body = nit.slice(0, 9);
  const dv = nit.slice(9);
  const expected = calcNitDv(body);
  if (dv !== expected) {
    throw new BadRequestException(`El dígito de verificación del NIT es ${expected}`);
  }
  const clientDigits = (clientDocument.match(/\d/g) ?? []).join('');
  if (clientDigits !== body && clientDigits !== body + dv) {
    throw new BadRequestException('El NIT no corresponde al cliente seleccionado');
  }
  return `${body}-${dv}`;
}
