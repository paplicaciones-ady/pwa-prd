import './SurveysPage.css';
import { useBackTarget } from '../../shared/layout/TopBarContext';

// ── DATOS MOCK ──
// TODO(real-data): reemplazar por GET /api/surveys
const MOCK_SURVEYS = [
  { id: '1', name: 'MERCADO 2026', icon: 0 },
  { id: '2', name: 'Encuesta de Visita Leads GO TO MARKET COSTA', icon: 1 },
  { id: '3', name: 'Encuesta de Visita Leads GO TO MARKET CUNDINAMARCA', icon: 0 },
  { id: '4', name: 'Encuesta de Visita Leads GO TO MARKET AGRO EJE CAF', icon: 1 },
  { id: '5', name: 'Encuesta de Visita Leads GO TO MARKET AGRO VALLE', icon: 0 },
  { id: '6', name: 'Encuesta de Visita Leads GO TO MARKET SANTANDER 2', icon: 1 },
];

const ICONS = [
  <svg key="a" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <rect x="5" y="3" width="14" height="18" rx="2" />
    <path d="M9 8h6M9 12h6M9 16h4" />
  </svg>,
  <svg key="b" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M12 21s7-6.3 7-11a7 7 0 1 0-14 0c0 4.7 7 11 7 11Z" />
    <circle cx="12" cy="10" r="2.4" />
  </svg>,
];

export function SurveysPage() {
  useBackTarget('/home');
  return (
    <div className="s2">
      <div className="s2-head">
        <h1 className="page-title">Encuestas</h1>
      </div>

      <div className="s2-body">
        <div className="hsec">Encuestas activas</div>
        <div className="survey-list">
          {MOCK_SURVEYS.map((s) => (
            <button
              key={s.id}
              type="button"
              className="survey-card"
              // TODO(real-data): navegar a /surveys/:id
              onClick={() => undefined}
            >
              <div className="survey-icon">{ICONS[s.icon % ICONS.length]}</div>
              <span className="survey-title">{s.name}</span>
              <svg className="survey-chevron" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M9 18l6-6-6-6" />
              </svg>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
