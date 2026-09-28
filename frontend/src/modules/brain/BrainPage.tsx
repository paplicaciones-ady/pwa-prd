import { useState } from 'react';
import { formatCOP } from '../../shared/utils/format';
import './BrainPage.css';
import { useBackTarget } from '../../shared/layout/TopBarContext';

// ── DATOS MOCK ──
// TODO(real-data): GET /api/brain/recommendations?clientId=... y motor RFM
const MOCK_CLIENT = { name: 'GARCIA BEDOYA ANDRES FELIPE', doc: '1053803896-2' };
const RFM = { label: 'Potenciar', priority: 'Prioridad de crecimiento', vocation: 'Depósito de materiales de construcción' };
const TABS = ['Portafolio', 'Combos', 'Sugerido', 'Innovación', 'Oportunidad'];

const ACTIONS = [
  { label: 'Pedidos Brain', icon: 'cart' },
  { label: 'Histórico', icon: 'clock' },
  { label: 'Devoluciones', icon: 'return' },
  { label: 'Otras gestiones', icon: 'menu' },
  { label: 'No compras', icon: 'ban' },
  { label: 'Cartera', icon: 'wallet' },
  { label: 'Digitalización', icon: 'scan' },
  { label: 'Seguimiento', icon: 'pin' },
  { label: 'Waze', icon: 'map' },
];

const RECOMMENDATIONS = [
  { name: 'CARRETAS METÁLICAS', price: 1089560, qty: 3, seg: 5, segment: 'Potenciales leales', bars: [100, 78, 62] },
  { name: 'BARRAS', price: 260250, qty: 3, seg: 9, segment: 'Leales de alto valor', bars: [100, 45, 31] },
  { name: 'ALMADANAS CON CABO', price: 0, qty: 0, seg: 9, segment: 'En riesgo', bars: [100, 8, 2] },
];

const ICONS: Record<string, JSX.Element> = {
  cart: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M6 6h15l-1.5 9h-12z" /><circle cx="9" cy="20" r="1.5" /><circle cx="18" cy="20" r="1.5" /><path d="M6 6L5 3H2" /></svg>,
  clock: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10" /><path d="M12 6v6l4 2" /></svg>,
  return: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M9 14L4 9l5-5" /><path d="M4 9h10a6 6 0 0 1 6 6v1" /></svg>,
  menu: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M4 6h16M4 12h16M4 18h16" /></svg>,
  ban: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10" /><path d="M4.9 4.9l14.2 14.2" /></svg>,
  wallet: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M2 7h18v12H2z" /><path d="M2 7V5a2 2 0 0 1 2-2h13" /><path d="M18 11h.01" /></svg>,
  scan: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 7V5a2 2 0 0 1 2-2h2M3 17v2a2 2 0 0 0 2 2h2M21 7V5a2 2 0 0 0-2-2h-2M21 17v2a2 2 0 0 1-2 2h-2M8 12h8" /></svg>,
  pin: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 21s7-6.3 7-11a7 7 0 1 0-14 0c0 4.7 7 11 7 11Z" /><circle cx="12" cy="10" r="2" /></svg>,
  map: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M9 20l-5-3V4l5 3 6-3 5 3v13l-5-3-6 3z" /></svg>,
};

function DualBar({ values }: { values: number[] }) {
  const [real, projected] = values;
  return (
    <div className="brain-bars">
      <div className="brain-bar-track">
        <div className="brain-bar-real" style={{ width: `${real}%` }} />
        <div className="brain-bar-proj" style={{ width: `${projected}%` }} />
      </div>
      <div className="brain-bar-legend">
        <span>Real</span>
        <span>Proyectado</span>
      </div>
    </div>
  );
}

export function BrainPage() {
  useBackTarget('/home');
  const [activeTab, setActiveTab] = useState('Portafolio');

  return (
    <div className="s2">
      <div className="s2-head">
        <h1 className="page-title">Recomendaciones</h1>
      </div>

      <div className="s2-body brain-body">
        <div className="brain-client-card">
          <div>
            <div className="brain-client-name">{MOCK_CLIENT.name}</div>
            <div className="brain-client-doc">{MOCK_CLIENT.doc}</div>
          </div>
          <svg className="brain-chevron" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M9 18l6-6-6-6" />
          </svg>
        </div>

        <div className="brain-actions">
          {ACTIONS.map((a) => (
            <button key={a.label} type="button" className="brain-action" onClick={() => undefined}>
              {ICONS[a.icon]}
              <span>{a.label}</span>
            </button>
          ))}
        </div>

        <div className="brain-rfm">
          <div className="brain-rfm-row"><span>RFM</span><b>{RFM.label}</b></div>
          <div className="brain-rfm-row"><span>Prioridad</span><b>{RFM.priority}</b></div>
          <div className="brain-rfm-row"><span>Vocación</span><b>{RFM.vocation}</b></div>
        </div>

        <div className="brain-tabs">
          {TABS.map((t) => (
            <button
              key={t}
              type="button"
              className={`brain-tab ${t === activeTab ? 'on' : ''}`}
              onClick={() => setActiveTab(t)}
            >
              {t}
            </button>
          ))}
        </div>

        <div className="brain-recs">
          {RECOMMENDATIONS.map((r) => (
            <div key={r.name} className="brain-rec-card">
              <div className="brain-rec-head">
                <div>
                  <div className="brain-rec-name">{r.name}</div>
                  <div className="brain-rec-price">{formatCOP(r.price)}</div>
                </div>
                <div className="brain-rec-qty">x{r.qty}</div>
              </div>
              <div className="brain-rec-segment">
                <span className="brain-seg-dot" style={{ '--seg': r.seg } as React.CSSProperties}>{r.seg}</span>
                {r.segment}
              </div>
              <DualBar values={r.bars} />
            </div>
          ))}
        </div>
      </div>

      <div className="brain-bottom">
        <span>6 Productos</span>
        <span className="brain-bottom-total">{formatCOP(1349811)}</span>
        <button type="button" className="brain-bottom-btn" onClick={() => undefined}>Resumen de pedidos</button>
      </div>
    </div>
  );
}
