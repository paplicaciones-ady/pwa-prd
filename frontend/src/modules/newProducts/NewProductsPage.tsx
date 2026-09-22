import { useNavigate } from 'react-router-dom';
import { formatCOP, productImage } from '../../shared/utils/format';
import './NewProductsPage.css';

// ── DATOS MOCK ──
// TODO(real-data): GET /api/new-products/:id, carrito y promociones
const MOCK_PRODUCT = {
  code: 'T1398601007',
  name: 'BOTA HERRAGRO PVC NEGRA S/P TALLA 42',
  price: 33210,
  total: 39520,
  discount: 0,
  stock: 0,
  ean: '—',
};

const CART_SUMMARY = { items: 6, total: 1349811 };

export function NewProductsPage() {
  const navigate = useNavigate();
  return (
    <div className="s2">
      <div className="s2-head">
        <div className="s2-top">
          <button type="button" className="cback" onClick={() => navigate('/home')} aria-label="Volver">
            <svg viewBox="0 0 24 24" fill="none"><path d="M15 6l-6 6 6 6" stroke="#fff" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" /></svg>
          </button>
          <div className="org-chip"><span className="org-dot" />Nuevos</div>
        </div>
        <h1 className="page-title">Productos nuevos</h1>
      </div>

      <div className="s2-body np-body">
        <div className="np-card">
          <img className="np-image" src={productImage(MOCK_PRODUCT.code)} alt="" />
          <h2 className="np-name">{MOCK_PRODUCT.name}</h2>

          <div className="np-rows">
            <div className="np-row"><span>Código</span><b>{MOCK_PRODUCT.code}</b></div>
            <div className="np-row">
              <span>Precio</span>
              <div className="np-col"><b>{formatCOP(MOCK_PRODUCT.price)}</b><small>Total {formatCOP(MOCK_PRODUCT.total)}</small></div>
            </div>
            <div className="np-row">
              <span>Descuento</span>
              <div className="np-col"><b>{MOCK_PRODUCT.discount.toFixed(2)}%</b><small>Inv {MOCK_PRODUCT.stock}</small></div>
            </div>
            <div className="np-row"><span>EAN</span><b>{MOCK_PRODUCT.ean}</b></div>
          </div>

          <div className="np-total-row">
            <span>Total</span>
            <b>{formatCOP(0)}</b>
          </div>

          <div className="np-stepper-static">
            <button type="button" aria-label="Restar" disabled>−</button>
            <span>0</span>
            <button type="button" aria-label="Sumar" disabled>+</button>
          </div>

          <button type="button" className="np-promo" onClick={() => undefined}>
            Promociones
          </button>
        </div>

        <div className="np-bottom">
          <span>{CART_SUMMARY.items} Productos</span>
          <span className="np-bottom-total">Total: {formatCOP(CART_SUMMARY.total)}</span>
          <button type="button" className="np-finish" onClick={() => undefined}>
            Finalizar pedidos
          </button>
        </div>
      </div>
    </div>
  );
}
