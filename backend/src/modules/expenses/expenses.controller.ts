import { Controller, Get, Post, Patch, Delete, Param, Body, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../../commons/guards/jwt-auth.guard';
import { PermissionsGuard } from '../../commons/guards/permissions.guard';
import { Permissions } from '../../commons/decorators/permissions.decorator';
import { CurrentTenant } from '../../commons/decorators/current-tenant.decorator';
import { CurrentUser } from '../../commons/decorators/current-user.decorator';
import { RbacService } from '../rbac/rbac.service';

@Controller('expenses')
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class ExpensesController {
  constructor(private rbacService: RbacService) {}

  @Get('context')
  async getContext(@CurrentUser() user, @CurrentTenant() companyId: string) {
    const permissions = await this.rbacService.getPermissionsByPrefix(user.sub, companyId, 'expenses');
    return { permissions, featureFlags: {} };
  }

  @Get()
  @Permissions('expenses.read')
  list() {
    return [];
  }

  @Post()
  @Permissions('expenses.create')
  create(@Body() _dto: unknown) {
    return { created: 1 };
  }

  @Patch(':id')
  @Permissions('expenses.update')
  update(@Param('id') id: string, @Body() _dto: unknown) {
    return { updated: 1, id };
  }

  @Delete(':id')
  @Permissions('expenses.delete')
  remove(@Param('id') id: string) {
    return { deleted: 1, id };
  }
}
