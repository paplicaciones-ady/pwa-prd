import {
  IsString,
  IsOptional,
  MaxLength,
  IsBoolean,
  IsArray,
  ValidateNested,
  IsUUID,
  Matches,
} from 'class-validator';
import { Type } from 'class-transformer';

/**
 * Formato de modules.path / module_variants.path: ruta interna de la SPA
 * (`/segmento/segmento`). Bloquea URLs externas, espacios o `javascript:`.
 * Que la ruta exista en el frontend lo garantiza su registro de módulos.
 */
export const MODULE_PATH_REGEX = /^\/(?:[A-Za-z0-9_-]+\/?)*$/;
export const MODULE_PATH_MESSAGE = 'path debe ser una ruta interna: empezar con / y usar letras, números, - o _';

export class OperationItemDto {
  @IsString()
  @MaxLength(60)
  action: string;

  @IsString()
  @MaxLength(80)
  name: string;
}

export class CreateModuleDto {
  @IsUUID(undefined, { message: 'companyId debe ser un UUID válido' })
  @IsOptional()
  companyId?: string;

  @IsBoolean()
  @IsOptional()
  global?: boolean;

  @IsString()
  @MaxLength(60)
  key: string;

  @IsString()
  @MaxLength(60)
  module: string;

  @IsString()
  @MaxLength(120)
  label: string;

  @IsString()
  @IsOptional()
  @MaxLength(500)
  icon?: string;

  @IsString()
  @MaxLength(200)
  @Matches(MODULE_PATH_REGEX, { message: MODULE_PATH_MESSAGE })
  path: string;

  @IsBoolean()
  @IsOptional()
  enabled?: boolean;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => OperationItemDto)
  operations: OperationItemDto[];
}