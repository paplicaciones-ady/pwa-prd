import { useNavigate } from 'react-router-dom';
import { useBackTarget } from '../../shared/layout/TopBarContext';

const STEPS = [
  {
    title: 'Estudio de crédito',
    desc: 'Datos del cliente y consentimiento. Adjuntar: tratamiento de datos.',
  },
  {
    title: 'Algoritmo y aprobación',
    desc: 'Se corre el algoritmo de crédito y define cupo, plazo y tasa.',
  },
  {
    title: 'Firma del pagaré',
    desc: 'Adjuntar: pagaré + carta de instrucciones.',
  },
  {
    title: 'Formalización y desembolso',
    desc: 'Solicitud creada. Se genera: documento de bienvenida y detalle.',
  },
  {
    title: 'Seguimiento y cartera',
    desc: 'Liquidación 60/90 días. Estado de cuenta y FE de intereses.',
  },
];

export function CreditsHomePage() {
  const navigate = useNavigate();
  useBackTarget('/home');

  return (
    <div className="s2">
      <div className="s2-head">
        <h1 className="page-title">Créditos</h1>
        <p className="lead below">Gestioná el estudio, la aprobación y el seguimiento de créditos.</p>
      </div>

      <div className="s2-body">
        <h2 className="hsec">El proceso en 5 pasos</h2>
        <ol className="steps">
          {STEPS.map((step, i) => (
            <li key={step.title}>
              <span className="step-num">{i + 1}</span>
              <div className="step-tx">
                <h3>{step.title}</h3>
                <p>{step.desc}</p>
              </div>
            </li>
          ))}
        </ol>

        <h2 className="hsec" style={{ marginTop: 26 }}>¿Qué deseas hacer hoy?</h2>
        <div className="home-actions">
          <button className="opt blue" onClick={() => navigate('/credits/study')}>
            <span className="ic">
              <svg viewBox="0 0 24 24" fill="none"><rect x="2.5" y="5.5" width="19" height="13" rx="2.5" stroke="currentColor" strokeWidth="2" /><path d="M2.5 10h19" stroke="currentColor" strokeWidth="2" /><path d="M6 14.5h4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" /></svg>
            </span>
            <span className="tx">
              <span className="t">Iniciar estudio de crédito</span>
              <span className="s">Consulta el NIT del cliente y corre el algoritmo de aprobación</span>
            </span>
            <svg className="ar" viewBox="0 0 24 24" fill="none"><path d="M9 6l6 6-6 6" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" /></svg>
          </button>

          <button className="opt green" onClick={() => navigate('/credits/list')}>
            <span className="ic">
              <svg viewBox="0 0 24 24" fill="none"><path d="M4 19V9M10 19V4M16 19v-7M22 19H2" stroke="currentColor" strokeWidth="2" strokeLinecap="round" /></svg>
            </span>
            <span className="tx">
              <span className="t">Ver créditos</span>
              <span className="s">Consulta el estado y el historial de solicitudes</span>
            </span>
            <svg className="ar" viewBox="0 0 24 24" fill="none"><path d="M9 6l6 6-6 6" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" /></svg>
          </button>
        </div>
      </div>
    </div>
  );
}