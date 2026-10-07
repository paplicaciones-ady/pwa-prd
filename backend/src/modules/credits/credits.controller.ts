import {
  Controller,
  Get,
  Post,
  Patch,
  Param,
  Body,
  Req,
  UseGuards,
  Query,
  ParseUUIDPipe,
  UseInterceptors,
} from '@nestjs/common';
import type { Request } from 'express';
import { JwtAuthGuard } from '../../commons/guards/jwt-auth.guard';
import { PermissionsGuard } from '../../commons/guards/permissions.guard';
import { Permissions } from '../../commons/decorators/permissions.decorator';
import { CurrentTenant } from '../../commons/decorators/current-tenant.decorator';
import { CurrentUser } from '../../commons/decorators/current-user.decorator';
import { IdempotencyInterceptor } from '../../commons/interceptors/idempotency.interceptor';
import { PaginationQueryDto } from '../../commons/dto/pagination.dto';
import { CreditsService } from './credits.service';
import { StudyCreditDto } from './dto/study-credit.dto';
import { RbacService } from '../rbac/rbac.service';

@Controller('credits')
@UseGuards(JwtAuthGuard, PermissionsGuard)
@UseInterceptors(IdempotencyInterceptor)
export class CreditsController {
  constructor(
    private service: CreditsService,
    private rbacService: RbacService,
  ) {}

  @Get('context')
  async getContext(@CurrentUser() user, @CurrentTenant() companyId: string) {
    const permissions = await this.rbacService.getPermissionsByPrefix(user.sub, companyId, 'credits');
    return { permissions, featureFlags: {} };
  }

  @Get()
  @Permissions('credits.read')
  findAll(@CurrentTenant() companyId: string, @Query() query: PaginationQueryDto) {
    return this.service.findAll(companyId, query);
  }

  @Get(':id/documents')
  @Permissions('credits.read')
  documents(@Param('id', new ParseUUIDPipe()) id: string, @CurrentTenant() companyId: string) {
    return this.service.listDocuments(id, companyId);
  }

  @Get(':id/documents/:documentId/signature')
  @Permissions('credits.read')
  documentContent(
    @Param('id', new ParseUUIDPipe()) id: string,
    @Param('documentId', new ParseUUIDPipe()) documentId: string,
    @CurrentTenant() companyId: string,
  ) {
    return this.service.findDocumentContent(id, documentId, companyId);
  }

  @Get(':id')
  @Permissions('credits.read')
  findOne(@Param('id', new ParseUUIDPipe()) id: string, @CurrentTenant() companyId: string) {
    return this.service.findOne(id, companyId);
  }

  @Post('study')
  @Permissions('credits.study')
  study(
    @CurrentTenant() companyId: string,
    @Body() dto: StudyCreditDto,
    // IP y user agent los toma el servidor: son parte de la evidencia del
    // consentimiento y no pueden declararse desde el cliente.
    @Req() req: Request,
  ) {
    return this.service.study(companyId, dto, {
      ip: req.ip ?? '',
      userAgent: req.headers['user-agent'] ?? '',
    });
  }

  /**
   * Confirmación del paso 1: valida y devuelve la petición que se enviará a
   * Saman, sin crear nada. Mismo body que POST /credits/study.
   */
  @Post('study/preview')
  @Permissions('credits.study')
  previewStudy(@CurrentTenant() companyId: string, @Body() dto: StudyCreditDto) {
    return this.service.previewStudy(companyId, dto);
  }

  /** Consulta al algoritmo el veredicto de un borrador (el front lo llama cada 10 s). */
  @Post(':id/study/check')
  @Permissions('credits.study')
  checkStudy(@Param('id', new ParseUUIDPipe()) id: string, @CurrentTenant() companyId: string) {
    return this.service.checkStudy(id, companyId);
  }

  /** Reintento manual tras un error de Saman: envía el borrador de nuevo. */
  @Post(':id/study/retry')
  @Permissions('credits.study')
  retryStudy(@Param('id', new ParseUUIDPipe()) id: string, @CurrentTenant() companyId: string) {
    return this.service.retryStudy(id, companyId);
  }

  /** Paso 3: envía los documentos a firma externa → pending_signatures. */
  @Post(':id/sign')
  @Permissions('credits.study')
  sign(@Param('id', new ParseUUIDPipe()) id: string, @CurrentTenant() companyId: string) {
    return this.service.sign(id, companyId);
  }

  /**
   * Confirmación de las firmas → signed. Mientras no exista el webhook del
   * servicio de firma externo, se dispara a mano desde la app.
   */
  @Post(':id/signatures/confirm')
  @Permissions('credits.study')
  confirmSignatures(@Param('id', new ParseUUIDPipe()) id: string, @CurrentTenant() companyId: string) {
    return this.service.confirmSignatures(id, companyId);
  }

  @Patch(':id/cancel')
  @Permissions('credits.study')
  cancel(@Param('id', new ParseUUIDPipe()) id: string, @CurrentTenant() companyId: string) {
    return this.service.cancel(id, companyId);
  }

  /** Decisión manual sobre un borrador, por si el algoritmo no está disponible. */
  @Patch(':id/approve')
  @Permissions('credits.update')
  approve(@Param('id', new ParseUUIDPipe()) id: string, @CurrentTenant() companyId: string) {
    return this.service.decideManually(id, companyId, 'pre_approved');
  }

  @Patch(':id/reject')
  @Permissions('credits.update')
  reject(@Param('id', new ParseUUIDPipe()) id: string, @CurrentTenant() companyId: string) {
    return this.service.decideManually(id, companyId, 'rejected');
  }
}
