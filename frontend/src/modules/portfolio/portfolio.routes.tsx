import type { FrontendModule } from '../registry/types';
import { PortfolioPage } from './PortfolioPage';

export const portfolioModule: FrontendModule = {
  module: 'portfolio',
  label: 'Cartera',
  basePath: '/portfolio',
  routes: [{ path: '/portfolio', perm: 'portfolio.read', element: <PortfolioPage /> }],
};
