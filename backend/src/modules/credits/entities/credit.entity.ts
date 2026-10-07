import { Entity, Column, ManyToOne, JoinColumn, OneToMany, ValueTransformer } from 'typeorm';
import { BaseEntity } from '../../../commons/entities/base.entity';
import { Company } from '../../config/entities/company.entity';
import { Client, ClientPersonType } from '../../clients/entities/client.entity';
import { CreditDocument } from './credit-document.entity';
import type { SamanAlgorithmResult } from '../saman/saman.types';

/** Flujo y transiciones: ver migración 1700000022000-CreditStatusFlow. */
export enum CreditStatus {
  /** Borrador: solicitud enviada, el algoritmo (Saman) la está evaluando. */
  DRAFT = 'draft',
  PRE_APPROVED = 'pre_approved',
  REJECTED = 'rejected',
  CANCELLED = 'cancelled',
  /** Documentos enviados a firmar al servicio externo; falta su confirmación. */
  PENDING_SIGNATURES = 'pending_signatures',
  /** Firmado/validado: llegó la confirmación de las firmas. */
  SIGNED = 'signed',
}

/** Estados en los que el estudio ya no se puede retomar. */
export const FINAL_CREDIT_STATUSES: readonly CreditStatus[] = [CreditStatus.REJECTED, CreditStatus.CANCELLED];

/**
 * El driver `pg` devuelve bigint como string. Sin este transformer
 * `opportunityValue` llega como texto al front y a cualquier cálculo
 * (NaN silencioso). Ver migración 1700000020000.
 */
const bigintAsNumber: ValueTransformer = {
  to: (value?: number | null) => (value == null ? null : value),
  from: (value?: string | null) => (value == null ? null : Number(value)),
};

@Entity('credits')
export class Credit extends BaseEntity {
  @Column({ name: 'company_id' })
  companyId: string;

  @ManyToOne(() => Company)
  @JoinColumn({ name: 'company_id' })
  company: Company;

  @Column({ name: 'client_id' })
  clientId: string;

  @ManyToOne(() => Client)
  @JoinColumn({ name: 'client_id' })
  client: Client;

  @Column({ type: 'enum', enum: CreditStatus, enumName: 'credits_status_enum', default: CreditStatus.DRAFT })
  status: CreditStatus;

  @Column({ name: 'application_number', length: 30, nullable: true })
  applicationNumber: string;

  /** NIT con dígito de verificación, solo dígitos (`9001234567`). */
  @Column({ length: 20, nullable: true })
  nit: string;

  @Column({ name: 'consent_data', type: 'boolean', default: false })
  consentData: boolean;
  // consent_data ya no lo envía el cliente: study() lo deriva de la existencia
  // de la firma (ver credits.service.ts), porque un booleano que el front
  // puede mandar en `true` no prueba que nadie haya firmado nada.

  // --- Evaluación comercial (paso 1 del estudio) ---

  @Column({ name: 'person_type', type: 'enum', enum: ClientPersonType, enumName: 'credits_person_type_enum', nullable: true })
  personType: ClientPersonType;

  /** Años de experiencia del solicitante en el mercado. */
  @Column({ name: 'years_experience', type: 'int', nullable: true })
  yearsExperience: number;

  /** Monto en pesos que el asesor dimensiona como oportunidad. Entero, sin decimales. */
  @Column({ name: 'opportunity_value', type: 'bigint', nullable: true, transformer: bigintAsNumber })
  opportunityValue: number;

  /** Juicio del asesor que conoce al cliente: 1 no paga, 5 paga. */
  @Column({ name: 'reliability_score', type: 'int', nullable: true })
  reliabilityScore: number;

  @Column({ name: 'approved_limit', type: 'decimal', precision: 12, scale: 2, nullable: true })
  approvedLimit: number;

  /**
   * @deprecated Ya no se piden en el flujo de estudio (ver CreditStudyPage).
   * Se conservan por compatibilidad con los créditos históricos.
   */
  @Column({ name: 'monthly_income', type: 'decimal', precision: 14, scale: 2, nullable: true })
  monthlyIncome: number;

  /** @deprecated Ver {@link Credit.monthlyIncome}. */
  @Column({ name: 'monthly_expenses', type: 'decimal', precision: 14, scale: 2, nullable: true })
  monthlyExpenses: number;

  /** @deprecated Ver {@link Credit.monthlyIncome}. */
  @Column({ name: 'assets_value', type: 'decimal', precision: 14, scale: 2, nullable: true })
  assetsValue: number;

  /** @deprecated Ver {@link Credit.monthlyIncome}. */
  @Column({ name: 'liabilities_value', type: 'decimal', precision: 14, scale: 2, nullable: true })
  liabilitiesValue: number;

  @Column({ name: 'foundation_date', type: 'date', nullable: true })
  foundationDate: string;

  /**
   * @deprecated Solo lectura. Guardó las respuestas de la evaluación mientras
   * vivieron en jsonb; la migración 1700000020000 las trasladó a las columnas
   * de arriba, que son las que se escriben ahora.
   */
  @Column({ name: 'study_answers', type: 'jsonb', nullable: true })
  studyAnswers: Record<string, unknown>;

  @Column({ name: 'decision_at', type: 'timestamp', nullable: true })
  decisionAt: Date;

  /**
   * Id de la tarea en Saman, el algoritmo que evalúa el estudio
   * (saman/saman.client.ts). Se llena al enviar el borrador y con él se
   * consulta el resultado. Null si el envío aún no se hizo o falló.
   */
  @Column({ name: 'decision_run_id', type: 'varchar', length: 100, nullable: true })
  decisionRunId: string | null;

  /**
   * Resumen del veredicto de Saman o del error que impidió obtenerlo.
   * Null mientras no hay respuesta.
   */
  @Column({ name: 'algorithm_result', type: 'jsonb', nullable: true })
  algorithmResult: SamanAlgorithmResult | null;

  /** Consultas hechas a Saman: espacia los reintentos del sondeo en segundo plano. */
  @Column({ name: 'algorithm_attempts', type: 'int', default: 0 })
  algorithmAttempts: number;

  @Column({ name: 'algorithm_checked_at', type: 'timestamptz', nullable: true })
  algorithmCheckedAt: Date | null;

  /** Proveedor del algoritmo de scoring. Sin FK por la misma razón. */
  @Column({ name: 'vendor_id', type: 'uuid', nullable: true })
  vendorId: string;

  @Column({ name: 'signature_date', type: 'timestamp', nullable: true })
  signatureDate: Date;

  @Column({ name: 'disbursement_date', type: 'timestamp', nullable: true })
  disbursementDate: Date;

  @OneToMany(() => CreditDocument, (d) => d.credit)
  documents: CreditDocument[];
}
