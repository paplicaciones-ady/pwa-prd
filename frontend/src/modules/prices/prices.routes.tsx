import type { FrontendModule } from '../registry/types';
import { PricesPage } from './PricesPage';

export const pricesModule: FrontendModule = {
  module: 'prices',
  label: 'Precios',
  basePath: '/prices',
  routes: [{ path: '/prices', perm: 'prices.read', element: <PricesPage /> }],
};
