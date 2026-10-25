import { useState } from 'react';
import { api } from '../api.js';
import { Icon, LogoMark } from './icons.jsx';

const DEMOS = [
  ['Teacher', 'teacher@classpulse.demo'],
  ['Admin', 'admin@classpulse.demo'],
  ['Student', 'student@classpulse.demo'],
];

export default function Login({ onLogin, themeButton }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [show, setShow] = useState(false);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    setBusy(true); setError('');
    try {
      const d = await api('/auth/login', { method: 'POST', body: { email, password } });
      onLogin(d.user, d.token);
    } catch (err) { setError(err.message); } finally { setBusy(false); }
  };

  return (
    <div className="login-wrap">
      <section className="login-hero" aria-label="About ClassPulse">
        <div className="brand"><LogoMark className="brand-mark" /><div><b>ClassPulse</b><small>Early academic support</small></div></div>
        <div>
          <svg className="ecg" viewBox="0 0 600 120" preserveAspectRatio="none" aria-hidden="true">
            <path className="ghost" d="M0 70h600" />
            <path d="M0 70h120l14-4 12 4h40l12-52 22 100 24-82 14 34h50l12-4 14 4h90l14-26 16 26h70l14-4 12 4h70" />
          </svg>
          <h1>Notice the signal before the struggle.</h1>
          <p>ClassPulse joins attendance and assessment trends, flags the students who may need support, and shows exactly why. The teacher always decides what happens next.</p>
        </div>
        <ul className="login-points">
          <li><Icon name="eye" />Every flag shows its rule, the value it saw, and the threshold it crossed.</li>
          <li><Icon name="shield" />No hidden score and no automated decisions, only prompts for teachers.</li>
          <li><Icon name="plan" />Plan support, record follow-ups, then see whether things improved.</li>
        </ul>
      </section>

      <section className="login-panel">
        <div className="theme-float">{themeButton}</div>
        <div className="login-card">
          <h2>Welcome back</h2>
          <p className="note">Sign in to see which students need support, and why.</p>
          <form onSubmit={submit}>
            <div className="field"><label htmlFor="email">Email</label><input id="email" type="email" autoComplete="username" required value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@school.org" /></div>
            <div className="field">
              <label htmlFor="pw">Password</label>
              <div className="pw-field">
                <input id="pw" type={show ? 'text' : 'password'} autoComplete="current-password" required value={password} onChange={(e) => setPassword(e.target.value)} style={{ paddingRight: 44 }} />
                <button type="button" className="btn ghost sm" onClick={() => setShow((s) => !s)} aria-label={show ? 'Hide password' : 'Show password'}><Icon name={show ? 'eyeOff' : 'eye'} /></button>
              </div>
            </div>
            {error && <p className="form-error" role="alert">{error}</p>}
            <button className="btn primary block" disabled={busy}>{busy ? 'Signing in…' : 'Sign in'}</button>
          </form>

          <div className="demo-box">
            <h3>Trying the demo?</h3>
            <p className="note" style={{ margin: 0 }}>Pick a role to fill in the email. All data is synthetic.</p>
            <div className="demo-accounts">
              {DEMOS.map(([label, mail]) => <button key={mail} type="button" className="chip" aria-pressed={email === mail} onClick={() => { setEmail(mail); document.getElementById('pw')?.focus(); }}>{label}</button>)}
            </div>
            <p className="note" style={{ margin: 0 }}>The password is the <code>DEMO_PASSWORD</code> set where this app is hosted (see README).</p>
          </div>
        </div>
      </section>
    </div>
  );
}
