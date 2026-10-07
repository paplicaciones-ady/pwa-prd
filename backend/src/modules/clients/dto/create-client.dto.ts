import { Type } from 'class-transformer';
import { IsString, IsEmail, IsOptional, Length, IsEnum, ValidateNested, IsArray, IsBoolean, Matches } from 'class-validator';
import { ClientDocumentType, ClientPersonType } from '../entities/client.entity';

export class CreateClientDirectionDto {
  @IsString()
  kind: string;

  @IsOptional()
  @IsString()
  address?: string;

  @IsOptional()
  @IsString()
  department?: string;

  @IsOptional()
  @IsString()
  city?: string;

  @IsOptional()
  @IsString()
  postalCode?: string;

  @IsOptional()
  @IsString()
  phone?: string;

  @IsOptional()
  @IsString()
  contactFirstName?: string;

  @IsOptional()
  @IsString()
  contactSecondName?: string;

  @IsOptional()
  @IsString()
  contactFirstLastName?: string;

  @IsOptional()
  @IsString()
  contactSecondLastName?: string;

  @IsOptional()
  @IsString()
  description?: string;
}

export class CreateClientReferenceDto {
  @IsOptional()
  @IsString()
  entity?: string;

  @IsOptional()
  @IsString()
  address?: string;

  @IsOptional()
  @IsString()
  department?: string;

  @IsOptional()
  @IsString()
  city?: string;

  @IsOptional()
  @IsString()
  phone?: string;

  @IsOptional()
  @IsString()
  creditLimit?: string;
}

export class CreateClientDto {
  @IsString()
  @Length(1, 200)
  fullName: string;

  @Matches(/^[0-9A-Za-z]+$/, { message: "El número de documento va sin '-', espacios ni puntos" })
  @IsString()
  @Length(1, 20)
  documentNumber: string;

  @IsOptional()
  @IsEnum(ClientDocumentType)
  documentType?: ClientDocumentType;

  @IsOptional()
  @IsString()
  dv?: string;

  @IsOptional()
  @IsEnum(ClientPersonType)
  personType?: ClientPersonType;

  @IsOptional()
  @IsString()
  commercialName?: string;

  @IsOptional()
  @IsString()
  firstName?: string;

  @IsOptional()
  @IsString()
  secondName?: string;

  @IsOptional()
  @IsString()
  firstLastName?: string;

  @IsOptional()
  @IsString()
  secondLastName?: string;

  @IsOptional()
  @IsString()
  legalName?: string;

  @IsOptional()
  @IsString()
  repFirstName?: string;

  @IsOptional()
  @IsString()
  repSecondName?: string;

  @IsOptional()
  @IsString()
  repFirstLastName?: string;

  @IsOptional()
  @IsString()
  repSecondLastName?: string;

  @IsOptional()
  @IsString()
  economicActivityCode?: string;

  @IsOptional()
  @IsString()
  economicActivityDescription?: string;

  @IsEmail()
  @IsOptional()
  billingEmail?: string;

  @IsEmail()
  @IsOptional()
  treasuryEmail?: string;

  @IsOptional()
  @IsString()
  establishmentVocation?: string;

  @IsOptional()
  @IsString()
  establishmentSize?: string;

  @IsOptional()
  @IsString()
  serviceType?: string;

  @IsOptional()
  @IsBoolean()
  publicOffice?: boolean;

  @IsOptional()
  @IsString()
  publicOfficeCargo?: string;

  @IsOptional()
  @IsString()
  publicOfficeStart?: string;

  @IsOptional()
  @IsString()
  publicOfficeEnd?: string;

  @IsOptional()
  @IsBoolean()
  foreignAccounts?: boolean;

  @IsOptional()
  @IsBoolean()
  publicResourceManagement?: boolean;

  @IsOptional()
  @IsBoolean()
  foreignTrade?: boolean;

  @IsOptional()
  @IsString()
  foreignTradeOpsPerYear?: string;

  @IsOptional()
  @IsString()
  paymentMethod?: string;

  @IsOptional()
  @IsString()
  paymentMethodOther?: string;

  @IsOptional()
  @IsString()
  merchandiseDescription?: string;

  @IsOptional()
  @IsString()
  capitalRegistered?: string;

  @IsOptional()
  @IsString()
  fundsOrigin?: string;

  @IsOptional()
  @IsBoolean()
  jurPublicOffice?: boolean;

  @IsOptional()
  @IsBoolean()
  jurPublicResourceManagement?: boolean;

  @IsOptional()
  @IsBoolean()
  jurForeignTrade?: boolean;

  @IsOptional()
  phone?: string;

  @IsEmail()
  @IsOptional()
  email?: string;

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CreateClientDirectionDto)
  directions?: CreateClientDirectionDto[];

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CreateClientReferenceDto)
  references?: CreateClientReferenceDto[];
}