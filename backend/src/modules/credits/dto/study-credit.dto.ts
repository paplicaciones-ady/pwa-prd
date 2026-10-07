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
   * Persona jurídica: NIT completo, con DV. Persona natural: número de
   * identificación sin DV. En ambos casos solo dígitos, sin '-'. study() lo
   * compara con el documento del cliente y lo guarda así.
   */
  @Matches(/^\d{5,16}$/, { message: "El NIT o número de identificación va solo con dígitos, sin '-'" })
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
