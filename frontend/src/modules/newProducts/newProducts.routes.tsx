import type { FrontendModule } from '../registry/types';
import { NewProductsPage } from './NewProductsPage';

export const newProductsModule: FrontendModule = {
  module: 'new-products',
  label: 'Productos nuevos',
  basePath: '/new-products',
  routes: [{ path: '/new-products', perm: 'new-products.read', element: <NewProductsPage /> }],
};
