import { Controller, Get, Post, Patch, Delete, Param, Body, Query, UseGuards, ForbiddenException, BadRequestException, ParseUUIDPipe } from '@nestjs/common';
import { JwtAuthGuard } from '../../commons/guards/jwt-auth.guard';
import { PermissionsGuard } from '../../commons/guards/permissions.guard';
import { Permissions } from '../../commons/decorators/permissions.decorator';
import { CurrentTenant } from '../../commons/decorators/current-tenant.decorator';
import { CurrentUser } from '../../commons/decorators/current-user.decorator';
import { UsersService } from './users.service';
import { RbacService } from '../rbac/rbac.service';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { SUPER_ADMIN_PROFILE_ID } from '../../commons/constants';

@Controller('users')
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class UsersController {
  constructor(
    private service: UsersService,
    private rbacService: RbacService,
  ) {}

  @Get('context')
  async getContext(@CurrentUser() user, @CurrentTenant() companyId: string) {
    const permissions = await this.rbacService.getPermissionsByPrefix(user.sub, companyId, 'users');
    return { permissions, featureFlags: {} };
  }

  @Get('profiles')
  @Permissions('users.read')
  findProfiles(@CurrentTenant() companyId: string) {
    // Fuente única de verdad: RbacService.findProfiles ya filtra por tenant
    // (companyId propio + perfiles de sistema con companyId NULL).
    return this.rbacService.findProfiles(companyId);
  }

  @Get()
  @Permissions('users.read')
  findAll(@CurrentUser() user, @CurrentTenant() companyId: string) {
    return this.service.findAll(companyId);
  }

  @Post()
  @Permissions('users.create')
  create(
    @CurrentUser() user,
    @CurrentTenant() companyId: string | null,
    @Body() dto: CreateUserDto,
  ) {
    const isSuperAdmin = user.profileId === SUPER_ADMIN_PROFILE_ID;
    // El super_admin es un rol de sistema: solo el superadmin puede asignarlo
    // y nunca lleva empresa vinculada.
    if (!isSuperAdmin && dto.profileId === SUPER_ADMIN_PROFILE_ID) {
      throw new ForbiddenException('El perfil super_admin es de sistema; solo el superadmin puede asignarlo');
    }
    if (dto.profileId === SUPER_ADMIN_PROFILE_ID) {
      return this.service.create(null, dto);
    }
    if (isSuperAdmin) {
      if (!dto.companyId) {
        throw new BadRequestException('El superadmin debe indicar la empresa principal del usuario');
      }
      return this.service.create(dto.companyId, dto);
    }
    return this.service.create(companyId, dto);
  }

  @Patch(':id')
  @Permissions('users.update')
  update(
    @CurrentUser() user,
    @Param('id', new ParseUUIDPipe()) id: string,
    @CurrentTenant() companyId: string | null,
    @Body() dto: UpdateUserDto,
  ) {
    const isSuperAdmin = user.profileId === SUPER_ADMIN_PROFILE_ID;
    if (dto.companyId !== undefined && !isSuperAdmin) {
      throw new ForbiddenException('Solo el superadmin puede reasignar la empresa de un usuario');
    }
    return this.service.update(id, companyId, dto);
  }

  @Patch(':id/status')
  @Permissions('users.update')
  toggleStatus(
    @Param('id', new ParseUUIDPipe()) id: string,
    @CurrentTenant() companyId: string | null,
  ) {
    return this.service.toggleStatus(id, companyId);
  }

  @Delete(':id')
  @Permissions('users.delete')
  remove(@Param('id', new ParseUUIDPipe()) id: string, @CurrentTenant() companyId: string | null) {
    return this.service.remove(id, companyId);
  }
}
