# Sistema de módulos, login sin empresa, superadmin de sistema y variantes por empresa

> Documenta el paradigma implementado: login por email sin elegir empresa, empresa principal del
> usuario, superadmin a nivel de **sistema** (sin empresa asignada) con selector de empresas y
> configuración global, el sistema de módulos con operaciones editables, publicación (`publish`) y
> alcance global, y las **variantes por empresa** que permiten que un módulo compartido se comporte
> distinto según la empresa.

---

## 1. Modelo de datos

### `modules` — definición de un módulo

| Columna        | Tipo                              | Descripción |
| -------------- | --------------------------------- | ----------- |
| `id`           | `uuid` PK                         |             |
| `created_at`   | `timestamptz`                     |             |
| `updated_at`   | `timestamptz`                     |             |
| `deleted_at`   | `timestamptz` NULL                | soft delete |
| `company_id`   | `uuid NULL REFERENCES companies`  | `NULL` = módulo **global** |
| `key`          | `varchar`                         | clave única por scope (ej. `creditos`) |
| `module`       | `varchar`                         | recurso backend (registra permisos `module.*`) |
| `label`        | `varchar`                         | nombre visible |
| `icon`         | `varchar(500)` NULL               | URL o clave de ícono |
| `path`         | `varchar`                         | ruta frontend (home del módulo) |
| `operations`   | `jsonb` `[{action,name}]`         | operaciones editables (registran permisos) |
| `flag`         | `varchar` NULL                    | flag (integración legacy) |
| `enabled`      | `boolean`                         |                    |

- Índice único parcial: `uq_modules_global_key ON modules(key) WHERE company_id IS NULL`
  (solo un módulo por `key` con alcance global).

### `module_assignments` — visibilidad por empresa

`PK (module_id, company_id)`, `FK` a ambas tablas con `ON DELETE CASCADE`.

| Columna      | Tipo              | Descripción |
| ------------ | ----------------- | ----------- |
| `placement`  | `'grid' \| 'fab'` | `grid` = botón en Home, `fab` = FAB superior |
| `position`   | `int`             | orden de aparición |
| `enabled`    | `boolean`         | visible si `true` |

- La asignación del **dueño** del módulo (fila `company_id = modules.company_id`) define dónde se
  muestra en su propia empresa.
- Las filas de **otras** empresas (publicaciones) siempre se muestran en el **FAB** (ver reglas).

### `module_variants` — variante de un módulo por empresa

`PK id`, `UNIQUE (module_id, company_id)`, `FK` a `modules` y `companies` con `ON DELETE CASCADE`.
Es el mecanismo para registrar **comportamientos distintos según la empresa** de un mismo módulo
(compartido o propio):

| Columna              | Tipo                          | Descripción |
| -------------------- | ----------------------------- | ----------- |
| `label`              | `varchar(120)` NULL           | sobrescribe el nombre visible |
| `icon`               | `varchar(500)` NULL           | sobrescribe el ícono |
| `path`               | `varchar(200)` NULL           | sobrescribe la ruta frontend |
| `config`             | `jsonb` `{}`                  | configuración libre por empresa (ej. `{"modo":"promo","limiteCredito":5000000}`) |
| `enabled_operations` | `jsonb` `[]`                  | operaciones del módulo activas en esa empresa (`[]` = todas) |

- Existe solo para empresas donde el módulo está **asignado** (dueña o publicada): el back valida
  que haya una `module_assignments` antes de guardar.
- En el bootstrap de la empresa, la variante se **mergea** sobre el placement: `label/icon/path`
  si están seteados, `config` y `enabled_operations` (si vacío → todas las operaciones del módulo).
- `UNIQUE (module_id, company_id)` → un solo registro por (módulo, empresa); `PUT` es idempotente.

### RLS

Las tablas de módulos tienen RLS con política `tenant_isolation_*` basada en
`current_setting('app.current_company_id', true)`:
- `modules`: permite filas globales (`company_id IS NULL`) **o** de la empresa activa.
- `module_assignments` y `module_variants`: solo filas de la empresa activa.
- `users`: permite la empresa activa **o** filas de sistema (`company_id IS NULL`), para que los
  roles globales sean visibles; la aislación real se garantiza a nivel de aplicación.

> **Nota de seguridad:** `pwa_user` es dueño de las tablas y el RLS no usa `FORCE`, por lo que el
> owner omite la política. El servicio aplica las mismas reglas **a nivel de aplicación**
> (`assertCanManage` + resolución del tenant), por lo que el alcance admin/superadmin queda
> garantizado aunque el RLS sea bypassable por el dueño.

---

## 2. Migración

Migraciones del módulo (las 18 corren OK en una BD limpia):

- `backend/src/database/migrations/1700000012000-ModuleSystem.ts`
  1. Crea `modules` y `module_assignments` (idempotente, `IF NOT EXISTS`).
  2. Habilita RLS + políticas de tenant.
  3. Backfill desde la tabla legacy `module_placements`.
  4. `DROP TABLE module_placements`.
  5. Otorga `config.read` / `config.update` al perfil `admin`
     (`aaaaaaaa-0000-4000-8000-000000000002`), para que el admin de cada empresa administre sus módulos.

- `backend/src/database/migrations/1700000013000-SuperadminNoCompany.ts`
  1. `users.company_id` pasa a **NULLABLE**.
  2. `UPDATE users SET company_id = NULL WHERE profile_id = super_admin` → el superadmin es rol de
     sistema y deja de pertenecer a una empresa (su acceso a una empresa es temporal, vía switch).
  3. Recrea la policy de `users` permitiendo filas de sistema (`company_id IS NULL`).

- `backend/src/database/migrations/1700000014000-ModuleVariants.ts`
  Crea `module_variants` (schema de arriba) + índice por `company_id` + RLS.

`down()` de ModuleSystem reconstruye `module_placements` desde `module_assignments + modules`.

---

## 3. Reglas de negocio

1. **`read` obligatorio**: si `operations` contiene `update` o `delete`, debe incluir `read`
   (validación en formulario y en `validateOperations` del service).
2. **Módulo global** (`company_id = NULL`): no tiene asignación propia; solo se muestra vía
   publicaciones en **FAB** (posición `999`, `placement` forzado a `fab`).
3. **Publicación en otra empresa**: solo `fab` (posición `999`). No se puede publicar en el `grid`.
4. **Admin**: lista módulos de **su propia empresa** + los **compartidos** (de otra empresa)
   asignados a la suya (`isShared: true`). Solo puede **crear/editar/eliminar/publicar** los de su
   empresa (módulo ajeno → `403`); sobre los compartidos solo puede configurar la **variante de su
   empresa**.
5. **Superadmin es un rol de sistema** (`profile_id = aaaaaaaa-0000-4000-8000-000000000001`):
   - en BD tiene `users.company_id = NULL` (no pertenece a ninguna empresa); su empresa activa es
     solo el `companyId` del token tras el switch;
   - permisos totales: crea módulos globales, los publica en cualquier empresa, administra módulos
     de cualquier empresa y configura variantes para cualquier empresa donde el módulo esté asignado;
   - invariable: **ningún usuario con perfil `super_admin` puede tener empresa** (el `create`/
     `update` de usuarios lo fuerza a `NULL`).
6. **Variantes**: solo se guardan si el módulo está asignado a esa empresa
   (`module_assignments`); el admin solo puede tocar la variante de su propia empresa (`403` en
   otra); las operaciones de `enabled_operations` deben pertenecer al `operations` del módulo (400
   si no) y no pueden duplicarse.
7. **Alta de usuarios con rol de sistema**: solo el superadmin puede asignar el perfil
   `super_admin` (empresa admin → `403`); al crearlo no se pide empresa. El superadmin sigue
   requiriendo indicar la empresa principal al crear usuarios con perfil de empresa.
8. **Cambio de alcance (solo superadmin)**: desde el editor de módulos se puede convertir un
   módulo de empresa a **global** (`global: true`: la asignación dueña pasa a publicación FAB) y
   de global a **empresa** (`global: false` + `companyId`: se asegura la asignación dueña grid).
9. **Permisos deshabilitados por defecto**: al registrar un módulo se crean las permisiones
   `resource.accion` en el catálogo (p. ej. `calculator.sumar`, `calculator.restar`) **sin
   otorgarlas a ningún perfil**. Hasta que no se asignen, ningún usuario (admin incluido) ve ni
   opera el módulo. La asignación se hace en **Perfiles → Permisos**: el superadmin gestiona
   perfiles en todas las empresas y el admin solo los de su empresa (mismo comportamiento para
   usuarios: superadmin en todas, admin en la suya). El superadmin igual accede a todo por su
   perfil.

---

## 4. API

Autorización: `X-Requested-With: XMLHttpRequest` + cookies JWT (access/refresh).

### Auth / bootstrap

| Método | Ruta              | Descripción |
| ------ | ----------------- | ----------- |
| POST   | `/auth/login`     | login local por `email` + `password` (sin `companyId`) |
| POST   | `/auth/passkeys/...` | login/registro passkey resuelto por **email** |
| POST   | `/auth/company`   | **switch de empresa** (solo superadmin): `{companyId}` o `{companyId:null}` para volver al selector; re-emite tokens |
| GET    | `/auth/companies` | empresas activas para el selector |
| GET    | `/me/bootstrap`   | scope + company + companies + placements + permisos |

`bootstrap.user.profileId` identifica al superadmin en el frontend. El `scope` puede ser:

- `superadmin` → `company: null`, `companies: []` (selector), sin `modulePlacements`.
- `company` → `company: {...}`, estando dentro de una empresa (superadmin o usuario normal).

Login email-only: `email` es `UNIQUE`. El estratega devuelve `companyId: null` si el usuario tiene
perfil `super_admin` (el frontend decide entrando al selector). Con la migración
`1700000013000`, además, el superadmin **ya no tiene empresa en BD** (`company_id NULL`): el
`companyId` del token = null hasta que entra a una empresa por `/auth/company`.

### Módulos (`/config/modules`) — requiere `config.read`/`config.update`

| Método | Ruta                          | Descripción |
| ------ | ----------------------------- | ----------- |
| GET    | `/config/modules`             | lista: superadmin (todos) / admin (los de su empresa + compartidos asignados, con `isShared`) |
| POST   | `/config/modules`             | crea módulo (`global?`, `companyId?`, `key`, `module`, `label`, `path`, `icon?`, `enabled?`, `operations[]`); registra permisos `module.*` **sin otorgarlos a nadie** (se habilitan desde Perfiles → Permisos); crea asignación del dueño |
| PATCH  | `/config/modules/:id`         | actualiza `label`, `icon`, `path`, `enabled`, `operations` (relanzado `registerModulePermissions` si cambian acciones). El superadmin además puede cambiar el **alcance**: `global: true` (empresa → global; la asignación dueña pasa a FAB) o `global: false` + `companyId` (global → empresa; asegura asignación dueña grid) |
| PATCH  | `/config/modules/:id/assignment` | ubicación/posición de la asignación del dueño (`placement`, `position`) |
| DELETE | `/config/modules/:id`         | elimina módulo (cascade a publicaciones) |
| POST   | `/config/modules/:id/publications` | publica en `{companyIds[]}` (solo superadmin; scope global/ajeno → fab) |
| DELETE | `/config/modules/:id/publications/:companyId` | quita publicación (solo superadmin) |
| GET    | `/config/modules/:id/variants` | lista variantes (admin: solo la de su empresa) |
| PUT    | `/config/modules/:id/variants/:companyId` | **upsert** de la variante: `label?`, `icon?`, `path?`, `config?`, `enabled_operations[]?`; exige módulo asignado a esa empresa; admin solo su empresa |
| DELETE | `/config/modules/:id/variants/:companyId` | elimina variante (vuelve al comportamiento por defecto) |

El **bootstrap** (`/me/bootstrap`) aplica la variante de la empresa sobre cada placement
(`label/icon/path` mergeados + `config` + `enabled_operations`).

### Empresas (`/config/companies`) — solo superadmin (`ensureSuperAdmin`)

| Método | Ruta                      | Descripción |
| ------ | ------------------------- | ----------- |
| GET    | `/config/companies`       | lista con `isActive`, `authStrategy`, `primaryColor`, `logoUrl` |
| POST   | `/config/companies`       | crea empresa (`name`, `primaryColor?`) |
| PATCH  | `/config/companies/:id`   | edita `name`, `primaryColor`, `isActive` |
| POST   | `/config/companies/:id/logo` | sube logo |

---

## 5. Frontend

> Paso a paso para dar de alta un módulo nuevo: [MODULE-GUIDE.md](MODULE-GUIDE.md).

- **Registro de módulos** (`frontend/src/modules/registry/`): cada módulo declara sus pantallas en
  `modules/<carpeta>/<carpeta>.routes.tsx` (`module`, `basePath`, `routes[{path, perm, element}]`).
  `App.tsx` genera las `<Route>` (con `RequirePerm`) desde `MODULES`, y `ModuleForm` /
  `ModuleVariantForm` solo ofrecen esas rutas como `path` (selector `ModulePathSelect`), por lo que
  `modules.path` no puede apuntar a una pantalla inexistente. En DEV, `validateRegistry()` rompe el
  arranque ante duplicados o permisos sin prefijo del módulo.
- `AuthContext` expone `scope`, `companies`, `enterCompany/exitCompany`, `isSuperAccount`,
  `refreshBootstrap`, `moduleContexts` (`/{module}/context` + `Can`).
- `LoginPage` sin selector de empresas (gradiente `#1356a0 → #0c3567`).
- `HomePage` superadmin = cards de empresas + tarjeta **Configuración global** (`/global-config`).
- `Sidebar` neutral a `company: null` (optional chaining) + "Panel global" para superadmin.
- `ModulesManagement` (`mode: 'company' | 'global'`) — lista + create/edit (`ModuleForm`) +
  publicar/despublicar + toggle `enabled` + delete + botón **Variantes** (panel por empresa).
- `ModuleForm` — create/edit; scope global (FAB + publish), operaciones CRUD con regla
  read-obligatorio, ícono con tooltip apuntando a `path`.
- `ModuleVariantForm` — upsert de la variante de un módulo para una empresa: `label/icon/path`
  opcionales, checkboxes de operaciones activas (todas marcadas = por defecto), `config` en JSON.
  Para módulos compartidos (`isShared`) los admins solo ven este panel (sin editar/publicar/borrar).
- `SuperAdminGlobalConfigPage` (`/global-config`) — tabs **Empresas** y **Módulos** (global).
- `UsersListPage` — campo *Empresa principal* al crear usuario cuando `isSuperAccount` **y** el
  perfil no es `super_admin` (si es `super_admin` se oculta y no se asigna empresa; el perfil
  `super_admin` solo aparece para superadmin).
- `ProfilePage` — botón *Volver al selector* para superadmin.

Flujo típico superadmin: login (selector) → entrar a empresa (switch) usable como admin de esa
empresa, o ir a `/global-config` para alta de empresas / módulos globales.

---

## 7. Módulos de prueba (para validar los flujos)

Tres módulos **backend + frontend mínimos** para probar registro, definiciones globales,
definiciones por empresa y publicación entre empresas sin tocar datos reales:

| Módulo | `module`/prefijo | Path frontend | Permisos (el 1º es `perm` del tile) | Extra |
| ------ | ---------------- | ------------- | ----------------------------------- | ----- |
| Catálogo | `catalog` | `/catalog` | `catalog.ver`, `catalog.cargar` | solo home |
| Promociones | `promos` | `/promos`, `/promos/nueva` | `promos.ver`, `promos.crear`, `promos.detalle` | sub-ruta `/promos/nueva` protegida por `promos.crear` + detalle por `promos.detalle` |
| Reportes | `reports` | `/reports` | `reports.ver`, `reports.generar`, `reports.exportar` | solo home |

- Backend: `GET <module>/context` (sin permiso) + endpoints protegidos con
  `@Permissions('module.accion')` (mismo patrón que `calculator`). Sin persistencia.
- Frontend: cada home llama `loadModuleContext('<module>')`; los botones/links se ocultan con
  `Can`/`permissions.includes`; el backend igual devuelve `403` sin el permiso.
- **Registro por empresa** (admin): `Configuración → Módulos` → crear con `key`, `module`,
  `path` y `operations` del cuadro (la 1ª operación `ver` define el `perm` del tile en Home).
- **Definición global** (superadmin): `Configuración global → Módulos` → crear con `global:true`
  → se distribuye FAB a todas las empresas activas.
- **Publicación entre empresas** (superadmin): usa el botón publicar existente (`publish` → FAB).
- **Permisos**: `Perfiles → Permisos` habilita `module.accion` (quedan deshabilitados al
  registrarse). Reescribir la caché RBAC del usuario o esperar TTL 120 s.

## 8. Notas

- Los IDs seed (`11111111-1111-1111-8111-111111111111`, `22222222-…`, …) **no son UUID v4**; por
  eso los DTOs de módulos validan `@IsUUID()` (sin versión).
- El switch de empresa solo afecta tokens del superadmin; usuarios admin no pueden usarlo (`403`).
- El superadmin crea usuarios de empresa indicando la **empresa principal**; al crear un
  `super_admin` no (queda `company_id NULL`). Un admin de empresa no puede asignar el perfil
  `super_admin` (`403`).
- `enabled_operations`/`config` de la variante se exponen en el **bootstrap** de la empresa (dentro
  de `modulePlacements`) para que el frontend del módulo adapte su comportamiento; la autorización
  fina sigue vía RBAC (`/{module}/context` + `Can`).
- Las variantes se crean solo sobre módulos **asignados** a la empresa (dueña o publicada); para
  módulos globales primero hay que publicarlos en la empresa destino.
- `SEED_DEMO_DATA`, contraseñas demo `Password123!`: documentadas en `TEST-GUIDE.md`.