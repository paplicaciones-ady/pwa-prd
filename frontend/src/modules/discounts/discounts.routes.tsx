import type { FrontendModule } from '../registry/types';
import { DiscountsPage } from './DiscountsPage';

export const discountsModule: FrontendModule = {
  module: 'discounts',
  label: 'Descuentos',
  basePath: '/discounts',
  routes: [{ path: '/discounts', perm: 'discounts.read', element: <DiscountsPage /> }],
};
