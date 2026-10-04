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
import { MODULE_PATH_MESSAGE, MODULE_PATH_REGEX, OperationItemDto } from './create-module.dto';

export class UpdateModuleDto {
  @IsBoolean()
  @IsOptional()
  global?: boolean;

  @IsUUID(undefined, { message: 'companyId debe ser un UUID válido' })
  @IsOptional()
  companyId?: string;

  @IsString()
  @IsOptional()
  @MaxLength(120)
  label?: string;

  @IsString()
  @IsOptional()
  @MaxLength(500)
  icon?: string | null;

  @IsString()
  @IsOptional()
  @MaxLength(200)
  @Matches(MODULE_PATH_REGEX, { message: MODULE_PATH_MESSAGE })
  path?: string;

  @IsBoolean()
  @IsOptional()
  enabled?: boolean;

  @IsArray()
  @IsOptional()
  @ValidateNested({ each: true })
  @Type(() => OperationItemDto)
  operations?: OperationItemDto[];
}