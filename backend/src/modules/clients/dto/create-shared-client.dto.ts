import { IsEmail, IsEnum, IsOptional, IsString, Length, Matches } from 'class-validator';
import { ClientDocumentType, ClientPersonType } from '../entities/client.entity';

/**
 * Alta de un cliente del padrón compartido (company_id NULL) desde
 * Configuración global. Solo datos básicos: direcciones y referencias tienen
 * RLS por empresa y no admiten filas globales.
 */
export class CreateSharedClientDto {
  @IsEnum(ClientPersonType)
  personType: ClientPersonType;

  @IsEnum(ClientDocumentType)
  documentType: ClientDocumentType;

  @Matches(/^[0-9A-Za-z]+$/, { message: "El número de documento va sin '-', espacios ni puntos" })
  @Length(1, 20)
  documentNumber: string;

  @IsOptional()
  @Matches(/^\d$/, { message: 'El DV es un solo dígito' })
  dv?: string;

  @IsString()
  @Length(1, 200)
  fullName: string;

  @IsOptional()
  @IsString()
  phone?: string;

  @IsOptional()
  @IsEmail()
  email?: string;

  @IsOptional()
  @IsString()
  commercialName?: string;

  @IsOptional()
  @IsString()
  legalName?: string;
}
