import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext';
import { Can } from '../../shared/components/Can';
import './ExpensesPage.css';
import { useBackTarget } from '../../shared/layout/TopBarContext';

// ── DATOS MOCK ──
// TODO(real-data): catálogo de dependencias desde GET /api/expenses/dependencies
const DEPENDENCIES = ['Comercial', 'Mercadeo', 'Logística', 'Administrativa'];

export function ExpensesPage() {
  const navigate = useNavigate();
  useBackTarget('/home');
  const { moduleContexts } = useAuth();
  const permissions = moduleContexts.expenses?.permissions || [];

  const [route, setRoute] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [advance, setAdvance] = useState('');
  const [dependency, setDependency] = useState(DEPENDENCIES[0]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    // TODO(real-data): POST /api/expenses con {dependency, route, startDate, endDate, advance}
    window.alert('Gasto registrado (mock)');
  };

  return (
    <div className="s2">
      <div className="s2-head">
        <h1 className="page-title">Gastos de viaje</h1>
      </div>

      <div className="s2-body">
        <form onSubmit={handleSubmit} className="expenses-form">
          <div className="field">
            <label>Dependencia</label>
            <div className="sel">
              <select value={dependency} onChange={(e) => setDependency(e.target.value)}>
                {DEPENDENCIES.map((d) => <option key={d} value={d}>{d}</option>)}
              </select>
              <svg className="cv" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M6 9l6 6 6-6" />
              </svg>
            </div>
          </div>

          <div className="field">
            <label>Ruta</label>
            <div className="inp">
              <input
                type="text"
                value={route}
                maxLength={500}
                placeholder="Describe la ruta"
                onChange={(e) => setRoute(e.target.value)}
              />
              <span className="inp-counter">{route.length}/500</span>
            </div>
          </div>

          <div className="row2">
            <div className="field">
              <label>Fecha inicio</label>
              <div className="inp"><input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} /></div>
            </div>
            <div className="field">
              <label>Fecha fin</label>
              <div className="inp"><input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} /></div>
            </div>
          </div>

          <div className="field">
            <label>Valor anticipo</label>
            <div className="inp">
              <input
                type="number"
                min={0}
                max={20}
                value={advance}
                placeholder="0"
                onChange={(e) => setAdvance(e.target.value)}
              />
              <span className="inp-counter">{advance ? `${advance}/20` : '0/20'}</span>
            </div>
          </div>

          <Can permission="expenses.create" permissions={permissions}>
            <div className="rowbtn">
              <button type="button" className="btn btn-ghost" onClick={() => navigate('/home')}>Cancelar</button>
              <button type="submit" className="btn btn-primary">Aceptar</button>
            </div>
          </Can>
        </form>
      </div>

      <Can permission="expenses.create" permissions={permissions}>
        <div className="fab-stack">
          <button type="button" className="fab" aria-label="Nuevo gasto" onClick={() => undefined}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 5v14M5 12h14" />
            </svg>
          </button>
        </div>
      </Can>
    </div>
  );
}
