import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext';
import { AppBar } from '../../shared/components/AppBar';
import { CreditStepper } from '../../shared/components/CreditStepper';
import { Modal } from '../../shared/components/Modal';
import { httpClient } from '../../shared/api/httpClient';
import { useTheme } from '../../shared/theme/ThemeContext';

interface ClientLookup {
  id: string;
  fullName: string;
  documentNumber: string;
  documentType?: string;
  legalName?: string;
  commercialName?: string;
  city?: string;
}

export function CreditStudyPage() {
  const navigate = useNavigate();
  const { moduleContexts } = useAuth();
  const theme = useTheme();
  const [nit, setNit] = useState('');
  const [results, setResults] = useState<ClientLookup[]>([]);
  const [client, setClient] = useState<ClientLookup | null>(null);
  const [searching, setSearching] = useState(false);
  const [consentData, setConsentData] = useState(false);
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [showFinance, setShowFinance] = useState(false);
  const [monthlyIncome, setMonthlyIncome] = useState('');
  const [monthlyExpenses, setMonthlyExpenses] = useState('');
  const [financeError, setFinanceError] = useState('');

  const canCreateClient = moduleContexts['clients']?.permissions.includes('clients.create') ?? false;

  useEffect(() => {
    if (nit.length >= 3) {
      setSearching(true);
      setError('');
      setResults([]);
      httpClient
        .get('/clients', { params: { limit: 500 } })
        .then((res) => {
          const list: ClientLookup[] = res.data[0] || [];
          setResults(list.filter((c) => c.documentNumber.includes(nit)));
          setClient(null);
          setSearching(false);
        })
        .catch(() => {
          setError('No se pudieron consultar los clientes');
          setSearching(false);
        });
    } else {
      setResults([]);
      setClient(null);
    }
  }, [nit]);

  const selectClient = (c: ClientLookup) => {
    setClient(c);
    setError('');
  };

  const goCreateClient = () => navigate(`/clients/new?nit=${nit}`);

  const openFinanceModal = () => {
    setError('');
    if (!client) {
      setError('El NIT no corresponde a un cliente registrado.');
      return;
    }
    if (!consentData) {
      setError('Debes aceptar el tratamiento de datos para continuar');
      return;
    }
    setFinanceError('');
    setShowFinance(true);
  };

  const closeFinanceModal = () => {
    if (submitting) return;
    setShowFinance(false);
  };

  const handleSubmit = async () => {
    if (!client) return;
    const income = Number(monthlyIncome);
    if (!monthlyIncome || !(income > 0)) {
      setFinanceError('Ingresa los ingresos mensuales del cliente.');
      return;
    }
    setFinanceError('');
    setSubmitting(true);
    try {
      const res = await httpClient.post('/credits/study', {
        clientId: client.id,
        consentData,
        monthlyIncome: income,
        monthlyExpenses: monthlyExpenses ? Number(monthlyExpenses) : undefined,
      });
      navigate(`/credits/result/${res.data.credit.id}`, {
        state: {
          decision: res.data.mockup.decision,
          approvedLimit: res.data.mockup.approvedLimit,
          reason: res.data.mockup.reason,
        },
      });
    } catch (err: any) {
      setFinanceError(err?.response?.data?.message?.message || 'No se pudo enviar la solicitud');
      setSubmitting(false);
    }
  };

  const logo = theme.logoUrl || undefined;
  const clientReady = !!client && consentData;

  return (
    <div className="s2 flow credit-shell">
      <AppBar title="Estudio de crédito" subtitle="Paso 1 de 4" logo={logo} />
      <div className="body credit-body">
        <CreditStepper current={1} />

        <div className="sectitle">Identificación del cliente</div>
        <div className="field">
          <label>
            NIT{' '}
            <span style={{ color: 'var(--faint)', fontWeight: 600 }}>
              {nit.length < 3 ? 'Digita 3+ dígitos' : searching ? 'Consultando…' : client ? 'Encontrado' : results.length > 0 ? `${results.length} coincidencia(s)` : 'Sin registro'}
            </span>
          </label>
          <input
            className="inp"
            inputMode="numeric"
            maxLength={10}
            value={nit}
            onChange={(e) => setNit(e.target.value.replace(/\D/g, ''))}
            placeholder="Ej. 901234567"
          />
          <div className="help">Digita el NIT (sin dígito de verificación) o la cédula. La búsqueda es parcial e inicia desde los 3 dígitos.</div>
        </div>

        {nit.length < 3 && (
          <div className="empty" style={{ background: '#fff', border: '1.5px dashed #dbe4ef', borderRadius: 16, textAlign: 'center', padding: '26px 16px', marginBottom: 13 }}>
            <svg viewBox="0 0 24 24" fill="none" width="30" height="30" color="#c3cede"><path d="M4 20V9l8-5 8 5v11" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" /><path d="M9 20v-6h6v6" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" /></svg>
            <div>Esperando el NIT para consultar los datos del cliente</div>
          </div>
        )}

        {nit.length >= 3 && searching && (
          <p style={{ color: 'var(--muted)', fontSize: 12, padding: '15px 3px' }}>Consultando…</p>
        )}

        {nit.length >= 3 && !searching && !client && results.length > 0 && (
          <div>
            <div style={{ fontSize: 9.5, fontWeight: 800, letterSpacing: '.1em', color: 'var(--faint)', margin: '6px 2px 10px' }}>SELECCIONA UN CLIENTE</div>
            {results.map((c) => (
              <button
                key={c.id}
                className="card pick"
                onClick={() => selectClient(c)}
              >
                <div>
                  <div className="pname">{c.legalName || c.fullName}</div>
                  <div className="pdoc">{(c.documentType ? c.documentType + ' ' : '') + c.documentNumber}</div>
                </div>
                <svg viewBox="0 0 24 24" fill="none"><path d="M5 12h14M13 6l6 6-6 6" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" /></svg>
              </button>
            ))}
          </div>
        )}

        {client && (
          <>
            <div className="card" style={{ borderColor: '#cfe8d9', background: '#f4fbf6' }}>
              <div style={{ fontSize: 9.5, fontWeight: 800, letterSpacing: '.1em', color: 'var(--green-deep)', marginBottom: 9 }}>DATOS TRAÍDOS AUTOMÁTICAMENTE</div>
              <div className="stk"><div className="k">Razón social</div><div className="v">{client.legalName || client.fullName}</div></div>
              <div className="stk"><div className="k">NIT</div><div className="v">{client.documentNumber}</div></div>
              {client.city && <div className="stk"><div className="k">Ciudad</div><div className="v">{client.city}</div></div>}
              <button className="btn btn-ghost" style={{ marginTop: 12, height: 44 }} onClick={() => { setClient(null); setNit(''); }}>
                Cambiar cliente
              </button>
            </div>

            <div className="attnote">
              <svg viewBox="0 0 24 24" fill="none"><path d="M12 2l8 4v6c0 5-3.5 8-8 10-4.5-2-8-5-8-10V6l8-4Z" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" /></svg>
              <p>Antes de correr el algoritmo, el cliente debe autorizar el tratamiento de sus datos personales.</p>
            </div>
          </>
        )}

        {nit.length >= 3 && !searching && !client && results.length === 0 && (
          <div className="card" style={{ textAlign: 'center', borderColor: '#f6caca', background: '#fdecec' }}>
            <div style={{ fontSize: 9.5, fontWeight: 800, letterSpacing: '.1em', color: '#b00020', marginBottom: 9 }}>CLIENTE NO ENCONTRADO</div>
            <div style={{ fontSize: 12.5, fontWeight: 700, color: 'var(--ink)' }}>No existe un cliente registrado que coincida con {nit}.</div>
            {canCreateClient ? (
              <button className="btn btn-primary" style={{ marginTop: 14 }} onClick={goCreateClient}>
                Crear cliente <svg viewBox="0 0 24 24" fill="none"><path d="M12 5v14M5 12h14" stroke="#fff" strokeWidth="2.2" strokeLinecap="round" /></svg>
              </button>
            ) : (
              <div style={{ fontSize: 11, color: 'var(--muted)', marginTop: 8 }}>
                No tienes permisos para crear clientes. Solicita al administrador que lo registre.
              </div>
            )}
          </div>
        )}

        {error && <p style={{ color: '#c62828', fontSize: 12, margin: '10px 2px' }}>{error}</p>}
      </div>

      <div
        className={`check ${consentData ? 'on' : ''}`}
        onClick={() => setConsentData((v) => !v)}
        style={{ margin: '0 22px', flex: 'none' }}
      >
        <span className="bx"><svg viewBox="0 0 24 24" fill="none"><path d="M5 13l4 4L19 7" stroke="currentColor" strokeWidth="3.4" strokeLinecap="round" strokeLinejoin="round" /></svg></span>
        <p>Acepto la <span>política de tratamiento de datos personales</span> y autorizo la consulta en centrales de riesgo.</p>
      </div>

      <div className="action-bar credit-actions">
        <div className="credit-form-actions">
          <button className="btn btn-primary" disabled={!clientReady} onClick={openFinanceModal}>
            Solicitar estudio de crédito
            <svg viewBox="0 0 24 24" fill="none"><path d="M5 12h14M13 6l6 6-6 6" stroke="#fff" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" /></svg>
          </button>
          <div className="bhelp">Se habilita al validar el NIT y aceptar el tratamiento de datos</div>
        </div>
      </div>

      <Modal open={showFinance} onClose={closeFinanceModal}>
        <div className="sectitle">Información financiera</div>
        <div className="field">
          <label>Ingresos mensuales</label>
          <input
            className="inp"
            type="number"
            min="0"
            step="1000"
            value={monthlyIncome}
            onChange={(e) => setMonthlyIncome(e.target.value)}
            placeholder="Ej. 3000000"
            autoFocus
          />
          <div className="help">Necesarios para calcular la capacidad de pago del cliente.</div>
        </div>
        <div className="field">
          <label>Gastos mensuales <span style={{ color: 'var(--faint)', fontWeight: 600 }}>(opcional)</span></label>
          <input
            className="inp"
            type="number"
            min="0"
            step="1000"
            value={monthlyExpenses}
            onChange={(e) => setMonthlyExpenses(e.target.value)}
            placeholder="Ej. 1500000"
          />
        </div>

        {financeError && <p style={{ color: '#c62828', fontSize: 12, margin: '10px 2px' }}>{financeError}</p>}

        <div className="action-bar stacked" style={{ position: 'static', boxShadow: 'none', padding: 0 }}>
          <button className="btn btn-primary" disabled={!monthlyIncome || submitting} onClick={handleSubmit}>
            Continuar
            <svg viewBox="0 0 24 24" fill="none"><path d="M5 12h14M13 6l6 6-6 6" stroke="#fff" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" /></svg>
          </button>
        </div>
      </Modal>
    </div>
  );
}
