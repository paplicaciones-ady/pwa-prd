import type { FrontendModule } from '../registry/types';
import { ProfilesPage } from './ProfilesPage';

export const profilesModule: FrontendModule = {
  module: 'profiles',
  label: 'Perfiles',
  basePath: '/profiles',
  routes: [{ path: '/profiles', perm: 'profiles.read', element: <ProfilesPage /> }],
};
