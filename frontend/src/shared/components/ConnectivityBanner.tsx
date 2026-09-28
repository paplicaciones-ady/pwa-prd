import { useConnectivity } from '../connectivity/ConnectivityContext';
import { STATE_META } from '../connectivity/labels';
import { describeReport } from '../connectivity/probe';

/**
 * Aviso de conexión, fijo sobre el contenido y por encima de la barra.
 *
 * Solo aparece ante un problema real. Una latencia alta por sí sola no levanta
 * un banner: en un enlace lento molestaría en cada navegación, así que queda
 * solo en el punto de estado del header.
 */
export function ConnectivityBanner() {
  const { state, report, isProbing, refresh } = useConnectivity();

  if (state === 'online' || state === 'unknown') return null;
  if (state === 'degraded' && report.fault === 'slow') return null;

  const meta = STATE_META[state];
  const detail = state === 'offline' ? 'Revisá tu red. Los datos que cargues no se van a poder guardar todavía.' : describeReport(report);

  return (
    <div className={`conn-banner conn-banner-${meta.css}`} role="status" aria-live="polite">
      <div className="conn-banner-text">
        <strong>{meta.label}</strong>
        <span>{detail}</span>
      </div>
      <button
        type="button"
        className="conn-banner-retry"
        onClick={() => void refresh()}
        disabled={isProbing}
        title="Verificar la conexión otra vez"
      >
        {isProbing ? 'Comprobando…' : 'Reintentar'}
      </button>
    </div>
  );
}
