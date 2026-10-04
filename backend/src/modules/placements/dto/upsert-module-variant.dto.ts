import {
  IsOptional,
  IsString,
  MaxLength,
  IsObject,
  IsArray,
  Matches,
} from 'class-validator';
import { MODULE_PATH_MESSAGE, MODULE_PATH_REGEX } from './create-module.dto';

/** Upsert de la variante de un módulo para una empresa (PUT idempotente). */
export class UpsertModuleVariantDto {
  @IsOptional()
  @IsString()
  @MaxLength(120)
  label?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  icon?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  @Matches(MODULE_PATH_REGEX, { message: MODULE_PATH_MESSAGE })
  path?: string | null;

  @IsOptional()
  @IsObject()
  config?: Record<string, unknown>;

  /** Subconjunto de operaciones del módulo activas en esta empresa ([] = todas). */
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  enabledOperations?: string[];
}