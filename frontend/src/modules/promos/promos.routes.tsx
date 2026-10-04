import type { FrontendModule } from '../registry/types';
import { PromosPage } from './PromosPage';
import { PromoCreatePage } from './PromoCreatePage';

export const promosModule: FrontendModule = {
  module: 'promos',
  label: 'Promociones',
  basePath: '/promos',
  routes: [
    { path: '/promos', perm: 'promos.ver', element: <PromosPage /> },
    { path: '/promos/nueva', perm: 'promos.crear', element: <PromoCreatePage /> },
  ],
};
