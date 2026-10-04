import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectDataSource, InjectRepository } from '@nestjs/typeorm';
import { DataSource, IsNull, Repository } from 'typeorm';
import { Client, ClientStatus } from './entities/client.entity';
import { ClientDirection, ClientDirectionType } from './entities/client-direction.entity';
import { ClientReference } from './entities/client-reference.entity';
import { CreateClientDto } from './dto/create-client.dto';
import { UpdateClientDto } from './dto/update-client.dto';
import { clampPagination } from '../../commons/dto/pagination.dto';

@Injectable()
export class ClientsService {
  constructor(
    @InjectRepository(Client) private repo: Repository<Client>,
    @InjectDataSource() private dataSource: DataSource,
  ) {}

  /**
   * Alcance de lectura de una empresa: sus propios clientes más el padrón
   * compartido. Deliberadamente NO se incluye `companyId: In(otras)` — el RLS
   * ya impide que esas filas lleguen a la base de datos, pero dejarlo explícito
   * en el `where` documenta que la lista no es un `SELECT *` y evita que un
   * futuro refactor la convierta en una fuga entre competidores.
   *
   * `companyId` puede ser null solo en los clientes del padrón compartido, así
   * que la comparación por igualdad es lo que los deja fuera.
   */
  private visibleTo(companyId: string) {
    return [{ companyId }, { companyId: IsNull() }];
  }

  findAll(companyId: string, query: { page?: number; limit?: number }) {
    const { page, limit } = clampPagination(query);
    return this.repo.findAndCount({
      where: this.visibleTo(companyId),
      skip: (page - 1) * limit,
      take: limit,
      order: { createdAt: 'DESC' },
    });
  }

  async findOne(id: string, companyId: string) {
    const client = await this.repo.findOne({
      where: [...this.visibleTo(companyId).map((w) => ({ id, ...w }))],
      relations: ['directions', 'references'],
    });
    if (!client) throw new NotFoundException();
    return client;
  }

  /**
   * Proyección mínima para otros módulos (ej. credits) que solo necesitan
   * confirmar que un cliente es visible para esta empresa y leer un par de
   * campos, sin acoplarse a un Repository<Client> propio ni cargar relaciones.
   *
   * Acepta el padrón compartido (`company_id IS NULL`), que es justamente lo
   * que Credits necesita para poder estudiar crédito contra un cliente global.
   * Un cliente de otra empresa sigue dando NotFound.
   */
  async findBasicInTenant(id: string, companyId: string) {
    const client = await this.repo.findOne({
      where: [...this.visibleTo(companyId).map((w) => ({ id, ...w }))],
      select: ['id', 'documentNumber'],
    });
    if (!client) throw new NotFoundException('Cliente no encontrado en esta empresa');
    return client;
  }

  async create(companyId: string, dto: CreateClientDto) {
    const { directions, references, ...rest } = dto;
    return this.dataSource.transaction(async (manager) => {
      const client = await manager.save(manager.create(Client, { ...rest, companyId }));

      if (Array.isArray(directions) && directions.length > 0) {
        await manager.save(
          ClientDirection,
          directions.map((d) =>
            manager.create(ClientDirection, {
              companyId,
              client,
              type: d.kind === 'despacho' ? ClientDirectionType.DESPACHO : ClientDirectionType.PRINCIPAL,
              address: d.address,
              department: d.department,
              city: d.city,
              postalCode: d.postalCode,
              phone: d.phone,
              contactFirstName: d.contactFirstName,
              contactSecondName: d.contactSecondName,
              contactFirstLastName: d.contactFirstLastName,
              contactSecondLastName: d.contactSecondLastName,
              description: d.description,
            }),
          ),
        );
      }

      if (Array.isArray(references) && references.length > 0) {
        await manager.save(
          ClientReference,
          references.map((r, idx) =>
            manager.create(ClientReference, {
              companyId,
              client,
              sequence: idx + 1,
              entity: r.entity,
              address: r.address,
              department: r.department,
              city: r.city,
              phone: r.phone,
              creditLimit: r.creditLimit,
            }),
          ),
        );
      }

      const created = await manager.getRepository(Client).findOne({
        where: { id: client.id, companyId },
        relations: ['directions', 'references'],
      });
      if (!created) throw new NotFoundException();
      return created;
    });
  }

  async update(id: string, companyId: string, dto: UpdateClientDto) {
    const client = await this.ownedByTenant(id, companyId);
    Object.assign(client, dto);
    return this.repo.save(client);
  }

  async toggleStatus(id: string, companyId: string) {
    const client = await this.ownedByTenant(id, companyId);
    client.status = client.status === ClientStatus.ACTIVE ? ClientStatus.INACTIVE : ClientStatus.ACTIVE;
    return this.repo.save(client);
  }

  async remove(id: string, companyId: string) {
    const client = await this.ownedByTenant(id, companyId);

    await this.dataSource.transaction(async (manager) => {
      await manager.getRepository(ClientDirection).softDelete({ clientId: id, companyId });
      await manager.getRepository(ClientReference).softDelete({ clientId: id, companyId });
      await manager.getRepository(Client).softDelete({ id, companyId });
    });

    return { success: true };
  }

  /**
   * Localiza un cliente para escribir sobre él, exigiendo que sea de esta
   * empresa. Los clientes del padrón compartido (`company_id IS NULL`) son
   * visibles pero no administrables por una empresa: se editan desde el
   * control del padrón, no desde un tenant.
   *
   * Sin este chequeo, `where: { id, companyId }` sobre una fila global no
   * encuentra nada y la empresa recibe un 404 genérico, que en la UI se lee
   * como "el cliente no existe" cuando sí existe y lo tiene abierto en la
   * pantalla de al lado. Un 403 dice qué está pasando.
   */
  private async ownedByTenant(id: string, companyId: string) {
    const client = await this.repo.findOne({ where: { id, companyId } });
    if (client) return client;

    const shared = await this.repo.findOne({ where: { id, companyId: IsNull() }, select: ['id'] });
    if (shared) {
      throw new ForbiddenException(
        'Este cliente pertenece al padrón compartido y se administra de forma centralizada. ' +
          'No puede ser modificado ni desactivado desde una empresa.',
      );
    }

    throw new NotFoundException();
  }
}