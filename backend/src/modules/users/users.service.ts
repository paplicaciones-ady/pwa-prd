import { Inject, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, IsNull } from 'typeorm';
import { User, UserStatus } from './entities/user.entity';
import * as bcrypt from 'bcrypt';
import { SUPER_ADMIN_PROFILE_ID } from '../../commons/constants';
import Redis from 'ioredis';
import { RbacService } from '../rbac/rbac.service';

@Injectable()
export class UsersService {
  private readonly logger = new Logger(UsersService.name);

  constructor(
    @InjectRepository(User) private repo: Repository<User>,
    private rbacService: RbacService,
    @Inject(Redis) private redis: Redis,
  ) {}

  /**
   * Borra los permisos (rbac, 120 s) y el estado (JwtStrategy, 60 s) cacheados
   * del usuario: sin esto, tras cambiarle el perfil, desactivarlo o borrarlo,
   * el backend seguía aceptando su acceso anterior hasta que expiraran.
   */
  private async invalidateAccess(userId: string): Promise<void> {
    try {
      await this.rbacService.invalidateCache(userId);
      await this.redis.del(`auth:user:status:${userId}`);
    } catch (e) {
      this.logger.warn(`No se pudo invalidar la caché de acceso de ${userId}: ${(e as Error)?.message}`);
    }
  }

  findAll(companyId: string | null) {
    return this.repo.find({
      where: { companyId: companyId ?? IsNull() },
      select: ['id', 'email', 'fullName', 'status', 'profileId', 'createdAt'],
    });
  }

  async findOne(id: string, companyId: string | null) {
    const user = await this.repo.findOne({ where: { id, companyId: companyId ?? IsNull() } });
    if (!user) throw new NotFoundException();
    return user;
  }

  /** Búsqueda por id sin restricción de empresa (superadmin / bootstrap). */
  async findById(id: string) {
    const user = await this.repo.findOne({ where: { id } });
    if (!user) throw new NotFoundException();
    return user;
  }

  async create(companyId: string | null, data: { email: string; password: string; fullName: string; profileId: string }) {
    const passwordHash = await bcrypt.hash(data.password, 12);
    return this.repo.save(
      this.repo.create({
        email: data.email,
        passwordHash,
        fullName: data.fullName,
        profileId: data.profileId,
        companyId,
      }),
    );
  }

  async update(id: string, companyId: string | null, data: Partial<User>) {
    const user = await this.repo.findOne({ where: { id, companyId: companyId ?? IsNull() } });
    if (!user) throw new NotFoundException();
    if (data.email !== undefined) user.email = data.email;
    if (data.fullName !== undefined) user.fullName = data.fullName;
    if (data.profileId !== undefined) user.profileId = data.profileId;
    if (data.status !== undefined) user.status = data.status;
    if (data.companyId !== undefined) user.companyId = data.companyId;
    // Invariante: el super_admin es un rol de sistema, no puede estar vinculado a una empresa.
    if (user.profileId === SUPER_ADMIN_PROFILE_ID) user.companyId = null;
    const saved = await this.repo.save(user);
    await this.invalidateAccess(id);
    return saved;
  }

  async toggleStatus(id: string, companyId: string | null) {
    const user = await this.repo.findOne({ where: { id, companyId: companyId ?? IsNull() } });
    if (!user) throw new NotFoundException();
    user.status = user.status === UserStatus.ACTIVE ? UserStatus.INACTIVE : UserStatus.ACTIVE;
    const saved = await this.repo.save(user);
    await this.invalidateAccess(id);
    return saved;
  }

  async remove(id: string, companyId: string | null) {
    const user = await this.repo.findOne({ where: { id, companyId: companyId ?? IsNull() } });
    if (!user) throw new NotFoundException();
    await this.repo.softRemove(user);
    await this.invalidateAccess(id);
    return { success: true };
  }
}
