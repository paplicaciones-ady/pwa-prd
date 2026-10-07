import { BadRequestException, ConflictException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectDataSource, InjectRepository } from '@nestjs/typeorm';
import { DataSource, IsNull, Repository } from 'typeorm';
import { Client, ClientDocumentType, ClientStatus } from './entities/client.entity';
import { ClientDirection, ClientDirectionType } from './entities/client-direction.entity';
import { ClientReference } from './entities/client-reference.entity';
import { CreateClientDto } from './dto/create-client.dto';
import { UpdateClientDto } from './dto/update-client.dto';
import { CreateSharedClientDto } from './dto/create-shared-client.dto';
import { clampPagination } from '../../commons/dto/pagination.dto';
import { calcNitDv, isValidFullNit } from '../../commons/utils/nit';

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
    Object.assign(rest, nitFields(rest.documentType, rest.documentNumber));
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
    Object.assign(client, dto, nitFields(client.documentType, dto.documentNumber));
    return this.repo.save(client);
  }

  // --- Padrón compartido (company_id NULL): lo administra solo el superadmin ---
  // Las empresas lo ven en solo lectura (ver ownedByTenant). El control de que
  // quien llama es superadmin está en el controller.

  findShared() {
    return this.repo.find({ where: { companyId: IsNull() }, order: { fullName: 'ASC' } });
  }

  async createShared(dto: CreateSharedClientDto) {
    const nit = nitFields(dto.documentType, dto.documentNumber);
    await this.ensureDocumentFree(dto.documentNumber);
    return this.repo.save(this.repo.create({ ...dto, ...nit, companyId: null }));
  }

  async updateShared(id: string, dto: UpdateClientDto) {
    const client = await this.sharedOrFail(id);
    const nit = nitFields(client.documentType, dto.documentNumber);
    if (dto.documentNumber && dto.documentNumber !== client.documentNumber) {
      await this.ensureDocumentFree(dto.documentNumber);
    }
    Object.assign(client, dto, nit);
    return this.repo.save(client);
  }

  /** document_number es único en toda la tabla: se valida antes para responder 409 y no un 500. */
  private async ensureDocumentFree(documentNumber: string) {
    const taken = await this.repo.findOne({ where: { documentNumber }, withDeleted: true, select: ['id'] });
    if (taken) throw new ConflictException('Ya existe un cliente con ese número de documento');
  }

  async toggleSharedStatus(id: string) {
    const client = await this.sharedOrFail(id);
    client.status = client.status === ClientStatus.ACTIVE ? ClientStatus.INACTIVE : ClientStatus.ACTIVE;
    return this.repo.save(client);
  }

  private async sharedOrFail(id: string) {
    const client = await this.repo.findOne({ where: { id, companyId: IsNull() } });
    if (!client) throw new NotFoundException('Cliente del padrón compartido no encontrado');
    return client;
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

/**
 * Un NIT se digita y se guarda completo, con DV y sin '-' (9014902765). Si el
 * documento es NIT se valida el DV y se deja también en la columna `dv`.
 * Devuelve los campos a fusionar ({} si no aplica).
 */
function nitFields(documentType: string | null | undefined, documentNumber: string | undefined): { dv?: string } {
  if (documentType !== ClientDocumentType.NIT || !documentNumber) return {};
  if (!isValidFullNit(documentNumber)) {
    const hint = /^\d{9,16}$/.test(documentNumber) ? ` (con ese número, el DV sería ${calcNitDv(documentNumber.slice(0, -1))})` : '';
    throw new BadRequestException(`El NIT va completo, con su DV al final y sin '-'${hint}`);
  }
  return { dv: documentNumber.slice(-1) };
}
