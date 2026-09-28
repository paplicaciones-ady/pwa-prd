import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext';
import { AppBar } from '../../shared/components/AppBar';
import { CreditStepper } from '../../shared/components/CreditStepper';
import { Modal } from '../../shared/components/Modal';
import { ScaleInput } from '../../shared/components/ScaleInput';
import { httpClient } from '../../shared/api/httpClient';
import { useTheme } from '../../shared/theme/ThemeContext';
import { stripNitDv, validateNit } from '../../shared/utils/validators';

type PersonType = 'natural' | 'juridica';

interface ClientLookup {
  id: string;
  fullName: string;
  documentNumber: string;
  documentType?: string;
  personType?: PersonType;
  legalName?: string;
  commercialName?: string;
  city?: string;
}

export function CreditStudyPage() {
  const navigate = useNavigate();
  const { moduleContexts } = useAuth();
  const theme = useTheme();
  const [personType, setPersonType] = useState<PersonType>('natural');
  const [nit, setNit] = useState('');
  const [nitConfirm, setNitConfirm] = useState('');
  const [nitTouched, setNitTouched] = useState(false);
  const [confirmTouched, setConfirmTouched] = useState(false);
  const [results, setResults] = useState<ClientLookup[]>([]);
  const [client, setClient] = useState<ClientLookup | null>(null);
  const [searching, setSearching] = useState(false);
  const [consentData, setConsentData] = useState(false);
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [showFinance, setShowFinance] = useState(false);
  const [yearsExperience, setYearsExperience] = useState('');
  const [opportunityValue, setOpportunityValue] = useState('');
  const [reliabilityScore, setReliabilityScore] = useState<number | null>(null);
  const [financeError, setFinanceError] = useState('');

  const canCreateClient = moduleContexts['clients']?.permissions.includes('clients.create') ?? false;

  const nitCheck = validateNit(nit);
  const confirmMatches = nit.length > 0 && nitConfirm === nit;
  const nitDigits = stripNitDv(nit);

  useEffect(() => {
    if (nitDigits.length >= 3) {
      setSearching(true);
      setError('');
      setResults([]);
      httpClient
        .get('/clients', { params: { limit: 500 } })
        .then((res) => {
          const list: ClientLookup[] = res.data[0] || [];
          setResults(
            list.filter(
              (c) =>
                c.documentNumber.includes(nitDigits) &&
                (c.personType ?? 'natural') === personType,
            ),
          );
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
  }, [nitDigits, personType]);

  const selectClient = (c: ClientLookup) => {
    setClient(c);
    setError('');
  };

  const goCreateClient = () => navigate(`/clients/new?nit=${nitDigits}`);

  const openFinanceModal = () => {
    setError('');
    if (!client) {
      setError('El NIT no corresponde a un cliente registrado.');
      return;
    }
    if (!nitCheck.ok) {
      setError(nitCheck.error);
      return;
    }
    if (!confirmMatches) {
      setError('La confirmación del NIT no coincide.');
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
    const years = Number(yearsExperience);
    if (!yearsExperience || !(years > 0)) {
      setFinanceError('Ingresa los años de experiencia del cliente.');
      return;
    }
    const opportunity = Number(opportunityValue);
    if (!opportunityValue || !(opportunity > 0)) {
      setFinanceError('Ingresa el valor de la oportunidad.');
      return;
    }
    if (reliabilityScore === null) {
      setFinanceError('Selecciona qué tan confiable te parece este crédito.');
      return;
    }
    setFinanceError('');
    setSubmitting(true);
    try {
      const res = await httpClient.post('/credits/study', {
        clientId: client.id,
        consentData,
        nit: nitDigits,
        personType,
        yearsExperience: years,
        opportunityValue: opportunity,
        reliabilityScore,
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
  const clientReady = !!client && consentData && nitCheck.ok && confirmMatches;
  const nitError = nitTouched && !nitCheck.ok ? nitCheck.error : '';
  const confirmError = confirmTouched && nit.length > 0 && !confirmMatches ? 'La confirmación no coincide con el NIT.' : '';

  return (
    <div className="s2 flow crflow">
      <AppBar title="Estudio de crédito" subtitle="Paso 1 de 4" logo={logo} />
      <div className="body credit-body">
        <CreditStepper current={1} />

        <div className="sectitle">Identificación del cliente</div>

        <div className="field">
          <label>Tipo de persona</label>
          <div className="radio-group">
            <label className="radio">
              <input
                type="radio"
                name="creditPersonType"
                checked={personType === 'natural'}
                onChange={() => setPersonType('natural')}
              />
              <span>Natural</span>
            </label>
            <label className="radio">
              <input
                type="radio"
                name="creditPersonType"
                checked={personType === 'juridica'}
                onChange={() => setPersonType('juridica')}
              />
              <span>Jurídica</span>
            </label>
          </div>
          <div className="help">Determina si se buscan cédulas o NITs en el registro de clientes.</div>
        </div>

        <div className="field">
          <label>
            NIT{' '}
            <span style={{ color: 'var(--faint)', fontWeight: 600 }}>
              {nitDigits.length < 3 ? 'Digita 3+ dígitos' : searching ? 'Consultando…' : client ? 'Encontrado' : results.length > 0 ? `${results.length} coincidencia(s)` : 'Sin registro'}
            </span>
          </label>
          <input
            className="inp"
            inputMode="numeric"
            maxLength={10}
            value={nit}
            onChange={(e) => {
              setNit(e.target.value.replace(/\D/g, ''));
              setNitTouched(true);
            }}
            onBlur={() => setNitTouched(true)}
            placeholder="Ej. 9012345678"
            style={nitError ? { borderColor: '#e11225' } : undefined}
          />
          <div className="help">
            {nitError ? (
              <span style={{ color: '#c62828', fontWeight: 600 }}>{nitError}</span>
            ) : (
              '9 dígitos más el de verificación. La búsqueda es parcial e inicia desde los 3 dígitos.'
            )}
          </div>
        </div>

        <div className="field">
          <label>Confirmación de NIT</label>
          <input
            className="inp"
            inputMode="numeric"
            maxLength={10}
            value={nitConfirm}
            onChange={(e) => {
              setNitConfirm(e.target.value.replace(/\D/g, ''));
              setConfirmTouched(true);
            }}
            onBlur={() => setConfirmTouched(true)}
            placeholder="Ej. 9012345678"
            style={confirmError ? { borderColor: '#e11225' } : undefined}
          />
          <div className="help">
            {confirmError ? (
              <span style={{ color: '#c62828', fontWeight: 600 }}>{confirmError}</span>
            ) : (
              'Repite el NIT para confirmar que no hay errores de digitación.'
            )}
          </div>
        </div>

        {nitDigits.length < 3 && (
          <div className="empty" style={{ background: '#fff', border: '1.5px dashed #dbe4ef', borderRadius: 16, textAlign: 'center', padding: '26px 16px', marginBottom: 13 }}>
            <svg viewBox="0 0 24 24" fill="none" width="30" height="30" color="#c3cede"><path d="M4 20V9l8-5 8 5v11" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" /><path d="M9 20v-6h6v6" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" /></svg>
            <div>Esperando el NIT para consultar los datos del cliente</div>
          </div>
        )}

        {nitDigits.length >= 3 && searching && (
          <p style={{ color: 'var(--muted)', fontSize: 12, padding: '15px 3px' }}>Consultando…</p>
        )}

        {nitDigits.length >= 3 && !searching && !client && results.length > 0 && (
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
              <div className="stk"><div className="k">Tipo de persona</div><div className="v">{personType === 'juridica' ? 'Jurídica' : 'Natural'}</div></div>
              <div className="stk"><div className="k">NIT</div><div className="v">{client.documentNumber}</div></div>
              {client.city && <div className="stk"><div className="k">Ciudad</div><div className="v">{client.city}</div></div>}
              <button className="btn btn-ghost" style={{ marginTop: 12, height: 44 }} onClick={() => { setClient(null); setNit(''); setNitConfirm(''); setNitTouched(false); setConfirmTouched(false); }}>
                Cambiar cliente
              </button>
            </div>

            <div className="attnote">
              <svg viewBox="0 0 24 24" fill="none"><path d="M12 2l8 4v6c0 5-3.5 8-8 10-4.5-2-8-5-8-10V6l8-4Z" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" /></svg>
              <p>Antes de correr el algoritmo, el cliente debe autorizar el tratamiento de sus datos personales.</p>
            </div>
          </>
        )}

        {nitDigits.length >= 3 && !searching && !client && results.length === 0 && (
          <div className="card" style={{ textAlign: 'center', borderColor: '#f6caca', background: '#fdecec' }}>
            <div style={{ fontSize: 9.5, fontWeight: 800, letterSpacing: '.1em', color: '#b00020', marginBottom: 9 }}>CLIENTE NO ENCONTRADO</div>
            <div style={{ fontSize: 12.5, fontWeight: 700, color: 'var(--ink)' }}>No existe un cliente registrado que coincida con {nitDigits}.</div>
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
        style={{ flex: 'none' }}
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
          <div className="bhelp">Se habilita al validar el NIT, confirmarlo y aceptar el tratamiento de datos</div>
        </div>
      </div>

      <Modal open={showFinance} onClose={closeFinanceModal}>
        <div className="sectitle">Evaluación comercial</div>

        <div className="field">
          <label>¿Cuántos años de experiencia tiene en el mercado?</label>
          <input
            className="inp"
            type="number"
            min="0"
            max="100"
            step="1"
            inputMode="numeric"
            value={yearsExperience}
            onChange={(e) => setYearsExperience(e.target.value.replace(/[^0-9]/g, ''))}
            placeholder="Ej. 8"
            autoFocus
          />
          <div className="help">Mide la trayectoria del negocio.</div>
        </div>

        <div className="field">
          <label>¿Cuál es el valor de la oportunidad que ve en el cliente?</label>
          <input
            className="inp"
            type="number"
            min="0"
            step="1000"
            inputMode="numeric"
            value={opportunityValue}
            onChange={(e) => setOpportunityValue(e.target.value.replace(/[^0-9]/g, ''))}
            placeholder="Ej. 5000000"
          />
          <div className="help">Monto en pesos, sin decimales.</div>
        </div>

        <div className="field">
          <label>De 1 a 5, ¿qué tan confiable le parece este crédito?</label>
          <ScaleInput
            value={reliabilityScore}
            onChange={setReliabilityScore}
            lowLabel="1 · No va a pagar"
            highLabel="5 · Va a pagar"
            ariaLabel="Qué tan confiable le parece este crédito"
            tooltip="1 = no va a pagar, 5 = va a pagar. Registra el juicio del asesor que conoce al cliente."
          />
        </div>

        {financeError && <p style={{ color: '#c62828', fontSize: 12, margin: '10px 2px' }}>{financeError}</p>}

        <div className="action-bar stacked" style={{ position: 'static', boxShadow: 'none', padding: 0 }}>
          <button
            className="btn btn-primary"
            disabled={!yearsExperience || !opportunityValue || reliabilityScore === null || submitting}
            onClick={handleSubmit}
          >
            Continuar
            <svg viewBox="0 0 24 24" fill="none"><path d="M5 12h14M13 6l6 6-6 6" stroke="#fff" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" /></svg>
          </button>
        </div>
      </Modal>
    </div>
  );
}
