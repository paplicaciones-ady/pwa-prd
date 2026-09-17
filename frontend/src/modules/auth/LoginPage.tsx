import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from './AuthContext';
import { httpClient } from '../../shared/api/httpClient';
import { startAuthentication } from '@simplewebauthn/browser';

export function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [uiMode, setUiMode] = useState<'form' | 'has-passkey' | 'loading'>('loading');
  const navigate = useNavigate();
  const { refreshBootstrap, resetModuleContexts } = useAuth();

  // Guards contra disparos duplicados (React.StrictMode en dev monta el efecto
  // dos veces): sin esto se piden dos challenges y el segundo pisa al primero
  // en Redis, haciendo que la firma del dispositivo no coincida → login falla.
  const autoScheduledRef = useRef(false);
  const passkeyInFlightRef = useRef(false);
  const autoTimerRef = useRef<number | null>(null);

  // Verificar passkey automáticamente al cargar si hay email guardado
  useEffect(() => {
    const savedEmail = localStorage.getItem('lastEmail');
    if (savedEmail) {
      setEmail(savedEmail);
      checkPasskeys(savedEmail);
    } else {
      setUiMode('form');
    }
    return () => {
      if (autoTimerRef.current !== null) {
        clearTimeout(autoTimerRef.current);
        autoTimerRef.current = null;
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const checkPasskeys = async (emailToCheck: string) => {
    try {
      const res = await httpClient.post('/auth/passkeys/check', { email: emailToCheck });
      if (res.data?.hasPasskeys) {
        setUiMode('has-passkey');
        // Intento automático tras un pequeño delay para que el usuario vea la UI.
        // Solo se agenda una vez por carga (aunque StrictMode repita el effect).
        if (!autoScheduledRef.current) {
          autoScheduledRef.current = true;
          autoTimerRef.current = window.setTimeout(() => {
            autoTimerRef.current = null;
            handlePasskeyAuto(emailToCheck);
          }, 600);
        }
      } else {
        setUiMode('form');
      }
    } catch {
      setUiMode('form');
    }
  };

  const finishLogin = async () => {
    localStorage.setItem('lastEmail', email);
    resetModuleContexts();
    await refreshBootstrap();
    navigate('/home');
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setBusy(true);
    try {
      await httpClient.post('/auth/login', { email, password });
      await finishLogin();
    } catch (err: any) {
      setError(err?.response?.data?.message?.message || 'Credenciales inválidas');
    } finally {
      setBusy(false);
    }
  };

  const handlePasskeyAuto = async (emailToUse: string) => {
    // Evita que el intento automático y el botón manual corran a la vez y
    // generen dos challenges (el segundo invalidaría la firma del primero).
    if (passkeyInFlightRef.current) return;
    passkeyInFlightRef.current = true;
    setBusy(true);
    setError('');
    try {
      const optionsRes = await httpClient.post('/auth/passkeys/login/options', { email: emailToUse });
      const options = optionsRes.data;
      const credential = await startAuthentication(options);
      await httpClient.post('/auth/passkeys/login/verify', { email: emailToUse, response: credential });
      localStorage.setItem('lastEmail', emailToUse);
      await finishLogin();
    } catch (err: any) {
      if (err?.name === 'NotAllowedError') {
        // El usuario canceló el prompt biométrico: volvemos al formulario
        setUiMode('form');
      } else {
        setError(err?.response?.data?.message?.message || err?.message || 'No se pudo iniciar sesión con passkey');
        setUiMode('form');
      }
    } finally {
      passkeyInFlightRef.current = false;
      setBusy(false);
    }
  };

  const handlePasskeyManual = () => {
    if (!email) {
      setError('Ingresa tu correo para iniciar con passkey');
      return;
    }
    handlePasskeyAuto(email);
  };

  const today = new Date().toLocaleDateString('es-CO', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });

  return (
    <div className="s1">
      <div className="s1-hero" style={{ background: 'linear-gradient(160deg, #1356a0, #0c3567)' }}>
        <div className="org-row">
          <div className="org-chip">
            <span className="org-dot" />
            PWA App
          </div>
        </div>
        <div className="s1-date">
          <span className="date-label">{today}</span>
        </div>
      </div>

      <div className="s1-sheet">
        <div className="sheet-handle" />
        <div className="sheet-scroll">
          {error && <div className="error-msg">{error}</div>}

          <h3 className="sheet-title">Iniciar sesión</h3>
          <p className="sheet-lead">Accede con tu cuenta corporativa.</p>

          {uiMode === 'has-passkey' && (
            <>
              <button
                className="btn btn-primary"
                onClick={handlePasskeyManual}
                disabled={busy}
                style={{ padding: '18px', fontSize: 17 }}
              >
                <svg viewBox="0 0 24 24" fill="none">
                  <path d="M12 4c-2.8 0-5 1.6-6 3.5M19 9c0-1.2-.5-2.4-1.3-3.4M5 11c0-1 .3-2 .8-2.8M4.5 16c.7-1.3 1-2.8 1-4.3M8 19c1-1.6 1.4-3.6 1.4-5.6 0-1.5 1-2.6 2.6-2.6s2.6 1.1 2.6 2.6c0 .9-.1 1.8-.3 2.6M11.8 13.4c0 3.2-.6 5.8-1.6 7.6M15 17.5c-.3 1-.7 2-1.2 2.9" stroke="#fff" strokeWidth="1.8" strokeLinecap="round" />
                </svg>
                {busy ? 'Entrando…' : 'Entrar con huella'}
              </button>

              <div className="divider">o continúa con</div>
            </>
          )}

          <form onSubmit={handleSubmit}>
            <div className="field">
              <label>Email</label>
              <div className="inp">
                <svg viewBox="0 0 24 24" fill="none"><rect x="2" y="5" width="20" height="14" rx="2" stroke="currentColor" strokeWidth="2" /><path d="m2 7 10 7 10-7" stroke="currentColor" strokeWidth="2" strokeLinecap="round" /></svg>
                <input
                  value={email}
                  onChange={(e) => {
                    setEmail(e.target.value);
                    setUiMode('form');
                  }}
                  onBlur={(e) => {
                    if (e.target.value && uiMode !== 'has-passkey') {
                      checkPasskeys(e.target.value);
                    }
                  }}
                  placeholder="tu@empresa.com"
                  autoComplete="username"
                  type="email"
                />
              </div>
            </div>

            <div className="field">
              <label>Contraseña</label>
              <div className="inp">
                <svg viewBox="0 0 24 24" fill="none"><rect x="3" y="11" width="18" height="11" rx="2" stroke="currentColor" strokeWidth="2" /><path d="M7 11V7a5 5 0 0 1 10 0v4" stroke="currentColor" strokeWidth="2" /></svg>
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  autoComplete="current-password"
                />
              </div>
            </div>

            <button type="submit" className="btn btn-primary" disabled={busy} style={{ opacity: busy ? 0.6 : 1 }}>
              {busy ? 'Ingresando…' : 'Ingresar'}
            </button>
          </form>

          {uiMode === 'form' && (
            <>
              <div className="divider">o</div>
              <button className="btn btn-ghost" onClick={handlePasskeyManual} disabled={busy}>
                <svg viewBox="0 0 24 24" fill="none"><path d="M12 2a7 7 0 0 0-7 7c0 2.5 1.5 4.5 3 6v3a2 2 0 0 0 2 2h4a2 2 0 0 0 2-2v-3c1.5-1.5 3-3.5 3-6a7 7 0 0 0-7-7Z" stroke="currentColor" strokeWidth="2" /><path d="M9 22h6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" /></svg>
                Iniciar con passkey
              </button>
            </>
          )}

          <div className="s1-foot">
            <svg viewBox="0 0 24 24" fill="none"><path d="M12 2l8 4v6c0 5-3.5 8-8 10-4.5-2-8-5-8-10V6l8-4Z" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" /><path d="M9 12l2 2 4-4" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" /></svg>
            Conexión cifrada de extremo a extremo
          </div>
        </div>
      </div>
    </div>
  );
}