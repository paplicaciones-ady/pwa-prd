import { Entity, Column, ManyToOne, JoinColumn } from 'typeorm';
import { BaseEntity } from '../../../commons/entities/base.entity';
import { Company } from '../../config/entities/company.entity';
import { Credit } from './credit.entity';

@Entity('credit_documents')
export class CreditDocument extends BaseEntity {
  @Column({ name: 'company_id' })
  companyId: string;

  @ManyToOne(() => Company)
  @JoinColumn({ name: 'company_id' })
  company: Company;

  @Column({ name: 'credit_id' })
  creditId: string;

  @ManyToOne(() => Credit, (c) => c.documents)
  @JoinColumn({ name: 'credit_id' })
  credit: Credit;

  @Column({ length: 50 })
  code: string;

  @Column({ length: 200 })
  name: string;

  @Column({ length: 20, default: 'pending' })
  status: string;

  @Column({ nullable: true })
  url: string;

  @Column({ name: 'signed_at', type: 'timestamp', nullable: true })
  signedAt: Date;

  /**
   * Contenido del documento cuando es imagen: data URL base64 (`image/png;base64,...`).
   * `select: false` para que los listados del expediente no arrastren el binario
   * de cada documento; hay que pedirlo explícito con addSelect().
   */
  @Column({ name: 'content_base64', type: 'text', nullable: true, select: false })
  contentBase64: string;

  @Column({ name: 'content_mime', length: 50, nullable: true })
  contentMime: string;

  @Column({ name: 'content_sha256', length: 64, nullable: true })
  contentSha256: string;

  @Column({ length: 45, nullable: true })
  ip: string;

  @Column({ name: 'user_agent', type: 'text', nullable: true })
  userAgent: string;
}