import { IsString, IsEmail, IsOptional, Length, IsEnum, Matches } from 'class-validator';
import { ClientStatus } from '../entities/client.entity';

export class UpdateClientDto {
  @IsString()
  @Length(1, 200)
  @IsOptional()
  fullName?: string;

  @Matches(/^[0-9A-Za-z]+$/, { message: "El número de documento va sin '-', espacios ni puntos" })
  @IsString()
  @Length(1, 20)
  @IsOptional()
  documentNumber?: string;

  @IsString()
  @IsOptional()
  phone?: string;

  @IsEmail()
  @IsOptional()
  email?: string;

  @IsEmail()
  @IsOptional()
  billingEmail?: string;

  @IsEmail()
  @IsOptional()
  treasuryEmail?: string;

  @IsString()
  @IsOptional()
  commercialName?: string;

  @IsString()
  @IsOptional()
  legalName?: string;

  @IsString()
  @IsOptional()
  establishmentVocation?: string;

  @IsString()
  @IsOptional()
  establishmentSize?: string;

  @IsString()
  @IsOptional()
  serviceType?: string;

  @IsEnum(ClientStatus)
  @IsOptional()
  status?: ClientStatus;
}
