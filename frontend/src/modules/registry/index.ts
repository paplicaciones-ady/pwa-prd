import { matchPath } from 'react-router-dom';
import type { FrontendModule } from './types';
import { brainModule } from '../brain/brain.routes';
import { calculatorModule } from '../calculator/calculator.routes';
import { catalogModule } from '../catalog/catalog.routes';
import { clientsModule } from '../clients/clients.routes';
import { complaintsModule } from '../complaints/complaints.routes';
import { configModule } from '../config/config.routes';
import { creditsModule } from '../credits/credits.routes';
import { discountsModule } from '../discounts/discounts.routes';
import { expensesModule } from '../expenses/expenses.routes';
import { newProductsModule } from '../newProducts/newProducts.routes';
import { portfolioModule } from '../portfolio/portfolio.routes';
import { pricesModule } from '../prices/prices.routes';
import { profilesModule } from '../profiles/profiles.routes';
import { promosModule } from '../promos/promos.routes';
import { reportsModule } from '../reports/reports.routes';
import { routesModule } from '../routes/routes.routes';
import { surveysModule } from '../surveys/surveys.routes';
import { usersModule } from '../users/users.routes';

export type { FrontendModule, ModuleRoute } from './types';

/**
 * Registro de módulos frontend. Para dar de alta un módulo nuevo: crear
 * `modules/<carpeta>/<carpeta>.routes.tsx` y añadirlo aquí. App.tsx genera
 * sus <Route> y Configuración → Módulos lo ofrece como `path`.
 */
export const MODULES: FrontendModule[] = [
  clientsModule,
  configModule,
  creditsModule,
  usersModule,
  profilesModule,
  portfolioModule,
  discountsModule,
  surveysModule,
  expensesModule,
  complaintsModule,
  pricesModule,
  newProductsModule,
  routesModule,
  brainModule,
  calculatorModule,
  catalogModule,
  promosModule,
  reportsModule,
];

export const findModule = (module: string) => MODULES.find((m) => m.module === module);

/** Rutas sin parámetros de un módulo: las únicas válidas como destino de un tile (modules.path). */
export const staticPaths = (m: FrontendModule) => m.routes.map((r) => r.path).filter((p) => !p.includes(':'));

/** ¿La ruta guardada en BD (modules.path / variante) lleva a una pantalla registrada? */
export const isRegisteredPath = (path: string) =>
  MODULES.some((m) => m.routes.some((r) => matchPath({ path: r.path, end: true }, path) !== null));

/** Reglas del registro. Solo en DEV: un error aquí rompe el arranque, no producción. */
function validateRegistry(modules: FrontendModule[]) {
  const errors: string[] = [];
  const seenModules = new Set<string>();
  const seenPaths = new Set<string>();
  for (const m of modules) {
    if (seenModules.has(m.module)) errors.push(`module duplicado: ${m.module}`);
    seenModules.add(m.module);
    if (m.routes[0]?.path !== m.basePath) errors.push(`${m.module}: la primera ruta debe ser basePath (${m.basePath})`);
    for (const r of m.routes) {
      if (seenPaths.has(r.path)) errors.push(`path duplicado: ${r.path}`);
      seenPaths.add(r.path);
      if (r.path !== m.basePath && !r.path.startsWith(`${m.basePath}/`)) {
        errors.push(`${m.module}: ${r.path} no cuelga de ${m.basePath}`);
      }
      if (!r.perm.startsWith(`${m.module}.`)) errors.push(`${m.module}: el permiso ${r.perm} no empieza por "${m.module}."`);
    }
  }
  if (errors.length) throw new Error(`Registro de módulos inválido:\n- ${errors.join('\n- ')}`);
}

if (import.meta.env.DEV) validateRegistry(MODULES);
