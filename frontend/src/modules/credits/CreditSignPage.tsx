import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
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
    email?: string;
    phone?: string;
  };
}

export function CreditSignPage() {
  const { id } = useParams<{ id: string }>();
  const theme = useTheme();
  const navigate = useNavigate();
  const [credit, setCredit] = useState<SignCredit | null>(null);
  const [confirm, setConfirm] = useState(false);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!id) return;
    httpClient
      .get(`/credits/${id}`)
      .then((res) => setCredit(res.data))
      .catch((err: any) => setError(err?.response?.data?.message?.message || 'No se pudo cargar el crédito'));
  }, [id]);

  const sign = async () => {
    if (!id) return;
    setBusy(true);
    setError('');
    try {
      // Queda en pending_signatures hasta que el servicio externo confirme las firmas.
      await httpClient.post(`/credits/${id}/sign`);
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
  const email = credit.client?.email || 'correo@empresa.com';
  const phone = credit.client?.phone || '';

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
          <input className="inp" defaultValue={email} type="email" />
        </div>

        <div className="field" style={{ marginBottom: 12 }}>
          <label>Teléfono de contacto</label>
          <input className="inp" defaultValue={phone} type="tel" placeholder="No registrado" />
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
    </div>
  );
}
