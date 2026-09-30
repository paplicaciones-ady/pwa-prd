import { Entity, Column, ManyToOne, JoinColumn, OneToMany } from 'typeorm';
import { BaseEntity } from '../../../commons/entities/base.entity';
import { Company } from '../../config/entities/company.entity';
import { Client } from '../../clients/entities/client.entity';
import { CreditDocument } from './credit-document.entity';

export enum CreditStatus {
  PENDING = 'pending',
  IN_STUDY = 'in_study',
  APPROVED = 'approved',
  REJECTED = 'rejected',
  SIGNED = 'signed',
  DISBURSED = 'disbursed',
}

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

  @Column({ name: 'requested_amount', type: 'decimal', precision: 12, scale: 2 })
  requestedAmount: number;

  @Column({ type: 'enum', enum: CreditStatus, default: CreditStatus.PENDING })
  status: CreditStatus;

  @Column({ name: 'application_number', length: 30, nullable: true })
  applicationNumber: string;

  @Column({ length: 20, nullable: true })
  nit: string;

  @Column({ name: 'consent_data', type: 'boolean', default: false })
  consentData: boolean;
  // consent_data ya no lo envía el cliente: study() lo deriva de la existencia
  // de la firma (ver credits.service.ts), porque un booleano que el front
  // puede mandar en `true` no prueba que nadie haya firmado nada.

  @Column({ name: 'approved_limit', type: 'decimal', precision: 12, scale: 2, nullable: true })
  approvedLimit: number;

  @Column({ name: 'monthly_income', type: 'decimal', precision: 14, scale: 2, nullable: true })
  monthlyIncome: number;

  @Column({ name: 'monthly_expenses', type: 'decimal', precision: 14, scale: 2, nullable: true })
  monthlyExpenses: number;

  @Column({ name: 'assets_value', type: 'decimal', precision: 14, scale: 2, nullable: true })
  assetsValue: number;

  @Column({ name: 'liabilities_value', type: 'decimal', precision: 14, scale: 2, nullable: true })
  liabilitiesValue: number;

  @Column({ name: 'foundation_date', type: 'date', nullable: true })
  foundationDate: string;

  /**
   * Respuestas de la evaluación comercial en un único jsonb
   * ({ personType, yearsExperience, opportunityValue, reliabilityScore, ... }).
   * Agregar una pregunta al cuestionario no requiere otra columna.
   */
  @Column({ name: 'study_answers', type: 'jsonb', nullable: true })
  studyAnswers: Record<string, unknown>;

  @Column({ name: 'decision_at', type: 'timestamp', nullable: true })
  decisionAt: Date;

  /**
   * Corrida del algoritmo de scoring que emitió el veredicto. La entidad que
   * lo produce está fuera de este alcance: la columna queda modelada, sin FK.
   */
  @Column({ name: 'decision_run_id', length: 100, nullable: true })
  decisionRunId: string;

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
