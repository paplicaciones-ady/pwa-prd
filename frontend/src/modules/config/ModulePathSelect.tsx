import { MODULES, FrontendModule, isRegisteredPath, staticPaths } from '../registry';

interface Props {
  value: string;
  onChange: (path: string, owner: FrontendModule | undefined) => void;
  /** Texto de la opción vacía (ej. variantes: "Por defecto: del módulo"). Sin él, la opción vacía es un placeholder. */
  emptyLabel?: string;
}

/**
 * Selector de `path` restringido al registro de módulos frontend: evita
 * guardar en BD rutas que no tienen pantalla. Si el valor actual no está
 * registrado (dato previo al registro) se muestra igualmente, marcado, para
 * no perderlo al editar.
 */
export function ModulePathSelect({ value, onChange, emptyLabel }: Props) {
  const unregistered = value !== '' && !isRegisteredPath(value);
  const ownerOf = (path: string) => MODULES.find((m) => staticPaths(m).includes(path));

  return (
    <>
      <div className="sel">
        <select value={value} onChange={(e) => onChange(e.target.value, ownerOf(e.target.value))}>
          <option value="" disabled={!emptyLabel}>{emptyLabel ?? 'Elegí una pantalla…'}</option>
          {unregistered && <option value={value}>⚠ {value} (no registrada)</option>}
          {MODULES.map((m) => (
            <optgroup key={m.module} label={`${m.label} · ${m.module}`}>
              {staticPaths(m).map((p) => (
                <option key={p} value={p}>{p === m.basePath ? `${p} (home)` : p}</option>
              ))}
            </optgroup>
          ))}
        </select>
        <svg className="cv" viewBox="0 0 24 24" fill="none"><path d="M6 9l6 6 6-6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" /></svg>
      </div>
      {unregistered && (
        <p style={{ color: '#b00020', fontSize: 11, marginTop: 4 }}>
          ⚠️ Esta ruta no existe en el frontend: el botón del módulo no abrirá ninguna pantalla. Elegí una ruta registrada.
        </p>
      )}
    </>
  );
}
