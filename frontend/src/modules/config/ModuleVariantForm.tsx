import { useState } from 'react';
import { httpClient } from '../../shared/api/httpClient';
import { ModuleView, ModuleVariant } from '../auth/AuthContext';
import { ModulePathSelect } from './ModulePathSelect';

interface Props {
  module: ModuleView;
  company: { id: string; name: string };
  existing?: ModuleVariant | null;
  onSaved: () => void;
  onCancel: () => void;
}

export function ModuleVariantForm({ module, company, existing, onSaved, onCancel }: Props) {
  const allOps = (module.operations || []).map((o) => o.action);
  const existingOps = existing?.enabledOperations?.length ? existing.enabledOperations : allOps;

  const [label, setLabel] = useState(existing?.label ?? '');
  const [icon, setIcon] = useState(existing?.icon ?? '');
  const [path, setPath] = useState(existing?.path ?? '');
  const [selected, setSelected] = useState<Set<string>>(new Set(existingOps));
  const [configText, setConfigText] = useState<string>(
    existing && Object.keys(existing.config || {}).length
      ? JSON.stringify(existing.config, null, 2)
      : '',
  );
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const toggleOp = (action: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(action)) next.delete(action);
      else next.add(action);
      return next;
    });
  };

  const save = async () => {
    setError('');
    let config: Record<string, unknown> = {};
    if (configText.trim()) {
      try {
        config = JSON.parse(configText);
      } catch {
        setError('La configuración no es un JSON válido.');
        return;
      }
    }
    const payload: Record<string, unknown> = {
      label: label.trim() || null,
      icon: icon.trim() || null,
      path: path.trim() || null,
      config,
      // [] = todas las operaciones del módulo (comportamiento por defecto)
      enabledOperations: selected.size === allOps.length ? [] : [...selected],
    };
    setBusy(true);
    try {
      await httpClient.put(`/config/modules/${module.id}/variants/${company.id}`, payload);
      onSaved();
    } catch (err: any) {
      setError(err?.response?.data?.message?.message || 'No se pudo guardar la variante.');
    } finally {
      setBusy(false);
    }
  };

  const remove = async () => {
    if (!existing || !window.confirm('¿Eliminar la variante de esta empresa? Volverá al comportamiento por defecto.')) return;
    setBusy(true);
    try {
      await httpClient.delete(`/config/modules/${module.id}/variants/${company.id}`);
      onSaved();
    } catch (err: any) {
      setError(err?.response?.data?.message?.message || 'No se pudo eliminar la variante.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="info-card" style={{ padding: 16, marginTop: 12, background: 'var(--accent-soft)' }}>
      <h4 style={{ margin: 0, fontSize: 13, marginBottom: 8 }}>
        Variante del módulo en <strong>{company.name}</strong>
      </h4>
      <p style={{ fontSize: 11, color: 'var(--faint)', marginBottom: 12 }}>
        “Variante” = cómo se comporta este módulo en esa empresa. Los campos vacíos usan el valor por defecto del módulo.
      </p>

      <div className="row2">
        <div className="field" style={{ flex: 1 }}>
          <label>Nombre visible (opcional)</label>
          <input className="inp" value={label} onChange={(e) => setLabel(e.target.value)} placeholder="Por defecto: del módulo" />
        </div>
        <div className="field" style={{ flex: 1 }}>
          <label>Path (opcional)</label>
          <ModulePathSelect value={path} onChange={(p) => setPath(p)} emptyLabel={`Por defecto: ${module.path}`} />
        </div>
      </div>
      <div className="field">
        <label>Ícono (opcional)</label>
        <input className="inp" value={icon} onChange={(e) => setIcon(e.target.value)} placeholder="https://... o clave de ícono" />
      </div>

      <div className="field">
        <label>Operaciones activas en esta empresa</label>
        {allOps.length === 0 && <p style={{ fontSize: 11, color: 'var(--faint)' }}>El módulo no define operaciones.</p>}
        <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginTop: 6 }}>
          {allOps.map((action) => (
            <label key={action} style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, cursor: 'pointer', background: '#fff', border: '1px solid var(--line)', borderRadius: 8, padding: '6px 10px' }}>
              <input type="checkbox" checked={selected.has(action)} onChange={() => toggleOp(action)} />
              {action}
            </label>
          ))}
        </div>
        {selected.size !== allOps.length && selected.size > 0 && (
          <p style={{ fontSize: 11, color: 'var(--accent-deep)', marginTop: 6 }}>
            Las demás operaciones quedarán desactivadas para esta empresa.
          </p>
        )}
      </div>

      <div className="field">
        <label>Configuración por empresa (JSON, opcional)</label>
        <textarea
          className="inp"
          rows={4}
          value={configText}
          onChange={(e) => setConfigText(e.target.value)}
          placeholder='{\n  "modo": "avanzado",\n  "limiteCredito": 5000000\n}'
          style={{ fontFamily: 'monospace', fontSize: 12 }}
        />
        <p style={{ fontSize: 11, color: 'var(--faint)', marginTop: 4 }}>
          Este objeto se expone en el bootstrap del usuario de la empresa para que el módulo adapte su comportamiento (ej: mostrar/ocultar pasos, límites, flujos).
        </p>
      </div>

      {error && <p style={{ color: 'red', fontSize: 12, marginBottom: 8 }}>{error}</p>}
      <div className="row2">
        <button className="btn btn-primary" onClick={save} disabled={busy} style={{ width: 'auto', padding: '0 18px', opacity: busy ? 0.6 : 1 }}>
          {busy ? 'Guardando…' : 'Guardar variante'}
        </button>
        {existing && (
          <button onClick={remove} disabled={busy} style={{ background: 'none', border: '1px solid #b00020', color: '#b00020', borderRadius: 8, padding: '7px 14px', fontSize: 12, fontWeight: 700, cursor: 'pointer' }}>
            Eliminar variante
          </button>
        )}
        <button onClick={onCancel} style={{ background: 'none', border: 'none', color: 'var(--ink)', fontSize: 12, fontWeight: 700, cursor: 'pointer' }}>
          Cancelar
        </button>
      </div>
    </div>
  );
}