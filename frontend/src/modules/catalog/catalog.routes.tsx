import type { FrontendModule } from '../registry/types';
import { CatalogPage } from './CatalogPage';

export const catalogModule: FrontendModule = {
  module: 'catalog',
  label: 'Catálogo',
  basePath: '/catalog',
  routes: [{ path: '/catalog', perm: 'catalog.ver', element: <CatalogPage /> }],
};
