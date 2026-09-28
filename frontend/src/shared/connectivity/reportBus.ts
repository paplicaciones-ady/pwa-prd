/**
 * Bus mínimo para que la capa HTTP avise a la de conectividad sin importarla.
 *
 * `httpClient` necesita reportar fallas de transporte y `ConnectivityProvider`
 * necesita escucharlas. Importarse mutuamente crearía un ciclo, así que ambos
 * dependen de este módulo sin dependencias. Existe además para que una ráfaga
 * de requests caídos dispare una sola verificación, no una por request.
 */
export type TransportFault = 'offline' | 'timeout';

type TransportFaultListener = (fault: TransportFault) => void;

let listener: TransportFaultListener | null = null;

export function onTransportFault(next: TransportFaultListener): () => void {
  listener = next;
  return () => {
    if (listener === next) listener = null;
  };
}

export function reportTransportFault(fault: TransportFault): void {
  listener?.(fault);
}
