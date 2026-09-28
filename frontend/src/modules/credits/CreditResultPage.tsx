import { useEffect, useState } from 'react';
import { useLocation, useNavigate, useParams } from 'react-router-dom';
import { AppBar } from '../../shared/components/AppBar';
import { CreditStepper } from '../../shared/components/CreditStepper';
import { httpClient } from '../../shared/api/httpClient';
import { useTheme } from '../../shared/theme/ThemeContext';

interface CreditDetail {
  id: string;
  applicationNumber: string;
  requestedAmount: string;
  approvedLimit: string | null;
  status: string;
  nit: string | null;
  client?: {
    id: string;
    fullName: string;
    documentNumber: string;
    legalName?: string;
    commercialName?: string;
    city?: string;
  };
}

interface StudyResultState {
  decision?: 'approved' | 'rejected';
  approvedLimit?: number;
  reason?: string;
}

export function CreditResultPage() {
  const { id } = useParams<{ id: string }>();
  const theme = useTheme();
  const navigate = useNavigate();
  const location = useLocation();
  const studyResult = (location.state as StudyResultState | null) ?? null;
  const [credit, setCredit] = useState<CreditDetail | null>(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!id) return;
    httpClient
      .get(`/credits/${id}`)
      .then((res) => setCredit(res.data))
      .catch((err: any) => setError(err?.response?.data?.message?.message || 'No se pudo cargar el crédito'));
  }, [id]);

  const decide = async (decision: 'approved' | 'rejected') => {
    if (!id) return;
    setBusy(true);
    setError('');
    try {
      await httpClient.post(`/credits/${id}/result`, { decision });
      if (decision === 'approved') {
        navigate(`/credits/sign/${id}`);
      } else {
        setCredit((prev) => (prev ? { ...prev, status: 'rejected' } : prev));
        setBusy(false);
      }
    } catch (err: any) {
      setError(err?.response?.data?.message?.message || 'No se pudo registrar la decisión');
      setBusy(false);
    }
  };

  if (error && !credit) {
    return (
      <div className="s2 crflow">
        <AppBar title="Resultado del crédito" subtitle="Paso 2 de 4" logo={theme.logoUrl || undefined} />
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
        <AppBar title="Resultado del crédito" subtitle="Paso 2 de 4" logo={theme.logoUrl || undefined} />
        <div className="body" style={{ color: 'var(--muted)', fontSize: 13 }}>Cargando…</div>
      </div>
    );
  }

  const clientName = credit.client?.legalName || credit.client?.fullName;
  const isRejected = credit.status === 'rejected' || studyResult?.decision === 'rejected';
  const approvedLimit = studyResult?.approvedLimit ?? Number(credit.approvedLimit ?? credit.requestedAmount);

  return (
    <div className="s2 crflow">
      <AppBar title="Resultado del crédito" subtitle={clientName} logo={theme.logoUrl || undefined} />
      <div className="body" style={{ paddingBottom: 24 }}>
        <CreditStepper current={2} />

        {isRejected ? (
          <div className="approve" style={{ background: '#fdecec', borderColor: '#f6caca' }}>
            <div className="badge" style={{ background: '#E11225' }}>
              <svg viewBox="0 0 24 24" fill="none"><path d="M12 3l9 16H3L12 3Z" stroke="#fff" strokeWidth="2" strokeLinejoin="round" /></svg>
            </div>
            <h3 style={{ color: '#b00020' }}>Solicitud no aprobada</h3>
            <p>{studyResult?.reason || 'Comunícate con el cliente para informar la decisión.'}</p>
          </div>
        ) : (
          <>
            <div className="approve">
              <div className="badge">
                <svg viewBox="0 0 24 24" fill="none"><path d="M5 13l4 4L19 7" stroke="#fff" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" /></svg>
              </div>
              <h3>¡Crédito aprobado!</h3>
              <p>{studyResult?.reason || 'El algoritmo aprobó al cliente'}</p>
              <div className="amt">${approvedLimit.toLocaleString('es-CO')}</div>
              <div className="amtl">Cupo aprobado</div>
            </div>
          </>
        )}

        {!isRejected && (
          <>
            <div className="sectitle" style={{ marginTop: 4 }}>Condiciones de pago</div>
            <div className="cond">
              <div className="crow g">
                <span className="pill">0 – 30<br />días</span>
                <div className="cc">
                  <div className="t">Sin intereses remuneratorios</div>
                  <div className="d">Contados desde la entrega del bien. Si paga dentro de este plazo, no se cobran intereses.</div>
                </div>
              </div>
              <div className="crow y">
                <span className="pill">31 – 90<br />días</span>
                <div className="cc">
                  <div className="t">Con intereses remuneratorios</div>
                  <div className="d">Se causan intereses sobre el saldo.</div>
                  <span className="tag">POR DEFINIR EN JUNTA</span>
                </div>
              </div>
              <div className="crow r">
                <span className="pill">+ de 90<br />días</span>
                <div className="cc">
                  <div className="t">Intereses moratorios</div>
                  <div className="d">Pasa a mora y se activa la escala de cartera (bloqueo de despachos).</div>
                </div>
              </div>
            </div>

            {error && <p style={{ color: '#c62828', fontSize: 12, margin: '10px 2px' }}>{error}</p>}

            <div className="sp" />
            <div className="action-bar stacked">
              <button className="btn btn-green" disabled={busy} onClick={() => decide('approved')} style={{ opacity: busy ? 0.6 : 1 }}>
                Continuar a firma del pagaré
                <svg viewBox="0 0 24 24" fill="none"><path d="M5 12h14M13 6l6 6-6 6" stroke="#fff" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" /></svg>
              </button>
              <button className="btn btn-ghost" disabled={busy} onClick={() => decide('rejected')} style={{ opacity: busy ? 0.6 : 1, background: '#fdecec' }}>
                Rechazar solicitud
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
