import type { FrontendModule } from '../registry/types';
import { ClientsListPage } from './ClientsListPage';
import { CreateClientPage } from './CreateClientPage';
import { EditClientPage } from './EditClientPage';

export const clientsModule: FrontendModule = {
  module: 'clients',
  label: 'Clientes',
  basePath: '/clients',
  routes: [
    { path: '/clients', perm: 'clients.read', element: <ClientsListPage /> },
    { path: '/clients/new', perm: 'clients.create', element: <CreateClientPage /> },
    { path: '/clients/:id/edit', perm: 'clients.update', element: <EditClientPage /> },
  ],
};
