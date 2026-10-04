import type { ReactNode } from 'react';

/** Una pantalla del módulo. App.tsx la envuelve en <RequirePerm module perm>. */
export interface ModuleRoute {
  /** Ruta completa de React Router (ej. '/credits/study', '/credits/:id/documents'). */
  path: string;
  /** Permiso exigido por RequirePerm; debe empezar por `${module}.`. */
  perm: string;
  element: ReactNode;
}

/**
 * Declaración frontend de un módulo. Es la única fuente de verdad de sus
 * pantallas: App.tsx genera las <Route> desde aquí y ModuleForm /
 * ModuleVariantForm ofrecen solo estas rutas como `path`.
 */
export interface FrontendModule {
  /** = @Controller('<module>') del backend = columna modules.module en BD. */
  module: string;
  /** Nombre sugerido al registrar el módulo desde Configuración → Módulos. */
  label: string;
  /** Home del módulo (valor por defecto de modules.path). */
  basePath: string;
  /** La primera ruta debe ser `basePath`. */
  routes: ModuleRoute[];
}
