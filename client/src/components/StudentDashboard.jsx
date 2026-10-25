import { useState } from 'react';
import { api, useApi } from '../api.js';
import { ErrorBox, Loading, Empty, Kpi, PageHead, useToast, RiskBadge, ChartTip } from './ui.jsx';
import { Icon } from './icons.jsx';
import { ResponsiveContainer, AreaChart, Area, XAxis, YAxis, Tooltip, CartesianGrid } from 'recharts';

export default function StudentDashboard({ user }) {
  const { data, loading, error, reload } = useApi('/student/dashboard');
  const [answers, setAnswers] = useState({});
  const [submitting, setSubmitting] = useState('');
  const toast = useToast();
  const answerFor = (assessmentId, questionId) => answers[assessmentId]?.[questionId] || '';
  const setAnswer = (assessmentId, questionId, value) => setAnswers((state) => ({ ...state, [assessmentId]: { ...(state[assessmentId] || {}), [questionId]: value } }));
  const submit = async (assessment) => {
    setSubmitting(assessment.id);
    try {
      await api(`/assessments/${assessment.id}/submit`, { method: 'POST', body: { answers: assessment.questions.map((q) => ({ questionId: q.id, answer: answerFor(assessment.id, q.id) })) } });
      toast('Your work was submitted. Your teacher will review it and release your mark.');
      reload();
    } catch (e) { toast(e.message, 'err'); } finally { setSubmitting(''); }
  };
  if (loading && !data) return <Loading />;
  if (error && !data) return <ErrorBox error={error} onRetry={reload} />;
  const metrics = data?.analytics || {};
  const lineData = [...(metrics.scores || []).map((x) => ({ label: x.label, score: x.score })), ...(metrics.releasedScores || []).map((x) => ({ label: x.label, score: Math.round(x.score / x.maxScore * 1000) / 10 }))].map((d, i) => ({ ...d, n: i + 1 }));
  return <>
    <PageHead title={`Welcome, ${(data?.student?.name || user.name).split(' ')[0]}`} actions={<button className="btn" onClick={reload}><Icon name="refresh" />Refresh</button>}>Track your work, marks, and progress in one place.</PageHead>
    <div className="kpis">
      <Kpi label="Class" value={data?.student?.class || '—'} />
      <Kpi label="Assigned" value={metrics.assigned ?? 0} />
      <Kpi label="Awaiting submission" value={metrics.pending ?? 0} tone={metrics.pending ? 'med' : ''} />
      <Kpi label="Released marks" value={metrics.releasedCount ?? 0} tone="good" />
      <Kpi label="Average on released work" value={metrics.averageScore ?? null} decimals={1} suffix="%" />
    </div>
    <section className="grid g-main" style={{ marginBottom: 20 }}>
      <div className="panel"><div className="panel-head"><div><h2>My progress</h2><p>Scores and released marks, shown as percentages.</p></div></div>
        {lineData.length ? <ResponsiveContainer width="100%" height={240}>
          <AreaChart data={lineData} margin={{ left: -12, right: 8, top: 8 }}>
            <defs><linearGradient id="sg" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" style={{ stopColor: 'var(--brand)', stopOpacity: 0.35 }} /><stop offset="100%" style={{ stopColor: 'var(--brand)', stopOpacity: 0 }} /></linearGradient></defs>
            <CartesianGrid vertical={false} /><XAxis dataKey="n" tickLine={false} axisLine={false} /><YAxis domain={[0, 100]} tickLine={false} axisLine={false} />
            <Tooltip content={<ChartTip labelPrefix="Result " />} /><Area type="monotone" dataKey="score" name="Score" stroke="var(--brand)" strokeWidth={2.5} fill="url(#sg)" dot={{ r: 3, fill: 'var(--brand)' }} connectNulls />
          </AreaChart>
        </ResponsiveContainer> : <Empty title="Your chart will appear here" icon="trend">Complete work and wait for your teacher to release marks.</Empty>}
      </div>
      <div className="panel"><h2>Academic check-in</h2>
        <div className="student-risk" style={{ marginTop: 12 }}><RiskBadge level={data?.evaluation?.riskLevel || 'Low'} /><strong>{data?.evaluation?.riskScore ?? 0}/100 support signal</strong></div>
        <p>{data?.evaluation?.summary || 'Keep practising consistently and ask your teacher when you need help.'}</p>
        <p className="note">This is a prompt for your teacher to support you, based on attendance and past scores. It is not a judgement of your ability.</p>
      </div>
    </section>
    <h2 className="section-title" style={{ marginTop: 8 }}>Assignments & tests</h2>
    {!data?.assessments?.length ? <div className="panel"><Empty title="Nothing assigned yet" icon="assess">Work your teacher publishes will appear here.</Empty></div> : data.assessments.map((a) => <article className="panel student-assessment" key={a.id}>
      <div className="assessment-header"><div><span className="badge active">{a.type}</span> <span className="note">Due {a.dueDate}</span><h2>{a.title}</h2><p>{a.description || 'No additional instructions.'}</p></div><div className="stat-pair"><div><b>{a.maxScore}</b><span>points</span></div><div><b>{a.questions.length}</b><span>question{a.questions.length === 1 ? '' : 's'}</span></div></div></div>
      {a.submission ? <div className="submission-status" style={{ marginTop: 14 }}><strong>{a.submission.released ? `Mark released: ${a.submission.score}/${a.maxScore}` : 'Submitted. Mark pending'}</strong><p>{a.submission.released ? (a.submission.feedback || 'Your teacher has released your mark.') : 'Your teacher has your work. The mark and feedback will appear here once released.'}</p><span className="note">Submitted {new Date(a.submission.submittedAt).toLocaleString()}</span></div> : <form onSubmit={(e) => { e.preventDefault(); submit(a); }}>
        {a.questions.map((q, i) => <div className="student-question" key={q.id}><label htmlFor={`${a.id}-${q.id}`}>{i + 1}. {q.prompt}</label>{q.type === 'choice' ? <div className="choice-list">{q.options.map((option) => <label className="choice-option" key={option}><input type="radio" name={`${a.id}-${q.id}`} checked={answerFor(a.id, q.id) === option} onChange={() => setAnswer(a.id, q.id, option)} />{option}</label>)}</div> : <textarea id={`${a.id}-${q.id}`} rows="3" required value={answerFor(a.id, q.id)} onChange={(e) => setAnswer(a.id, q.id, e.target.value)} placeholder="Write your answer here" />}</div>)}
        <button className="btn primary" disabled={submitting === a.id || a.questions.some((q) => !answerFor(a.id, q.id).trim())}>{submitting === a.id ? 'Submitting…' : 'Submit assessment'}</button>
        <span className="note" style={{ marginLeft: 12 }}>You can submit once, so check your answers first.</span>
      </form>}
    </article>)}
  </>;
}
