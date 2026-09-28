import { useState } from 'react';
import { productImage } from '../../shared/utils/format';
import './ComplaintsPage.css';
import { useBackTarget } from '../../shared/layout/TopBarContext';

// ── DATOS MOCK ──
// TODO(real-data): cargar producto desde GET /api/products/:id
const MOCK_PRODUCT = {
  code: 'T1201303700',
  name: 'AZADÓN FORJADO 3037 RECTO',
  price: 30000,
};

// TODO(real-data): cargar tipos de reclamo desde GET /api/complaints/reasons
const CLAIM_REASONS = [
  'OXIDACIÓN',
  'EMPAQUE DETERIORADO',
  'MAL PEDIDO',
  'PINTURA',
  'FISURA / FRACTURA',
  'FALTANTE UNIDAD DE EMPAQUE',
];

function Stepper({ value, onChange }: { value: number; onChange: (v: number) => void }) {
  return (
    <div className="cp-stepper">
      <button type="button" onClick={() => onChange(Math.max(0, value - 1))} aria-label="Restar">−</button>
      <span>{value}</span>
      <button type="button" onClick={() => onChange(value + 1)} aria-label="Sumar">+</button>
    </div>
  );
}

export function ComplaintsPage() {
  useBackTarget('/home');
  const [qty, setQty] = useState(1);

  return (
    <div className="s2">
      <div className="s2-head">
        <h1 className="page-title">Quejas y reclamos</h1>
      </div>

      <div className="s2-body">
        <div className="complaint-product">
          <img className="cp-thumb" src={productImage(MOCK_PRODUCT.code)} alt="" />
          <div className="cp-info">
            <div className="cp-code">{MOCK_PRODUCT.code}</div>
            <div className="cp-name">{MOCK_PRODUCT.name}</div>
            <div className="cp-price">${MOCK_PRODUCT.price.toLocaleString('es-CO')}</div>
          </div>
          <Stepper value={qty} onChange={setQty} />
        </div>

        <div className="hsec">Selecciona el tipo de reclamo</div>
        <div className="claims-grid">
          {CLAIM_REASONS.map((reason) => (
            <button
              key={reason}
              type="button"
              className="claim-card"
              // TODO(real-data): POST /api/complaints con {productCode, reason, qty}
              onClick={() => undefined}
            >
              {reason}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
