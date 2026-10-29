import { useState, type FormEvent } from 'react';
import { createRoot } from 'react-dom/client';
import { AuthRequestError, requestEmailCode, verifyEmailCode } from './services/auth';
import { TicketDashboard } from './ticket-dashboard';
import './style.css';

type AccessStep = 'email' | 'code';

function BrandMark(): React.JSX.Element {
  return <div className="brand-mark" aria-hidden="true"><span>N</span><i /><i /><i /></div>;
}

const companyLogoUrl = 'https://media.licdn.com/dms/image/v2/D4E0BAQExaCuh_D9S4g/company-logo_200_200/company-logo_200_200/0/1713277996559?e=2147483647&v=beta&t=e9XNo8F60mGK0S_BuRy-eLBZnyKjPJE0D0JbmHRY0do';

function HeaderLogo(): React.JSX.Element {
  const [failed, setFailed] = useState(false);
  return <span className="header-company-logo">{failed ? <BrandMark /> : <img src={companyLogoUrl} alt="Logo Grupo Nodos" onError={() => setFailed(true)} />}</span>;
}

function ShieldIcon(): React.JSX.Element {
  return <svg aria-hidden="true" viewBox="0 0 24 24" fill="none"><path d="M12 3 19 6v5.4c0 4.2-2.8 7.8-7 9.6-4.2-1.8-7-5.4-7-9.6V6l7-3Z" /><path d="m9 12 2 2 4-4" /></svg>;
}

function AccessApp(): React.JSX.Element {
  const [authenticated, setAuthenticated] = useState(false);
  const [step, setStep] = useState<AccessStep>('email');
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [verifiedNotice, setVerifiedNotice] = useState(false);

  async function handleRequestCode(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    setError('');
    setNotice('');
    setBusy(true);
    try {
      await requestEmailCode(email.trim());
      setStep('code');
      setNotice('Solicitud recibida. Si el correo está registrado y autorizado, recibirás instrucciones para continuar.');
    } catch (cause) {
      setError(cause instanceof AuthRequestError ? cause.message : 'No se pudo completar la solicitud. Intenta más tarde.');
    } finally {
      setBusy(false);
    }
  }

  async function handleVerifyCode(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    setError('');
    setNotice('');
    setBusy(true);
    try {
      const verified = await verifyEmailCode(email.trim(), code);
      if (!verified) {
        setError('El código no fue validado. Comprueba los dígitos o solicita uno nuevo.');
        return;
      }
      setAuthenticated(true);
    } catch (cause) {
      setError(cause instanceof AuthRequestError ? cause.message : 'No se pudo validar el código. Intenta más tarde.');
    } finally {
      setBusy(false);
    }
  }

  if (authenticated) return <TicketDashboard email={email.trim()} onSignOut={() => { setAuthenticated(false); changeStep('email'); }} />;

  function changeStep(nextStep: AccessStep): void {
    setStep(nextStep);
    setError('');
    setNotice('');
    setVerifiedNotice(false);
    if (nextStep === 'email') setCode('');
  }

  function openCodeStep(): void {
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
      setError('Escribe primero un correo válido para asociar el código.');
      return;
    }
    changeStep('code');
  }

  return <main className="access-page">
    <section className="brand-panel" aria-label="Grupo Nodos IT">
      <div className="brand-panel-inner">
        <a className="brand-lockup" href="#inicio" aria-label="Grupo Nodos IT, inicio"><HeaderLogo /><span><strong>Grupo Nodos</strong><small>IT MANAGEMENT</small></span></a>
        <div className="brand-copy">
          <span className="brand-eyebrow"><span /> PLATAFORMA INTERNA</span>
          <h1>Tecnología que conecta<br /><em>nuestro trabajo.</em></h1>
          <p>Acceso centralizado a las herramientas de soporte y gestión tecnológica de Grupo Nodos.</p>
        </div>
        <div className="access-visual" aria-hidden="true">
          <div className="visual-orbit orbit-one" /><div className="visual-orbit orbit-two" />
          <div className="visual-core"><BrandMark /></div>
          <div className="visual-node node-one"><ShieldIcon /></div>
          <div className="visual-node node-two"><span>IT</span></div>
          <div className="visual-line line-one" /><div className="visual-line line-two" />
          <span className="visual-caption">GRUPO NODOS · SISTEMAS INTERNOS</span>
        </div>
        <div className="brand-footer"><span>Acceso para personal autorizado</span><span>GUAYAQUIL · ECUADOR</span></div>
      </div>
    </section>

    <section className="form-panel" aria-label="Acceso al sistema">
      <div className="form-panel-top"><span className="secure-label"><ShieldIcon /> ACCESO SEGURO</span><span className="version-label">PORTAL INTERNO</span></div>
      <div className="access-form-wrap">
        <div className="mobile-brand"><BrandMark /><span><strong>Grupo Nodos</strong><small>IT MANAGEMENT</small></span></div>
        <div className="form-heading">
          <span className="step-label">{step === 'email' ? 'BIENVENIDO' : 'VERIFICACIÓN DE CORREO'}</span>
          <h2>{step === 'email' ? 'Iniciar sesión' : 'Ingresa tu código'}</h2>
          <p>{step === 'email' ? 'Usa tu correo corporativo para solicitar un código de acceso.' : <>Enviaremos un código temporal a <strong>{email}</strong>, si la dirección está registrada y autorizada.</>}</p>
        </div>

        {step === 'email' ? <form className="access-form" onSubmit={handleRequestCode}>
          <label htmlFor="corporate-email">Correo corporativo</label>
          <div className="input-shell"><svg aria-hidden="true" viewBox="0 0 24 24" fill="none"><rect x="3" y="5" width="18" height="14" rx="2" /><path d="m4 7 8 6 8-6" /></svg><input id="corporate-email" type="email" name="email" autoComplete="email" placeholder="nombre@gruponodos.com" value={email} onChange={(event) => setEmail(event.target.value)} required maxLength={254} /></div>
          <p className="field-help">Solo pueden continuar contactos registrados y autorizados.</p>
          {error && <div className="feedback feedback-error" role="alert">{error}</div>}
          {notice && <div className="feedback feedback-success" role="status">{notice}</div>}
          <button className="submit-button" type="submit" disabled={busy}>{busy ? <><span className="spinner" /> Enviando solicitud…</> : <>Solicitar código <span aria-hidden="true">→</span></>}</button>
          <button className="text-button resend-button" type="button" disabled={busy} onClick={openCodeStep}>Ya tengo un código</button>
        </form> : <form className="access-form" onSubmit={handleVerifyCode}>
          <label htmlFor="email-code">Código de verificación</label>
          <div className="input-shell code-shell"><svg aria-hidden="true" viewBox="0 0 24 24" fill="none"><rect x="3" y="5" width="18" height="14" rx="2" /><path d="M7 10h.01M11 10h.01M15 10h.01M7 14h.01M11 14h.01M15 14h.01" /></svg><input id="email-code" type="text" inputMode="numeric" autoComplete="one-time-code" placeholder="••••••" value={code} onChange={(event) => { setCode(event.target.value.replace(/\D/g, '').slice(0, 6)); setVerifiedNotice(false); }} required minLength={6} maxLength={6} pattern="[0-9]{6}" aria-describedby="code-help" /></div>
          <p className="field-help" id="code-help">Ingresa los seis dígitos del código temporal.</p>
          {error && <div className="feedback feedback-error" role="alert">{error}</div>}
          {notice && <div className={`feedback ${verifiedNotice ? 'feedback-info' : 'feedback-success'}`} role="status">{notice}</div>}
          <button className="submit-button" type="submit" disabled={busy || code.length !== 6}>{busy ? <><span className="spinner" /> Verificando…</> : <>Verificar código <span aria-hidden="true">→</span></>}</button>
          <button className="text-button resend-button" type="button" disabled={busy} onClick={() => changeStep('email')}>Solicitar otro código</button>
        </form>}

        <div className="access-divider"><span>VERIFICACIÓN CORPORATIVA</span></div>
        <div className="access-assurance"><span className="assurance-icon"><ShieldIcon /></span><p>La verificación del correo no concede permisos por sí sola. El acceso depende de la autorización del usuario.</p></div>
        <div className="mobile-footer">© Grupo Nodos · Sistemas internos</div>
      </div>
      <div className="form-panel-footer"><span>¿Necesitas ayuda? Contacta al equipo de TI.</span><span>© Grupo Nodos 2026</span></div>
    </section>
  </main>;
}

createRoot(document.getElementById('root')!).render(<AccessApp />);
