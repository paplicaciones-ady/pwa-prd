import type { ConnectivityState } from './probe';

/**
 * Presentación del estado de conexión. Vive aparte para que el badge y el
 * banner no puedan discrepar: antes ambos mostraban el mismo literal fijo
 * "En línea" escrito en el markup.
 */
export interface StateMeta {
  /** Clase CSS del punto de estado (`.status-dot.<css>`). */
  css: string;
  label: string;
  title: string;
}

export const STATE_META: Record<ConnectivityState, StateMeta> = {
  unknown: {
    css: 'unknown',
    label: 'Comprobando…',
    title: 'Verificando la conexión con el servidor',
  },
  online: {
    css: 'online',
    label: 'En línea',
    title: 'Conectado al servidor',
  },
  degraded: {
    css: 'degraded',
    label: 'Conexión débil',
    title: 'El servidor responde con problemas',
  },
  offline: {
    css: 'offline',
    label: 'Sin conexión',
    title: 'No se puede alcanzar el servidor',
  },
};
