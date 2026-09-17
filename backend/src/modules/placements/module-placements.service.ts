import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  BadRequestException,
} from '@nestjs/common';
import { InjectDataSource, InjectRepository } from '@nestjs/typeorm';
import { DataSource, IsNull, Repository } from 'typeorm';
import { Module } from './entities/module.entity';
import { ModuleAssignment } from './entities/module-assignment.entity';
import { ModuleVariant } from './entities/module-variant.entity';
import { Company } from '../config/entities/company.entity';
import { CreateModuleDto } from './dto/create-module.dto';
import { UpdateModuleDto } from './dto/update-module.dto';
import { UpdateAssignmentDto, PublishModuleDto } from './dto/update-assignment.dto';
import { UpsertModuleVariantDto } from './dto/upsert-module-variant.dto';
import { RbacService } from '../rbac/rbac.service';
import { SUPER_ADMIN_PROFILE_ID } from '../../commons/constants';

export interface AuthUserContext {
  sub: string;
  profileId: string;
  companyId: string | null;
}

@Injectable()
export class ModulePlacementsService {
  constructor(
    @InjectRepository(Module)
    private moduleRepo: Repository<Module>,
    @InjectRepository(ModuleAssignment)
    private assignmentRepo: Repository<ModuleAssignment>,
    @InjectRepository(ModuleVariant)
    private variantRepo: Repository<ModuleVariant>,
    @InjectDataSource() private dataSource: DataSource,
    private rbacService: RbacService,
  ) {}

  private isSuperAdmin(user: AuthUserContext): boolean {
    return user.profileId === SUPER_ADMIN_PROFILE_ID;
  }

  private validateOperations(operations: { action: string; name: string }[]): void {
    if (!operations || operations.length === 0) {
      throw new BadRequestException('Debe definir al menos una operación');
    }
    const actions = operations.map((o) => o.action);
    if (new Set(actions).size !== actions.length) {
      throw new BadRequestException('No se permiten acciones duplicadas');
    }
    const hasUpdate = actions.includes('update');
    const hasDelete = actions.includes('delete');
    if ((hasUpdate || hasDelete) && !actions.includes('read')) {
      throw new BadRequestException('Si el módulo tiene operaciones de edición o eliminación, debe incluir también la operación de lectura (read)');
    }
  }

  private permOf(m: Module): string {
    return `${m.module}.${m.operations?.[0]?.action ?? 'read'}`;
  }

  private enrichAssignment(a: ModuleAssignment) {
    const m = a.module;
    return {
      id: a.moduleId,
      key: m.key,
      module: m.module,
      label: m.label,
      placement: a.placement,
      position: a.position,
      path: m.path,
      perm: this.permOf(m),
      flag: m.flag,
      logoUrl: m.icon && m.icon.startsWith('http') ? m.icon : null,
      icon: m.icon,
      enabled: a.enabled && m.enabled,
    };
  }

  private toVariantView(v: ModuleVariant) {
    return {
      id: v.id,
      moduleId: v.moduleId,
      companyId: v.companyId,
      companyName: v.company?.name ?? null,
      label: v.label,
      icon: v.icon,
      path: v.path,
      config: v.config,
      enabledOperations: v.enabledOperations,
    };
  }

  private toViewModel(m: Module) {
    const ownerAssignment = m.assignments?.find((x) => x.companyId === m.companyId) ?? null;
    const published = (m.assignments ?? [])
      .filter((x) => x.companyId !== m.companyId)
      .map((x) => ({
        companyId: x.companyId,
        companyName: x.company?.name ?? null,
        placement: x.placement,
        position: x.position,
        enabled: x.enabled,
      }));

    return {
      id: m.id,
      scope: m.companyId ? 'company' : 'global',
      companyId: m.companyId,
      companyName: m.company?.name ?? null,
      key: m.key,
      module: m.module,
      label: m.label,
      icon: m.icon,
      path: m.path,
      operations: m.operations,
      enabled: m.enabled,
      flag: m.flag,
      ownerAssignment: ownerAssignment
        ? {
            companyId: ownerAssignment.companyId,
            placement: ownerAssignment.placement,
            position: ownerAssignment.position,
            enabled: ownerAssignment.enabled,
          }
        : null,
      published,
      variants: (m.variants ?? []).map((v) => this.toVariantView(v)),
    };
  }

  /** Placements visibles para una empresa (bootstrap de Home), con su variante aplicada. */
  async findByCompany(companyId: string) {
    const rows = await this.assignmentRepo.find({
      where: { companyId },
      relations: { module: true },
      order: { position: 'ASC' },
    });

    const variants = await this.variantRepo.find({
      where: { companyId },
    });
    const byModule = new Map(variants.map((v) => [v.moduleId, v]));

    return rows
      .filter((a) => a.module && a.enabled && a.module.enabled)
      .map((a) => {
        const base = this.enrichAssignment(a);
        const v = byModule.get(a.moduleId);
        return {
          ...base,
          label: v?.label ?? base.label,
          icon: v?.icon ?? base.icon,
          path: v?.path ?? base.path,
          config: v?.config ?? {},
          enabledOperations: v?.enabledOperations?.length
            ? v.enabledOperations
            : (a.module.operations ?? []).map((o) => o.action),
        };
      });
  }

  /** Módulos que puede administrar el superadmin (todos) o el admin (los de su empresa + los compartidos/publicados en ella). */
  async findAdminModules(user: AuthUserContext) {
    const isSuper = this.isSuperAdmin(user);
    const relations = { company: true, assignments: { company: true }, variants: { company: true } } as const;
    let modules: Module[];
    if (isSuper) {
      modules = await this.moduleRepo.find({ relations, order: { createdAt: 'ASC' } });
    } else {
      const tenant = user.companyId;
      const myAssigned = tenant
        ? await this.assignmentRepo.find({ select: ['moduleId'], where: { companyId: tenant } })
        : [];
      const sharedIds = myAssigned.map((a) => a.moduleId);
      modules = await this.moduleRepo.find({
        where: sharedIds.length
          ? [{ companyId: tenant! }, ...sharedIds.map((id) => ({ id }))]
          : { companyId: tenant! },
        relations,
        order: { createdAt: 'ASC' },
      });
    }
    return modules.map((m) => ({
      ...this.toViewModel(m),
      isShared: !isSuper && !!user.companyId && m.companyId !== user.companyId,
    }));
  }

  async create(user: AuthUserContext, tenantCompanyId: string | null, dto: CreateModuleDto) {
    this.validateOperations(dto.operations);

    const isSuper = this.isSuperAdmin(user);
    let targetCompanyId: string | null;
    let global = !!dto.global;

    if (global) {
      if (!isSuper) throw new ForbiddenException('Solo el superadmin puede crear módulos globales');
      targetCompanyId = null;
    } else if (isSuper && dto.companyId) {
      targetCompanyId = dto.companyId;
    } else {
      // admin: solo puede crear módulos para su propia empresa
      targetCompanyId = tenantCompanyId;
    }
    if (!targetCompanyId && !global) {
      throw new BadRequestException('Se debe indicar la empresa del módulo');
    }

    const module = await this.dataSource.transaction(async (manager) => {
      const saved = await manager.save(
        manager.create(Module, {
          companyId: targetCompanyId,
          key: dto.key,
          module: dto.module,
          label: dto.label,
          icon: dto.icon ?? null,
          path: dto.path,
          operations: dto.operations,
          flag: null,
          enabled: dto.enabled ?? true,
        }),
      );

      if (targetCompanyId) {
        await manager.save(
          manager.create(ModuleAssignment, {
            moduleId: saved.id,
            companyId: targetCompanyId,
            placement: 'grid',
            position: 0,
            enabled: true,
          }),
        );
      } else {
        // Módulo global (sin empresa dueña): se distribuye automáticamente a
        // todas las empresas activas como FAB.
        const companies = await manager.find(Company, { select: ['id'], where: { isActive: true } });
        if (companies.length > 0) {
          await manager.upsert(
            ModuleAssignment,
            companies.map((c) => ({
              moduleId: saved.id,
              companyId: c.id,
              placement: 'fab',
              position: 999,
              enabled: true,
            })),
            ['moduleId', 'companyId'],
          );
        }
      }

      await this.rbacService.registerModulePermissions(
        dto.module,
        dto.operations.map((o) => o.action),
        undefined,
        manager,
      );

      return saved;
    });

    await this.rbacService.invalidateCache(user.sub);
    return this.findOneViewModel(module.id);
  }

  async update(id: string, user: AuthUserContext, tenantCompanyId: string | null, dto: UpdateModuleDto) {
    const module = await this.findWithRelations(id);
    this.assertCanManage(module, user, tenantCompanyId);

    if (dto.operations) this.validateOperations(dto.operations);

    // Cambio de alcance (solo superadmin): empresa <-> global.
    const oldCompanyId = module.companyId;
    const wantsGlobal = dto.global !== undefined ? dto.global : module.companyId === null;
    const wantsCompanyId = dto.companyId !== undefined && dto.companyId ? dto.companyId : null;
    const scopeChanged =
      wantsGlobal !== (module.companyId === null) ||
      (!wantsGlobal && module.companyId !== null && wantsCompanyId !== null && wantsCompanyId !== module.companyId);

    if (scopeChanged) {
      if (!this.isSuperAdmin(user)) {
        throw new ForbiddenException('Solo el superadmin puede cambiar el alcance de un módulo');
      }
      if (!wantsGlobal && !wantsCompanyId) {
        throw new BadRequestException('Indicá la empresa dueña para un módulo de empresa');
      }

      const existing = module.assignments ?? [];
      if (oldCompanyId && wantsGlobal) {
        // empresa -> global: la asignación propia pasa a ser una publicación FAB
        const owner = existing.find((x) => x.companyId === oldCompanyId);
        if (owner) {
          owner.placement = 'fab';
          owner.position = 999;
          await this.assignmentRepo.save(owner);
        }
        // empresa -> global: se distribuye a todas las empresas activas (igual que el create global)
        const activeCompanies = await this.assignmentRepo.manager.find(Company, {
          select: ['id'],
          where: { isActive: true },
        });
        if (activeCompanies.length > 0) {
          await this.assignmentRepo.upsert(
            activeCompanies.map((c) => ({
              moduleId: id,
              companyId: c.id,
              placement: 'fab',
              position: 999,
              enabled: true,
            })),
            ['moduleId', 'companyId'],
          );
        }
      } else if (oldCompanyId && wantsCompanyId && wantsCompanyId !== oldCompanyId) {
        // mueve el módulo a otra empresa dueña
        const existingTarget = existing.find((x) => x.companyId === wantsCompanyId);
        const ownerRow = existing.find((x) => x.companyId === oldCompanyId);
        if (ownerRow) {
          if (existingTarget) {
            existingTarget.placement = ownerRow.placement;
            existingTarget.position = ownerRow.position;
            existingTarget.enabled = ownerRow.enabled;
            await this.assignmentRepo.save(existingTarget);
            await this.assignmentRepo.remove(ownerRow);
          } else {
            ownerRow.companyId = wantsCompanyId;
            await this.assignmentRepo.save(ownerRow);
          }
        } else if (!existingTarget) {
          await this.assignmentRepo.save(
            this.assignmentRepo.create({
              moduleId: id,
              companyId: wantsCompanyId,
              placement: 'grid',
              position: 0,
              enabled: true,
            }),
          );
        }
      } else if (module.companyId === null && !wantsGlobal) {
        // global -> empresa: asegura la asignación dueña (home)
        const existingTarget = existing.find((x) => x.companyId === wantsCompanyId);
        if (existingTarget) {
          existingTarget.placement = 'grid';
          existingTarget.position = 0;
          existingTarget.enabled = true;
          await this.assignmentRepo.save(existingTarget);
        } else {
          await this.assignmentRepo.save(
            this.assignmentRepo.create({
              moduleId: id,
              companyId: wantsCompanyId!,
              placement: 'grid',
              position: 0,
              enabled: true,
            }),
          );
        }
        // global -> empresa: el módulo pasa a ser solo de la empresa dueña;
        // se eliminan las publicaciones FAB del resto de las empresas (visibilidad
        // por module_assignments, independiente de permisos).
        const others = existing.filter((x) => x.companyId !== wantsCompanyId);
        if (others.length > 0) {
          await this.assignmentRepo.remove(others);
        }
        // global -> empresa: los usuarios de las demás empresas dejan de tener
        // los permisos del módulo (solo superadmin puede cambiar el alcance).
        await this.rbacService.revokeModulePermissionsFromCompanies(module.module, wantsCompanyId!);
      }

      // companyId es la columna join de la relación company: al estar la relación
      // cargada, TypeORM persistiría el FK desde `company` y revertiría el cambio.
      module.companyId = wantsGlobal ? null : wantsCompanyId;
      module.company = null;
    }

    if (dto.label !== undefined) module.label = dto.label;
    if (dto.icon !== undefined) module.icon = dto.icon;
    if (dto.path !== undefined) module.path = dto.path;
    if (dto.enabled !== undefined) module.enabled = dto.enabled;
    if (dto.operations) {
      const changed =
        JSON.stringify(module.operations.map((o) => o.action)) !==
        JSON.stringify(dto.operations.map((o) => o.action));
      module.operations = dto.operations;
      if (changed) {
        await this.rbacService.registerModulePermissions(
          module.module,
          dto.operations.map((o) => o.action),
          undefined,
          this.moduleRepo.manager,
        );
      }
    }

    await this.moduleRepo.save(module);
    await this.rbacService.invalidateCache(user.sub);
    return this.toViewModel(await this.findWithRelations(id));
  }

  /** Ubicación/posición de la asignación de la empresa dueña del módulo. */
  async updateOwnerAssignment(
    id: string,
    user: AuthUserContext,
    tenantCompanyId: string | null,
    dto: UpdateAssignmentDto,
  ) {
    const module = await this.findWithRelations(id);
    this.assertCanManage(module, user, tenantCompanyId);

    if (!module.companyId) {
      throw new BadRequestException('Los módulos globales no tienen asignación propia; adminístrala vía publicaciones');
    }
    if (!this.isSuperAdmin(user) && module.companyId !== tenantCompanyId) {
      throw new ForbiddenException('No puedes modificar la ubicación de este módulo');
    }

    const assignment = await this.assignmentRepo.findOne({
      where: { moduleId: id, companyId: module.companyId },
    });
    if (!assignment) throw new NotFoundException('Asignación no encontrada');

    if (dto.placement !== undefined) assignment.placement = dto.placement;
    if (dto.position !== undefined) assignment.position = dto.position;
    if (dto.enabled !== undefined) assignment.enabled = dto.enabled;

    return this.assignmentRepo.save(assignment);
  }

  async remove(id: string, user: AuthUserContext, tenantCompanyId: string | null) {
    const module = await this.findWithRelations(id);
    this.assertCanManage(module, user, tenantCompanyId);
    await this.moduleRepo.remove(module);
    return { success: true };
  }

  /** Publicar un módulo en otras empresas (única posición permitida: FAB). */
  async publish(id: string, user: AuthUserContext, tenantCompanyId: string | null, dto: PublishModuleDto) {
    const module = await this.findWithRelations(id);
    this.assertCanManage(module, user, tenantCompanyId);

    const assignmentToPublish = (module.assignments ?? []).filter((x) =>
      dto.companyIds.includes(x.companyId),
    );
    const freshTargets = dto.companyIds.filter(
      (cid) => !(module.assignments ?? []).some((x) => x.companyId === cid),
    );

    for (const existing of assignmentToPublish) {
      if (existing.companyId === module.companyId) continue;
      existing.placement = 'fab';
      existing.enabled = true;
      await this.assignmentRepo.save(existing);
    }

    if (freshTargets.length > 0) {
      await this.assignmentRepo.upsert(
        freshTargets.map((cid) => ({
          moduleId: id,
          companyId: cid,
          placement: 'fab',
          position: 999,
          enabled: true,
        })),
        ['moduleId', 'companyId'],
      );
    }

    return { success: true };
  }

  async unpublish(id: string, companyId: string, user: AuthUserContext, tenantCompanyId: string | null) {
    const module = await this.findWithRelations(id);
    this.assertCanManage(module, user, tenantCompanyId);

    const target = (module.assignments ?? []).find(
      (x) => x.companyId === companyId && x.companyId !== module.companyId,
    );
    if (!target) throw new NotFoundException('Publicación no encontrada');

    await this.assignmentRepo.remove(target);
    return { success: true };
  }

  /* ---------- Variantes por empresa ---------- */

  /** Variantes del módulo: el admin solo ve (y puede editar) la de su empresa. */
  async getVariants(id: string, user: AuthUserContext, tenantCompanyId: string | null) {
    await this.findWithRelations(id);
    const where = this.isSuperAdmin(user)
      ? { moduleId: id }
      : { moduleId: id, companyId: tenantCompanyId! };
    const rows = await this.variantRepo.find({
      where,
      relations: { company: true },
      order: { createdAt: 'ASC' },
    });
    return rows.map((v) => this.toVariantView(v));
  }

  /** Create/Update de la variante de una empresa sobre un módulo. PUT idempotente. */
  async upsertVariant(
    id: string,
    targetCompanyId: string,
    user: AuthUserContext,
    tenantCompanyId: string | null,
    dto: UpsertModuleVariantDto,
  ) {
    const module = await this.findWithRelations(id);
    const isSuper = this.isSuperAdmin(user);
    if (!isSuper && targetCompanyId !== tenantCompanyId) {
      throw new ForbiddenException('Solo podés configurar la variante de tu propia empresa');
    }

    const hasAssignment = (module.assignments ?? []).some((x) => x.companyId === targetCompanyId);
    if (!hasAssignment) {
      throw new BadRequestException('El módulo no está disponible para esta empresa (asigná o publicá el módulo primero)');
    }

    if (dto.enabledOperations) {
      const validActions = new Set((module.operations ?? []).map((o) => o.action));
      for (const action of dto.enabledOperations) {
        if (!validActions.has(action)) {
          throw new BadRequestException(`La operación '${action}' no existe en el módulo`);
        }
      }
      if (new Set(dto.enabledOperations).size !== dto.enabledOperations.length) {
        throw new BadRequestException('No se permiten operaciones duplicadas');
      }
    }

    let variant = await this.variantRepo.findOne({ where: { moduleId: id, companyId: targetCompanyId } });
    if (!variant) {
      variant = this.variantRepo.create({ moduleId: id, companyId: targetCompanyId });
    }

    if (dto.label !== undefined) variant.label = dto.label;
    if (dto.icon !== undefined) variant.icon = dto.icon;
    if (dto.path !== undefined) variant.path = dto.path;
    if (dto.config !== undefined) variant.config = dto.config;
    if (dto.enabledOperations !== undefined) {
      variant.enabledOperations = dto.enabledOperations.length ? dto.enabledOperations : [];
    }

    const saved = await this.variantRepo.save(variant);
    await this.rbacService.invalidateCache(user.sub);
    return this.toVariantView(saved);
  }

  async deleteVariant(
    id: string,
    targetCompanyId: string,
    user: AuthUserContext,
    tenantCompanyId: string | null,
  ) {
    await this.findWithRelations(id);
    if (!this.isSuperAdmin(user) && targetCompanyId !== tenantCompanyId) {
      throw new ForbiddenException('Solo podés quitar la variante de tu propia empresa');
    }
    const variant = await this.variantRepo.findOne({
      where: { moduleId: id, companyId: targetCompanyId },
    });
    if (!variant) throw new NotFoundException('Variante no encontrada');
    await this.variantRepo.remove(variant);
    return { success: true };
  }

  /** Asigna todos los módulos globales habilitados a una empresa (usado al crear empresa). */
  async assignGlobalModules(companyId: string): Promise<void> {
    const globals = await this.moduleRepo.find({ where: { companyId: IsNull(), enabled: true } });
    if (globals.length === 0) return;
    await this.assignmentRepo.upsert(
      globals.map((m) => ({
        moduleId: m.id,
        companyId,
        placement: 'fab',
        position: 999,
        enabled: true,
      })),
      ['moduleId', 'companyId'],
    );
  }

  /* ---------- helpers ---------- */

  private async findWithRelations(id: string): Promise<Module> {
    const module = await this.moduleRepo.findOne({
      where: { id },
      relations: { company: true, assignments: { company: true }, variants: { company: true } },
    });
    if (!module) throw new NotFoundException('Módulo no encontrado');
    return module;
  }

  private async findOneViewModel(id: string) {
    const m = await this.findWithRelations(id);
    if (!m) throw new NotFoundException('Módulo no encontrado');
    return this.toViewModel(m);
  }

  private assertCanManage(module: Module, user: AuthUserContext, tenantCompanyId: string | null): void {
    if (this.isSuperAdmin(user)) return;
    if (module.companyId !== tenantCompanyId) {
      throw new ForbiddenException('Solo puedes administrar módulos de tu empresa');
    }
  }
}