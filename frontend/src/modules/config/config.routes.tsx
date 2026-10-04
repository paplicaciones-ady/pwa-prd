import { lazy, Suspense } from 'react';
import type { FrontendModule } from '../registry/types';

// Import diferido a propósito: ConfigPage → ModulesManagement → ModuleForm
// importa el registro, y el registro importa este archivo. Un import estático
// cerraría el ciclo y, según qué módulo se evalúe primero, `configModule`
// llegaría `undefined` a MODULES.
const ConfigPage = lazy(() => import('./ConfigPage').then((m) => ({ default: m.ConfigPage })));

export const configModule: FrontendModule = {
  module: 'config',
  label: 'Configuración',
  basePath: '/config',
  routes: [
    {
      path: '/config',
      perm: 'config.read',
      element: (
        <Suspense fallback={null}>
          <ConfigPage />
        </Suspense>
      ),
    },
  ],
};
