import { Type } from 'class-transformer';
import {
  IsIn,
  IsInt,
  IsNumber,
  IsOptional,
  IsPositive,
  IsString,
  IsUUID,
  Length,
  Matches,
  Max,
  MaxLength,
  Min,
} from 'class-validator';

export class StudyCreditDto {
  @IsUUID()
  clientId: string;

  @IsOptional()
  @IsString()
  @Length(1, 20)
  nit?: string;

  // --- Evaluación comercial ---
  // El API las recibe planas (las contesta un formulario); study() las empaqueta
  // en el jsonb `study_answers` del crédito.

  @IsIn(['natural', 'juridica'])
  personType: 'natural' | 'juridica';

  @IsInt()
  @Min(0)
  @Max(100)
  @Type(() => Number)
  yearsExperience: number;

  @IsNumber()
  @IsPositive()
  @Type(() => Number)
  opportunityValue: number;

  @IsInt()
  @Min(1)
  @Max(5)
  @Type(() => Number)
  reliabilityScore: number;

  /**
   * Veredicto. Lo emite el asesor desde el modal de la evaluación; por ahora no
   * hay scoring automático, así que no se acepta `decision` ausente.
   */
  @IsIn(['approved', 'rejected'])
  decision: 'approved' | 'rejected';

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
