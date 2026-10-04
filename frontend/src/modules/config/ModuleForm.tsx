import { useState } from 'react';
import { httpClient } from '../../shared/api/httpClient';
import { ModuleView, CompanySummary } from '../auth/AuthContext';
import { FrontendModule, findModule, isRegisteredPath } from '../registry';
import { ModulePathSelect } from './ModulePathSelect';

export interface ModuleFormValue {
  key: string;
  module: string;
  label: string;
  path: string;
  icon: string;
  global: boolean;
  companyId: string;
  placement: 'grid' | 'fab';
  position: number;
  enabled: boolean;
  operations: { action: string; name: string }[];
}

const CRUD_OPS = [
  { action: 'read', name: 'Leer' },
  { action: 'create', name: 'Crear' },
  { action: 'update', name: 'Editar' },
  { action: 'delete', name: 'Eliminar' },
];

interface Props {
  mode: 'create' | 'edit';
  editing?: ModuleView;
  superMode: boolean;
  companies: CompanySummary[];
  defaultCompanyId?: string;
  onSaved: () => void;
}

export function ModuleForm({ mode, editing, superMode, companies, defaultCompanyId, onSaved }: Props) {
  const toValue = (): ModuleFormValue =>
    editing
      ? {
          key: editing.key,
          module: editing.module,
          label: editing.label,
          path: editing.path,
          icon: editing.icon || '',
          global: editing.scope === 'global',
          companyId: editing.companyId || defaultCompanyId || companies[0]?.id || '',
          placement: editing.ownerAssignment?.placement || 'grid',
          position: editing.ownerAssignment?.position ?? 0,
          enabled: editing.enabled,
          operations: editing.operations.length ? editing.operations : [...CRUD_OPS],
        }
      : {
          key: '',
          module: '',
          label: '',
          path: '',
          icon: '',
          global: false,
          companyId: defaultCompanyId || companies[0]?.id || '',
          placement: 'grid',
          position: 0,
          enabled: true,
          operations: [...CRUD_OPS],
        };

  const [value, setValue] = useState<ModuleFormValue>(toValue);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const set = (patch: Partial<ModuleFormValue>) => setValue((v) => ({ ...v, ...patch }));

  const hasUpdateOrDelete = value.operations.some((o) => o.action === 'update' || o.action === 'delete');
  const hasRead = value.operations.some((o) => o.action === 'read');
  const ruleBroken = hasUpdateOrDelete && !hasRead;

  const prefill = () => set({ operations: [...CRUD_OPS] });

  // `module` siempre sale del registro: es el dueño de la pantalla elegida
  // (= @Controller del backend), así no puede quedar desalineado del path.
  const pickPath = (path: string, owner: FrontendModule | undefined) => {
    if (mode === 'create') {
      set({ path, module: owner?.module ?? '', label: value.label || owner?.label || '' });
    } else {
      set({ path });
    }
  };
  const pathOwner = findModule(value.module);
  const pathMismatch = mode === 'edit' && !!value.path && isRegisteredPath(value.path) && !pathOwner?.routes.some((r) => r.path === value.path);

  const addOperation = () => {
    const existing = value.operations.map((o) => o.action);
    const picked = CRUD_OPS.find((o) => !existing.includes(o.action)) || { action: 'leer_detalles', name: 'Ver detalles' };
    set({ operations: [...value.operations, { action: picked.action, name: picked.name }] });
  };

  const updateOperation = (index: number, patch: Partial<{ action: string; name: string }>) => {
    const ops = value.operations.slice();
    ops[index] = { ...ops[index], ...patch };
    set({ operations: ops });
  };

  const removeOperation = (index: number) => {
    set({ operations: value.operations.filter((_, i) => i !== index) });
  };

  const save = async () => {
    setError('');
    if (!value.key.trim() || !value.module.trim() || !value.label.trim() || !value.path.trim()) {
      setError('Completá key, pantalla (path), nombre visible y módulo backend.');
      return;
    }
    if (mode === 'create' && !isRegisteredPath(value.path)) {
      setError('El path debe ser una pantalla registrada en el frontend (modules/registry).');
      return;
    }
    if (value.operations.length === 0) {
      setError('Definí al menos una operación.');
      return;
    }
    if (ruleBroken) {
      setError('Si tenés operaciones de edición o eliminación, es obligatorio incluir la operación de lectura (Leer).');
      return;
    }
    if (value.global && !superMode) {
      setError('Solo el superadmin puede crear módulos globales.');
      return;
    }
    if (!value.global && !value.companyId) {
      setError('Indicá la empresa del módulo.');
      return;
    }
    setBusy(true);
    try {
      if (mode === 'create') {
        const res = await httpClient.post('/config/modules', {
          key: value.key.trim(),
          module: value.module.trim(),
          label: value.label.trim(),
          path: value.path.trim(),
          icon: value.icon.trim() || undefined,
          global: value.global,
          companyId: value.global ? undefined : value.companyId,
          enabled: value.enabled,
          operations: value.operations,
        });
        const created = res.data as ModuleView;
        if (!value.global && (value.placement !== 'grid' || value.position !== 0)) {
          await httpClient.patch(`/config/modules/${created.id}/assignment`, {
            placement: value.placement,
            position: value.position,
          });
        }
      } else if (editing) {
        const payload: Record<string, unknown> = {
          label: value.label.trim(),
          icon: value.icon.trim() || null,
          path: value.path.trim(),
          enabled: value.enabled,
          operations: value.operations,
        };
        if (superMode) {
          if (value.global !== (editing.scope === 'global')) payload.global = value.global;
          if (!value.global && value.companyId && value.companyId !== editing.companyId) {
            payload.companyId = value.companyId;
          }
        }
        await httpClient.patch(`/config/modules/${editing.id}`, payload);
        if (!value.global) {
          const target =
            editing.ownerAssignment?.companyId ||
            (editing.scope === 'company' ? editing.companyId : value.companyId) ||
            value.companyId;
          if (target && editing.ownerAssignment) {
            await httpClient.patch(`/config/modules/${editing.id}/assignment`, {
              placement: value.placement,
              position: value.position,
            });
          }
        }
      }
      onSaved();
    } catch (err: any) {
      setError(err?.response?.data?.message?.message || 'No se pudo guardar el módulo.');
    } finally {
      setBusy(false);
    }
  };

  const showGlobalConfig = superMode;
  const isGlobal = value.global;

  return (
    <div className="info-card" style={{ padding: 20, marginBottom: 16 }}>
      <h3 className="section-title" style={{ marginTop: 0 }}>
        {mode === 'create' ? 'Nuevo módulo' : `Editar módulo · ${editing?.label}`}
      </h3>

      {showGlobalConfig && (
        <div className="row2">
          <div className="field" style={{ flex: 1 }}>
            <label>Alcance</label>
            <div className="sel">
              <select value={value.global ? 'global' : 'company'} onChange={(e) => set({ global: e.target.value === 'global' })}>
                <option value="company">Empresa propia</option>
                <option value="global">Global (plataforma)</option>
              </select>
              <svg className="cv" viewBox="0 0 24 24" fill="none"><path d="M6 9l6 6 6-6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" /></svg>
            </div>
          </div>
          {!isGlobal && (
            <div className="field" style={{ flex: 1 }}>
              <label>Empresa dueña</label>
              <div className="sel">
                <select value={value.companyId} onChange={(e) => set({ companyId: e.target.value })}>
                  {companies.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
                <svg className="cv" viewBox="0 0 24 24" fill="none"><path d="M6 9l6 6 6-6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" /></svg>
              </div>
            </div>
          )}
        </div>
      )}

      <div className="row2">
        <div className="field" style={{ flex: 1 }}>
          <label>Pantalla (path frontend)</label>
          <ModulePathSelect value={value.path} onChange={pickPath} />
          {pathMismatch && (
            <p style={{ color: '#b00020', fontSize: 11, marginTop: 4 }}>
              ⚠️ Esta pantalla pertenece a otro módulo: se pedirán permisos de ese módulo, no de <code>{value.module}.*</code>.
            </p>
          )}
        </div>
        <div className="field" style={{ flex: 1 }}>
          <label>Módulo backend (recurso)</label>
          <input className="inp" value={value.module} placeholder="Se completa al elegir la pantalla" disabled />
        </div>
      </div>
      <div className="row2">
        <div className="field" style={{ flex: 1 }}>
          <label>Key</label>
          <input className="inp" value={value.key} onChange={(e) => set({ key: e.target.value })} placeholder="Ej: creditos" disabled={mode === 'edit'} />
        </div>
        <div className="field" style={{ flex: 1 }}>
          <label>Nombre visible</label>
          <input className="inp" value={value.label} onChange={(e) => set({ label: e.target.value })} placeholder="Ej: Créditos" />
        </div>
      </div>
      <div className="field">
        <label>Ícono (URL o clave existente)</label>
        <input className="inp" value={value.icon} onChange={(e) => set({ icon: e.target.value })} placeholder="https://.../logo.png  o  creditos" />
        <p style={{ fontSize: 11, color: 'var(--accent)', marginTop: 4 }}>
          ℹ️ El ícono se muestra en el Home/FAB y enlaza a la <strong>pantalla elegida</strong> (normalmente el home del módulo). Solo se listan pantallas registradas en <code>modules/registry</code>.
        </p>
      </div>

      {!isGlobal && (
        <div className="row2">
          <div className="field" style={{ flex: 1 }}>
            <label>Ubicación</label>
            <div className="sel">
              <select value={value.placement} onChange={(e) => set({ placement: e.target.value as 'grid' | 'fab' })}>
                <option value="grid">Botón en Home</option>
                <option value="fab">FAB superior derecha</option>
              </select>
              <svg className="cv" viewBox="0 0 24 24" fill="none"><path d="M6 9l6 6 6-6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" /></svg>
            </div>
          </div>
          <div className="field" style={{ flex: 1 }}>
            <label>Posición</label>
            <input className="inp" type="number" value={value.position} onChange={(e) => set({ position: Number(e.target.value) })} />
          </div>
        </div>
      )}

      {isGlobal && (
        <p style={{ fontSize: 12, background: 'var(--accent-soft)', padding: '8px 12px', borderRadius: 10, marginBottom: 12 }}>
          🌐 Los módulos globales solo se muestran en el <strong>FAB</strong> de las empresas donde los publiques (usá "Publicar" en la lista).
        </p>
      )}

      <div className="field">
        <label>Operaciones (registra permisos <code>{value.module ? `${value.module.trim() || 'modulo'}.*` : 'modulo.*'}</code>)</label>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 6 }}>
          <button type="button" className="btn btn-ghost" onClick={prefill} style={{ width: 'auto', padding: '6px 14px', fontSize: 12 }}>
            Autocompletar CRUD
          </button>
          <button type="button" className="btn btn-ghost" onClick={addOperation} style={{ width: 'auto', padding: '6px 14px', fontSize: 12 }}>
            + Agregar operación
          </button>
        </div>
        <div style={{ marginTop: 8, display: 'flex', flexDirection: 'column', gap: 8 }}>
          {value.operations.map((op, i) => (
            <div key={i} style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
              <input
                className="inp"
                value={op.action}
                onChange={(e) => updateOperation(i, { action: e.target.value })}
                placeholder="acción (ej: read)"
                style={{ width: 140 }}
              />
              <input
                className="inp"
                value={op.name}
                onChange={(e) => updateOperation(i, { name: e.target.value })}
                placeholder="Nombre (ej: Leer)"
                style={{ flex: 1 }}
              />
              <button
                type="button"
                onClick={() => removeOperation(i)}
                style={{ background: 'none', border: 'none', color: '#b00020', fontSize: 12, fontWeight: 700, cursor: 'pointer' }}
              >
                Quitar
              </button>
            </div>
          ))}
        </div>
        {ruleBroken && (
          <p style={{ color: '#b00020', fontSize: 12, marginTop: 6 }}>
            ⚠️ Si hay operaciones de edición (update) o eliminación (delete), la operación de lectura (read) es obligatoria.
          </p>
        )}
      </div>

      <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, margin: '12px 0', cursor: 'pointer' }}>
        <input type="checkbox" checked={value.enabled} onChange={(e) => set({ enabled: e.target.checked })} />
        Módulo habilitado
      </label>

      {error && <p style={{ color: 'red', fontSize: 12, marginBottom: 8 }}>{error}</p>}
      <button className="btn btn-primary" onClick={save} disabled={busy} style={{ width: 'auto', padding: '0 24px', opacity: busy ? 0.6 : 1 }}>
        {busy ? 'Guardando…' : mode === 'create' ? 'Crear módulo' : 'Guardar cambios'}
      </button>
    </div>
  );
}