import type { FrontendModule } from '../registry/types';
import { RoutesPage } from './RoutesPage';

export const routesModule: FrontendModule = {
  module: 'routes',
  label: 'Rutas',
  basePath: '/routes',
  routes: [{ path: '/routes', perm: 'routes.read', element: <RoutesPage /> }],
};
