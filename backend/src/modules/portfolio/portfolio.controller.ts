import { Controller, Get, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../../commons/guards/jwt-auth.guard';
import { PermissionsGuard } from '../../commons/guards/permissions.guard';
import { Permissions } from '../../commons/decorators/permissions.decorator';
import { CurrentTenant } from '../../commons/decorators/current-tenant.decorator';
import { CurrentUser } from '../../commons/decorators/current-user.decorator';
import { RbacService } from '../rbac/rbac.service';

@Controller('portfolio')
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class PortfolioController {
  constructor(private rbacService: RbacService) {}

  @Get('context')
  async getContext(@CurrentUser() user, @CurrentTenant() companyId: string) {
    const permissions = await this.rbacService.getPermissionsByPrefix(user.sub, companyId, 'portfolio');
    return { permissions, featureFlags: {} };
  }

  @Get()
  @Permissions('portfolio.read')
  list() {
    return [];
  }
}
