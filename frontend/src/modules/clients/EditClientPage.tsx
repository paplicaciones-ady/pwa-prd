import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { httpClient } from '../../shared/api/httpClient';
import { useBackTarget } from '../../shared/layout/TopBarContext';

export function EditClientPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  useBackTarget('/clients');
  const [form, setForm] = useState<Record<string, any>>({});
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState('');
  const [saved, setSaved] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!id) return;
    httpClient
      .get(`/clients/${id}`)
      .then((res) => {
        const c = res.data;
        setForm({
          fullName: c.fullName || '',
          documentNumber: c.documentNumber || '',
          documentType: c.documentType || '',
          personType: c.personType || '',
          commercialName: c.commercialName || '',
          legalName: c.legalName || '',
          phone: c.phone || '',
          email: c.email || '',
          billingEmail: c.billingEmail || '',
          treasuryEmail: c.treasuryEmail || '',
          establishmentVocation: c.establishmentVocation || '',
          establishmentSize: c.establishmentSize || '',
          serviceType: c.serviceType || '',
          status: c.status || 'active',
        });
        setLoaded(true);
      })
      .catch((err: any) => setError(err?.response?.data?.message || 'No se pudo cargar el cliente'));
  }, [id]);

  const set = (key: string, value: any) => setForm((prev) => ({ ...prev, [key]: value }));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!id) return;
    setBusy(true);
    setSaved(false);
    setError('');
    try {
      await httpClient.patch(`/clients/${id}`, form);
      setSaved(true);
      setTimeout(() => navigate('/clients'), 700);
    } catch (err: any) {
      setError(err?.response?.data?.message?.message || 'No se pudo guardar el cliente');
      setBusy(false);
    }
  };

  if (error && !loaded) {
    return (
      <div className="s2">
        <div className="s2-head">
          <h1 className="page-title">Editar cliente</h1>
        </div>
        <div className="s2-body">
          <p className="error-msg">{error}</p>
        </div>
      </div>
    );
  }

  if (!loaded) {
    return (
      <div className="s2">
        <div className="s2-head">
          <h1 className="page-title">Editar cliente</h1>
        </div>
        <div className="s2-body">
          <p className="empty-state">Cargando…</p>
        </div>
      </div>
    );
  }

  return (
    <div className="s2">
      <div className="s2-head">
        <h1 className="page-title">Editar cliente</h1>
      </div>

      <form className="s2-body" onSubmit={handleSubmit}>
        <div className="note">
          <svg viewBox="0 0 24 24" fill="none"><circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="2" /><path d="M12 8v5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" /><circle cx="12" cy="16.5" r="1" fill="currentColor" /></svg>
          <p>Actualiza la información del cliente. Los cambios se reflejan de inmediato en el registro.</p>
        </div>

        <div className="sec">Datos básicos</div>
        <div className="field">
          <label>* Nombre / Razón social</label>
          <input className="inp" value={form.fullName} onChange={(e) => set('fullName', e.target.value)} required />
        </div>
        <div className="field">
          <label>* Documento</label>
          <input className="inp" value={form.documentNumber} onChange={(e) => set('documentNumber', e.target.value)} required />
        </div>
        <div className="row2">
          <div className="field">
            <label>Teléfono</label>
            <input className="inp" value={form.phone} onChange={(e) => set('phone', e.target.value)} />
          </div>
          <div className="field">
            <label>Email</label>
            <input className="inp" type="email" value={form.email} onChange={(e) => set('email', e.target.value)} />
          </div>
        </div>

        <div className="sec">Información comercial</div>
        <div className="field">
          <label>Razón comercial</label>
          <input className="inp" value={form.commercialName} onChange={(e) => set('commercialName', e.target.value)} />
        </div>
        <div className="field">
          <label>Razón social (jurídica)</label>
          <input className="inp" value={form.legalName} onChange={(e) => set('legalName', e.target.value)} />
        </div>
        <div className="row2">
          <div className="field">
            <label>Email facturación</label>
            <input className="inp" type="email" value={form.billingEmail} onChange={(e) => set('billingEmail', e.target.value)} />
          </div>
          <div className="field">
            <label>Email tesorería</label>
            <input className="inp" type="email" value={form.treasuryEmail} onChange={(e) => set('treasuryEmail', e.target.value)} />
          </div>
        </div>
        <div className="field">
          <label>Vocación del establecimiento</label>
          <div className="sel">
            <select value={form.establishmentVocation} onChange={(e) => set('establishmentVocation', e.target.value)}>
              <option value="">Seleccionar</option>
              <option value="almacen-agricola">Almacén agrícola</option>
              <option value="almacen-agricola-ferreteria">Almacén agrícola / Ferretería</option>
              <option value="ferroelectrico">Ferroeléctrico</option>
              <option value="ferreteria">Ferretería</option>
              <option value="miscelanea">Miscelánea</option>
              <option value="viveros">Viveros</option>
              <option value="distribucion-pdv">Distribución punto de venta</option>
            </select>
            <svg className="cv" viewBox="0 0 24 24" fill="none"><path d="M6 9l6 6 6-6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" /></svg>
          </div>
        </div>
        <div className="field">
          <label>Tamaño del establecimiento</label>
          <div className="sel">
            <select value={form.establishmentSize} onChange={(e) => set('establishmentSize', e.target.value)}>
              <option value="">Seleccionar</option>
              <option value="hasta-50">Hasta 50 m²</option>
              <option value="50-100">50 – 100 m²</option>
              <option value="100-200">100 – 200 m²</option>
              <option value="mas-200">Más de 200 m²</option>
            </select>
            <svg className="cv" viewBox="0 0 24 24" fill="none"><path d="M6 9l6 6 6-6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" /></svg>
          </div>
        </div>

        <div className="sec">Estado</div>
        <div className="field">
          <label>Estado actual</label>
          <div className="sel">
            <select value={form.status} onChange={(e) => set('status', e.target.value)}>
              <option value="active">Activo</option>
              <option value="inactive">Inactivo</option>
            </select>
            <svg className="cv" viewBox="0 0 24 24" fill="none"><path d="M6 9l6 6 6-6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" /></svg>
          </div>
        </div>

        {error && <p className="error-msg">{error}</p>}
        {saved && <p className="error-msg" style={{ background: 'var(--green-soft)', color: 'var(--green-deep)', borderColor: 'rgba(62,155,97,0.2)' }}>Cambios guardados. Redirigiendo…</p>}

        <div className="rowbtn">
          <button type="button" className="btn btn-ghost" onClick={() => navigate('/clients')}>Cancelar</button>
          <button type="submit" className="btn btn-primary" disabled={busy} style={{ opacity: busy ? 0.6 : 1 }}>
            {busy ? 'Guardando…' : 'Guardar cambios'}
          </button>
        </div>
      </form>
    </div>
  );
}