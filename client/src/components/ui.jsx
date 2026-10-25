import { createContext, useContext, useState, useCallback, useRef, useEffect, useId } from 'react';
import { Icon } from './icons.jsx';

/* ---------- Toasts ---------- */
const ToastCtx = createContext(() => {});
export const useToast = () => useContext(ToastCtx);

/* ---------- Confirm dialog (replaces window.confirm) ---------- */
const ConfirmCtx = createContext(() => Promise.resolve(true));
export const useConfirm = () => useContext(ConfirmCtx);

export function UIProvider({ children }) {
  const [toasts, setToasts] = useState([]);
  const [dialog, setDialog] = useState(null);
  const nextId = useRef(0);

  const notify = useCallback((message, type = 'ok') => {
    const id = ++nextId.current;
    setToasts((t) => [...t.slice(-2), { id, message, type }]);
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 4200);
  }, []);

  const confirm = useCallback((opts) => new Promise((resolve) => setDialog({ ...opts, resolve })), []);
  const close = (v) => { dialog?.resolve(v); setDialog(null); };

  useEffect(() => {
    if (!dialog) return;
    const onKey = (e) => e.key === 'Escape' && close(false);
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });

  return (
    <ToastCtx.Provider value={notify}>
      <ConfirmCtx.Provider value={confirm}>
        {children}
        <div className="toasts" aria-live="polite">
          {toasts.map((t) => (
            <div key={t.id} className={`toast ${t.type}`} role="status">
              <Icon name={t.type === 'err' ? 'alert' : 'checkCircle'} />
              <span>{t.message}</span>
            </div>
          ))}
        </div>
        {dialog && (
          <div className="overlay center" onMouseDown={(e) => e.target === e.currentTarget && close(false)}>
            <div className="modal" role="alertdialog" aria-modal="true" aria-labelledby="dlg-title">
              <h2 id="dlg-title">{dialog.title}</h2>
              <p>{dialog.body}</p>
              <div className="modal-actions">
                <button className="btn" onClick={() => close(false)}>{dialog.cancelLabel || 'Keep as is'}</button>
                <button className={`btn ${dialog.danger ? 'danger solid' : 'primary'}`} autoFocus onClick={() => close(true)}>{dialog.confirmLabel || 'Confirm'}</button>
              </div>
            </div>
          </div>
        )}
      </ConfirmCtx.Provider>
    </ToastCtx.Provider>
  );
}
// Backwards-compatible alias.
export const ToastProvider = UIProvider;

/* ---------- States ---------- */
export function Loading({ label = 'Loading…', rows = 3 }) {
  return (
    <div className="skeleton" role="status" aria-label={label}>
      <div className="sk" style={{ height: 42, width: '38%' }} />
      <div className="grid g3">{Array.from({ length: rows }, (_, i) => <div key={i} className="sk" style={{ height: 110 }} />)}</div>
      <div className="sk" style={{ height: 260 }} />
    </div>
  );
}
export const ErrorBox = ({ error, onRetry }) => (
  <div className="state error panel" role="alert">
    <div className="state-icon"><Icon name="alert" /></div>
    <strong>Something went wrong</strong>
    <p>{error}</p>
    {onRetry && <button className="btn" onClick={onRetry}><Icon name="refresh" />Try again</button>}
  </div>
);
export const Empty = ({ title, children, icon = 'inbox', action }) => (
  <div className="state">
    <div className="state-icon"><Icon name={icon} /></div>
    <strong>{title}</strong>
    {children && <p>{children}</p>}
    {action}
  </div>
);

/* ---------- Small pieces ---------- */
export const RiskBadge = ({ level }) => <span className={`badge ${level.toLowerCase()}`}>{level} risk</span>;
export const pct = (v) => (v == null ? '—' : `${v}%`);
export const signed = (v, unit = '') => (v == null ? '—' : `${v > 0 ? '+' : ''}${v}${unit}`);
export const RISK_COLOR = { High: 'var(--high)', Medium: '#f59e0b', Low: 'var(--ok)' };

export function Avatar({ name, size = '' }) {
  const initials = name.split(/\s+/).map((p) => p[0]).slice(0, 2).join('').toUpperCase();
  let hue = 0;
  for (const ch of name) hue = (hue * 31 + ch.charCodeAt(0)) % 360;
  return <span className={`avatar ${size}`} style={{ '--h': hue }} aria-hidden="true">{initials}</span>;
}

// Counts up to a number once, respecting reduced-motion.
export function CountUp({ value, decimals = 0, suffix = '' }) {
  const [shown, setShown] = useState(value);
  const from = useRef(0);
  useEffect(() => {
    if (value == null || Number.isNaN(value)) return;
    const reduce = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    if (reduce) { setShown(value); return; }
    const start = performance.now(), a = from.current, dur = 700;
    let raf;
    const tick = (t) => {
      const p = Math.min(1, (t - start) / dur), e = 1 - Math.pow(1 - p, 3);
      setShown(a + (value - a) * e);
      if (p < 1) raf = requestAnimationFrame(tick); else from.current = value;
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [value]);
  if (value == null) return '—';
  return <>{Number(shown).toFixed(decimals)}{suffix}</>;
}

export function Kpi({ label, value, decimals, suffix, tone = '', hint, spark }) {
  return (
    <div className={`kpi ${tone}`}>
      <span>{label}</span>
      <b>{typeof value === 'number' ? <CountUp value={value} decimals={decimals} suffix={suffix} /> : (value ?? '—')}</b>
      {hint && <small>{hint}</small>}
      {spark && <Sparkline data={spark} width={84} height={30} className="spark" />}
    </div>
  );
}

export function Sparkline({ data = [], width = 96, height = 28, color = 'var(--brand)', className }) {
  const pts = data.filter((v) => v != null);
  if (pts.length < 2) return <span className="note">—</span>;
  const min = Math.min(...pts), max = Math.max(...pts), span = max - min || 1, pad = 3;
  const xy = pts.map((v, i) => [pad + (i * (width - pad * 2)) / (pts.length - 1), height - pad - ((v - min) / span) * (height - pad * 2)]);
  const d = xy.map(([x, y], i) => `${i ? 'L' : 'M'}${x.toFixed(1)} ${y.toFixed(1)}`).join(' ');
  const last = xy[xy.length - 1];
  return (
    <svg className={className} width={width} height={height} viewBox={`0 0 ${width} ${height}`} role="img" aria-label={`Trend: ${pts[0]} to ${pts[pts.length - 1]}`}>
      <path d={d} fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      <circle cx={last[0]} cy={last[1]} r="3" fill={color} />
    </svg>
  );
}

export function Gauge({ value = 0, color = 'var(--brand)', label = 'risk points' }) {
  const r = 52, c = 2 * Math.PI * r;
  const [v, setV] = useState(0);
  useEffect(() => { const t = setTimeout(() => setV(value), 60); return () => clearTimeout(t); }, [value]);
  return (
    <div className="gauge" role="img" aria-label={`${value} out of 100 ${label}`}>
      <svg viewBox="0 0 132 132"><circle className="track" cx="66" cy="66" r={r} /><circle className="val" cx="66" cy="66" r={r} stroke={color} strokeDasharray={c} strokeDashoffset={c * (1 - v / 100)} /></svg>
      <div className="gauge-label"><div><b>{value}</b><br /><span>{label}</span></div></div>
    </div>
  );
}

export function ChartTip({ active, payload, label, unit = '%', labelPrefix = 'Week ' }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="chart-tip">
      <b>{labelPrefix}{label}</b>
      {payload.filter((p) => p.value != null).map((p) => <div key={p.dataKey}><span style={{ color: p.color }}>●</span> {p.name}: <b style={{ display: 'inline' }}>{p.value}{unit}</b></div>)}
    </div>
  );
}

export function PageHead({ title, children, actions }) {
  return (
    <div className="head">
      <div><h1>{title}</h1>{children && <p>{children}</p>}</div>
      {actions && <div className="head-actions">{actions}</div>}
    </div>
  );
}

export function useId2(prefix) { return `${prefix}${useId().replace(/:/g, '')}`; }
