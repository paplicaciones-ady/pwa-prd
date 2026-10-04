# Guía técnica: alta de un módulo funcional en `pwa-app`

> Proceso completo, de principio a fin, para crear un módulo nuevo (backend NestJS + frontend React),
> registrarlo en el sistema de módulos, darle permisos RBAC y distribuirlo entre empresas.
> El paradigma y la API del sistema de módulos están en [MODULE-SYSTEM.md](MODULE-SYSTEM.md);
> credenciales y procedimientos de prueba en [TEST-GUIDE.md](TEST-GUIDE.md).

---

## 0. Mapa rápido

Un módulo son **cuatro piezas** que se conectan por nombre. Si una no coincide, el módulo no aparece o
devuelve `403`/404.

```
                         ┌──────────────────────── mismo nombre: <module> ─────────────────────────┐
                         │                                                                          │
Backend    @Controller('<module>')  ──►  /api/<module>/...      permisos  <module>.<operation>      │
Frontend   modules/<carpeta>/<carpeta>.routes.tsx  { module: '<module>', basePath: '/<path>' }  ────┤
           modules/registry/index.ts  → App.tsx genera <Route> + <RequirePerm module perm>          │
BD         modules (key, module, path, operations)  ← se crea desde Configuración → Módulos  ───────┘
           module_assignments (grid/fab, posición) · module_variants (overrides por empresa)
RBAC       profile_permissions  ← Perfiles → Permisos
```

Ruta de una petición: `navegador → Vite (dev) / proxy del host (prod) → Kong :8000 (/api, JWT) →
NestJS :3000 (/api/<module>/..., @Permissions)`. El backend **no publica puertos**: solo se llega por Kong.

### Nombres que deben coincidir

| Dónde | Valor | Ejemplo (créditos) |
| --- | --- | --- |
| `@Controller()` del backend | `<module>` | `@Controller('credits')` |
| Prefijo de permisos | `<module>.` | `credits.read`, `credits.study` |
| `getPermissionsByPrefix(..., '<module>')` en `context` | `<module>` | `'credits'` |
| `FrontendModule.module` en `*.routes.tsx` | `<module>` | `module: 'credits'` |
| `moduleContexts['<module>']` en las páginas | `<module>` | `moduleContexts['credits']` |
| Columna `modules.module` en BD | `<module>` | se autocompleta desde el registro |
| Columna `modules.path` en BD | una ruta del registro | `/credits` |
| Columna `modules.key` en BD | libre | `creditos` (**no** se usa en permisos ni rutas) |

> ⚠️ `key` ≠ `module`. `key` es solo el identificador del registro en BD; todo lo demás (API, permisos,
> contexto, registro frontend) usa `module`.

### Qué NO hay que tocar

- **Kong** (`backend/kong/kong.yml.tpl`): la ruta comodín `/api` ya cubre `/api/<module>/...` con JWT,
  CORS, rate-limit (100/min) y límite de body (6 MB). Solo se edita si el módulo necesita un endpoint
  **público** (sin JWT), otro rate-limit o bodies > 6 MB. `kong.yml` se genera desde el `.tpl` (`start.sh`) y
  está en `.gitignore`.
- **SQL manual** para dar de alta el módulo: se hace desde la GUI.
- **`App.tsx`**: las rutas de módulos se generan desde el registro.

---

## 1. Herramientas y entorno

| Herramienta | Uso | Notas |
| --- | --- | --- |
| `npm` | build, dev, migraciones | El repo usa `package-lock.json`. |
| Docker Compose | PostgreSQL, Redis, Kong, backend, frontend | `docker-compose.yml` (dev), `docker-compose.prod.yml` |
| Kong 3.6 | Gateway en `127.0.0.1:8000` (admin `:8001`) | Modo declarativo, sin BD |
| PostgreSQL 16 | `127.0.0.1:5433` (dev nativo) | RLS por empresa |
| Redis | `127.0.0.1:6379` | Caché RBAC, rate-limit de Kong |

---

## 2. Flujo general

| # | Paso | Dónde | Resultado |
| --- | --- | --- | --- |
| 1 | Definir `module`, `path` y operaciones | Papel / PR | Tabla de decisión + catálogo `<module>.*` |
| 2 | Backend | `backend/src/modules/<module>/` + `app.module.ts` | `GET /api/<module>/context` + endpoints protegidos |
| 3 | Persistencia con RLS *(opcional)* | Entidad + migración | Tabla aislada por `company_id` |
| 4 | Frontend | `frontend/src/modules/<carpeta>/` + `modules/registry/index.ts` | Pantallas registradas con `RequirePerm` |
| 5 | Registrar el módulo | GUI: Configuración → Módulos | Filas en `modules` + `module_assignments` + permisos en catálogo |
| 6 | Asignar permisos | GUI: Perfiles → Permisos | Usuarios con acceso |
| 7 | Publicar / variantes *(opcional)* | GUI (superadmin) | Distribución entre empresas |
| 8 | Verificar end-to-end | Navegador + `curl` vía Kong | `403` sin permiso, `200` y tile visible con permiso |

---

## 3. Paso 1 — Definir el módulo y sus operaciones

Es el paso que condiciona todo lo demás. Al registrar el módulo, el backend crea **un permiso por
operación** con el formato `<module>.<action>` (`registerModulePermissions`,
[rbac.service.ts:40](backend/src/modules/rbac/rbac.service.ts#L40)).

### 3.1 Convenciones

- **`module`**: minúsculas, sin puntos; guiones permitidos (`new-products`). Será la URL de la API y el
  prefijo de permisos. No puede contener `.` (el frontend separa `module.accion` por el primer punto).
- **`path`**: ruta interna de la SPA, normalmente `/<module>`. El backend valida el formato
  (`^\/(?:[A-Za-z0-9_-]+\/?)*$`): rechaza URLs externas, `//host`, espacios o `javascript:`.
- **Operaciones (`action`)**: verbos en inglés para módulos nuevos — CRUD (`read`, `create`, `update`,
  `delete`) y de negocio (`export`, `approve`, `send`, `study`…). Existen módulos de prueba con acciones en
  español (`promos.ver`, `catalog.cargar`, `calculator.sumar`); no son el patrón a seguir.
- **`name`**: texto visible de la operación en Perfiles → Permisos (`Ver`, `Crear`…).

### 3.2 Reglas que valida el sistema

1. **`read` obligatorio** si hay `update` o `delete` (formulario y `validateOperations` del service).
2. **La primera operación define el permiso del tile** en Home/FAB/Sidebar: el backend calcula
   `perm = <module>.<operations[0].action>` (`permOf` en
   [module-placements.service.ts:58](backend/src/modules/placements/module-placements.service.ts#L58)).
   Pon `read` primero.
3. Los permisos se crean **sin asignar a ningún perfil**: nadie ve el módulo hasta el Paso 6.
4. Mínimo viable para un módulo pequeño: `read` + `create`.

### 3.3 Plantilla de decisión (rellenar antes de escribir código)

| Campo | Valor | Notas |
| --- | --- | --- |
| `module` | | API, permisos, registro frontend |
| `key` | | Único entre globales (índice en BD); en empresa no se valida: evita duplicados |
| `label` | | Nombre visible |
| `path` (home) | `/<module>` | Debe existir en el registro frontend |
| Alcance | Empresa / Global | Global solo lo crea el superadmin |
| Ubicación | `grid` (Home) / `fab` | Publicaciones en otras empresas siempre `fab` |
| `operations[]` | `[{action,name}, …]` | `read` primero |
| ¿Persistencia? | Sí / No | Si sí → Paso 3 |

| `action` | `name` | Endpoint | Pantalla (`perm` de la ruta) |
| --- | --- | --- | --- |
| `read` | Ver | `GET /api/<module>/items` | `/<module>` |
| `create` | Crear | `POST /api/<module>/items` | `/<module>/new` |
| `update` | Editar | `PATCH /api/<module>/items/:id` | `/<module>/:id/edit` |
| `delete` | Eliminar | `DELETE /api/<module>/items/:id` | — (botón) |
| `export` | Exportar | `GET /api/<module>/export` | — (botón) |

---

## 4. Paso 2 — Backend

Patrón de referencia: `backend/src/modules/catalog/` (sin persistencia) y `credits/` (con persistencia).

```
backend/src/modules/<module>/
├── <module>.module.ts
├── <module>.controller.ts
├── <module>.service.ts
├── dto/
│   └── <entidad>.dto.ts
└── entities/                # solo si hay persistencia (Paso 3)
    └── <entidad>.entity.ts
```

### 4.1 Módulo Nest

```ts
import { Module } from '@nestjs/common';
// import { TypeOrmModule } from '@nestjs/typeorm';          // ← si hay entidades
import { ProveedoresController } from './proveedores.controller';
import { ProveedoresService } from './proveedores.service';

@Module({
  // imports: [TypeOrmModule.forFeature([Proveedor])],       // ← si hay entidades
  controllers: [ProveedoresController],
  providers: [ProveedoresService],
  exports: [ProveedoresService],
})
export class ProveedoresModule {}
```

- **No importes `RbacModule`**: es `@Global()` y exporta `RbacService`.
- Las entidades se cargan solas en runtime (`autoLoadEntities: true`), pero **deben** declararse en
  `TypeOrmModule.forFeature([...])` para inyectar sus repositorios.

### 4.2 Controller

Dos tipos de endpoint:

1. **`GET <module>/context`** — sin `@Permissions`. Devuelve los permisos del usuario con prefijo
   `<module>.`. Lo usan `RequirePerm`, el Home (visibilidad del tile) y las páginas (botones).
   **Es obligatorio**: sin él, el frontend trata al usuario como sin permisos.
2. **Endpoints de negocio** — cada uno con `@Permissions('<module>.<action>')`.

```ts
import { Body, Controller, Get, Post, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../../commons/guards/jwt-auth.guard';
import { PermissionsGuard } from '../../commons/guards/permissions.guard';
import { Permissions } from '../../commons/decorators/permissions.decorator';
import { CurrentTenant } from '../../commons/decorators/current-tenant.decorator';
import { CurrentUser } from '../../commons/decorators/current-user.decorator';
import { RbacService } from '../rbac/rbac.service';
import { ProveedoresService } from './proveedores.service';
import { ProveedorDto } from './dto/proveedor.dto';

@Controller('proveedores')                       // → /api/proveedores (prefijo global 'api' en main.ts)
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class ProveedoresController {
  constructor(
    private service: ProveedoresService,
    private rbacService: RbacService,
  ) {}

  @Get('context')
  async getContext(@CurrentUser() user, @CurrentTenant() companyId: string) {
    const permissions = await this.rbacService.getPermissionsByPrefix(user.sub, companyId, 'proveedores');
    return { permissions, featureFlags: {} };
  }

  @Get('items')
  @Permissions('proveedores.read')
  list() {
    return this.service.list();
  }

  @Post('items')
  @Permissions('proveedores.create')
  add(@Body() dto: ProveedorDto) {
    return this.service.add(dto);
  }
}
```

Piezas comunes en `backend/src/commons/`:

| Pieza | Archivo | Para qué |
| --- | --- | --- |
| `JwtAuthGuard` | `guards/jwt-auth.guard.ts` | Exige sesión válida (cookie `access_token`) |
| `PermissionsGuard` + `@Permissions()` | `guards/permissions.guard.ts`, `decorators/permissions.decorator.ts` | RBAC por endpoint → `403` |
| `@CurrentUser()` | `decorators/current-user.decorator.ts` | Payload del JWT (`sub`, `profileId`…) |
| `@CurrentTenant()` | `decorators/current-tenant.decorator.ts` | `companyId` activo de la sesión |
| `BaseEntity` | `entities/base.entity.ts` | `id` uuid, `created_at`, `updated_at`, `deleted_at` |
| `PaginationQueryDto` | `dto/pagination.dto.ts` | `?page&limit` estándar |

DTOs con `class-validator` + `class-transformer` (patrón: `catalog/dto/catalog-item.dto.ts`). Usa
`@Type(() => Number)` en numéricos y `@IsUUID()` **sin versión** (los IDs seed `11111111-…` no son v4).

### 4.3 Registro en `app.module.ts`

```ts
import { ProveedoresModule } from './modules/proveedores/proveedores.module';
// ...
@Module({
  imports: [
    // ...
    CatalogModule,
    ProveedoresModule,
  ],
})
```

### 4.4 Resultado esperado

```bash
cd backend && npm run build          # nest build sin errores
```

Y un usuario autenticado **sin** permisos del módulo obtiene en `GET /api/<module>/context`:
`{ "permissions": [], "featureFlags": {} }` (ver §10.3 para la receta `curl`).

---

## 5. Paso 3 — Persistencia con RLS de tenant *(opcional)*

Omítelo si el módulo no guarda datos (como el ejemplo del Anexo A).

### 5.1 Entidad

```ts
import { Column, Entity, Index } from 'typeorm';
import { BaseEntity } from '../../../commons/entities/base.entity';

@Entity('proveedores')
export class Proveedor extends BaseEntity {
  @Index()
  @Column({ name: 'company_id', type: 'uuid' })
  companyId: string;

  @Column({ length: 160 })
  nombre: string;

  @Column({ length: 80 })
  rubro: string;
}
```

### 5.2 Migración

Las migraciones del proyecto se escriben **a mano** en `backend/src/database/migrations/` con prefijo
numérico incremental (`1700000017000-…`, el siguiente libre: revisa la carpeta) y SQL idempotente. Plantilla
basada en `1700000014000-ModuleVariants.ts`:

```ts
import { MigrationInterface, QueryRunner } from 'typeorm';

export class Proveedores1700000018000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS proveedores (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        created_at timestamptz NOT NULL DEFAULT now(),
        updated_at timestamptz NOT NULL DEFAULT now(),
        deleted_at timestamptz NULL,
        company_id uuid NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
        nombre varchar(160) NOT NULL,
        rubro varchar(80) NOT NULL
      );
    `);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS idx_proveedores_company ON proveedores (company_id);`);
    await queryRunner.query(`ALTER TABLE proveedores ENABLE ROW LEVEL SECURITY;`);
    await queryRunner.query(`
      CREATE POLICY tenant_isolation_proveedores ON proveedores
      USING (company_id = current_setting('app.current_company_id', true)::uuid)
      WITH CHECK (company_id = current_setting('app.current_company_id', true)::uuid);
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP POLICY IF EXISTS tenant_isolation_proveedores ON proveedores;`);
    await queryRunner.query(`DROP TABLE IF EXISTS proveedores;`);
  }
}
```

```bash
cd backend && npm run migration:run      # corre como DB_USER (owner), ver data-source.ts
npm run migration:revert                 # deshace la última
```

`migration:generate` existe (`npm run migration:generate -- src/database/migrations/<Nombre>`), pero
no genera RLS: si lo usas, añade las políticas a mano.

### 5.3 Doble aislamiento (obligatorio)

1. **RLS en PostgreSQL**: `TenantContextInterceptor` fija `app.current_company_id` por petición. En runtime
   la app conecta como `DB_APP_USER` (rol `NOBYPASSRLS`) si está definido; si no, como `DB_USER` (owner),
   que **se salta el RLS**.
2. **Filtro en la aplicación**: toda query filtra por `@CurrentTenant()`:
   `repo.find({ where: { companyId } })`, y en altas `companyId` sale del tenant, **nunca del body**.

No confíes en una sola capa: en dev puede que no haya `DB_APP_USER` y el RLS no actúe.

---

## 6. Paso 4 — Frontend

### 6.1 Página

`frontend/src/modules/<carpeta>/<Nombre>Page.tsx`. Patrón: `catalog/CatalogPage.tsx`.

- El **acceso a la pantalla** lo controla `RequirePerm` (lo pone `App.tsx` desde el registro): carga
  `GET /api/<module>/context` y muestra `ForbiddenPage` si falta el permiso de la ruta. La página no
  necesita volver a comprobarlo.
- La página solo decide **qué botones mostrar**:

```tsx
const { moduleContexts } = useAuth();
const perms = moduleContexts['proveedores']?.permissions ?? [];   // ← <module>, no <key>
const canCreate = perms.includes('proveedores.create');
// o: <Can permission="proveedores.create" permissions={perms}>…</Can>
```

- `useBackTarget('/home')` (de `shared/layout/TopBarContext`) fija el destino del botón "volver".
- Llamadas a la API con `httpClient` (`shared/api/httpClient`), **sin** `/api`: `httpClient.get('/proveedores/items')`.
  Añade solo `X-Requested-With` y `X-CSRF-Token` en mutaciones.
- Clases de layout: `s2`, `s2-head`, `s2-body`, `page-title`, `lead`, `info-card`, `btn btn-primary`,
  `btn btn-ghost`, `empty-state`, `field`, `inp`, `sel`.

> La UI no es una capa de seguridad: ocultar un botón no impide llamar al API. El backend debe responder
> `403` por sí mismo (`@Permissions`).

### 6.2 Declarar las pantallas: `<carpeta>.routes.tsx`

Cada módulo declara **todas** sus pantallas en un archivo propio. Es la única fuente de verdad de sus rutas.

```tsx
// frontend/src/modules/proveedores/proveedores.routes.tsx
import type { FrontendModule } from '../registry/types';
import { ProveedoresPage } from './ProveedoresPage';

export const proveedoresModule: FrontendModule = {
  module: 'proveedores',          // = @Controller del backend
  label: 'Proveedores',           // sugerido en Configuración → Módulos
  basePath: '/proveedores',       // home del módulo
  routes: [
    { path: '/proveedores', perm: 'proveedores.read', element: <ProveedoresPage /> },
    // { path: '/proveedores/new', perm: 'proveedores.create', element: <ProveedorCreatePage /> },
    // { path: '/proveedores/:id/edit', perm: 'proveedores.update', element: <ProveedorEditPage /> },
  ],
};
```

### 6.3 Añadirlo al registro

```ts
// frontend/src/modules/registry/index.ts
import { proveedoresModule } from '../proveedores/proveedores.routes';

export const MODULES: FrontendModule[] = [
  // ...
  proveedoresModule,
];
```

Con eso:

- `App.tsx` genera cada `<Route path>` envuelta en `<RequirePerm module perm>`.
- **Configuración → Módulos** ofrece sus rutas sin parámetros (`/proveedores`, `/proveedores/new`) en el
  selector de *Pantalla*.

En desarrollo, `validateRegistry()` **rompe el arranque** si:

| Regla | Ejemplo inválido |
| --- | --- |
| `module` duplicado | dos archivos con `module: 'credits'` |
| `path` duplicado entre módulos | `/reports` en dos módulos |
| La primera ruta ≠ `basePath` | `basePath: '/x'`, `routes[0].path: '/x/list'` |
| Ruta fuera de `basePath` | `basePath: '/x'`, ruta `/y` |
| `perm` sin prefijo del módulo | `module: 'x'`, `perm: 'y.read'` |

> ⚠️ **Import circular**: si una página de tu módulo importa (directa o indirectamente) `modules/registry`
> — p. ej. reutiliza `ModulePathSelect` o `ModulesManagement` —, declárala con `lazy()` + `<Suspense>` en su
> `*.routes.tsx`, como hace `config/config.routes.tsx`. Con import estático, `MODULES` puede recibir
> `undefined` según el orden de evaluación.

Las rutas que **no** son módulos (`/`, `/login`, `/home`, `/profile`, `/global-config`, `/test`, `*`)
siguen escritas a mano en [App.tsx](frontend/src/App.tsx).

### 6.4 Resultado esperado

```bash
cd frontend && npm run build    # tsc + vite build sin errores
npm run lint                    # 0 errores
npm run dev                     # http://localhost:5173 sin error del registro en consola
```

Antes del Paso 6, `/proveedores` muestra la página de **acceso denegado** (no 404).

---

## 7. Paso 5 — Registrar el módulo desde la GUI

Sin redeploy ni SQL.

| Rol | Dónde | Componente |
| --- | --- | --- |
| Admin de empresa | Configuración → Módulos | `ModulesManagement` (`mode: 'company'`) |
| Superadmin | Configuración global → Módulos | `SuperAdminGlobalConfigPage` → `ModulesManagement` (`mode: 'global'`) |

Formulario (`ModuleForm.tsx`):

| Campo | Cómo se llena |
| --- | --- |
| **Pantalla (path)** | Selector con las rutas del registro, agrupadas por módulo. Al elegirla, `module` (y `label` si está vacío) se autocompletan. |
| Módulo backend | Solo lectura, sale del registro. |
| `key` | Manual. No editable después. Único solo entre módulos globales (`uq_modules_global_key`). |
| Nombre visible | Manual. |
| Ícono | URL (`https://…`) o clave de ícono existente. |
| Alcance / empresa dueña | Solo superadmin. |
| Ubicación / posición | `grid` (Home) o `fab`; posición ascendente. |
| Operaciones | Manual o **Autocompletar CRUD**. `read` primero. |
| Módulo habilitado | `enabled`. |

Lo que hace el backend en `POST /api/config/modules` (requiere `config.update`):

1. Valida `read` obligatorio, alcance (global solo superadmin, empresa indicada si no es global) y formato
   de `path`. La unicidad de `key` solo la impone la BD para módulos globales.
2. Crea la fila en `modules` y la **asignación dueña** en `module_assignments` (`grid`, posición `0`).
3. Registra `<module>.<action>` por cada operación en el catálogo (idempotente) **sin otorgarlos**.

Si cambias ubicación/posición en el alta, el formulario hace además
`PATCH /api/config/modules/:id/assignment` con `{ placement, position }`.

> **Aviso "ruta inexistente"**: la lista de módulos marca en rojo los registros cuyo `path` no existe en el
> registro frontend (datos antiguos). En dev, el Home avisa en consola (`[modules] tiles sin pantalla…`).
> Corrígelo editando el módulo y eligiendo una pantalla válida.

---

## 8. Paso 6 — Asignar permisos a perfiles

Tras el Paso 5 el módulo existe, pero **nadie** lo ve (ni el admin).

1. **Perfiles → Permisos** → elegir el perfil (`admin`, `vendedor`…) → marcar `<module>.read`,
   `<module>.create`, … según corresponda.
   - Superadmin: gestiona perfiles de todas las empresas. Admin: solo los de su empresa.
   - Los perfiles `admin`/`vendedor` son **por empresa**: asignar en Empresa 1 no afecta a Empresa 2.
2. **Caché**:
   - Backend: asignar o quitar un permiso **invalida al momento** la caché Redis de todos los usuarios del
     perfil (`invalidateProfileCache`). El TTL de 120 s
     ([rbac.service.ts:94](backend/src/modules/rbac/rbac.service.ts#L94)) solo aplica a cambios que no pasan
     por ahí, p. ej. el **superadmin** recibe los permisos *nuevos* del catálogo cuando expira su caché.
   - Frontend: `moduleContexts` se guarda en memoria durante la sesión. El usuario afectado debe
     **recargar la página** (F5) o volver a iniciar sesión para ver el cambio.
3. El superadmin tiene todos los permisos del catálogo por su perfil; no necesita asignaciones.

---

## 9. Paso 7 — Publicación, alcance global y variantes *(opcional)*

Todas requieren `config.update`. Publicar y cambiar alcance: **solo superadmin**.

| Operación | Endpoint | Detalle |
| --- | --- | --- |
| Publicar en otras empresas | `POST /api/config/modules/:id/publications` | `{ companyIds: [] }` → FAB, posición `999` |
| Quitar publicación | `DELETE /api/config/modules/:id/publications/:companyId` | |
| Ver variantes | `GET /api/config/modules/:id/variants` | `config.read` |
| Crear/editar variante | `PUT /api/config/modules/:id/variants/:companyId` | `label`, `icon`, `path`, `config`, `enabledOperations` (idempotente) |
| Eliminar variante | `DELETE /api/config/modules/:id/variants/:companyId` | |
| Convertir a global | `PATCH /api/config/modules/:id` con `{ global: true }` | La asignación dueña pasa a publicación FAB |
| Convertir a empresa | `PATCH` con `{ global: false, companyId }` | Asegura la asignación dueña `grid` |

- Una variante solo se guarda si el módulo está **asignado** a esa empresa (dueña o publicada). Un admin solo
  puede editar la variante de su empresa, también en módulos compartidos.
- En la variante, el `path` también se elige del registro ("Por defecto: <path del módulo>" = sin override).
  Si apuntas a una pantalla de **otro** módulo, `RequirePerm` exigirá los permisos de ese módulo.
- `config` y `enabledOperations` llegan al frontend en el bootstrap (`modulePlacements`) para que la página
  adapte su comportamiento; la autorización sigue siendo RBAC.

---

## 10. Paso 8 — Verificación end-to-end

### 10.1 Levantar el stack

```bash
docker compose up -d                       # postgres, redis, backend, kong, frontend
curl -s localhost:8000/api/health          # vía Kong → 200
```

Backend nativo (fuera de Docker) sin tocar `backend/.env`, con overrides por entorno:

```bash
cd backend
DB_HOST=127.0.0.1 DB_PORT=5433 REDIS_HOST=127.0.0.1 REDIS_PORT=6379 npm run start:dev
```

> Corriendo nativo y llamando a `localhost:3000` te saltas Kong: solo actúan los guards de Nest. Verifica
> siempre también por `:8000`.

### 10.2 Checklist

| # | Caso | Esperado |
| --- | --- | --- |
| 1 | Usuario sin `<module>.read` | Tile **no** aparece; `/<path>` muestra acceso denegado; `GET /api/<module>/items` → `403` |
| 2 | Asignar `<module>.read` + recargar (F5) | Tile visible en Home/Sidebar en su posición; endpoint → `200` |
| 3 | Sin `<module>.create` | Botón de alta oculto; `POST /api/<module>/items` → `403` |
| 4 | `GET /api/<module>/context` | Solo permisos con prefijo `<module>.` |
| 5 | Sin sesión | `GET /api/<module>/context` vía Kong → `401` |
| 6 | Multiempresa | Publicado → aparece en el FAB de la empresa destino; variante → cambia label/path/ops solo allí |
| 7 | Registro | `npm run dev` sin error de `validateRegistry`; consola del Home sin `[modules] tiles sin pantalla` |

### 10.3 Receta `curl` vía Kong

Usuarios demo en [TEST-GUIDE.md](TEST-GUIDE.md) (contraseña `Password123!`). Usa un usuario de empresa
(`vendedor@empresa1.com`): el superadmin entra sin empresa y tiene todos los permisos.

```bash
API=localhost:8000/api
# Login (exige X-Requested-With; está exento de CSRF)
curl -s -c /tmp/cj -X POST $API/auth/login -H 'Content-Type: application/json' \
  -H 'X-Requested-With: XMLHttpRequest' \
  -d '{"email":"vendedor@empresa1.com","password":"Password123!"}' -o /dev/null -w '%{http_code}\n'   # 201
CSRF=$(awk '/csrf_token/{print $NF}' /tmp/cj)

curl -s -b /tmp/cj $API/proveedores/context                                   # {"permissions":[...]}
curl -s -b /tmp/cj $API/proveedores/items -o /dev/null -w '%{http_code}\n'    # 403 sin read / 200 con read

# Mutación: X-Requested-With + X-CSRF-Token
curl -s -b /tmp/cj -X POST $API/proveedores/items -H 'Content-Type: application/json' \
  -H 'X-Requested-With: XMLHttpRequest' -H "X-CSRF-Token: $CSRF" \
  -d '{"nombre":"Ferretería Sur","rubro":"Herramientas"}' -w '\n%{http_code}\n'   # 403 sin create / 201 con create
```

### 10.4 Problemas frecuentes

| Síntoma | Causa probable |
| --- | --- |
| El tile no aparece aunque asigné el permiso | El usuario no recargó; `operations[0]` no es la operación asignada; módulo `enabled: false`; asignación en otra empresa |
| Tile aparece pero lleva a 404 | `path` en BD no registrado (badge "ruta inexistente") |
| Pantalla muestra "acceso denegado" con permiso | El `perm` de la ruta en `*.routes.tsx` no es el que asignaste, o `context` no existe en el backend |
| `context` devuelve `[]` siempre | `getPermissionsByPrefix` con un prefijo distinto de `<module>` |
| `403 Falta el header X-Requested-With` | Mutación sin ese header (fuera de `httpClient`) |
| `403 token CSRF` | Mutación sin `X-CSRF-Token` igual a la cookie `csrf_token` |
| `400 path debe ser una ruta interna` | `path` con espacios, `//`, protocolo o query string |
| Error "Registro de módulos inválido" al arrancar el front | Regla de §6.3 incumplida (el mensaje dice cuál) |
| `401` vía Kong pero funciona en `:3000` | Cookie `access_token` ausente o expirada: Kong valida el JWT antes que Nest |

---

## Anexo A — Ejemplo completo: módulo `proveedores`

Módulo pequeño, sin persistencia (datos seed en memoria), patrón equivalente a `catalog`.

### A.1 Decisión

| Campo | Valor |
| --- | --- |
| `module` | `proveedores` |
| `key` | `proveedores` |
| `label` | `Proveedores` |
| `path` | `/proveedores` |
| Alcance / ubicación | Empresa / Home (`grid`), posición `0` |
| `operations[]` | `[{ action: 'read', name: 'Ver' }, { action: 'create', name: 'Crear' }]` |

Permisos resultantes: `proveedores.read` (controla el tile) y `proveedores.create`.

### A.2 Backend

`backend/src/modules/proveedores/dto/proveedor.dto.ts`

```ts
import { IsNotEmpty, IsString, MaxLength } from 'class-validator';

export class ProveedorDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(160)
  nombre: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(80)
  rubro: string;
}
```

`backend/src/modules/proveedores/proveedores.service.ts`

```ts
import { Injectable } from '@nestjs/common';
import { randomUUID } from 'crypto';
import { ProveedorDto } from './dto/proveedor.dto';

export interface Proveedor {
  id: string;
  nombre: string;
  rubro: string;
}

const SEED: Proveedor[] = [
  { id: randomUUID(), nombre: 'Aceros del Norte', rubro: 'Metales' },
  { id: randomUUID(), nombre: 'Pinturas Andinas', rubro: 'Pinturas' },
];

@Injectable()
export class ProveedoresService {
  list(): Proveedor[] {
    return SEED;
  }

  add(dto: ProveedorDto): Proveedor {
    return { id: randomUUID(), nombre: dto.nombre, rubro: dto.rubro };
  }
}
```

`proveedores.module.ts` y `proveedores.controller.ts`: exactamente los de §4.1 y §4.2. Registro en
`app.module.ts` como en §4.3.

### A.3 Frontend

`frontend/src/modules/proveedores/ProveedoresPage.tsx`

```tsx
import { useState } from 'react';
import { httpClient } from '../../shared/api/httpClient';
import { useAuth } from '../auth/AuthContext';
import { useBackTarget } from '../../shared/layout/TopBarContext';

interface Proveedor {
  id: string;
  nombre: string;
  rubro: string;
}

export function ProveedoresPage() {
  useBackTarget('/home');
  const { moduleContexts } = useAuth();
  // RequirePerm ya cargó el contexto y garantizó proveedores.read.
  const canCreate = moduleContexts['proveedores']?.permissions.includes('proveedores.create') ?? false;
  const [items, setItems] = useState<Proveedor[] | null>(null);
  const [error, setError] = useState('');

  const listar = async () => {
    setError('');
    try {
      const res = await httpClient.get('/proveedores/items');
      setItems(res.data);
    } catch (err: any) {
      setError(err?.response?.data?.message?.message || 'No se pudo consultar proveedores');
    }
  };

  const crear = async () => {
    setError('');
    try {
      await httpClient.post('/proveedores/items', { nombre: 'Proveedor de prueba', rubro: 'General' });
      await listar();
    } catch (err: any) {
      setError(err?.response?.data?.message?.message || 'No se pudo crear el proveedor');
    }
  };

  return (
    <div className="s2">
      <div className="s2-head">
        <h1 className="page-title">Proveedores</h1>
      </div>
      <div className="s2-body">
        <div className="info-card" style={{ padding: 20 }}>
          {error && <p style={{ color: '#b00020', fontSize: 12 }}>{error}</p>}
          <div style={{ display: 'flex', gap: 10 }}>
            <button type="button" className="btn btn-primary" onClick={listar}>Listar proveedores</button>
            {canCreate && (
              <button type="button" className="btn btn-ghost" onClick={crear}>Crear proveedor de prueba</button>
            )}
          </div>
          {items && (
            <table style={{ width: '100%', marginTop: 16, fontSize: 14 }}>
              <thead>
                <tr><th style={{ textAlign: 'left' }}>Nombre</th><th style={{ textAlign: 'left' }}>Rubro</th></tr>
              </thead>
              <tbody>
                {items.map((p) => (
                  <tr key={p.id}><td>{p.nombre}</td><td>{p.rubro}</td></tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
}
```

`frontend/src/modules/proveedores/proveedores.routes.tsx`: el de §6.2. Y la línea en
`modules/registry/index.ts` de §6.3. **No se toca `App.tsx`.**

### A.4 Registro y permisos

1. Configuración → Módulos → **+ Nuevo módulo** → Pantalla: `Proveedores · proveedores › /proveedores (home)`
   (autocompleta `module` y `label`) → `key: proveedores` → operaciones `read` (Ver), `create` (Crear) →
   Home, posición `0` → **Crear módulo**.
2. Perfiles → Permisos → perfil `vendedor` (y/o `admin`) → marcar `proveedores.read` y `proveedores.create`.
3. El usuario recarga la página.

### A.5 Verificación

| Momento | Home | API |
| --- | --- | --- |
| Antes del paso A.4.2 | Sin tile "Proveedores"; `/proveedores` → acceso denegado | `GET /api/proveedores/items` → `403` |
| Con `proveedores.read` | Tile visible (#0); "Listar" devuelve los 2 seed | `200` |
| Sin `proveedores.create` | Botón "Crear" oculto | `POST /api/proveedores/items` → `403` |
| Con ambos | Los dos botones | `GET /api/proveedores/context` → `{"permissions":["proveedores.read","proveedores.create"],"featureFlags":{}}` |

---

## Notas y reglas

1. **Seguridad siempre en el backend.** `RequirePerm`, `Can` y la visibilidad de tiles son UX;
   `PermissionsGuard` es la autorización real. Kong valida el JWT como defensa adicional.
2. **`context` solo expone permisos del módulo** (`getPermissionsByPrefix`), no el catálogo completo del
   usuario.
3. **Permisos nuevos = deshabilitados** hasta asignarlos (regla 9 de [MODULE-SYSTEM.md](MODULE-SYSTEM.md)).
4. **`/api/config/modules`**: `config.read` para leer, `config.update` para modificar; módulos globales,
   publicación y cambio de alcance solo superadmin. El superadmin no tiene empresa (`company_id NULL`).
5. **`@IsUUID()` sin versión** en DTOs: los IDs seed (`11111111-1111-1111-8111-…`) no son UUID v4.
6. **No editar `backend/.env`** para correr nativo: usar overrides por variable de entorno.
7. **Aislamiento por empresa en dos capas** (RLS + filtro por `@CurrentTenant()`), nunca solo una.
8. **Un `path` en BD siempre debe existir en el registro frontend.** El formulario lo impone en altas; para
   datos antiguos, revisar el badge "ruta inexistente".
