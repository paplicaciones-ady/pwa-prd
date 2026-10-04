import type { FrontendModule } from '../registry/types';
import { ComplaintsPage } from './ComplaintsPage';

export const complaintsModule: FrontendModule = {
  module: 'complaints',
  label: 'Reclamos',
  basePath: '/complaints',
  routes: [{ path: '/complaints', perm: 'complaints.read', element: <ComplaintsPage /> }],
};
