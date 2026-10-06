import { Type } from 'class-transformer';
import {
  IsEnum,
  IsInt,
  IsNumber,
  IsOptional,
  IsPositive,
  IsString,
  IsUUID,
  Matches,
  Max,
  MaxLength,
  Min,
} from 'class-validator';
import { ClientPersonType } from '../../clients/entities/client.entity';

export class StudyCreditDto {
  @IsUUID()
  clientId: string;

  /**
   * NIT con dígito de verificación: documento del cliente (8 a 15 dígitos) +
   * DV, sin separadores. study() comprueba que el cuerpo sea el documento del
   * cliente y el DV, y lo guarda como `900123456-7`.
   */
  @Matches(/^\d{9,16}$/, { message: 'El NIT debe ser el documento del cliente más el dígito de verificación' })
  nit: string;

  // --- Evaluación comercial (cada pregunta tiene su columna en credits) ---

  @IsEnum(ClientPersonType)
  personType: ClientPersonType;

  @IsInt()
  @Min(0)
  @Max(100)
  @Type(() => Number)
  yearsExperience: number;

  /** Entero en pesos: la columna es bigint. */
  @IsInt()
  @IsPositive()
  @Type(() => Number)
  opportunityValue: number;

  @IsInt()
  @Min(1)
  @Max(5)
  @Type(() => Number)
  reliabilityScore: number;

  /**
   * Firma manuscrita del cliente como data URL PNG. Obligatoria: es lo que
   * sustenta el consentimiento, y `consent_data` se deriva de que exista.
   */
  @Matches(/^data:image\/png;base64,[A-Za-z0-9+/=]+$/)
  @MaxLength(400000)
  consentSignature: string;

  @IsOptional()
  @IsNumber()
  @IsPositive()
  @Type(() => Number)
  requestedAmount?: number;

  @IsOptional()
  @IsNumber()
  @IsPositive()
  @Type(() => Number)
  monthlyIncome?: number;

  @IsOptional()
  @IsNumber()
  @IsPositive()
  @Type(() => Number)
  monthlyExpenses?: number;

  @IsOptional()
  @IsNumber()
  @IsPositive()
  @Type(() => Number)
  assetsValue?: number;

  @IsOptional()
  @IsNumber()
  @IsPositive()
  @Type(() => Number)
  liabilitiesValue?: number;

  @IsOptional()
  @IsString()
  foundationDate?: string;
}
