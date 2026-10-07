import { BadRequestException } from '@nestjs/common';
import { calcNitDv, isValidFullNit } from '../../commons/utils/nit';

export { calcNitDv } from '../../commons/utils/nit';

/**
 * Valida el documento digitado en el estudio y lo devuelve como se guarda en
 * `credits.nit` (solo dígitos, sin '-'):
 *
 *   Persona jurídica: NIT completo, con DV (9001234567). Debe ser el
 *   `document_number` del cliente tal cual. El guion que espera Saman
 *   (900123456-7) lo agrega SamanClient.buildRequest.
 *   Persona natural: número de identificación (cédula) sin DV ni guion. Debe
 *   ser el `document_number` del cliente.
 *
 * Comparar con el documento del cliente elegido además impide radicar un
 * crédito de un cliente con el documento de otro.
 */
export function normalizeNitWithDv(input: string, clientDocument: string, personType: string): string {
  const juridica = personType === 'juridica';
  if (!/^\d+$/.test(input)) {
    throw new BadRequestException(
      juridica
        ? "El NIT va completo, con DV y sin '-' ni otros caracteres"
        : "El número de identificación va sin DV, sin '-' ni otros caracteres",
    );
  }
  const document = (clientDocument.match(/\d/g) ?? []).join('');
  if (input !== document) {
    throw new BadRequestException(
      `El ${juridica ? 'NIT' : 'número de identificación'} no corresponde al cliente seleccionado`,
    );
  }
  if (juridica && !isValidFullNit(input)) {
    throw new BadRequestException(
      `El NIT del cliente no tiene un DV válido (debería terminar en ${calcNitDv(input.slice(0, -1))}); corrígelo en el registro del cliente`,
    );
  }
  return input;
}
