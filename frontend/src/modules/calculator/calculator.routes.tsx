import type { FrontendModule } from '../registry/types';
import { CalculatorPage } from './CalculatorPage';

export const calculatorModule: FrontendModule = {
  module: 'calculator',
  label: 'Calculadora',
  basePath: '/calculator',
  routes: [{ path: '/calculator', perm: 'calculator.sumar', element: <CalculatorPage /> }],
};
