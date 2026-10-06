import { Injectable, Logger } from '@nestjs/common';
import { Client } from '../clients/entities/client.entity';

export interface SignatureRequest {
  creditId: string;
  client: Pick<Client, 'fullName' | 'email' | 'phone'> | undefined;
  documents: { id: string; code: string; name: string }[];
}

/**
 * Cliente del servicio externo de firma electrónica (paso 3).
 *
 * `requestSignatures` es donde se dispara el flujo de firma de los documentos
 * en el proveedor. Cuando el proveedor confirme las firmas (webhook o
 * consulta), esa confirmación debe terminar en
 * `CreditsService.confirmSignatures()`, que deja el crédito en `signed`.
 *
 * Aún no hay proveedor integrado: por ahora solo registra el envío, y la
 * confirmación se dispara a mano con POST /credits/:id/signatures/confirm.
 */
@Injectable()
export class CreditSignatureService {
  private readonly logger = new Logger(CreditSignatureService.name);

  async requestSignatures(request: SignatureRequest): Promise<void> {
    this.logger.log(
      `Firma externa pendiente de integrar: crédito ${request.creditId}, ` +
        `documentos ${request.documents.map((d) => d.code).join(', ')}`,
    );
  }
}
