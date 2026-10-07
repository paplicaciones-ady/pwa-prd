import { BadRequestException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, EntityManager, In, Repository } from 'typeorm';
import { createHash, randomUUID } from 'crypto';
import { Credit, CreditStatus } from './entities/credit.entity';
import { CreditDocument } from './entities/credit-document.entity';
import { ClientsService } from '../clients/clients.service';
import { clampPagination } from '../../commons/dto/pagination.dto';
import { StudyCreditDto } from './dto/study-credit.dto';
import { normalizeNitWithDv } from './nit';
import { SamanClient } from './saman/saman.client';
import { SamanAlgorithmResult, SamanError, STOPPING_ERRORS } from './saman/saman.types';
import { CreditSignatureService } from './credit-signature.service';

/** Cupo de la pre-aprobación manual (con Saman, el cupo es su total_credit_line). */
const APPROVED_LIMIT = 2_000_000;

/** Espera del sondeo entre consultas de un mismo borrador: 30 s, 1, 2, 4, 8 min… hasta 15 min. */
const BACKOFF_BASE_MS = 30_000;
const BACKOFF_MAX_MS = 15 * 60_000;

/** Documentos que se envían a firmar en el paso 3. */
const SIGNATURE_DOCUMENTS = [
  { code: 'pagare', name: 'Pagaré' },
  { code: 'carta_instrucciones', name: 'Carta de instrucciones' },
];

/** Estados desde los que el asesor puede cancelar la solicitud. */
const CANCELLABLE = [CreditStatus.DRAFT, CreditStatus.PRE_APPROVED, CreditStatus.PENDING_SIGNATURES];

/** Cambios que produce el veredicto del algoritmo sobre un borrador. */
type DraftOutcome = Partial<
  Pick<
    Credit,
    | 'status'
    | 'approvedLimit'
    | 'applicationNumber'
    | 'decisionAt'
    | 'decisionRunId'
    | 'algorithmResult'
    | 'algorithmAttempts'
    | 'algorithmCheckedAt'
  >
>;

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
    private saman: SamanClient,
    private config: ConfigService,
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
    const { nit, signature } = await this.validateStudy(companyId, dto);
    const signedAt = new Date();

    const credit = await this.dataSource.transaction(async (manager) => {
      const saved = await manager.save(
        manager.create(Credit, {
          companyId,
          clientId: dto.clientId,
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
   * Confirmación del paso 1: valida lo mismo que `study` y devuelve la petición
   * exacta que se enviará a Saman, sin crear nada. Nunca incluye el token.
   */
  async previewStudy(companyId: string, dto: StudyCreditDto) {
    const { client, nit } = await this.validateStudy(companyId, dto);
    return {
      simulated: this.saman.simulated,
      endpoint: 'POST /api/v1/check/async',
      request: this.saman.buildRequest({ personType: dto.personType, nit }),
      credit: {
        clientId: client.id,
        nit,
        personType: dto.personType,
        yearsExperience: dto.yearsExperience,
        opportunityValue: dto.opportunityValue,
        reliabilityScore: dto.reliabilityScore,
        consentSigned: true,
      },
    };
  }

  /** Validaciones comunes de `study` y `previewStudy`. */
  private async validateStudy(companyId: string, dto: StudyCreditDto) {
    const client = await this.ensureClientInTenant(dto.clientId, companyId);
    const nit = normalizeNitWithDv(dto.nit, client.documentNumber ?? '', dto.personType);
    const signature = decodeSignature(dto.consentSignature);
    return { client, nit, signature };
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
   * Reintento manual tras un error definitivo de Saman (o para forzar una
   * consulta): olvida la tarea anterior y envía el borrador de nuevo.
   */
  async retryStudy(id: string, companyId: string) {
    const credit = await this.findOne(id, companyId);
    if (credit.status !== CreditStatus.DRAFT) {
      throw new BadRequestException('Solo se puede reintentar el estudio de un crédito en borrador');
    }
    await this.repo.update(
      { id, companyId, status: CreditStatus.DRAFT },
      { decisionRunId: null, algorithmResult: null, algorithmAttempts: 0, algorithmCheckedAt: null },
    );
    return this.checkStudy(id, companyId);
  }

  /**
   * Lo que hay que cambiar en un borrador según Saman, sin tocar la BD (las
   * llamadas HTTP no deben ocurrir dentro de una transacción). null si no hay
   * nada que hacer: no es borrador, está incompleto, tiene un error definitivo
   * (espera al asesor) o, con `respectBackoff`, aún no toca consultarlo.
   *
   * Los errores de Saman no se lanzan: quedan en algorithm_result.error para
   * que el front los muestre y el sondeo decida si reintentar.
   */
  async draftOutcome(
    credit: Credit,
    {
      respectBackoff = false,
      claim = (c: Credit) => this.claimDraft(this.repo.manager, c),
    }: { respectBackoff?: boolean; claim?: (c: Credit) => Promise<boolean> } = {},
  ): Promise<DraftOutcome | null> {
    if (credit.status !== CreditStatus.DRAFT) return null;
    // Borradores de flujos anteriores sin evaluación comercial: no hay nada que
    // enviar. Quedan en borrador hasta que el asesor los cancele o los decida a
    // mano (PATCH :id/approve | :id/reject).
    if (credit.reliabilityScore == null || credit.yearsExperience == null || credit.opportunityValue == null) {
      return null;
    }
    const previous: SamanAlgorithmResult = credit.algorithmResult ?? {};
    // Errores que esperan al asesor (FAILED, 422, sin cupo, caducada): no se reintenta solo.
    if (previous.error && STOPPING_ERRORS.includes(previous.error.type)) return null;
    if (respectBackoff && !this.isDueForCheck(credit)) return null;
    // Reserva el borrador antes de llamar a Saman: si otra consulta (otra
    // instancia, o el front y el sondeo a la vez) ya lo tomó, no se duplica la tarea.
    if (!(await claim(credit))) return null;

    const now = new Date();
    const tracking = { algorithmAttempts: (credit.algorithmAttempts ?? 0) + 1, algorithmCheckedAt: now };
    try {
      // Sin tarea (envío fallido o reintento): se crea en Saman.
      if (!credit.decisionRunId) {
        // Sin tarea tras el tope de horas (Saman inalcanzable): se deja de reintentar.
        if (this.isOlderThanMaxAge(credit.createdAt, now)) {
          throw new SamanError(
            'definitive',
            `No se pudo contactar el servicio de estudio en ${this.maxAgeHours()} h; la solicitud no llegó a Saman`,
          );
        }
        const input = { personType: credit.personType, nit: credit.nit };
        const taskId = await this.saman.requestStudy(input);
        this.logger.log(
          `Saman: tarea ${taskId} creada para el crédito ${credit.id} (identificacion ${maskIdentificacion(this.saman.buildRequest(input).identificacion, credit.personType)})`,
        );
        // Tarea nueva: los intentos fallidos previos (sin tarea) no deben retrasar
        // sus primeras consultas, así que el conteo de la espera creciente se reinicia.
        return { ...tracking, algorithmAttempts: 1, decisionRunId: taskId, algorithmResult: { sentAt: now.toISOString() } };
      }

      if (this.isOlderThanMaxAge(previous.sentAt, now)) {
        throw new SamanError('definitive', 'Saman no entregó el resultado a tiempo: la tarea se da por perdida');
      }

      const verdict = await this.saman.checkStudy(credit.decisionRunId);
      // Respuesta válida: si había un error de credencial o de red, ya pasó.
      if (verdict.status === 'processing') return { ...tracking, algorithmResult: { ...previous, error: null } };

      this.logger.log(`Saman: tarea ${credit.decisionRunId} del crédito ${credit.id} → ${verdict.status}`);
      const result: SamanAlgorithmResult = { sentAt: previous.sentAt, ...verdict.summary, error: null };
      if (verdict.status === 'rejected') {
        return { ...tracking, status: CreditStatus.REJECTED, decisionAt: now, algorithmResult: result };
      }
      return {
        ...tracking,
        status: CreditStatus.PRE_APPROVED,
        approvedLimit: verdict.approvedLimit,
        applicationNumber: credit.applicationNumber ?? this.generateApplicationNumber(credit.id),
        decisionAt: now,
        algorithmResult: result,
      };
    } catch (err) {
      const error = err instanceof SamanError ? err : new SamanError('transient', (err as Error).message);
      const task = credit.decisionRunId ? ` (tarea ${credit.decisionRunId})` : ' (sin tarea)';
      const log = `Saman (${error.type}) en el crédito ${credit.id}${task}: ${error.message}`;
      if (error.type === 'auth') this.logger.error(log);
      else this.logger.warn(log);
      const streak =
        error.type === 'transient'
          ? previous.error?.type === 'transient'
            ? (previous.error.streak ?? 1) + 1
            : 1
          : undefined;
      return {
        ...tracking,
        algorithmResult: {
          ...previous,
          ...(error.summary ?? {}),
          error: { type: error.type, message: error.message, at: now.toISOString(), ...(streak ? { streak } : {}) },
        },
      };
    }
  }

  /** El sondeo espacia las consultas de un borrador según los intentos hechos. */
  private isDueForCheck(credit: Credit): boolean {
    if (!credit.algorithmCheckedAt || !credit.algorithmAttempts) return true;
    const wait = Math.min(BACKOFF_BASE_MS * 2 ** (credit.algorithmAttempts - 1), BACKOFF_MAX_MS);
    return Date.now() - new Date(credit.algorithmCheckedAt).getTime() >= wait;
  }

  /**
   * Tope de horas sin veredicto (SAMAN_TASK_MAX_AGE_HOURS). Se cuenta desde que
   * se creó la tarea (Celery responde "en proceso" para siempre si no existe)
   * o, si nunca se pudo crear, desde que se creó el borrador.
   */
  private isOlderThanMaxAge(since: string | Date | undefined | null, now: Date): boolean {
    if (!since) return false;
    return now.getTime() - new Date(since).getTime() > this.maxAgeHours() * 3_600_000;
  }

  private maxAgeHours(): number {
    return Number(this.config.get('SAMAN_TASK_MAX_AGE_HOURS') ?? 24);
  }

  /**
   * Toma el borrador para consultarlo: solo una consulta gana si dos lo leen a
   * la vez (varias instancias, o el front y el sondeo). Compara la última
   * consulta leída y la actualiza en la misma sentencia.
   */
  async claimDraft(manager: EntityManager, credit: Credit): Promise<boolean> {
    const qb = manager
      .createQueryBuilder()
      .update(Credit)
      .set({ algorithmCheckedAt: new Date() })
      .where('id = :id AND status = :draft', { id: credit.id, draft: CreditStatus.DRAFT });
    if (credit.algorithmCheckedAt) qb.andWhere('algorithm_checked_at = :prev', { prev: credit.algorithmCheckedAt });
    else qb.andWhere('algorithm_checked_at IS NULL');
    const res = await qb.execute();
    return (res.affected ?? 0) > 0;
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
    const now = new Date();
    await this.applyDraftOutcome(
      this.repo.manager,
      credit,
      verdict === 'rejected'
        ? { status: CreditStatus.REJECTED, decisionAt: now }
        : {
            status: CreditStatus.PRE_APPROVED,
            approvedLimit: APPROVED_LIMIT,
            applicationNumber: credit.applicationNumber ?? this.generateApplicationNumber(credit.id),
            decisionAt: now,
          },
    );
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

/** Para logs: la cédula de una persona natural es dato personal y se enmascara; el NIT de una empresa no. */
function maskIdentificacion(identificacion: string, personType: string): string {
  if (personType === 'juridica' || identificacion.length < 6) return identificacion;
  return `${identificacion.slice(0, 4)}${'*'.repeat(identificacion.length - 5)}${identificacion.slice(-1)}`;
}
