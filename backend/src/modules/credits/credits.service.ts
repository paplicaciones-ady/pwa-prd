import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import { createHash, randomUUID } from 'crypto';
import { Credit, CreditStatus } from './entities/credit.entity';
import { CreditDocument } from './entities/credit-document.entity';
import { ClientsService } from '../clients/clients.service';
import { clampPagination } from '../../commons/dto/pagination.dto';
import { CreateCreditDto } from './dto/create-credit.dto';
import { StudyCreditDto } from './dto/study-credit.dto';

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
  constructor(
    @InjectRepository(Credit) private repo: Repository<Credit>,
    @InjectRepository(CreditDocument) private docsRepo: Repository<CreditDocument>,
    private clientsService: ClientsService,
    private dataSource: DataSource,
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

  async create(companyId: string, dto: CreateCreditDto) {
    await this.ensureClientInTenant(dto.clientId, companyId);
    return this.repo.save(this.repo.create({ ...dto, companyId }));
  }

  /**
   * Evalúa la solicitud y, en la misma transacción, deja el crédito en su
   * estado final y la firma del consentimiento como documento del expediente.
   *
   * Ambas escrituras van juntas a propósito: una autorización de datos sin el
   * crédito al que pertenece (o al revés) es un registro inconsistente.
   */
  async study(companyId: string, dto: StudyCreditDto, audit: StudyAudit) {
    const client = await this.ensureClientInTenant(dto.clientId, companyId);
    const signature = decodeSignature(dto.consentSignature);
    const approved = dto.decision === 'approved';

    // El id se genera en Node para poder derivar el radicado de la solicitud sin
    // un segundo UPDATE (application_number tiene índice único).
    const creditId = randomUUID();
    const signedAt = new Date();

    const credit = await this.dataSource.transaction(async (manager) => {
      const saved = await manager.save(
        manager.create(Credit, {
          id: creditId,
          companyId,
          clientId: dto.clientId,
          requestedAmount: dto.opportunityValue,
          // undefined (no null): las columnas son nullable pero los campos de la
          // entidad no admiten null bajo strictNullChecks, y omitir la clave deja
          // la columna en su default.
          approvedLimit: approved ? dto.opportunityValue : undefined,
          applicationNumber: approved ? this.generateApplicationNumber(creditId) : undefined,
          nit: dto.nit ?? client.documentNumber,
          // Derivado de la existencia de la firma, no de lo que diga el cliente.
          consentData: true,
          studyAnswers: {
            personType: dto.personType,
            yearsExperience: dto.yearsExperience,
            opportunityValue: dto.opportunityValue,
            reliabilityScore: dto.reliabilityScore,
          },
          status: approved ? CreditStatus.APPROVED : CreditStatus.REJECTED,
          decisionAt: signedAt,
          // decisionRunId y vendor_id quedan en NULL: el scoring externo aún no
          // está modelado, pero las columnas ya están listas para trazarlo.
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

    return this.findOne(credit.id, companyId);
  }

  async sign(id: string, companyId: string) {
    const credit = await this.findOne(id, companyId);
    if (credit.status !== CreditStatus.APPROVED) {
      throw new BadRequestException('El crédito debe estar aprobado para firmar el pagaré');
    }
    credit.status = CreditStatus.SIGNED;
    credit.signatureDate = new Date();
    await this.repo.save(credit);

    await this.docsRepo.save([
      this.docsRepo.create({
        companyId,
        creditId: credit.id,
        code: 'pagare',
        name: 'Pagaré firmado',
        status: 'signed',
        signedAt: credit.signatureDate,
      }),
      this.docsRepo.create({
        companyId,
        creditId: credit.id,
        code: 'carta_instrucciones',
        name: 'Carta de instrucciones',
        status: 'signed',
        signedAt: credit.signatureDate,
      }),
    ]);

    return this.findOne(credit.id, companyId);
  }

  async finalize(id: string, companyId: string) {
    const credit = await this.findOne(id, companyId);
    if (credit.status !== CreditStatus.SIGNED) {
      throw new BadRequestException('El crédito debe estar firmado para desembolsar');
    }
    credit.status = CreditStatus.DISBURSED;
    credit.disbursementDate = new Date();
    await this.repo.save(credit);

    await this.docsRepo.save(
      this.docsRepo.create({
        companyId,
        creditId: credit.id,
        code: 'comprobante_desembolso',
        name: 'Comprobante de desembolso',
        status: 'issued',
      }),
    );

    return this.findOne(credit.id, companyId);
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

  async updateStatus(id: string, companyId: string, status: CreditStatus) {
    const credit = await this.findOne(id, companyId);
    credit.status = status;
    return this.repo.save(credit);
  }

  private ensureClientInTenant(clientId: string, companyId: string) {
    return this.clientsService.findBasicInTenant(clientId, companyId);
  }

  private generateApplicationNumber(creditId: string): string {
    return `IF-${creditId.replace(/-/g, '').slice(-5).toUpperCase()}`;
  }
}
