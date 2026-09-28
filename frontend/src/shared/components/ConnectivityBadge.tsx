import { useConnectivity } from '../connectivity/ConnectivityContext';
import { STATE_META } from '../connectivity/labels';

/**
 * Punto de estado real. Reemplaza el literal `<span className="status-dot
 * online">En línea</span>` que estaba hardcodeado en el markup, y que decía
 * "En línea" incluso sin red.
 */
export function ConnectivityBadge() {
  const { state, report } = useConnectivity();
  const meta = STATE_META[state];
  const detail = report.httpStatus ? ` · HTTP ${report.httpStatus}` : '';

  return (
    <span className={`status-dot ${meta.css}`} title={`${meta.title}${detail}`}>
      {meta.label}
    </span>
  );
}
