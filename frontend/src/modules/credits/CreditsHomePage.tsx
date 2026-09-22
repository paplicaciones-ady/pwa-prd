import { useNavigate } from 'react-router-dom';
import { AppBar } from '../../shared/components/AppBar';
import { useTheme } from '../../shared/theme/ThemeContext';

export function CreditsHomePage() {
  const navigate = useNavigate();
  const theme = useTheme();
  const logo = theme.logoUrl || undefined;

  return (
    <div className="s2 flow credit-shell">
      <AppBar title="Crédito" logo={logo} onBack={() => navigate('/home')} />
      <div className="body credit-body">
        <div className="qlab">¿Qué deseas hacer hoy?</div>

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
  );
}
