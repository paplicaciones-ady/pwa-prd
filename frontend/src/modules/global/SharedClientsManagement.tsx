import { useEffect, useState } from 'react';
import { httpClient } from '../../shared/api/httpClient';
import { Modal } from '../../shared/components/Modal';
import { isValidFullNit, sanitizeDocumentNumber } from '../../shared/utils/validators';

interface SharedClient {
  id: string;
  fullName: string;
  documentType?: string | null;
  documentNumber: string;
  personType?: 'natural' | 'juridica' | null;
  phone?: string | null;
  email?: string | null;
  commercialName?: string | null;
  legalName?: string | null;
  status: 'active' | 'inactive';
}

/** Campos editables del padrón compartido (subconjunto de UpdateClientDto). */
const FIELDS: { key: keyof SharedClient; label: string; type?: string; juridicaOnly?: boolean }[] = [
  { key: 'fullName', label: 'Nombre completo' },
  { key: 'documentNumber', label: "Número de documento (sin '-')" },
  { key: 'phone', label: 'Teléfono', type: 'tel' },
  { key: 'email', label: 'Correo electrónico', type: 'email' },
  { key: 'commercialName', label: 'Nombre comercial', juridicaOnly: true },
  { key: 'legalName', label: 'Razón social', juridicaOnly: true },
];

const EMPTY_NEW = {
  personType: 'natural',
  documentType: 'cc',
  documentNumber: '',
  fullName: '',
  phone: '',
  email: '',
  commercialName: '',
  legalName: '',
};

/** DV a mostrar: solo el NIT lo tiene (su último dígito, si es válido); la cédula y otros no. */
const dvOf = (doc: string, documentType: string) => (documentType === 'nit' && isValidFullNit(doc) ? doc.slice(-1) : '');
const nitLabel = (documentType?: string | null) =>
  documentType === 'nit' ? "NIT completo, con DV y sin '-'" : "Número de documento (sin '-')";

const errorMessage = (err: any, fallback: string) => err?.response?.data?.message?.message || err?.response?.data?.message || fallback;

/**
 * Clientes del padrón compartido (company_id NULL), visibles para todas las
 * empresas. Solo el superadmin los edita o desactiva; dentro de una empresa
 * aparecen en solo lectura. Backend: GET/PATCH /clients/shared.
 */
export function SharedClientsManagement() {
  const [clients, setClients] = useState<SharedClient[]>([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState('');
  const [editing, setEditing] = useState<SharedClient | null>(null);
  const [form, setForm] = useState<Record<string, string>>({});
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [creating, setCreating] = useState(false);
  const [newClient, setNewClient] = useState(EMPTY_NEW);

  const load = () => {
    setLoading(true);
    httpClient
      .get('/clients/shared')
      .then((res) => setClients(res.data))
      .catch((err) => setError(errorMessage(err, 'No se pudieron cargar los clientes globales')))
      .finally(() => setLoading(false));
  };

  useEffect(load, []);

  const openEdit = (c: SharedClient) => {
    setError('');
    setEditing(c);
    setForm(Object.fromEntries(FIELDS.map((f) => [f.key, String(c[f.key] ?? '')])));
  };

  const save = async () => {
    if (!editing) return;
    // Solo lo que cambió y no quedó vacío: el backend valida formato (p. ej. correo).
    const changes = Object.fromEntries(
      FIELDS.map((f) => [f.key, form[f.key].trim()]).filter(([k, v]) => v !== '' && v !== String(editing[k as keyof SharedClient] ?? '')),
    );
    if (Object.keys(changes).length === 0) {
      setEditing(null);
      return;
    }
    setBusy(true);
    setError('');
    try {
      await httpClient.patch(`/clients/shared/${editing.id}`, changes);
      setEditing(null);
      load();
    } catch (err) {
      setError(errorMessage(err, 'No se pudo guardar el cliente'));
    } finally {
      setBusy(false);
    }
  };

  const openCreate = () => {
    setError('');
    setNewClient(EMPTY_NEW);
    setCreating(true);
  };

  const create = async () => {
    const payload = Object.fromEntries(Object.entries(newClient).map(([k, v]) => [k, v.trim()]).filter(([, v]) => v !== ''));
    if (newClient.documentType === 'nit' && !isValidFullNit(newClient.documentNumber)) {
      setError("El NIT va completo, con su DV al final y sin '-'");
      return;
    }
    const dv = dvOf(newClient.documentNumber, newClient.documentType);
    if (dv) payload.dv = dv;
    if (newClient.personType !== 'juridica') {
      delete payload.commercialName;
      delete payload.legalName;
    }
    setBusy(true);
    setError('');
    try {
      await httpClient.post('/clients/shared', payload);
      setCreating(false);
      load();
    } catch (err) {
      setError(errorMessage(err, 'No se pudo crear el cliente'));
    } finally {
      setBusy(false);
    }
  };

  const setNew = (key: keyof typeof EMPTY_NEW, value: string) => setNewClient((prev) => ({ ...prev, [key]: value }));

  const toggleStatus = async (c: SharedClient) => {
    const verb = c.status === 'active' ? 'desactivar' : 'activar';
    if (!window.confirm(`¿Seguro que quieres ${verb} a ${c.fullName}? El cambio aplica para todas las empresas.`)) return;
    setError('');
    try {
      await httpClient.patch(`/clients/shared/${c.id}/status`);
      load();
    } catch (err) {
      setError(errorMessage(err, `No se pudo ${verb} el cliente`));
    }
  };

  const q = query.trim().toLowerCase();
  const visible = q ? clients.filter((c) => c.fullName.toLowerCase().includes(q) || c.documentNumber.includes(q)) : clients;

  return (
    <div>
      <div className="note" style={{ marginBottom: 14 }}>
        <p>
          Clientes visibles para <strong>todas las empresas</strong>. Los cambios aplican para todas; dentro de cada
          empresa estos clientes son de solo lectura.
        </p>
      </div>

      <div className="row2" style={{ alignItems: 'center', marginBottom: 13 }}>
        <input className="inp" style={{ flex: 1 }} value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Buscar por nombre o documento" />
        <button className="btn btn-primary" style={{ width: 'auto', padding: '0 18px', flex: 'none' }} onClick={openCreate}>
          Nuevo cliente global
        </button>
      </div>

      {error && !editing && !creating && <p style={{ color: '#c62828', fontSize: 12, marginBottom: 8 }}>{error}</p>}
      {!loading && visible.length === 0 && <p className="empty-state">No hay clientes globales{q ? ' que coincidan' : ''}.</p>}

      {visible.map((c) => {
        const active = c.status === 'active';
        return (
          <div key={c.id} className="info-card" style={{ padding: '14px 16px', marginBottom: 12, opacity: active ? 1 : 0.72 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 10 }}>
              <div style={{ minWidth: 0 }}>
                <strong style={{ fontSize: 14, color: 'var(--ink)', wordBreak: 'break-word' }}>{c.fullName}</strong>
                <div style={{ fontSize: 11.5, color: 'var(--muted)', marginTop: 2 }}>
                  {(c.documentType ?? '').toUpperCase()} {c.documentNumber} · {c.personType === 'juridica' ? 'Jurídica' : 'Natural'}
                </div>
              </div>
              <span
                style={{
                  flex: 'none',
                  fontSize: 11,
                  fontWeight: 700,
                  padding: '3px 9px',
                  borderRadius: 99,
                  background: active ? 'var(--green-soft)' : '#f1f3f5',
                  color: active ? 'var(--green-deep)' : 'var(--muted)',
                }}
              >
                {active ? 'Activo' : 'Inactivo'}
              </span>
            </div>
            <div style={{ display: 'flex', gap: 8, marginTop: 12, justifyContent: 'flex-end' }}>
              <button className="btn btn-ghost" style={{ width: 'auto', height: 38, padding: '0 14px', fontSize: 12.5 }} onClick={() => openEdit(c)}>
                Editar
              </button>
              <button
                className="btn btn-ghost"
                style={{ width: 'auto', height: 38, padding: '0 14px', fontSize: 12.5, color: active ? '#b00020' : 'var(--green-deep)' }}
                onClick={() => toggleStatus(c)}
              >
                {active ? 'Desactivar' : 'Activar'}
              </button>
            </div>
          </div>
        );
      })}

      <Modal open={!!editing} onClose={() => !busy && setEditing(null)}>
        <div className="sectitle">Editar cliente global</div>
        {editing &&
          FIELDS.filter((f) => !f.juridicaOnly || editing.personType === 'juridica').map((f) => (
            <div className="field" key={f.key}>
              <label>{f.key === 'documentNumber' ? nitLabel(editing.documentType) : f.label}</label>
              <input
                className="inp"
                type={f.type ?? 'text'}
                value={form[f.key] ?? ''}
                onChange={(e) =>
                  setForm((prev) => ({
                    ...prev,
                    [f.key]: f.key === 'documentNumber' ? sanitizeDocumentNumber(e.target.value) : e.target.value,
                  }))
                }
              />
            </div>
          ))}
        {error && editing && <p style={{ color: '#c62828', fontSize: 12, margin: '6px 2px' }}>{error}</p>}
        <div className="rowbtn" style={{ marginTop: 12 }}>
          <button className="btn btn-ghost" disabled={busy} onClick={() => setEditing(null)}>
            Cancelar
          </button>
          <button className="btn btn-primary" disabled={busy} onClick={save}>
            {busy ? 'Guardando…' : 'Guardar'}
          </button>
        </div>
      </Modal>

      <Modal open={creating} onClose={() => !busy && setCreating(false)}>
        <div className="sectitle">Nuevo cliente global</div>
        <p style={{ fontSize: 11.5, color: 'var(--muted)', margin: '-4px 0 12px' }}>
          Quedará visible para todas las empresas. Direcciones y referencias se registran dentro de cada empresa.
        </p>
        <div className="field">
          <label>Tipo de persona</label>
          <div className="radio-group">
            {(['natural', 'juridica'] as const).map((t) => (
              <label className="radio" key={t}>
                <input
                  type="radio"
                  name="sharedPersonType"
                  checked={newClient.personType === t}
                  onChange={() => setNewClient((prev) => ({ ...prev, personType: t, documentType: t === 'juridica' ? 'nit' : 'cc' }))}
                />
                <span>{t === 'juridica' ? 'Jurídica' : 'Natural'}</span>
              </label>
            ))}
          </div>
        </div>
        <div className="field">
          <label>Tipo de documento</label>
          <div className="sel">
            <select value={newClient.documentType} onChange={(e) => setNew('documentType', e.target.value)}>
              <option value="nit">NIT</option>
              <option value="cc">Cédula de Ciudadanía</option>
              <option value="ce">Cédula de Extranjería</option>
              <option value="pp">Permiso de Protección</option>
            </select>
          </div>
        </div>
        <div className="row2">
          <div className="field" style={{ flex: 3 }}>
            <label>* {nitLabel(newClient.documentType)}</label>
            <input
              className="inp"
              inputMode="numeric"
              maxLength={20}
              value={newClient.documentNumber}
              onChange={(e) => setNew('documentNumber', sanitizeDocumentNumber(e.target.value))}
            />
          </div>
          {newClient.documentType === 'nit' && (
            <div className="field" style={{ flex: 1 }}>
              <label>DV</label>
              <input className="inp" value={dvOf(newClient.documentNumber, newClient.documentType) || '—'} readOnly />
            </div>
          )}
        </div>
        <div className="field">
          <label>* {newClient.personType === 'juridica' ? 'Razón social / nombre' : 'Nombre completo'}</label>
          <input className="inp" value={newClient.fullName} onChange={(e) => setNew('fullName', e.target.value)} />
        </div>
        {newClient.personType === 'juridica' && (
          <div className="field">
            <label>Nombre comercial</label>
            <input className="inp" value={newClient.commercialName} onChange={(e) => setNew('commercialName', e.target.value)} />
          </div>
        )}
        <div className="row2">
          <div className="field" style={{ flex: 1 }}>
            <label>Teléfono</label>
            <input className="inp" type="tel" value={newClient.phone} onChange={(e) => setNew('phone', e.target.value)} />
          </div>
          <div className="field" style={{ flex: 1 }}>
            <label>Correo electrónico</label>
            <input className="inp" type="email" value={newClient.email} onChange={(e) => setNew('email', e.target.value)} />
          </div>
        </div>
        {error && creating && <p style={{ color: '#c62828', fontSize: 12, margin: '6px 2px' }}>{error}</p>}
        <div className="rowbtn" style={{ marginTop: 12 }}>
          <button className="btn btn-ghost" disabled={busy} onClick={() => setCreating(false)}>
            Cancelar
          </button>
          <button
            className="btn btn-primary"
            disabled={busy || !newClient.documentNumber || !newClient.fullName.trim()}
            onClick={create}
          >
            {busy ? 'Creando…' : 'Crear cliente global'}
          </button>
        </div>
      </Modal>
    </div>
  );
}
