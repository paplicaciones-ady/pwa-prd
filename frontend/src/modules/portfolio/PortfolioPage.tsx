import { useNavigate } from 'react-router-dom';
import './PortfolioPage.css';

// ── DATOS MOCK ──
// TODO(real-data): reemplazar por GET /api/portfolio y calcular nivel por días de mora
interface PortfolioClient {
  id: string;
  name: string;
  doc: string;
  status: string;
  level: 1 | 3 | 5;
}

const MOCK_CLIENTS: PortfolioClient[] = [
  { id: '1', name: 'FERRETERIA MANDROS', doc: 'CN9695934', status: 'Activo', level: 1 },
  { id: '2', name: 'FERRETERIA NUEVA CALDAS', doc: 'CN9995105', status: 'Activo', level: 1 },
  { id: '3', name: 'PACHON VASQUEZ GUSTAVO', doc: 'CN10273627', status: 'Activo', level: 3 },
  { id: '4', name: 'FERREMAGICA', doc: 'CN16071663', status: 'Activo', level: 3 },
  { id: '5', name: 'ARANGO MORALES GERMAN', doc: 'CN75033448', status: 'Activo', level: 5 },
];

function Battery({ level }: { level: 1 | 3 | 5 }) {
  const colorClass = level === 1 ? 'red' : level === 3 ? 'yellow' : 'green';
  return (
    <div className={`portfolio-battery ${colorClass}`} aria-label={`Nivel ${level}`}>
      {[1, 2, 3, 4, 5].map((i) => (
        <div key={i} className={`pb-bar ${i <= level ? 'on' : ''}`} />
      ))}
    </div>
  );
}

export function PortfolioPage() {
  const navigate = useNavigate();
  return (
    <div className="s2">
      <div className="s2-head">
        <div className="s2-top">
          <button type="button" className="cback" onClick={() => navigate('/home')} aria-label="Volver">
            <svg viewBox="0 0 24 24" fill="none"><path d="M15 6l-6 6 6 6" stroke="#fff" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" /></svg>
          </button>
          <div className="org-chip"><span className="org-dot" />Cartera</div>
        </div>
        <h1 className="page-title">Estado de cartera</h1>
      </div>

      <div className="s2-body">
        <div className="portfolio-controls">
          <span className="portfolio-sort-label">Ordenar por</span>
          <button type="button" className="portfolio-chip">
            Mora
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M6 9l6 6 6-6" />
            </svg>
          </button>
        </div>

        <div className="portfolio-list">
          {MOCK_CLIENTS.map((c) => (
            <div key={c.id} className="portfolio-card">
              <div className="portfolio-avatar">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <circle cx="12" cy="8" r="3.6" />
                  <path d="M5 20c0-3.4 3.1-6 7-6s7 2.6 7 6" />
                </svg>
              </div>
              <div className="portfolio-info">
                <div className="portfolio-name">{c.name}</div>
                <div className="portfolio-meta">{c.doc} · {c.status}</div>
              </div>
              <Battery level={c.level} />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
