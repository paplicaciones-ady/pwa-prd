import { Entity, Column, ManyToOne, JoinColumn, OneToMany, OneToOne } from 'typeorm';
import { BaseEntity } from '../../../commons/entities/base.entity';
import { Company } from '../../config/entities/company.entity';
import { ClientDirection } from './client-direction.entity';
import { ClientReference } from './client-reference.entity';
import { ClientTaxSettings } from './client-tax.entity';

export enum ClientStatus {
  ACTIVE = 'active',
  INACTIVE = 'inactive',
}

export enum ClientPersonType {
  NATURAL = 'natural',
  JURIDICA = 'juridica',
}

export enum ClientDocumentType {
  NIT = 'nit',
  CC = 'cc',
  CE = 'ce',
  PP = 'pp',
}

@Entity('clients')
export class Client extends BaseEntity {
  /**
   * NULL = cliente del padrón compartido, visible para todas las empresas.
   * Es el mismo criterio que usa `modules.companyId` (`Module` en
   * 1700000012000) y que `module-placements.service.ts:108` expone como
   * `scope: m.companyId ? 'company' : 'global'`. Un cliente con empresa propia
   * solo lo ve y administra esa empresa.
   */
  @Column({ name: 'company_id', nullable: true })
  companyId: string | null;

  @ManyToOne(() => Company, { nullable: true })
  @JoinColumn({ name: 'company_id' })
  company: Company | null;

  @Column({ name: 'full_name', length: 200 })
  fullName: string;

  @Column({ name: 'document_number', length: 20, unique: true })
  documentNumber: string;

  @Column({ name: 'document_type', type: 'enum', enum: ClientDocumentType, enumName: 'clients_document_type_enum', nullable: true })
  documentType: ClientDocumentType;

  @Column({ name: 'dv', length: 10, nullable: true })
  dv: string;

  @Column({ name: 'person_type', type: 'enum', enum: ClientPersonType, enumName: 'clients_person_type_enum', nullable: true })
  personType: ClientPersonType;

  @Column({ name: 'commercial_name', type: 'varchar', nullable: true })
  commercialName: string;

  @Column({ name: 'first_name', type: 'varchar', nullable: true })
  firstName: string;

  @Column({ name: 'second_name', type: 'varchar', nullable: true })
  secondName: string;

  @Column({ name: 'first_last_name', type: 'varchar', nullable: true })
  firstLastName: string;

  @Column({ name: 'second_last_name', type: 'varchar', nullable: true })
  secondLastName: string;

  @Column({ name: 'legal_name', type: 'varchar', nullable: true })
  legalName: string;

  @Column({ name: 'rep_first_name', type: 'varchar', nullable: true })
  repFirstName: string;

  @Column({ name: 'rep_second_name', type: 'varchar', nullable: true })
  repSecondName: string;

  @Column({ name: 'rep_first_last_name', type: 'varchar', nullable: true })
  repFirstLastName: string;

  @Column({ name: 'rep_second_last_name', type: 'varchar', nullable: true })
  repSecondLastName: string;

  @Column({ name: 'economic_activity_code', type: 'varchar', nullable: true })
  economicActivityCode: string;

  @Column({ name: 'economic_activity_description', type: 'varchar', nullable: true })
  economicActivityDescription: string;

  @Column({ name: 'billing_email', type: 'varchar', nullable: true })
  billingEmail: string;

  @Column({ name: 'treasury_email', type: 'varchar', nullable: true })
  treasuryEmail: string;

  @Column({ name: 'establishment_vocation', type: 'varchar', nullable: true })
  establishmentVocation: string;

  @Column({ name: 'establishment_size', type: 'varchar', nullable: true })
  establishmentSize: string;

  @Column({ name: 'service_type', type: 'varchar', nullable: true })
  serviceType: string;

  @Column({ name: 'public_office', type: 'boolean', nullable: true })
  publicOffice: boolean;

  @Column({ name: 'public_office_cargo', type: 'varchar', nullable: true })
  publicOfficeCargo: string;

  @Column({ name: 'public_office_start', type: 'date', nullable: true })
  publicOfficeStart: string;

  @Column({ name: 'public_office_end', type: 'date', nullable: true })
  publicOfficeEnd: string;

  @Column({ name: 'foreign_accounts', type: 'boolean', nullable: true })
  foreignAccounts: boolean;

  @Column({ name: 'public_resource_management', type: 'boolean', nullable: true })
  publicResourceManagement: boolean;

  @Column({ name: 'foreign_trade', type: 'boolean', nullable: true })
  foreignTrade: boolean;

  @Column({ name: 'foreign_trade_ops_per_year', type: 'varchar', nullable: true })
  foreignTradeOpsPerYear: string;

  @Column({ name: 'payment_method', type: 'varchar', nullable: true })
  paymentMethod: string;

  @Column({ name: 'payment_method_other', type: 'varchar', nullable: true })
  paymentMethodOther: string;

  @Column({ name: 'merchandise_description', type: 'text', nullable: true })
  merchandiseDescription: string;

  @Column({ name: 'capital_registered', type: 'varchar', nullable: true })
  capitalRegistered: string;

  @Column({ name: 'funds_origin', type: 'varchar', nullable: true })
  fundsOrigin: string;

  @Column({ name: 'jur_public_office', type: 'boolean', nullable: true })
  jurPublicOffice: boolean;

  @Column({ name: 'jur_public_resource_management', type: 'boolean', nullable: true })
  jurPublicResourceManagement: boolean;

  @Column({ name: 'jur_foreign_trade', type: 'boolean', nullable: true })
  jurForeignTrade: boolean;

  @Column({ name: 'phone', type: 'varchar', nullable: true })
  phone: string;

  @Column({ name: 'email', type: 'varchar', nullable: true })
  email: string;

  @Column({ type: 'enum', enum: ClientStatus, default: ClientStatus.ACTIVE })
  status: ClientStatus;

  @OneToMany(() => ClientDirection, (d) => d.client, { cascade: true })
  directions: ClientDirection[];

  @OneToMany(() => ClientReference, (r) => r.client, { cascade: true })
  references: ClientReference[];

  @OneToOne(() => ClientTaxSettings, (t) => t.client, { cascade: true })
  taxSettings: ClientTaxSettings;
}