import { useState } from 'react';
import { Infinity as InfinityIcon, ArrowRight, ArrowLeft, Eye, EyeOff, CheckCircle2 } from 'lucide-react';
import { motion } from 'motion/react';

export default function AuthScreen({ onSignIn }) {
  const [mode, setMode] = useState('signin');
  const [email, setEmail] = useState('reviewer@continuum.demo');
  const [name, setName] = useState('');
  const [password, setPassword] = useState('');
  const [visible, setVisible] = useState(false);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [recovered, setRecovered] = useState(false);
  const changeMode = next => { setMode(next); setError(''); setPassword(''); setRecovered(false); };
  const submit = event => {
    event.preventDefault(); setError('');
    if (mode === 'recover') { setRecovered(true); return; }
    if (password !== 'ContinuumDemo!') { setError('Use the demo password ContinuumDemo! No real account credentials are needed.'); return; }
    if (mode === 'signup' && !name.trim()) { setError('Enter a display name for your demo session.'); return; }
    setBusy(true);
    try { onSignIn({ email: email.trim(), name: name.trim() || (email.startsWith('viewer') ? 'Demo viewer' : 'Demo reviewer'), viewer: email.startsWith('viewer') }); }
    catch { setError('This browser could not save the demo session. Enable session storage and try again.'); setBusy(false); }
  };
  const title = mode === 'signup' ? 'Make room for context.' : mode === 'recover' ? 'Let’s get you back in.' : 'Welcome back to Continuum.';
  return <main className="entry-page">
    <header className="entry-brand"><InfinityIcon size={32} strokeWidth={1.5} /><span>Continuum</span></header>
    <div className="entry-layout">
      <section className="entry-story"><h1>Good decisions deserve<br />a little continuity.</h1><p>Follow a change. Understand its connections. Leave the next person the context they need.</p><div className="entry-example"><span>core/checkout-service</span><p>A return contract changed.</p><div><span>Code</span><ArrowRight size={15} /><span>Evidence</span><ArrowRight size={15} /><span>Your judgment</span></div></div><p className="entry-footnote">A synthetic workspace, ready to explore.</p></section>
      <motion.section key={mode} className="auth-panel" initial={{ opacity: 0.7, y: 8 }} animate={{ opacity: 1, y: 0 }} aria-labelledby="auth-title">
        <h2 id="auth-title">{title}</h2><p>{mode === 'signup' ? 'Create a local demo identity to try the complete review journey.' : mode === 'recover' ? 'This prototype uses a shared demo password. No recovery email is sent.' : 'Sign in to pick up the thread of your repository.'}</p>
        {recovered ? <div className="auth-recovery" role="status"><CheckCircle2 size={24} /><h3>Your demo access is ready</h3><p>Use your demo email with <strong>ContinuumDemo!</strong> to sign in.</p><button className="btn btn--accent" onClick={() => changeMode('signin')}>Back to sign in <ArrowRight size={16} /></button></div> : <form onSubmit={submit} className="journey-form">
          {mode === 'signup' && <label>Display name<input autoComplete="nickname" value={name} onChange={event => setName(event.target.value)} required maxLength={60} placeholder="Alex Rivera" /></label>}
          <label>Demo email<input type="email" autoComplete="username" value={email} onChange={event => setEmail(event.target.value)} required placeholder="reviewer@continuum.demo" /></label>
          {mode !== 'recover' && <label>Password<div className="password-field"><input type={visible ? 'text' : 'password'} autoComplete={mode === 'signup' ? 'new-password' : 'current-password'} value={password} onChange={event => setPassword(event.target.value)} required aria-describedby="demo-credentials" /><button type="button" onClick={() => setVisible(value => !value)} aria-label={visible ? 'Hide password' : 'Show password'}>{visible ? <EyeOff size={18} /> : <Eye size={18} />}</button></div></label>}
          {error && <p className="form-error" role="alert">{error}</p>}
          {mode === 'signin' && <button type="button" className="text-link auth-forgot" onClick={() => changeMode('recover')}>Forgot password?</button>}
          <button className="btn btn--accent auth-submit" disabled={busy}>{busy ? 'Opening your workspace…' : mode === 'signup' ? 'Create demo account' : mode === 'recover' ? 'Recover demo access' : 'Sign in'}<ArrowRight size={16} /></button>
        </form>}
        {mode !== 'recover' && <div className="demo-credentials" id="demo-credentials"><strong>Demo access</strong><p>Use <span>reviewer@continuum.demo</span> and <span>ContinuumDemo!</span>. For read-only access, use <span>viewer@continuum.demo</span>.</p><button className="text-link" onClick={() => { setEmail('reviewer@continuum.demo'); setPassword('ContinuumDemo!'); }}>Fill demo credentials</button></div>}
        <div className="auth-switch">{mode === 'signin' ? <>New here? <button className="text-link" onClick={() => changeMode('signup')}>Create a demo account</button></> : <button className="text-link" onClick={() => changeMode('signin')}><ArrowLeft size={14} />Back to sign in</button>}</div>
        <p className="auth-boundary">Demo only. Passwords are never stored or sent. Your session stays in this tab; review data stays in this browser.</p>
      </motion.section>
    </div>
  </main>;
}
