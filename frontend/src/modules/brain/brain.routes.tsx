import type { FrontendModule } from '../registry/types';
import { BrainPage } from './BrainPage';

export const brainModule: FrontendModule = {
  module: 'brain',
  label: 'Brain',
  basePath: '/brain',
  routes: [{ path: '/brain', perm: 'brain.read', element: <BrainPage /> }],
};
