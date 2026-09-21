import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { productImage } from '../../shared/lib/format';
import './PricesPage.css';

// ── DATOS MOCK ──
// TODO(real-data): GET /api/prices?q=... y selector PDV desde GET /api/prices/pdvs
interface PriceProduct {
  code: string;
  name: string;
  price: number;
  ivaRate: number;
  ivaAmount: number;
  priceWithIva: number;
  pack: number;
}

const MOCK_PRODUCTS: PriceProduct[] = [
  { code: 'T1201311800', name: 'ANCHO', price: 27400, ivaRate: 5, ivaAmount: 1370, priceWithIva: 28770, pack: 12 },
  { code: 'T1201311900', name: 'PAPE ANGOSTO', price: 27400, ivaRate: 5, ivaAmount: 1370, priceWithIva: 28770, pack: 12 },
  { code: 'T1201311901', name: 'PAPE ANGOSTO C/MUESCA', price: 27400, ivaRate: 5, ivaAmount: 1370, priceWithIva: 28770, pack: 12 },
];

const PDVS = ['PDV Principal', 'PDV Norte', 'PDV Sur'];

export function PricesPage() {
  const navigate = useNavigate();
  const [query, setQuery] = useState('');
  const [pdv, setPdv] = useState(PDVS[0]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return MOCK_PRODUCTS;
    return MOCK_PRODUCTS.filter((p) => p.code.toLowerCase().includes(q) || p.name.toLowerCase().includes(q));
  }, [query]);

  return (
    <div className="s2">
      <div className="s2-head">
        <div className="s2-top">
          <button type="button" className="cback" onClick={() => navigate('/home')} aria-label="Volver">
            <svg viewBox="0 0 24 24" fill="none"><path d="M15 6l-6 6 6 6" stroke="#fff" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" /></svg>
          </button>
          <div className="org-chip"><span className="org-dot" />Precios</div>
        </div>
        <h1 className="page-title">Consulta de precios</h1>
      </div>

      <div className="s2-body">
        <div className="prices-toolbar">
          <div className="inp prices-search">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="11" cy="11" r="7" />
              <path d="M21 21l-4.35-4.35" />
            </svg>
            <input
              type="text"
              placeholder="Buscar código o nombre"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
          </div>
          <button type="button" className="prices-scan" aria-label="Escanear" onClick={() => undefined}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M3 7V5a2 2 0 0 1 2-2h2M3 17v2a2 2 0 0 0 2 2h2M21 7V5a2 2 0 0 0-2-2h-2M21 17v2a2 2 0 0 1-2 2h-2M8 12h8M8 8h8M8 16h8" />
            </svg>
          </button>
        </div>

        <div className="field">
          <div className="sel">
            <select value={pdv} onChange={(e) => setPdv(e.target.value)}>
              {PDVS.map((p) => <option key={p} value={p}>{p}</option>)}
            </select>
            <svg className="cv" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M6 9l6 6 6-6" />
            </svg>
          </div>
        </div>

        <div className="prices-list">
          {filtered.map((p) => (
            <div key={p.code} className="price-card">
              <img className="price-thumb" src={productImage(p.code)} alt="" />
              <div className="price-info">
                <div className="price-code">{p.code}</div>
                <div className="price-name">{p.name}</div>
                <div className="price-row"><span>Precio:</span> <b>${p.price.toLocaleString('es-CO')}</b></div>
                <div className="price-row"><span>IVA {p.ivaRate.toFixed(1)}%:</span> <b>${p.ivaAmount.toLocaleString('es-CO')}</b></div>
                <div className="price-row"><span>Precio + IVA:</span> <b>${p.priceWithIva.toLocaleString('es-CO')}</b></div>
                <div className="price-row"><span>Unid. empaque:</span> <b>{p.pack.toFixed(1)}</b></div>
              </div>
            </div>
          ))}
          {filtered.length === 0 && <p className="empty-state">No se encontraron productos</p>}
        </div>
      </div>
    </div>
  );
}
