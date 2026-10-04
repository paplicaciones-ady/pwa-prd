import type { FrontendModule } from '../registry/types';
import { ExpensesPage } from './ExpensesPage';

export const expensesModule: FrontendModule = {
  module: 'expenses',
  label: 'Gastos',
  basePath: '/expenses',
  routes: [{ path: '/expenses', perm: 'expenses.read', element: <ExpensesPage /> }],
};
