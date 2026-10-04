import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Convierte `clients` en un padrón compartido: los 17 registros reales quedan
 * con `company_id = NULL`, visibles para todas las empresas, y se retiran los
 * clientes ficticios de `1700000012000-SeedClients` que estén libres.
 *
 * Ojo con el borrado: de los 5 clientes del seed, solo 3 se van. Los otros 2
 * (Carlos Andrés Martínez López y María Fernanda Gómez Ruiz) tienen 9 créditos
 * y 10 documentos asociados, 5 de ellos ya firmados, y conservarlos era
 * explícito. La base queda con 19 clientes: los 17 del padrón más esos 2.
 *
 * Por qué una migración nueva y no editar `SeedClients`: esa ya corrió en las
 * bases de desarrollo existentes. Editarla no revertiría nada allá — el borrado
 * tiene que viajar en una migración posterior para que aplique en todos lados.
 *
 * ------------------------------------------------------------------
 * RLS: POR QUÉ ESTA MIGRACIÓN SETEA EL GUC DE TENANT
 * ------------------------------------------------------------------
 * `1700000014500-RlsHardening` aplica `FORCE ROW LEVEL SECURITY` sobre
 * `clients`, `credits` y `credit_documents` (líneas 21-33 y 64). El comentario
 * de esa migración (líneas 15-16) afirma que "la tabla owner sigue exento de
 * RLS por diseño de Postgres"; no es así: `FORCE ROW LEVEL SECURITY` somete
 * también al owner a las políticas. Solo lo saltan superusuario y roles
 * BYPASSRLS.
 *
 * Las migraciones corren como `DB_USER`, que es owner (`data-source.ts:16`).
 * Por eso los INSERT/DELETE de esta migración están sujetos a la política
 * `company_id = current_setting('app.current_company_id', true)::uuid`. Con el
 * GUC sin setear, `current_setting(..., true)` devuelve NULL, la comparación da
 * NULL y la fila queda filtrada: el INSERT fallaría por violación de política y
 * los DELETE afectarían 0 filas en silencio.
 *
 * `1700000012000-SeedClients` no sufrió esto porque corre con timestamp
 * `12000`, antes del hardening `14500`: para cuando insertaba, RLS estaba solo
 * `ENABLE`d y el owner lo bypassaba. Esta migración corre después, así que sí
 * necesita el GUC.
 *
 * El GUC se setea a nivel de sesión (is_local=false, igual que
 * `TenantContextInterceptor:20`) y se limpia con `RESET` en un `finally`, para
 * que una conexión del pool no arrastre el tenant de una migración a un request
 * posterior. Alternativa descartada: `set_config(..., true)` sería más limpio,
 * pero solo es válido dentro de una transacción; si alguien configura
 * `migrationsTransactionMode` distinto, el scoping se pierde en silencio.
 *
 * Los 5 clientes ficticios están repartidos entre dos empresas (3 en la Uno,
 * 2 en la Dos), así que el borrado tiene que iterar las empresas cambiando el
 * GUC: con un único contexto, los de la otra empresa quedarían invisibles.
 * `companies` no tiene RLS, así que se puede listar sin contexto.
 *
 * ------------------------------------------------------------------
 * ESTE CAMBIO HACE `clients` MULTIEMPRESA, COMO `modules` Y `users`
 * ------------------------------------------------------------------
 * Los 17 clientes quedan como un padrón compartido: se insertan con
 * `company_id = NULL` y quedan visibles para todas las empresas, en lugar de
 * pertenecer a la Empresa Uno como en el borrador anterior de esta migración.
 *
 * `clients.company_id` era NOT NULL (`0000000000001-CreateTables`, línea 16) y
 * la política `tenant_isolation_clients` solo permitía el tenant activo. Se
 * copia aquí el patrón que el proyecto ya usa dos veces para el mismo problema:
 *
 *   - `modules`  → `company_id` nullable y política con `company_id IS NULL`
 *     (`1700000012000-ModuleSystem`, líneas 12 y 27-29).
 *   - `users`    → `ALTER COLUMN company_id DROP NOT NULL` y política con
 *     `company_id IS NULL` (`1700000013000-SuperadminNoCompany`, líneas 13 y
 *     24-26).
 *
 * NO se desactiva RLS. `1700000014500-RlsHardening` la convirtió en la
 * segunda capa de contención del modelo OWASP/ISO del commit `6c6ca14`, y
 * `clients` es la tabla con los datos personales más sensibles (nombre,
 * cédula, teléfono, correo). Perderla ahí para resolver un problema que tiene
 * una solución de dos sentencias sería exactamente lo contrario de lo que se
 * busca.
 *
 * Con la política nueva, el RLS deja de decidir quién ve al cliente global —
 * eso lo hace el servicio (ver `ClientsService.findAll`, que ahora incluye
 * `company_id IS NULL`). Lo que RLS sigue garantizando es lo importante:
 * que una empresa nunca vea los clientes de OTRA empresa. Un `company_id`
 * concreto ajeno sigue filtrado tanto en USING como en WITH CHECK.
 *
 * Sobre quién puede crear clientes globales: el `WITH CHECK` admite
 * `company_id IS NULL` porque es el único modo de que la migración y cualquier
 * carga masiva inserte filas globales. Eso deja abierta la escalada de
 * privilegios a nivel de código (un INSERT con NULL es visible para todos), y
 * la primera capa la aporta `ClientsService.create`, que pisa `companyId` con
 * el tenant del token DESPUÉS del spread del DTO, de modo que ni un campo
 * `companyId` en el body puede colarlo. `UpdateClientDto` ni siquiera declara
 * `companyId`. Si alguna vez se quiere endurecer esto en la base, el camino es
 * una política `AS RESTRICTIVE ... WITH CHECK (company_id IS NOT NULL)` para el
 * rol de aplicación, y una excepción para el owner; no se aplicó acá para no
 * inventar un rol que el proyecto no tiene.
 *
 * Sobre `person_type`: el enunciado los describía como persona natural, pero
 * INVERSIONES CONSTRUFACIL SAS y DISTRISOLLA FILANDIA SAS son sociedades. Se
 * guardan como `juridica` porque el flujo de estudio de crédito filtra por
 * persona natural/jurídica (`CreditStudyPage`) y un SAS marcado `natural` no
 * aparecería nunca en el estudio de una empresa. Si de verdad se requieren
 * todos como `natural`, es cambiar el literal en esas dos filas.
 *
 * Sobre `document_number`: se guarda exactamente el número entregado, sin
 * manipular dígitos. `dv` solo se completa para los NIT, que son 9 dígitos +
 * dígito de verificación por definición; en las cédulas el DV viaja dentro del
 * propio número (convención que ya usa `SeedClients` con '1023456789').
 *
 * `down()` no es un espejo exacto: borra los 17 y restaura el esquema y la
 * política previos, pero no resucita los 5 ficticios que `up()` retiró. Eso es
 * intencional — volver a sembrar datos ficticios en un rollback es peor que
 * dejar la base sin esos clientes. Lo que sí hace es fallar con un mensaje
 * claro si queda alguna otra fila global que impediría volver a NOT NULL.
 */
export class SharedClientPool1700000019000 implements MigrationInterface {
  name = 'SharedClientPool1700000019000';

  /**
   * Los 5 clientes ficticios de `SeedClients1700000012000`. No todos se van:
   * el DELETE de `up()` filtra los que tengan créditos asociados, porque 2 de
   * estos tienen 9 créditos (5 firmados) y 10 documentos que hay que conservar.
   */
  private static readonly LEGACY_CLIENT_IDS = [
    'aaaaaaaa-aaaa-4aaa-aaaa-aaaaaaaaaa01',
    'aaaaaaaa-aaaa-4aaa-aaaa-aaaaaaaaaa02',
    'aaaaaaaa-aaaa-4aaa-aaaa-aaaaaaaaaa03',
    'aaaaaaaa-aaaa-4aaa-aaaa-aaaaaaaaaa04',
    'aaaaaaaa-aaaa-4aaa-aaaa-aaaaaaaaaa05',
  ];

  /** Los 17 documentos, para que `down()` sea simétrico con `up()`. */
  private static readonly DOCUMENTS = [
    '91067726',
    '901633636',
    '1083020601',
    '1073160315',
    '43922106',
    '11276427',
    '19301587',
    '52183825',
    '79237113',
    '52788673',
    '1019017240',
    '1014212939',
    '80723560',
    '42152759',
    '66961271',
    '29831610',
    '901490276',
  ];

  public async up(queryRunner: QueryRunner): Promise<void> {
    try {
      // ----------------------------------------------------------------
      // 1. Esquema: `clients.company_id` pasa a nullable.
      //
      // Es el mismo ALTER de `1700000013000-SuperadminNoCompany` (línea 13),
      // aplicado a la columna que el RLS va a necesitar para distinguir un
      // cliente compartido de uno propio de una empresa. El orden importa: la
      // política de abajo referencia `IS NULL`, que hoy la columna no admite
      // como valor real (aunque el predicado sea válido sintácticamente).
      // ----------------------------------------------------------------
      await queryRunner.query(`ALTER TABLE clients ALTER COLUMN company_id DROP NOT NULL`);

      // ----------------------------------------------------------------
      // 2. RLS: se rehace la política de `clients` con la rama global.
      //
      // Copia de `tenant_isolation_users` (`1700000013000`, líneas 24-26).
      // Se traduce en dos efectos y conviene tenerlos presentes:
      //
      //   - USING permite leer los clientes globales desde cualquier empresa.
      //   - WITH CHECK sigue rechazando el company_id de OTRA empresa, así que
      //     una empresa no puede adueñarse un cliente global como propio ni,
      //     al revés, colarse en filas ajenas. La aislación entre competidores
      //     es la propiedad que no se negocia y sigue garantizada por la base.
      //
      // En la siguiente línea de orden de migración, `1700000012000-ModuleSystem`
      // usa el mismo predicado sobre `modules`.
      // ----------------------------------------------------------------
      await queryRunner.query(`DROP POLICY IF EXISTS tenant_isolation_clients ON clients`);
      await queryRunner.query(`
        CREATE POLICY tenant_isolation_clients ON clients
        USING (company_id IS NULL OR company_id = current_setting('app.current_company_id', true)::uuid)
        WITH CHECK (company_id IS NULL OR company_id = current_setting('app.current_company_id', true)::uuid);
      `);

      // ----------------------------------------------------------------
      // 3. Alta de los 17 clientes del padrón compartido.
      //
      // Van con `company_id = NULL`. El GUC no hace falta para escribirlos: la
      // rama `company_id IS NULL` del WITH CHECK los admite con cualquier
      // contexto, y por eso el `setTenant` inicial se hace recién antes del
      // borrado de los ficticios, que sí es por empresa.
      //
      // `document_number` tiene UNIQUE global (UQ_e9a9c65032a13279f68ba077fc3,
      // 0000000000001-CreateTables línea 16), no por empresa: un mismo
      // documento no puede repetirse entre tenants. Por eso el ON CONFLICT
      // va sobre document_number y no sobre id — un re-run con los mismos
      // datos no duplica y, si alguien ya había cargado ese documento con
      // otro id, tampoco choca.
      //
      // Sin el guard SEED_DEMO_DATA que usa `SeedClients`: estos no son datos
      // de demostración, son clientes reales y deben existir en cualquier
      // entorno, incluida producción.
      // ----------------------------------------------------------------
      await queryRunner.query(`
        INSERT INTO clients (
          id, company_id, full_name, document_number, document_type, dv, person_type,
          first_name, second_name, first_last_name, second_last_name,
          commercial_name,
          economic_activity_code, economic_activity_description,
          status
        ) VALUES
          -- 1. Natural · CC 91067726
          ('dddd0001-0000-4000-8000-000000000001', NULL,
           'RIVERO GOMEZ ORLANDO', '91067726', 'cc', NULL, 'natural',
           'Orlando', NULL, 'Rivero', 'Gomez',
           'Orlando Rivero',
           '4711', 'Comercio al por menor en establecimientos no especializados',
           'active'),
          -- 2. Jurídica · NIT 901633636 (DV 9)
          ('dddd0002-0000-4000-8000-000000000002', NULL,
           'INVERSIONES CONSTRUFACIL SAS', '901633636', 'nit', '9', 'juridica',
           NULL, NULL, NULL, NULL,
           'INVERSIONES CONSTRUFACIL',
           '4291', 'Almacenamiento de materiales para construcción',
           'active'),
          -- 3. Natural · CC 1083020601
          ('dddd0003-0000-4000-8000-000000000003', NULL,
           'DIAZ BOLAÑO DAVID SANTIAGO', '1083020601', 'cc', NULL, 'natural',
           'David', 'Santiago', 'Diaz', 'Bolaño',
           'David Diaz',
           '4711', 'Comercio al por menor en establecimientos no especializados',
           'active'),
          -- 4. Natural · CC 1073160315
          ('dddd0004-0000-4000-8000-000000000004', NULL,
           'CLAVIJO OVALLE ANGIE CAROLINA', '1073160315', 'cc', NULL, 'natural',
           'Angie', 'Carolina', 'Clavijo', 'Ovalle',
           'Angie Clavijo',
           '4711', 'Comercio al por menor en establecimientos no especializados',
           'active'),
          -- 5. Natural · CC 43922106
          ('dddd0005-0000-4000-8000-000000000005', NULL,
           'GOMEZ CARDONA SIRLEY LILIANA', '43922106', 'cc', NULL, 'natural',
           'Sirley', 'Liliana', 'Gomez', 'Cardona',
           'Sirley Gomez',
           '4711', 'Comercio al por menor en establecimientos no especializados',
           'active'),
          -- 6. Natural · CC 11276427
          ('dddd0006-0000-4000-8000-000000000006', NULL,
           'RINCON LEON JIMMY ALEXANDER', '11276427', 'cc', NULL, 'natural',
           'Jimmy', 'Alexander', 'Rincon', 'Leon',
           'Jimmy Rincon',
           '4711', 'Comercio al por menor en establecimientos no especializados',
           'active'),
          -- 7. Natural · CC 19301587
          ('dddd0007-0000-4000-8000-000000000007', NULL,
           'OJEDA RODRIGUEZ CARLOS ARTURO', '19301587', 'cc', NULL, 'natural',
           'Carlos', 'Arturo', 'Ojeda', 'Rodriguez',
           'Carlos Ojeda',
           '4711', 'Comercio al por menor en establecimientos no especializados',
           'active'),
          -- 8. Natural · CC 52183825
          ('dddd0008-0000-4000-8000-000000000008', NULL,
           'MURCIA DIAZ LUCERO', '52183825', 'cc', NULL, 'natural',
           'Lucero', NULL, 'Murcia', 'Diaz',
           'Lucero Murcia',
           '4711', 'Comercio al por menor en establecimientos no especializados',
           'active'),
          -- 9. Natural · CC 79237113
          ('dddd0009-0000-4000-8000-000000000009', NULL,
           'ALVARADO ALVARADO JORGE HUMBERTO', '79237113', 'cc', NULL, 'natural',
           'Jorge', 'Humberto', 'Alvarado', 'Alvarado',
           'Jorge Alvarado',
           '4711', 'Comercio al por menor en establecimientos no especializados',
           'active'),
          -- 10. Natural · CC 52788673
          ('dddd0010-0000-4000-8000-000000000010', NULL,
           'PINEDA ROMERO ANGELICA MARIA', '52788673', 'cc', NULL, 'natural',
           'Angelica', 'Maria', 'Pineda', 'Romero',
           'Angelica Pineda',
           '4711', 'Comercio al por menor en establecimientos no especializados',
           'active'),
          -- 11. Natural · CC 1019017240
          ('dddd0011-0000-4000-8000-000000000011', NULL,
           'ESPINOSA MACIAS PABLO ENRIQUE', '1019017240', 'cc', NULL, 'natural',
           'Pablo', 'Enrique', 'Espinosa', 'Macias',
           'Pablo Espinosa',
           '4711', 'Comercio al por menor en establecimientos no especializados',
           'active'),
          -- 12. Natural · CC 1014212939
          ('dddd0012-0000-4000-8000-000000000012', NULL,
           'RODRIGUEZ COQUECO ERIKA JOHANNA', '1014212939', 'cc', NULL, 'natural',
           'Erika', 'Johanna', 'Rodriguez', 'Coqueco',
           'Erika Rodriguez',
           '4711', 'Comercio al por menor en establecimientos no especializados',
           'active'),
          -- 13. Natural · CC 80723560
          ('dddd0013-0000-4000-8000-000000000013', NULL,
           'CASTELLANOS WITTINGHAN CARLOS ANDRES', '80723560', 'cc', NULL, 'natural',
           'Carlos', 'Andres', 'Castellanos', 'Wittinghan',
           'Carlos Castellanos',
           '4711', 'Comercio al por menor en establecimientos no especializados',
           'active'),
          -- 14. Natural · CC 42152759
          ('dddd0014-0000-4000-8000-000000000014', NULL,
           'MEDINA DUQUE ANA MARIA', '42152759', 'cc', NULL, 'natural',
           'Ana', 'Maria', 'Medina', 'Duque',
           'Ana Medina',
           '4711', 'Comercio al por menor en establecimientos no especializados',
           'active'),
          -- 15. Natural · CC 66961271
          ('dddd0015-0000-4000-8000-000000000015', NULL,
           'GUERRERO ALZATE ILDA MERY', '66961271', 'cc', NULL, 'natural',
           'Ilda', 'Mery', 'Guerrero', 'Alzate',
           'Ilda Guerrero',
           '4711', 'Comercio al por menor en establecimientos no especializados',
           'active'),
          -- 16. Natural · CC 29831610
          ('dddd0016-0000-4000-8000-000000000016', NULL,
           'HERRERA SANDRA MILENA', '29831610', 'cc', NULL, 'natural',
           'Sandra', 'Milena', 'Herrera', NULL,
           'Sandra Herrera',
           '4711', 'Comercio al por menor en establecimientos no especializados',
           'active'),
          -- 17. Jurídica · NIT 901490276 (DV 5)
          ('dddd0017-0000-4000-8000-000000000017', NULL,
           'DISTRISOLLA FILANDIA SAS', '901490276', 'nit', '5', 'juridica',
           NULL, NULL, NULL, NULL,
           'DISTRISOLLA FILANDIA',
           '4665', 'Venta al por mayor de alimentos',
           'active')
        ON CONFLICT (document_number) DO NOTHING;
      `);

      // ----------------------------------------------------------------
      // 4. Retiro de los clientes ficticios sin créditos, empresa por empresa.
      //
      // NO se borran los 5 de una. En la base de desarrollo hay 9 créditos
      // (5 en estado 'signed', con su documento firmado) apuntando a 2 de
      // ellos — Carlos Andrés Martínez López (aaaa...03) y María Fernanda
      // Gómez Ruiz (aaaa...05). Borrar esos clientes arrastraría los créditos
      // y sus 10 documentos en cascada, y 5 de esos créditos ya están
      // firmados: evidencia que no se pierde. Esos 2 se conservan y quedan
      // conviviendo con el padrón compartido.
      //
      // Por eso el borrado se autoprotege con NOT EXISTS en vez de borrar
      // primero los créditos y luego los clientes. Antes, el orden
      // créditos→clientes resolvía el FK `credits.client_id` ON DELETE NO
      // ACTION (0000000000001-CreateTables, línea 29), pero al precio de
      // destruir datos. Ahora el DELETE no toca clientes con créditos y el FK
      // nunca llega a dispararse.
      //
      // El `NOT EXISTS` es correcto aun con RLS activo: el subquery sobre
      // `credits` solo ve los créditos del tenant seteado, y el DELETE sobre
      // `clients` solo alcanza filas de ese mismo tenant. Al iterar todas las
      // empresas, cada cliente ficticio se evalúa en su propio contexto y
      // sobrevive si tiene créditos.
      //
      // Los ficticios son de empresa, así que para borrarlos hay que cambiar el
      // GUC: con un único contexto, los de la otra empresa quedan fuera del
      // USING y el DELETE se lleva 0 filas en silencio, sin error.
      // `companies` no tiene RLS, así que se puede listar sin contexto.
      // ----------------------------------------------------------------
      const companies = await queryRunner.query(`SELECT id FROM companies ORDER BY id`);
      for (const { id } of companies) {
        await this.setTenant(queryRunner, id);
        await queryRunner.query(
          `DELETE FROM clients
             WHERE id = ANY($1::uuid[])
               AND NOT EXISTS (SELECT 1 FROM credits WHERE credits.client_id = clients.id)`,
          [SharedClientPool1700000019000.LEGACY_CLIENT_IDS],
        );
      }
    } finally {
      await queryRunner.query(`RESET app.current_company_id`);
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    try {
      // Los créditos sí son por empresa, así que el borrado de créditos tiene
      // que iterar igual. Los clientes, en cambio, ya son globales y la
      // política restaurada abajo todavía les deja pasar por la rama IS NULL,
      // por eso el DELETE de clientes va una sola vez y fuera del bucle.
      const companies = await queryRunner.query(`SELECT id FROM companies ORDER BY id`);
      for (const { id } of companies) {
        await this.setTenant(queryRunner, id);
        await queryRunner.query(
          `DELETE FROM credits WHERE client_id IN (
             SELECT id FROM clients WHERE document_number = ANY($1::varchar[])
           )`,
          [SharedClientPool1700000019000.DOCUMENTS],
        );
      }

      // Un DELETE de clientes global no necesita GUC —la rama IS NULL de la
      // política vigente lo admite con contexto vacío—, pero se resetea el
      // GUC antes para no depender del residuo del último `setTenant`.
      await queryRunner.query(`RESET app.current_company_id`);
      await queryRunner.query(`DELETE FROM clients WHERE document_number = ANY($1::varchar[])`, [
        SharedClientPool1700000019000.DOCUMENTS,
      ]);

      // ----------------------------------------------------------------
      // Restaura el esquema y la política previos. El orden importa: primero
      // la política estricta, después el NOT NULL. Al revés, el ALTER fallaría
      // con "column contains null values" sin señalar la causa real.
      // ----------------------------------------------------------------
      await queryRunner.query(`DROP POLICY IF EXISTS tenant_isolation_clients ON clients`);
      await queryRunner.query(`
        CREATE POLICY tenant_isolation_clients ON clients
        USING (company_id = current_setting('app.current_company_id', true)::uuid)
        WITH CHECK (company_id = current_setting('app.current_company_id', true)::uuid);
      `);

      // Si quedó algún otro cliente global —creado por la app entre `up()` y
      // `down()`— el SET NOT NULL fallaría con un error que no dice qué fila
      // molesta. Se chequea antes para dar un mensaje accionable.
      const [{ count }] = await queryRunner.query(`SELECT count(*)::int AS count FROM clients WHERE company_id IS NULL`);
      if (count > 0) {
        throw new Error(
          `No se puede revertir SharedClientPool1700000019000: quedan ${count} clientes globales ` +
            `que no son parte de esta migración. Reasígnalos a una empresa antes de revertir.`,
        );
      }

      await queryRunner.query(`ALTER TABLE clients ALTER COLUMN company_id SET NOT NULL`);
    } finally {
      await queryRunner.query(`RESET app.current_company_id`);
    }
  }

  /**
   * Mismo mecanismo que `TenantContextInterceptor` (línea 20) para que las
   * políticas `tenant_isolation_*` vean el tenant. Sin esto, y con el
   * `FORCE ROW LEVEL SECURITY` de `1700000014500`, la migración no escribiría
   * nada. Ver la nota de RLS en el docstring de la clase.
   */
  private async setTenant(queryRunner: QueryRunner, companyId: string): Promise<void> {
    await queryRunner.query(`SELECT set_config('app.current_company_id', $1, false)`, [
      companyId,
    ]);
  }
}