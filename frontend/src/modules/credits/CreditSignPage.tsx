import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { AddressBuilderModal } from '../../shared/components/AddressBuilderModal';
import { AppBar } from '../../shared/components/AppBar';
import { CreditStepper } from '../../shared/components/CreditStepper';
import { httpClient } from '../../shared/api/httpClient';
import { useTheme } from '../../shared/theme/ThemeContext';
import { resumePath, statusMeta } from './creditStatus';

interface SignCredit {
  id: string;
  applicationNumber: string;
  approvedLimit: string;
  status: string;
  client?: {
    fullName: string;
    documentNumber: string;
    legalName?: string;
  };
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PHONE_RE = /^\+?\d{7,15}$/;

/** Mismas reglas que SignCreditDto en el backend; '' si el campo es válido. */
function contactErrors(email: string, phone: string, address: string) {
  return {
    email: EMAIL_RE.test(email.trim()) ? '' : 'Ingrese un correo válido',
    phone: PHONE_RE.test(phone.replace(/[\s()-]/g, '')) ? '' : 'Entre 7 y 15 dígitos',
    address: address.trim().length >= 5 ? '' : 'Ingrese la dirección completa',
  };
}

export function CreditSignPage() {
  const { id } = useParams<{ id: string }>();
  const theme = useTheme();
  const navigate = useNavigate();
  const [credit, setCredit] = useState<SignCredit | null>(null);
  const [confirm, setConfirm] = useState(false);
  // Vacíos a propósito: el asesor los confirma con el cliente, no se precargan.
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [address, setAddress] = useState('');
  const [addrModal, setAddrModal] = useState(false);
  const [touched, setTouched] = useState(false);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!id) return;
    httpClient
      .get(`/credits/${id}`)
      .then((res) => setCredit(res.data))
      .catch((err: any) => setError(err?.response?.data?.message?.message || 'No se pudo cargar el crédito'));
  }, [id]);

  const errors = contactErrors(email, phone, address);
  const contactValid = !errors.email && !errors.phone && !errors.address;

  const sign = async () => {
    if (!id) return;
    setTouched(true);
    if (!contactValid) return;
    setBusy(true);
    setError('');
    try {
      // Queda en pending_signatures hasta que el servicio externo confirme las firmas.
      await httpClient.post(`/credits/${id}/sign`, { email: email.trim(), phone, address: address.trim() });
      navigate(`/credits/success/${id}`, { replace: true });
    } catch (err: any) {
      setError(err?.response?.data?.message?.message || 'No se pudieron enviar los documentos a firma');
      setBusy(false);
    }
  };

  if (error && !credit) {
    return (
      <div className="s2 crflow">
        <AppBar title="Firma de documentos" subtitle="Paso 3 de 4" logo={theme.logoUrl || undefined} />
        <div className="body" style={{ paddingBottom: 24 }}>
          <div className="card" style={{ borderColor: '#f6caca', background: '#fdecec', color: '#c62828', fontSize: 12, fontWeight: 600 }}>
            {error}
          </div>
        </div>
      </div>
    );
  }

  if (!credit) {
    return (
      <div className="s2 crflow">
        <AppBar title="Firma de documentos" subtitle="Paso 3 de 4" logo={theme.logoUrl || undefined} />
        <div className="body" style={{ color: 'var(--muted)', fontSize: 13 }}>Cargando…</div>
      </div>
    );
  }

  const clientName = credit.client?.legalName || credit.client?.fullName;

  // Solo un crédito pre-aprobado se envía a firma. Si ya avanzó (o terminó),
  // se ofrece ir a donde corresponde según su estado.
  if (credit.status !== 'pre_approved') {
    const next = resumePath(credit.id, credit.status);
    return (
      <div className="s2 crflow">
        <AppBar title="Firma de documentos" subtitle="Paso 3 de 4" logo={theme.logoUrl || undefined} />
        <div className="body" style={{ paddingBottom: 24 }}>
          <CreditStepper current={3} />
          <div className="note">
            <p>
              Esta solicitud está en estado <strong>{statusMeta(credit.status).label}</strong>: los documentos solo
              se envían a firma cuando el crédito está pre-aprobado.
            </p>
          </div>
          <div className="rowbtn" style={{ marginTop: 16 }}>
            <button className="btn btn-ghost" onClick={() => navigate('/credits/list')}>Volver a la lista</button>
            {next && next !== `/credits/sign/${credit.id}` && (
              <button className="btn btn-primary" onClick={() => navigate(next)}>Continuar</button>
            )}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="s2 crflow">
      <AppBar title="Firma de documentos" subtitle="Paso 3 de 4" logo={theme.logoUrl || undefined} />
      <div className="body" style={{ paddingBottom: 24 }}>
        <CreditStepper current={3} />

        <div className="sectitle">Confirma los datos de contacto</div>

        <div className="card">
          <div className="stk"><div className="k">Cliente</div><div className="v">{clientName}</div></div>
          <div className="stk"><div className="k">NIT</div><div className="v">{credit.client?.documentNumber}</div></div>
          <div className="stk"><div className="k">Solicitud</div><div className="v">{credit.applicationNumber || '—'}</div></div>
          <div className="stk"><div className="k">Cupo pre-aprobado</div><div className="v" style={{ color: 'var(--green-deep)' }}>${Number(credit.approvedLimit).toLocaleString('es-CO')}</div></div>
        </div>

        <div className="field" style={{ marginBottom: 10 }}>
          <label>Correo electrónico</label>
          <input
            className="inp"
            type="email"
            inputMode="email"
            autoComplete="off"
            placeholder="* correo@cliente.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
          {touched && errors.email && <p style={{ color: '#c62828', fontSize: 11.5, fontWeight: 600, margin: '4px 2px 0' }}>{errors.email}</p>}
        </div>

        <div className="field" style={{ marginBottom: 10 }}>
          <label>Teléfono de contacto</label>
          <input
            className="inp"
            type="tel"
            inputMode="tel"
            autoComplete="off"
            placeholder="* Celular o fijo"
            value={phone}
            onChange={(e) => setPhone(e.target.value.replace(/[^\d+\s()-]/g, ''))}
          />
          {touched && errors.phone && <p style={{ color: '#c62828', fontSize: 11.5, fontWeight: 600, margin: '4px 2px 0' }}>{errors.phone}</p>}
        </div>

        <div className="field" style={{ marginBottom: 12 }}>
          <label>Dirección</label>
          <div className="inp-row inset">
            <input
              className="inp"
              autoComplete="off"
              placeholder="* Escriba la dirección o use el constructor"
              value={address}
              onChange={(e) => setAddress(e.target.value)}
            />
            <button className="addr-btn" type="button" onClick={() => setAddrModal(true)} aria-label="Construir dirección">
              <svg viewBox="0 0 24 24" fill="none"><path d="M12 21s7-6.3 7-11a7 7 0 1 0-14 0c0 4.7 7 11 7 11Z" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" /><circle cx="12" cy="10" r="2.2" stroke="currentColor" strokeWidth="2" /></svg>
            </button>
          </div>
          {touched && errors.address && <p style={{ color: '#c62828', fontSize: 11.5, fontWeight: 600, margin: '4px 2px 0' }}>{errors.address}</p>}
        </div>

        <div className="doc">
          <div className="di">
            <svg viewBox="0 0 24 24" fill="none"><path d="M5 4h9l5 5v11H5z" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" /><path d="M14 4v5h5" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" /><path d="M8 15h8" stroke="currentColor" strokeWidth="2" strokeLinecap="round" /></svg>
          </div>
          <div className="dc">
            <div className="t">Pagaré + carta de instrucciones</div>
            <div className="st">Se firma en: <b>Plataforma de firma electrónica</b></div>
          </div>
          <button className="docbtn">Ver</button>
        </div>

        <div
          className={`check ${confirm ? 'on' : ''}`}
          onClick={() => setConfirm((v) => !v)}
        >
          <span className="bx"><svg viewBox="0 0 24 24" fill="none"><path d="M5 13l4 4L19 7" stroke="currentColor" strokeWidth="3.4" strokeLinecap="round" strokeLinejoin="round" /></svg></span>
          <p>Confirmo que la información de contacto es correcta y <span>acepto firmar</span> el pagaré y la carta de instrucciones.</p>
        </div>

        {error && <p style={{ color: '#c62828', fontSize: 12, margin: '10px 2px' }}>{error}</p>}

        <div className="sp" />
        <div className="action-bar">
          <button className="btn btn-primary" disabled={!confirm || busy} onClick={sign} style={{ opacity: busy ? 0.6 : 1 }}>
            {busy ? 'Enviando…' : 'Aceptar información y enviar a firma'}
            <svg viewBox="0 0 24 24" fill="none"><path d="M3 19c3-1 4-9 7-9s2 6 4 6 2-4 4-4 2 2 3 2" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" /></svg>
          </button>
        </div>
        <div className="bhelp">Los documentos se envían a la plataforma de firma electrónica; el crédito queda pendiente de firmas hasta su confirmación</div>
      </div>

      {addrModal && (
        <AddressBuilderModal
          onApply={(a) => {
            setAddress(a);
            setAddrModal(false);
          }}
          onClose={() => setAddrModal(false)}
        />
      )}
    </div>
  );
}
