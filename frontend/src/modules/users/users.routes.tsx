import type { FrontendModule } from '../registry/types';
import { UsersListPage } from './UsersListPage';

export const usersModule: FrontendModule = {
  module: 'users',
  label: 'Usuarios',
  basePath: '/users',
  routes: [{ path: '/users', perm: 'users.read', element: <UsersListPage /> }],
};
