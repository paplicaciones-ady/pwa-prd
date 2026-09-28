import { useMemo, useState } from 'react';
import { useAuth } from '../auth/AuthContext';
import { Can } from '../../shared/components/Can';
import { formatCOP, productImage } from '../../shared/utils/format';
import './DiscountsPage.css';
import { useBackTarget } from '../../shared/layout/TopBarContext';

// ── DATOS MOCK ──
// TODO(real-data): GET /api/discounts/products, reglas de descuento y presupuesto por vendedor
interface DiscountProduct {
  code: string;
  name: string;
  price: number;
  discountPct: number;
  iva: number;
}

const MOCK_PRODUCTS: DiscountProduct[] = [
  { code: 'T1207320512', name: 'BARRA FORJADA AGRICOLA/INDUSTRIAL 3205-12 LB', price: 86750, discountPct: 0, iva: 0 },
  { code: 'T1217170020', name: 'CARRETA 110 LTS CHASIS MAD VERDE LLANTA ANTIPINCHAZO', price: 363187, discountPct: 0, iva: 0 },
];

const BUDGET = { used: 623437, quota: 3142676.3 };
const ADD_MORE_TILES = ['Herramientas', 'Carretas', 'Maquinaria'];

function Stepper({ value, onChange }: { value: number; onChange: (v: number) => void }) {
  return (
    <div className="dp-stepper">
      <button type="button" onClick={() => onChange(Math.max(0, value - 1))} aria-label="Restar">−</button>
      <span>{value}</span>
      <button type="button" onClick={() => onChange(value + 1)} aria-label="Sumar">+</button>
    </div>
  );
}

export function DiscountsPage() {
  useBackTarget('/home');
  const { moduleContexts } = useAuth();
  const permissions = moduleContexts.discounts?.permissions || [];

  const [qtys, setQtys] = useState<Record<string, number>>({
    [MOCK_PRODUCTS[0].code]: 3,
    [MOCK_PRODUCTS[1].code]: 1,
  });
  const [summaryOpen, setSummaryOpen] = useState(false);

  const lines = useMemo(() => MOCK_PRODUCTS.map((p) => {
    const qty = qtys[p.code] || 0;
    const gross = qty * p.price;
    const discount = gross * (p.discountPct / 100);
    const iva = (gross - discount) * (p.iva / 100);
    const total = gross - discount + iva;
    return { ...p, qty, gross, discount, iva, total };
  }), [qtys]);

  const { totalItems, subtotal, totalDiscount, totalIva, total } = useMemo(() => {
    return lines.reduce((acc, l) => ({
      totalItems: acc.totalItems + l.qty,
      subtotal: acc.subtotal + l.gross,
      totalDiscount: acc.totalDiscount + l.discount,
      totalIva: acc.totalIva + l.iva,
      total: acc.total + l.total,
    }), { totalItems: 0, subtotal: 0, totalDiscount: 0, totalIva: 0, total: 0 });
  }, [lines]);

  const budgetPct = Math.min(100, Math.round((BUDGET.used / BUDGET.quota) * 100));

  return (
    <div className="s2">
      <div className="s2-head">
        <h1 className="page-title">Descuentos</h1>
      </div>

      <div className="s2-body discounts-body">
        <div className="dp-budget">
          <div className="dp-budget-fill" style={{ width: `${budgetPct}%` }} />
          <span className="dp-budget-text">{formatCOP(BUDGET.used)} · {budgetPct}%</span>
        </div>
        <div className="dp-budget-caption">{formatCOP(BUDGET.quota)} V.sg</div>

        <div className="dp-products">
          {lines.map((l) => (
            <div key={l.code} className="dp-card">
              <div className="dp-card-head">{l.name}</div>
              <div className="dp-card-body">
                <img className="dp-thumb" src={productImage(l.code)} alt="" />
                <div className="dp-details">
                  <div className="dp-row"><span>Código</span><b>{l.code}</b></div>
                  <div className="dp-row"><span>Precio</span><b>{formatCOP(l.price)}</b></div>
                  <div className="dp-row"><span>Descuento</span><b>{l.discountPct}%</b></div>
                  <div className="dp-row"><span>Valor desc.</span><b>{formatCOP(l.discount)}</b></div>
                  <div className="dp-row"><span>IVA</span><b>{formatCOP(l.iva)}</b></div>
                  <div className="dp-row dp-total"><span>Total precio</span><b>{formatCOP(l.total)}</b></div>
                </div>
              </div>
              <div className="dp-card-actions">
                <Stepper value={l.qty} onChange={(v) => setQtys((prev) => ({ ...prev, [l.code]: v }))} />
                <button type="button" className="dp-pct-btn" onClick={() => undefined}>%</button>
              </div>
            </div>
          ))}
        </div>

        <div className="hsec">¿Algo más por agregar?</div>
        <div className="dp-add-grid">
          {ADD_MORE_TILES.map((t) => (
            <button key={t} type="button" className="dp-add-tile" onClick={() => undefined}>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M12 5v14M5 12h14" />
              </svg>
              {t}
            </button>
          ))}
        </div>

        <button type="button" className="dp-summary-toggle" onClick={() => setSummaryOpen(true)}>
          Resumen del pedido
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" style={{ transform: summaryOpen ? 'rotate(180deg)' : undefined }}>
            <path d="M6 15l6-6 6 6" />
          </svg>
        </button>
      </div>

      <div className="dp-action-bar">
        <span className="dp-count">{totalItems} Productos</span>
        <span className="dp-total">Total: {formatCOP(total)}</span>
        <Can permission="discounts.create" permissions={permissions}>
          <button type="button" className="dp-finish" onClick={() => undefined}>Finalizar pedidos</button>
        </Can>
      </div>

      {summaryOpen && (
        <div className="modal-backdrop" onClick={() => setSummaryOpen(false)}>
          <div className="modal-sheet" onClick={(e) => e.stopPropagation()}>
            <h3 className="sectitle">Resumen del pedido</h3>
            <div className="info-card" style={{ marginBottom: 12 }}>
              <div className="kvline"><span className="k">Subtotal</span><span className="v">{formatCOP(subtotal)}</span></div>
              <div className="kvline"><span className="k">Descuentos</span><span className="v">-{formatCOP(totalDiscount)}</span></div>
              <div className="kvline"><span className="k">IVA</span><span className="v">{formatCOP(totalIva)}</span></div>
              <div className="kvline" style={{ borderTop: '1px solid var(--line)', marginTop: 6, paddingTop: 8 }}>
                <span className="k">Total</span><span className="v" style={{ color: 'var(--accent)' }}>{formatCOP(total)}</span>
              </div>
            </div>
            <button type="button" className="btn btn-primary" onClick={() => setSummaryOpen(false)}>Cerrar</button>
          </div>
        </div>
      )}
    </div>
  );
}
