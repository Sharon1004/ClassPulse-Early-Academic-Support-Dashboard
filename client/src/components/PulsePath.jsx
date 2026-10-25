import { useState } from 'react';
import { api, useApi } from '../api.js';
import { Loading, ErrorBox, Empty, useToast, useConfirm, signed, PageHead, Avatar } from './ui.jsx';
import { Icon } from './icons.jsx';

const OUTCOMES = { improving: 'Improving', no_change: 'No change', worsening: 'Worsening' };
const plus14 = () => new Date(Date.now() + 14 * 86400000).toISOString().slice(0, 10);

export function PlanForm({ student, suggested = [], onCreated, onCancel }) {
  const notify = useToast();
  const [title, setTitle] = useState(`Support plan for ${student.name}`);
  const [actions, setActions] = useState(suggested.join('\n'));
  const [dueDate, setDueDate] = useState(plus14());
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const submit = async (e) => {
    e.preventDefault(); setBusy(true); setError('');
    try {
      await api('/plans', { method: 'POST', body: { studentId: student.id, title, actions: actions.split('\n'), dueDate } });
      notify('Support plan created.'); onCreated();
    } catch (err) { setError(err.message); } finally { setBusy(false); }
  };
  return (
    <form className="panel flat" onSubmit={submit}>
      <div className="field"><label htmlFor="pt">Plan title</label><input id="pt" value={title} onChange={(e) => setTitle(e.target.value)} required /></div>
      <div className="field"><label htmlFor="pa">Actions, one per line (up to 8)</label><textarea id="pa" rows={5} value={actions} onChange={(e) => setActions(e.target.value)} required /><span className="note">{suggested.length ? 'Prefilled from this student’s alerts. Edit freely.' : 'Describe what you will do to help.'}</span></div>
      <div className="field" style={{ maxWidth: 220 }}><label htmlFor="pd">Review by</label><input id="pd" type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} required /></div>
      {error && <p className="form-error" role="alert">{error}</p>}
      <div className="plan-actions" style={{ marginTop: 0 }}><button className="btn primary" disabled={busy}>{busy ? 'Saving…' : 'Create plan'}</button><button type="button" className="btn" onClick={onCancel}>Cancel</button></div>
    </form>
  );
}

export function PlanCard({ plan, onChange, openStudent, showImpact }) {
  const notify = useToast();
  const confirm = useConfirm();
  const [note, setNote] = useState('');
  const [outcome, setOutcome] = useState('no_change');
  const [busy, setBusy] = useState(false);
  const done = plan.actions.filter((a) => a.done).length;
  const overdue = plan.status === 'active' && plan.dueDate < new Date().toISOString().slice(0, 10);

  const run = async (fn, msg) => {
    setBusy(true);
    try { await fn(); if (msg) notify(msg); onChange(); } catch (e) { notify(e.message, 'err'); } finally { setBusy(false); }
  };
  const toggle = (i) => run(() => api(`/plans/${plan.id}`, { method: 'PATCH', body: { toggleAction: i } }));
  const setStatus = (status, msg) => run(() => api(`/plans/${plan.id}`, { method: 'PATCH', body: { status } }), msg);
  const cancel = async () => {
    if (await confirm({ title: 'Cancel this plan?', body: 'The plan stays on record as cancelled and can be reopened later.', confirmLabel: 'Cancel plan', cancelLabel: 'Keep plan', danger: true })) setStatus('cancelled', 'Plan cancelled.');
  };
  const addFollowUp = (e) => {
    e.preventDefault();
    run(async () => { await api(`/plans/${plan.id}/followups`, { method: 'POST', body: { note, outcome } }); setNote(''); }, 'Follow-up recorded.');
  };

  return (
    <article className="panel plan" style={plan.status !== 'active' ? { background: 'var(--surface-2)' } : undefined}>
      <header>
        <div style={{ display: 'flex', gap: 12 }}>
          {plan.studentName && <Avatar name={plan.studentName} />}
          <div>
            <h3>{plan.title}</h3>
            <div className="meta">
              {plan.studentName && <><button className="link" onClick={() => openStudent(plan.studentId)}>{plan.studentName}</button> ({plan.studentClass}) · </>}
              Review by {plan.dueDate}{overdue && <strong style={{ color: 'var(--high)' }}> (overdue)</strong>} · created by {plan.createdBy}
            </div>
          </div>
        </div>
        <span className={`badge ${plan.status}`}>{plan.status}</span>
      </header>

      <div className="progress" aria-hidden="true"><i style={{ width: `${(done / plan.actions.length) * 100}%` }} /></div>
      <p className="note" style={{ marginBottom: 8 }}>{done} of {plan.actions.length} actions done</p>
      {plan.actions.map((a, i) => (
        <label key={i} className={`check ${a.done ? 'done' : ''}`}><input type="checkbox" checked={a.done} disabled={busy || plan.status !== 'active'} onChange={() => toggle(i)} /><span>{a.text}</span></label>
      ))}

      {showImpact && plan.impact && (
        <div className="impact-line">
          <Icon name="impact" size={18} />
          {plan.impact.weeksSince === 0 ? 'Impact: waiting for new weekly data after this plan started.' : <span>Since the plan started ({plan.impact.weeksSince} week{plan.impact.weeksSince > 1 ? 's' : ''} of new data): attendance <b>{signed(plan.impact.attendanceChange, ' pts')}</b>, score <b>{signed(plan.impact.scoreChange, ' pts')}</b> <span className={`badge ${plan.impact.outcome}`}>{plan.impact.outcome.replace('_', ' ')}</span></span>}
        </div>
      )}

      <h3 style={{ margin: '18px 0 4px', fontSize: '.95rem' }}>Follow-ups</h3>
      {plan.followUps.length === 0 ? <p className="note">No follow-ups recorded yet.</p> : (
        <div className="timeline">
          {plan.followUps.map((f, i) => (
            <div className="fu" key={i}><span className="note">{f.date}{f.by ? ` · ${f.by}` : ''}</span> <span className={`badge ${f.outcome}`}>{OUTCOMES[f.outcome]}</span><div>{f.note}</div></div>
          ))}
        </div>
      )}
      {plan.status === 'active' && (
        <form className="row" onSubmit={addFollowUp} style={{ marginTop: 14 }}>
          <div style={{ flex: '3 1 240px' }}><label htmlFor={`n${plan.id}`}>New follow-up note</label><input id={`n${plan.id}`} value={note} onChange={(e) => setNote(e.target.value)} required minLength={3} placeholder="What happened, and what is next?" /></div>
          <div><label htmlFor={`o${plan.id}`}>Outcome</label><select id={`o${plan.id}`} value={outcome} onChange={(e) => setOutcome(e.target.value)}>{Object.entries(OUTCOMES).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select></div>
          <button className="btn auto" disabled={busy}><Icon name="plus" />Add follow-up</button>
        </form>
      )}
      <div className="plan-actions">
        {plan.status === 'active'
          ? <><button className="btn sm" disabled={busy} onClick={() => setStatus('completed', 'Plan marked complete.')}><Icon name="check" />Mark complete</button><button className="btn sm danger" disabled={busy} onClick={cancel}>Cancel plan</button></>
          : <button className="btn sm" disabled={busy} onClick={() => setStatus('active', 'Plan reopened.')}>Reopen plan</button>}
      </div>
    </article>
  );
}

export default function PulsePath({ openStudent }) {
  const [status, setStatus] = useState('active');
  const { data, loading, error, reload } = useApi('/plans' + (status ? `?status=${status}` : ''));
  if (error) return <ErrorBox error={error} onRetry={reload} />;
  if (!data) return <Loading rows={1} />;
  const TABS = [['active', 'Active'], ['completed', 'Completed'], ['cancelled', 'Cancelled'], ['', 'All']];
  return (
    <div style={{ opacity: loading ? 0.65 : 1, transition: 'opacity .2s' }}>
      <PageHead title="PulsePath support plans">Track actions and follow-ups. To start a new plan, open a student’s profile.</PageHead>
      <div className="chips" role="group" aria-label="Plan status" style={{ marginBottom: 18 }}>
        {TABS.map(([v, label]) => <button key={label} className="chip" aria-pressed={status === v} onClick={() => setStatus(v)}>{label}</button>)}
      </div>
      {data.plans.length === 0 ? <div className="panel"><Empty title="No plans here" icon="plan">Open a flagged student’s profile and choose “Create support plan”.</Empty></div> : data.plans.map((p) => <PlanCard key={p.id} plan={p} onChange={reload} openStudent={openStudent} />)}
    </div>
  );
}
