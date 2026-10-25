import { useState } from 'react';
import { api, useApi } from '../api.js';
import { ErrorBox, Loading, Empty, Kpi, PageHead, useToast } from './ui.jsx';
import { Icon } from './icons.jsx';

const blankQuestion = () => ({ prompt: '', type: 'choice', optionsText: 'Option A, Option B', correctAnswer: 'Option A' });

function GradeSubmission({ submission, assessment, onSaved }) {
  const [score, setScore] = useState(String(submission.score ?? submission.autoScore ?? ''));
  const [feedback, setFeedback] = useState(submission.feedback || '');
  const [release, setRelease] = useState(!!submission.released);
  const [busy, setBusy] = useState(false);
  const toast = useToast();
  const save = async () => {
    setBusy(true);
    try {
      await api(`/submissions/${submission.id}/grade`, { method: 'PATCH', body: { score: Number(score), feedback, release } });
      toast(release ? 'Mark saved and released to the student.' : 'Mark saved. The student cannot see it yet.');
      onSaved();
    } catch (e) { toast(e.message, 'err'); } finally { setBusy(false); }
  };
  return <div className="submission-card">
    <div className="submission-title"><strong>{submission.studentName}</strong><span className="note">Submitted {new Date(submission.submittedAt).toLocaleString()}</span></div>
    {assessment.questions.map((q) => {
      const answer = submission.answers?.find((x) => x.questionId === q.id)?.answer || '—';
      const match = answer.toLowerCase() === String(q.correctAnswer || '').toLowerCase();
      return <div className="answer-row" key={q.id}><b>{q.prompt}</b><p>{answer}</p>{q.type === 'choice' && <small className={match ? 'answer-correct' : 'answer-review'}>{match ? 'Matches answer key' : `Answer key: ${q.correctAnswer}`}</small>}</div>;
    })}
    <div className="row grade-row">
      <div style={{ flex: '0 1 160px' }}><label>Score (out of {assessment.maxScore})</label><input type="number" min="0" max={assessment.maxScore} step="0.1" value={score} onChange={(e) => setScore(e.target.value)} /></div>
      <div style={{ flex: '3 1 260px' }}><label>Feedback for the student</label><input value={feedback} maxLength="1000" onChange={(e) => setFeedback(e.target.value)} placeholder="A helpful next step…" /></div>
      <div className="release-field auto"><label><input type="checkbox" checked={release} onChange={(e) => setRelease(e.target.checked)} /> Release mark</label></div>
      <button className="btn primary auto" disabled={busy || score === '' || Number(score) < 0 || Number(score) > assessment.maxScore} onClick={save}>{busy ? 'Saving…' : 'Save mark'}</button>
    </div>
  </div>;
}

export default function Assessments() {
  const { data, loading, error, reload } = useApi('/assessments');
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [type, setType] = useState('assignment');
  const [classTarget, setClassTarget] = useState('all');
  const [dueDate, setDueDate] = useState('');
  const [maxScore, setMaxScore] = useState('100');
  const [questions, setQuestions] = useState([blankQuestion()]);
  const [busy, setBusy] = useState(false);
  const [open, setOpen] = useState(false);
  const toast = useToast();
  const classes = [...new Set((data?.assessments || []).map((a) => a.classTarget).filter((c) => c !== 'all'))];
  const addQuestion = () => setQuestions((qs) => qs.length < 20 ? [...qs, blankQuestion()] : qs);
  const updateQuestion = (index, patch) => setQuestions((qs) => qs.map((q, i) => i === index ? { ...q, ...patch } : q));
  const create = async (e) => {
    e.preventDefault(); setBusy(true);
    try {
      await api('/assessments', { method: 'POST', body: { title, description, type, classTarget, dueDate, maxScore: Number(maxScore), questions: questions.map((q) => ({ prompt: q.prompt, type: q.type, options: q.type === 'choice' ? q.optionsText.split(',').map((o) => o.trim()).filter(Boolean) : [], correctAnswer: q.type === 'choice' ? q.correctAnswer : undefined })) } });
      setTitle(''); setDescription(''); setQuestions([blankQuestion()]); setOpen(false); toast('Assessment published for the selected class.'); reload();
    } catch (e2) { toast(e2.message, 'err'); } finally { setBusy(false); }
  };
  if (loading && !data) return <Loading />;
  if (error && !data) return <ErrorBox error={error} onRetry={reload} />;
  const list = data?.assessments || [];
  const released = list.reduce((n, a) => n + (a.analytics?.released || 0), 0);
  const avg = released ? list.reduce((x, y) => x + (y.analytics?.averageScore || 0) * (y.analytics?.released || 0), 0) / released : null;
  return <>
    <PageHead title="Assignments & tests" actions={<><button className="btn" onClick={reload}><Icon name="refresh" />Refresh</button><button className="btn primary" onClick={() => setOpen((o) => !o)}><Icon name={open ? 'x' : 'plus'} />{open ? 'Close form' : 'New assessment'}</button></>}>
      Create assessments, review submissions, release marks, and track class performance.
    </PageHead>
    <div className="kpis">
      <Kpi label="Assessments" value={list.length} />
      <Kpi label="Submissions" value={list.reduce((n, a) => n + (a.analytics?.submitted || 0), 0)} />
      <Kpi label="Marks released" value={released} tone="good" />
      <Kpi label="Released-score average" value={avg == null ? null : avg} decimals={1} suffix="%" />
    </div>

    {open && <section className="panel"><div className="panel-head"><div><h2>Create an assignment or test</h2><p>Multiple-choice answers are checked against your key for review. You set the final score and decide when students see it.</p></div></div>
      <form onSubmit={create}>
        <div className="row field">
          <div style={{ flex: '3 1 260px' }}><label>Title</label><input required minLength="3" maxLength="120" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. Fractions practice" /></div>
          <div><label>Type</label><select value={type} onChange={(e) => setType(e.target.value)}><option value="assignment">Assignment</option><option value="test">Test</option></select></div>
          <div><label>Class</label><select value={classTarget} onChange={(e) => setClassTarget(e.target.value)}><option value="all">All classes</option>{(data?.classes || classes).map((c) => <option key={c} value={c}>{c}</option>)}</select></div>
        </div>
        <div className="row field">
          <div><label>Due date</label><input type="date" required value={dueDate} onChange={(e) => setDueDate(e.target.value)} /></div>
          <div><label>Maximum score</label><input type="number" min="1" max="1000" required value={maxScore} onChange={(e) => setMaxScore(e.target.value)} /></div>
        </div>
        <div className="field"><label>Instructions (optional)</label><textarea rows="2" maxLength="1000" value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Instructions or learning objectives" /></div>
        <h3 style={{ margin: '18px 0 10px' }}>Questions</h3>
        {questions.map((q, i) => <div className="question-editor" key={i}>
          <div className="row"><div style={{ flex: '3 1 260px' }}><label>Question {i + 1}</label><input required minLength="3" maxLength="500" value={q.prompt} onChange={(e) => updateQuestion(i, { prompt: e.target.value })} placeholder="Enter the question" /></div><div><label>Response type</label><select value={q.type} onChange={(e) => updateQuestion(i, { type: e.target.value })}><option value="choice">Multiple choice</option><option value="text">Written response</option></select></div></div>
          {q.type === 'choice' && <div className="row"><div style={{ flex: '2 1 260px' }}><label>Options (separate with commas)</label><input value={q.optionsText} onChange={(e) => updateQuestion(i, { optionsText: e.target.value })} required placeholder="Option A, Option B, Option C" /></div><div><label>Correct answer (must match an option)</label><input value={q.correctAnswer} onChange={(e) => updateQuestion(i, { correctAnswer: e.target.value })} required /></div></div>}
          {questions.length > 1 && <button className="btn sm ghost" type="button" onClick={() => setQuestions((qs) => qs.filter((_, j) => i !== j))}>Remove question</button>}
        </div>)}
        <div className="plan-actions"><button className="btn" type="button" disabled={questions.length >= 20} onClick={addQuestion}><Icon name="plus" />Add question</button><button className="btn primary" disabled={busy}>{busy ? 'Publishing…' : 'Publish assessment'}</button></div>
      </form>
    </section>}

    <h2 className="section-title">Published assessments</h2>
    {!list.length ? <div className="panel"><Empty title="No assessments yet" icon="assess" action={<button className="btn primary" onClick={() => setOpen(true)}><Icon name="plus" />New assessment</button>}>Create an assignment or test to get started.</Empty></div> : list.map((a) => <article className="panel" key={a.id}>
      <div className="assessment-header">
        <div><span className="badge active">{a.type}</span> <span className="note">{a.classTarget === 'all' ? 'All classes' : a.classTarget} · Due {a.dueDate}</span><h2>{a.title}</h2><p>{a.description || 'No additional instructions.'}</p></div>
        <div className="stat-pair"><div><b>{a.analytics?.submitted || 0}</b><span>submissions</span></div><div><b>{a.analytics?.averageScore == null ? '—' : `${a.analytics.averageScore}%`}</b><span>average released mark</span></div></div>
      </div>
      <div className="facts"><span>Marks released: <b>{a.analytics?.released || 0}</b></span><span>Questions: <b>{a.questions.length}</b></span><span>Max score: <b>{a.maxScore}</b></span><span>Submission rate: <b>{a.analytics?.submissionRate == null ? '—' : `${a.analytics.submissionRate}%`}</b></span></div>
      {a.submissions?.length ? <div><h3>Review submissions</h3>{a.submissions.map((sub) => <GradeSubmission key={sub.id} submission={sub} assessment={a} onSaved={reload} />)}</div> : <p className="note">No student submissions yet.</p>}
    </article>)}
  </>;
}
