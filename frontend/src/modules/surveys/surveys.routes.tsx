import type { FrontendModule } from '../registry/types';
import { SurveysPage } from './SurveysPage';

export const surveysModule: FrontendModule = {
  module: 'surveys',
  label: 'Encuestas',
  basePath: '/surveys',
  routes: [{ path: '/surveys', perm: 'surveys.read', element: <SurveysPage /> }],
};
