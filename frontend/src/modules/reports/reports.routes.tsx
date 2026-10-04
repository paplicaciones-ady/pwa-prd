import type { FrontendModule } from '../registry/types';
import { ReportsPage } from './ReportsPage';

export const reportsModule: FrontendModule = {
  module: 'reports',
  label: 'Reportes',
  basePath: '/reports',
  routes: [{ path: '/reports', perm: 'reports.ver', element: <ReportsPage /> }],
};
