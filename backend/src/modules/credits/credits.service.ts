import { BadRequestException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, EntityManager, In, Repository } from 'typeorm';
import { createHash, randomUUID } from 'crypto';
import { Credit, CreditStatus } from './entities/credit.entity';
import { CreditDocument } from './entities/credit-document.entity';
import { ClientsService } from '../clients/clients.service';
import { clampPagination } from '../../commons/dto/pagination.dto';
import { StudyCreditDto } from './dto/study-credit.dto';
import { normalizeNitWithDv } from './nit';
import { AlgorithmVerdict, CreditStudyAlgorithmService } from './credit-study-algorithm.service';
import { CreditSignatureService } from './credit-signature.service';

/**
 * Cupo de un crédito pre-aprobado cuando el algoritmo no indica uno (y en la
 * pre-aprobación manual). Fijo mientras el algoritmo no lo calcule.
 */
const APPROVED_LIMIT = 2_000_000;

/** Documentos que se envían a firmar en el paso 3. */
const SIGNATURE_DOCUMENTS = [
  { code: 'pagare', name: 'Pagaré' },
  { code: 'carta_instrucciones', name: 'Carta de instrucciones' },
];

/** Estados desde los que el asesor puede cancelar la solicitud. */
const CANCELLABLE = [CreditStatus.DRAFT, CreditStatus.PRE_APPROVED, CreditStatus.PENDING_SIGNATURES];

/** Cambios que produce el veredicto del algoritmo sobre un borrador. */
type DraftOutcome = Partial<Pick<Credit, 'status' | 'approvedLimit' | 'applicationNumber' | 'decisionAt' | 'decisionRunId'>>;

const SIGNATURE_PREFIX = 'data:image/png;base64,';
const SIGNATURE_MIME = 'image/png';
const PNG_SIGNATURE = Buffer.from([0x89, 0x50, 0x4e, 0x47]);

/** Código con el que la autorización de datos se identifica como documento. */
const CONSENT_CODE = 'autorizacion_datos';
const CONSENT_NAME = 'Autorización de tratamiento de datos personales';

/** Contexto de la solicitud que el cliente no puede declarar por sí mismo. */
export interface StudyAudit {
  ip: string;
  userAgent: string;
}

/**
 * El prefijo ya pasó por `@Matches` en el DTO, así que aquí solo se confirma que
 * lo que se decodifica sea de verdad un PNG. Sin esto, un data URL con otra
 * cabecera se guardaría como "firma" y quedaría registrado en el expediente.
 */
function decodeSignature(dataUrl: string): Buffer {
  const bytes = Buffer.from(dataUrl.slice(SIGNATURE_PREFIX.length), 'base64');
  if (!bytes.subarray(0, 4).equals(PNG_SIGNATURE)) {
    throw new BadRequestException('La firma no es una imagen PNG válida');
  }
  return bytes;
}

@Injectable()
export class CreditsService {
  private readonly logger = new Logger(CreditsService.name);

  constructor(
    @InjectRepository(Credit) private repo: Repository<Credit>,
    @InjectRepository(CreditDocument) private docsRepo: Repository<CreditDocument>,
    private clientsService: ClientsService,
    private dataSource: DataSource,
    private algorithm: CreditStudyAlgorithmService,
    private signatures: CreditSignatureService,
  ) {}

  findAll(companyId: string, query: { page?: number; limit?: number }) {
    const { page, limit } = clampPagination(query);
    return this.repo.findAndCount({
      where: { companyId },
      relations: ['client'],
      skip: (page - 1) * limit,
      take: limit,
      order: { createdAt: 'DESC' },
    });
  }

  async findOne(id: string, companyId: string) {
    const credit = await this.repo.findOne({
      where: { id, companyId },
      relations: ['client', 'documents'],
    });
    if (!credit) throw new NotFoundException('Crédito no encontrado');
    return credit;
  }

  /**
   * Paso 1: registra la solicitud como borrador y la envía al algoritmo.
   *
   * El crédito y la firma del consentimiento se guardan en la misma
   * transacción: una autorización de datos sin el crédito al que pertenece (o
   * al revés) es un registro inconsistente. El envío al algoritmo va después y
   * fuera de la transacción: si falla, el borrador queda guardado sin tarea y
   * `checkStudy` / el sondeo en segundo plano lo reintentan.
   */
  async study(companyId: string, dto: StudyCreditDto, audit: StudyAudit) {
    const client = await this.ensureClientInTenant(dto.clientId, companyId);
    const nit = normalizeNitWithDv(dto.nit, client.documentNumber ?? '');
    const signature = decodeSignature(dto.consentSignature);
    const signedAt = new Date();

    const credit = await this.dataSource.transaction(async (manager) => {
      const saved = await manager.save(
        manager.create(Credit, {
          companyId,
          clientId: dto.clientId,
          requestedAmount: dto.opportunityValue,
          nit,
          // Derivado de la existencia de la firma, no de lo que diga el cliente.
          consentData: true,
          personType: dto.personType,
          yearsExperience: dto.yearsExperience,
          opportunityValue: dto.opportunityValue,
          reliabilityScore: dto.reliabilityScore,
          status: CreditStatus.DRAFT,
        }),
      );

      await manager.save(
        manager.create(CreditDocument, {
          companyId,
          creditId: saved.id,
          code: CONSENT_CODE,
          name: CONSENT_NAME,
          status: 'signed',
          contentBase64: signature.toString('base64'),
          contentMime: SIGNATURE_MIME,
          contentSha256: createHash('sha256').update(signature).digest('hex'),
          ip: audit.ip,
          userAgent: audit.userAgent,
          signedAt,
        }),
      );

      return saved;
    });

    const outcome = await this.draftOutcome(credit);
    if (outcome) await this.applyDraftOutcome(this.repo.manager, credit, outcome);
    return this.findOne(credit.id, companyId);
  }

  /**
   * Consulta al algoritmo el veredicto de un borrador y, si ya lo hay, lo
   * aplica. El front lo llama cada 10 s durante el primer minuto; después lo
   * resuelve el sondeo en segundo plano (CreditStudyPoller). En cualquier otro
   * estado no hace nada y devuelve el crédito tal cual.
   */
  async checkStudy(id: string, companyId: string) {
    const credit = await this.findOne(id, companyId);
    const outcome = await this.draftOutcome(credit);
    if (outcome) await this.applyDraftOutcome(this.repo.manager, credit, outcome);
    return this.findOne(id, companyId);
  }

  /**
   * Lo que hay que cambiar en un borrador según el algoritmo, sin tocar la BD
   * (las llamadas HTTP no deben ocurrir dentro de una transacción). null si no
   * hay nada que cambiar: no es borrador, o el algoritmo sigue procesando.
   */
  async draftOutcome(credit: Credit): Promise<DraftOutcome | null> {
    if (credit.status !== CreditStatus.DRAFT) return null;
    // Borradores de flujos anteriores sin evaluación comercial: no hay nada que
    // enviar al algoritmo. Quedan en borrador hasta que el asesor los cancele o
    // los decida a mano (PATCH :id/approve | :id/reject).
    if (credit.reliabilityScore == null || credit.yearsExperience == null || credit.opportunityValue == null) {
      return null;
    }
    try {
      // Sin tarea (envío fallido o borrador de un flujo anterior): se envía.
      if (!credit.decisionRunId) {
        const taskId = await this.algorithm.requestStudy({
          creditId: credit.id,
          nit: credit.nit,
          personType: credit.personType,
          yearsExperience: credit.yearsExperience,
          opportunityValue: credit.opportunityValue,
          reliabilityScore: credit.reliabilityScore,
        });
        return { decisionRunId: taskId };
      }
      return this.outcomeFromVerdict(credit, await this.algorithm.checkStudy(credit.decisionRunId));
    } catch (err) {
      this.logger.warn(`Algoritmo no disponible para el crédito ${credit.id}: ${(err as Error).message}`);
      return null;
    }
  }

  private outcomeFromVerdict(credit: Credit, verdict: AlgorithmVerdict): DraftOutcome | null {
    if (verdict.status === 'processing') return null;
    if (verdict.status === 'rejected') {
      return { status: CreditStatus.REJECTED, decisionAt: new Date() };
    }
    return {
      status: CreditStatus.PRE_APPROVED,
      approvedLimit: verdict.approvedLimit ?? APPROVED_LIMIT,
      applicationNumber: credit.applicationNumber ?? this.generateApplicationNumber(credit.id),
      decisionAt: new Date(),
    };
  }

  /**
   * Aplica el resultado solo si el crédito sigue en borrador: si el sondeo en
   * segundo plano y el front lo resuelven a la vez, gana el primero y el otro
   * no pisa nada (ni revive un crédito que el asesor canceló entretanto).
   */
  async applyDraftOutcome(manager: EntityManager, credit: Credit, outcome: DraftOutcome) {
    await manager.update(
      Credit,
      { id: credit.id, companyId: credit.companyId, status: CreditStatus.DRAFT },
      outcome,
    );
  }

  /**
   * Paso 3: envía el pagaré y la carta de instrucciones a firmar al servicio
   * externo y deja el crédito esperando la confirmación de las firmas.
   */
  async sign(id: string, companyId: string) {
    const credit = await this.findOne(id, companyId);
    if (credit.status !== CreditStatus.PRE_APPROVED) {
      throw new BadRequestException('El crédito debe estar pre-aprobado para enviar los documentos a firma');
    }

    const documents = await this.dataSource.transaction(async (manager) => {
      await manager.update(Credit, { id, companyId }, { status: CreditStatus.PENDING_SIGNATURES });
      return manager.save(
        SIGNATURE_DOCUMENTS.map((d) =>
          manager.create(CreditDocument, { companyId, creditId: id, code: d.code, name: d.name, status: 'pending' }),
        ),
      );
    });

    await this.signatures.requestSignatures({
      creditId: id,
      client: credit.client,
      documents: documents.map((d) => ({ id: d.id, code: d.code, name: d.name })),
    });

    return this.findOne(id, companyId);
  }

  /**
   * Confirmación de las firmas: deja el crédito firmado/validado y los
   * documentos del paso 3 como firmados. La invocará el webhook o la consulta
   * del servicio de firma externo; mientras no exista, se dispara a mano.
   */
  async confirmSignatures(id: string, companyId: string) {
    const credit = await this.findOne(id, companyId);
    if (credit.status !== CreditStatus.PENDING_SIGNATURES) {
      throw new BadRequestException('El crédito no está esperando la confirmación de firmas');
    }
    const signedAt = new Date();
    await this.dataSource.transaction(async (manager) => {
      await manager.update(Credit, { id, companyId }, { status: CreditStatus.SIGNED, signatureDate: signedAt });
      await manager.update(
        CreditDocument,
        { creditId: id, companyId, code: In(SIGNATURE_DOCUMENTS.map((d) => d.code)), status: 'pending' },
        { status: 'signed', signedAt },
      );
    });
    return this.findOne(id, companyId);
  }

  /** El asesor cancela una solicitud que aún no está firmada ni rechazada. */
  async cancel(id: string, companyId: string) {
    const credit = await this.findOne(id, companyId);
    if (!CANCELLABLE.includes(credit.status)) {
      throw new BadRequestException('Esta solicitud ya no se puede cancelar');
    }
    await this.repo.update({ id, companyId }, { status: CreditStatus.CANCELLED });
    return this.findOne(id, companyId);
  }

  /**
   * Decisión manual sobre un borrador (PATCH :id/approve | :id/reject), por si
   * el algoritmo no está disponible. Pre-aprobar asigna el cupo fijo.
   */
  async decideManually(id: string, companyId: string, verdict: 'pre_approved' | 'rejected') {
    const credit = await this.findOne(id, companyId);
    if (credit.status !== CreditStatus.DRAFT) {
      throw new BadRequestException('Solo se puede decidir manualmente un crédito en borrador');
    }
    const outcome = this.outcomeFromVerdict(credit, { status: verdict });
    if (outcome) await this.applyDraftOutcome(this.repo.manager, credit, outcome);
    return this.findOne(id, companyId);
  }

  listDocuments(id: string, companyId: string) {
    return this.docsRepo.find({ where: { creditId: id, companyId }, order: { createdAt: 'ASC' } });
  }

  /**
   * Contenido de un documento. `contentBase64` es `select: false`, así que el
   * listado del expediente lo deja fuera a propósito: el binario solo se trae
   * cuando alguien abre el documento.
   */
  async findDocumentContent(creditId: string, documentId: string, companyId: string) {
    // findOne valida que el crédito exista y sea de esta empresa antes de tocar
    // el documento, para no servir contenido de un crédito ajeno.
    await this.findOne(creditId, companyId);

    const doc = await this.docsRepo
      .createQueryBuilder('doc')
      .addSelect('doc.contentBase64')
      .where('doc.id = :documentId', { documentId })
      .andWhere('doc.creditId = :creditId', { creditId })
      .andWhere('doc.companyId = :companyId', { companyId })
      .getOne();

    if (!doc) throw new NotFoundException('Documento no encontrado');

    return {
      id: doc.id,
      code: doc.code,
      contentMime: doc.contentMime,
      contentBase64: doc.contentBase64,
      contentSha256: doc.contentSha256,
      signedAt: doc.signedAt,
    };
  }

  private ensureClientInTenant(clientId: string, companyId: string) {
    return this.clientsService.findBasicInTenant(clientId, companyId);
  }

  private generateApplicationNumber(creditId: string): string {
    return `IF-${creditId.replace(/-/g, '').slice(-5).toUpperCase()}`;
  }
}
