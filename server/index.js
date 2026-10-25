require('dotenv').config();
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { createStore } = require('./store');
const { seedUsers, seedSettings, seedDemoData, seedStudentUser } = require('./seed');
const { DEFAULTS, evaluate, planBaseline, impact, latestWeek, r1, avg } = require('./alerts');
const { validateImport, key } = require('./csv');

const PROD = process.env.NODE_ENV === 'production';
const PORT = process.env.PORT || 5000;
if (PROD && (!process.env.JWT_SECRET || process.env.JWT_SECRET.length < 16 || !process.env.DEMO_PASSWORD)) {
  console.error('In production, set JWT_SECRET (16+ characters) and DEMO_PASSWORD. See .env.example.');
  process.exit(1);
}
const JWT_SECRET = process.env.JWT_SECRET || crypto.randomBytes(32).toString('hex');
if (!process.env.JWT_SECRET) console.warn('JWT_SECRET is not set: using a temporary secret (everyone is logged out when the server restarts).');

const app = express();
app.set('trust proxy', 1);
app.use(helmet());
if (process.env.CLIENT_ORIGIN) app.use(cors({ origin: process.env.CLIENT_ORIGIN.split(',').map((s) => s.trim()) }));
app.use(express.json({ limit: '2mb' }));

let store;
const h = (fn) => (req, res, next) => fn(req, res, next).catch(next);
const bad = (res, msg, code = 400) => res.status(code).json({ error: msg });
const num = (v) => typeof v === 'number' && Number.isFinite(v);

// ---------- auth ----------
const attempts = new Map();
function loginLimiter(req, res, next) {
  const now = Date.now();
  const rec = (attempts.get(req.ip) || []).filter((t) => now - t < 15 * 60 * 1000);
  if (rec.length >= 10) return bad(res, 'Too many login attempts. Try again in 15 minutes.', 429);
  rec.push(now); attempts.set(req.ip, rec); next();
}
function auth(req, res, next) {
  const m = /^Bearer (.+)$/.exec(req.headers.authorization || '');
  if (!m) return bad(res, 'Please sign in.', 401);
  try { req.user = jwt.verify(m[1], JWT_SECRET); next(); } catch { bad(res, 'Your session expired. Please sign in again.', 401); }
}
const adminOnly = (req, res, next) => (req.user.role === 'admin' ? next() : bad(res, 'Only administrators can do this.', 403));
const teacherOnly = (req, res, next) => (['admin', 'teacher'].includes(req.user.role) ? next() : bad(res, 'Teacher access is required.', 403));
const studentOnly = (req, res, next) => (req.user.role === 'student' && req.user.studentId ? next() : bad(res, 'Student access is required.', 403));

app.get('/api/health', h(async (req, res) => res.json({ ok: true, storage: store.mode })));

app.post('/api/auth/login', loginLimiter, h(async (req, res) => {
  const email = String(req.body?.email || '').trim().toLowerCase();
  const password = String(req.body?.password || '');
  const user = (await store.list('users')).find((u) => u.email === email);
  if (!user || !(await bcrypt.compare(password, user.passwordHash))) return bad(res, 'Incorrect email or password.', 401);
  const payload = { id: user.id, name: user.name, role: user.role, email: user.email, ...(user.studentId ? { studentId: user.studentId } : {}) };
  res.json({ token: jwt.sign(payload, JWT_SECRET, { expiresIn: '8h' }), user: payload });
}));
app.get('/api/auth/me', auth, (req, res) => res.json({ user: { id: req.user.id, name: req.user.name, role: req.user.role, email: req.user.email, ...(req.user.studentId ? { studentId: req.user.studentId } : {}) } }));

// ---------- helpers ----------
const getTh = async () => ({ ...DEFAULTS, ...(await store.get('settings', 'thresholds')) });
const brief = (s, e) => ({
  id: s.id, name: s.name, class: s.class, riskLevel: e.riskLevel, riskScore: e.riskScore, alertCount: e.alerts.length,
  topAlert: e.alerts[0]?.explanation || null, recentAttendance: e.metrics.recentAttendance, recentScore: e.metrics.recentScore,
  spark: [...s.records].sort((a, b) => a.week - b.week).slice(-8).map((r) => r.attendance),
});

// ---------- dashboard & students ----------
app.get('/api/dashboard', auth, teacherOnly, h(async (req, res) => {
  const th = await getTh();
  const all = await store.list('students');
  const classes = [...new Set(all.map((s) => s.class))].sort();
  const students = req.query.class ? all.filter((s) => s.class === req.query.class) : all;
  const ev = students.map((s) => ({ s, e: evaluate(s, th) }));
  const counts = { High: 0, Medium: 0, Low: 0 };
  ev.forEach(({ e }) => counts[e.riskLevel]++);
  const weeks = [...new Set(students.flatMap((s) => s.records.map((r) => r.week)))].sort((a, b) => a - b);
  const trend = weeks.map((w) => {
    const rs = students.flatMap((s) => s.records.filter((r) => r.week === w));
    return { week: w, attendance: r1(avg(rs.map((r) => r.attendance))), score: r1(avg(rs.filter((r) => r.score != null).map((r) => r.score))) };
  });
  const ids = new Set(students.map((s) => s.id));
  const plans = (await store.list('plans')).filter((p) => ids.has(p.studentId));
  res.json({
    thresholds: th, classes, total: students.length, counts, trend,
    // Weekly attendance for every student (riskiest first) – drives the "pulse grid" heatmap.
    heat: {
      weeks,
      rows: ev.slice().sort((a, b) => b.e.riskScore - a.e.riskScore || a.s.name.localeCompare(b.s.name)).slice(0, 60).map(({ s, e }) => ({
        id: s.id, name: s.name, class: s.class, riskLevel: e.riskLevel,
        values: weeks.map((w) => s.records.find((r) => r.week === w)?.attendance ?? null),
      })),
    },
    avgAttendance: r1(avg(ev.map(({ e }) => e.metrics.recentAttendance).filter((x) => x != null))),
    avgScore: r1(avg(ev.map(({ e }) => e.metrics.recentScore).filter((x) => x != null))),
    activePlans: plans.filter((p) => p.status === 'active').length,
    attention: ev.filter(({ e }) => e.riskLevel !== 'Low').sort((a, b) => b.e.riskScore - a.e.riskScore).slice(0, 8).map(({ s, e }) => brief(s, e)),
  });
}));

app.get('/api/students', auth, teacherOnly, h(async (req, res) => {
  const th = await getTh();
  const q = String(req.query.q || '').toLowerCase();
  const list = (await store.list('students'))
    .filter((s) => (!req.query.class || s.class === req.query.class) && (!q || s.name.toLowerCase().includes(q)))
    .map((s) => brief(s, evaluate(s, th)))
    .filter((b) => !req.query.risk || b.riskLevel === req.query.risk)
    .sort((a, b) => b.riskScore - a.riskScore || a.name.localeCompare(b.name));
  const classes = [...new Set((await store.list('students')).map((s) => s.class))].sort();
  res.json({ students: list, classes });
}));

app.get('/api/students/:id', auth, teacherOnly, h(async (req, res) => {
  const s = await store.get('students', req.params.id);
  if (!s) return bad(res, 'Student not found.', 404);
  const th = await getTh();
  const plans = (await store.list('plans')).filter((p) => p.studentId === s.id).sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  res.json({ student: { id: s.id, name: s.name, class: s.class, synthetic: !!s.synthetic, records: [...s.records].sort((a, b) => a.week - b.week) }, evaluation: evaluate(s, th), thresholds: th, plans: plans.map((p) => ({ ...p, impact: impact(p, s) })) });
}));

// ---------- assignments, tests, submissions, and learning analytics ----------
const cleanAssessment = (a) => ({
  id: a.id, title: a.title, description: a.description, type: a.type, classTarget: a.classTarget,
  dueDate: a.dueDate, maxScore: a.maxScore, questions: a.questions, published: a.published,
  createdAt: a.createdAt, createdBy: a.createdBy,
});

app.get('/api/assessments', auth, h(async (req, res) => {
  const all = await store.list('assessments');
  if (req.user.role === 'student') {
    const student = await store.get('students', req.user.studentId);
    if (!student) return bad(res, 'Student profile not found.', 404);
    const visible = all.filter((a) => a.published && (a.classTarget === 'all' || a.classTarget === student.class));
    const submissions = (await store.list('submissions')).filter((s) => s.studentId === student.id);
    return res.json({ assessments: visible.sort((a, b) => a.dueDate.localeCompare(b.dueDate)).map((a) => {
      const sub = submissions.find((s) => s.assessmentId === a.id);
      return { ...cleanAssessment(a), questions: a.questions.map(({ id, prompt, type, options }) => ({ id, prompt, type, options })), submission: sub ? { id: sub.id, status: sub.status, submittedAt: sub.submittedAt, released: !!sub.released, score: sub.released ? sub.score : null, feedback: sub.released ? sub.feedback : '' } : null };
    }) });
  }
  const allStudents = await store.list('students');
  const classes = [...new Set(allStudents.map((s) => s.class))].sort();
  const students = new Map(allStudents.map((s) => [s.id, s]));
  const submissions = await store.list('submissions');
  res.json({ classes, assessments: all.sort((a, b) => b.createdAt.localeCompare(a.createdAt)).map((a) => {
    const related = submissions.filter((s) => s.assessmentId === a.id);
    const released = related.filter((s) => s.released && Number.isFinite(s.score));
    return { ...cleanAssessment(a), submissions: related.map((s) => ({ ...s, studentName: students.get(s.studentId)?.name || 'Unknown student', studentClass: students.get(s.studentId)?.class || '' })), analytics: { submitted: related.length, graded: related.filter((s) => s.status === 'graded').length, released: released.length, averageScore: released.length ? Math.round(released.reduce((sum, s) => sum + s.score / a.maxScore * 100, 0) / released.length * 10) / 10 : null, submissionRate: (() => { const count = [...students.values()].filter((s) => a.classTarget === 'all' || s.class === a.classTarget).length; return count ? Math.round(related.length / count * 100) : null; })() } };
  }) });
}));

app.post('/api/assessments', auth, teacherOnly, h(async (req, res) => {
  const b = req.body || {};
  const title = String(b.title || '').trim();
  const description = String(b.description || '').trim();
  const type = b.type === 'test' ? 'test' : b.type === 'assignment' ? 'assignment' : null;
  const classTarget = String(b.classTarget || 'all');
  const due = new Date(`${String(b.dueDate || '')}T23:59:59.999Z`);
  const maxScore = Number(b.maxScore);
  if (title.length < 3 || title.length > 120) return bad(res, 'Title must be 3–120 characters.');
  if (!type) return bad(res, 'Choose assignment or test.');
  if (description.length > 1000) return bad(res, 'Description must be 1,000 characters or fewer.');
  if (!b.dueDate || Number.isNaN(due.getTime())) return bad(res, 'Choose a valid due date.');
  if (!Number.isInteger(maxScore) || maxScore < 1 || maxScore > 1000) return bad(res, 'Maximum score must be a whole number from 1 to 1,000.');
  const classes = [...new Set((await store.list('students')).map((s) => s.class))];
  if (classTarget !== 'all' && !classes.includes(classTarget)) return bad(res, 'Choose a class that exists in the student records.');
  if (!Array.isArray(b.questions) || b.questions.length < 1 || b.questions.length > 20) return bad(res, 'Add between 1 and 20 questions.');
  const questions = [];
  for (const q of b.questions) {
    const prompt = String(q?.prompt || '').trim();
    const qtype = q?.type === 'choice' ? 'choice' : q?.type === 'text' ? 'text' : null;
    if (prompt.length < 3 || prompt.length > 500 || !qtype) return bad(res, 'Each question needs a prompt (3–500 characters) and a valid type.');
    if (qtype === 'choice') {
      const options = Array.isArray(q.options) ? q.options.map((o) => String(o).trim()).filter(Boolean) : [];
      const answer = String(q.correctAnswer || '').trim();
      if (options.length < 2 || options.length > 6 || options.some((o) => o.length > 200) || !options.includes(answer)) return bad(res, 'Multiple-choice questions need 2–6 options and a correct answer matching one option.');
      questions.push({ id: crypto.randomUUID(), prompt, type: qtype, options, correctAnswer: answer });
    } else questions.push({ id: crypto.randomUUID(), prompt, type: qtype, options: [] });
  }
  const assessment = { id: crypto.randomUUID(), title, description, type, classTarget, dueDate: String(b.dueDate), maxScore, questions, published: b.published !== false, createdAt: new Date().toISOString(), createdBy: req.user.name };
  await store.insert('assessments', assessment);
  res.status(201).json({ assessment: cleanAssessment(assessment) });
}));

app.patch('/api/assessments/:id', auth, teacherOnly, h(async (req, res) => {
  const a = await store.get('assessments', req.params.id);
  if (!a) return bad(res, 'Assessment not found.', 404);
  if (req.body?.published !== undefined && typeof req.body.published !== 'boolean') return bad(res, 'Published must be true or false.');
  const submissions = (await store.list('submissions')).filter((s) => s.assessmentId === a.id);
  if (submissions.length && req.body?.published === false) return bad(res, 'An assessment with student submissions cannot be unpublished.');
  const updated = await store.update('assessments', a.id, { published: req.body?.published ?? a.published });
  res.json({ assessment: cleanAssessment(updated) });
}));

app.post('/api/assessments/:id/submit', auth, studentOnly, h(async (req, res) => {
  const a = await store.get('assessments', req.params.id);
  if (!a || !a.published) return bad(res, 'Assessment not found.', 404);
  const student = await store.get('students', req.user.studentId);
  if (!student || (a.classTarget !== 'all' && a.classTarget !== student.class)) return bad(res, 'This assessment is not assigned to your class.', 403);
  const existing = (await store.list('submissions')).find((s) => s.assessmentId === a.id && s.studentId === student.id);
  if (existing) return bad(res, 'You have already submitted this assessment.', 409);
  if (!Array.isArray(req.body?.answers)) return bad(res, 'Submit answers for the assessment questions.');
  const answerMap = new Map(req.body.answers.map((x) => [String(x.questionId), String(x.answer ?? '').trim()]));
  if (a.questions.some((q) => !answerMap.has(q.id) || !answerMap.get(q.id))) return bad(res, 'Answer every question before submitting.');
  if (a.questions.some((q) => answerMap.get(q.id).length > 5000)) return bad(res, 'Each answer must be 5,000 characters or fewer.');
  const answers = a.questions.map((q) => ({ questionId: q.id, answer: answerMap.get(q.id) }));
  const choiceQuestions = a.questions.filter((q) => q.type === 'choice');
  const earned = choiceQuestions.reduce((n, q) => n + (answerMap.get(q.id).toLowerCase() === q.correctAnswer.toLowerCase() ? 1 : 0), 0);
  const autoScore = choiceQuestions.length && choiceQuestions.length === a.questions.length ? Math.round(earned / choiceQuestions.length * a.maxScore * 10) / 10 : null;
  const submission = { id: crypto.randomUUID(), assessmentId: a.id, studentId: student.id, answers, autoScore, score: null, feedback: '', status: 'submitted', released: false, submittedAt: new Date().toISOString(), gradedAt: null, gradedBy: null };
  await store.insert('submissions', submission);
  res.status(201).json({ submission: { id: submission.id, status: submission.status, submittedAt: submission.submittedAt, released: false } });
}));

app.patch('/api/submissions/:id/grade', auth, teacherOnly, h(async (req, res) => {
  const sub = await store.get('submissions', req.params.id);
  if (!sub) return bad(res, 'Submission not found.', 404);
  const a = await store.get('assessments', sub.assessmentId);
  if (!a) return bad(res, 'Assessment not found.', 404);
  const score = Number(req.body?.score);
  const feedback = String(req.body?.feedback || '').trim();
  const release = req.body?.release === true;
  if (!Number.isFinite(score) || score < 0 || score > a.maxScore) return bad(res, `Score must be between 0 and ${a.maxScore}.`);
  if (feedback.length > 1000) return bad(res, 'Feedback must be 1,000 characters or fewer.');
  const updated = await store.update('submissions', sub.id, { score: Math.round(score * 10) / 10, feedback, status: 'graded', released: release, gradedAt: new Date().toISOString(), gradedBy: req.user.name });
  res.json({ submission: updated });
}));

app.get('/api/student/dashboard', auth, studentOnly, h(async (req, res) => {
  const student = await store.get('students', req.user.studentId);
  if (!student) return bad(res, 'Student profile not found.', 404);
  const assessments = (await store.list('assessments')).filter((a) => a.published && (a.classTarget === 'all' || a.classTarget === student.class));
  const submissions = (await store.list('submissions')).filter((s) => s.studentId === student.id);
  const released = submissions.filter((s) => s.released && Number.isFinite(s.score));
  const assessmentList = assessments.map((a) => {
    const sub = submissions.find((s) => s.assessmentId === a.id);
    return { ...cleanAssessment(a), questions: a.questions.map(({ id, prompt, type, options }) => ({ id, prompt, type, options })), submission: sub ? { id: sub.id, status: sub.status, submittedAt: sub.submittedAt, released: !!sub.released, score: sub.released ? sub.score : null, feedback: sub.released ? sub.feedback : '' } : null };
  });
  const th = await getTh();
  const recordScores = (student.records || []).filter((r) => r.score != null).map((r) => ({ label: `Week ${r.week}`, score: r.score, attendance: r.attendance }));
  const releasedScores = released.map((s) => ({ label: assessments.find((a) => a.id === s.assessmentId)?.title || 'Assessment', score: s.score, maxScore: (assessments.find((a) => a.id === s.assessmentId)?.maxScore || 100) }));
  res.json({ student: { id: student.id, name: student.name, class: student.class }, evaluation: (() => { const e = evaluate(student, th); return { ...e, summary: e.alerts.length ? e.alerts.map((a) => a.explanation).join(' ') : 'Your recent attendance and scores are within the current support thresholds. Keep up your steady effort.' }; })(), assessments: assessmentList, analytics: { assigned: assessments.length, submitted: submissions.length, pending: assessmentList.filter((a) => !a.submission).length, releasedCount: released.length, averageScore: released.length ? Math.round(released.reduce((sum, s) => sum + s.score / (assessments.find((a) => a.id === s.assessmentId)?.maxScore || 100) * 100, 0) / released.length * 10) / 10 : null, scores: recordScores, releasedScores } });
}));

app.get('/api/teacher/analytics', auth, teacherOnly, h(async (req, res) => {
  const assessments = await store.list('assessments');
  const submissions = await store.list('submissions');
  const students = await store.list('students');
  const released = submissions.filter((s) => s.released && Number.isFinite(s.score));
  const scoresByAssessment = assessments.map((a) => {
    const subs = released.filter((s) => s.assessmentId === a.id);
    return { title: a.title, type: a.type, averageScore: subs.length ? Math.round(subs.reduce((n, s) => n + s.score / a.maxScore * 100, 0) / subs.length * 10) / 10 : null, released: subs.length, maxScore: a.maxScore };
  });
  res.json({ summary: { assessments: assessments.length, submissions: submissions.length, released: released.length, students: students.length, averageScore: released.length ? Math.round(released.reduce((n, s) => { const a = assessments.find((x) => x.id === s.assessmentId); return n + (a ? s.score / a.maxScore * 100 : 0); }, 0) / released.length * 10) / 10 : null }, scoresByAssessment });
}));

// ---------- thresholds ----------
app.get('/api/settings', auth, teacherOnly, h(async (req, res) => res.json({ thresholds: await getTh(), defaults: DEFAULTS })));
const THRESHOLD_RULES = { attendanceMin: [0, 100], attendanceDrop: [1, 50], scoreMin: [0, 100], scoreDrop: [1, 50] };
function parseThresholds(b) {
  const next = {};
  for (const [k, [lo, hi]] of Object.entries(THRESHOLD_RULES)) {
    if (!num(b?.[k]) || b[k] < lo || b[k] > hi) return { error: `${k} must be a number between ${lo} and ${hi}.` };
    next[k] = b[k];
  }
  return { next };
}
app.put('/api/settings', auth, adminOnly, h(async (req, res) => {
  const { next, error } = parseThresholds(req.body);
  if (error) return bad(res, error);
  await store.update('settings', 'thresholds', next);
  res.json({ thresholds: { ...DEFAULTS, ...next } });
}));
// "What-if" preview: evaluates every student with candidate thresholds WITHOUT saving them.
app.post('/api/settings/preview', auth, teacherOnly, h(async (req, res) => {
  const { next, error } = parseThresholds(req.body);
  if (error) return bad(res, error);
  const current = await getTh();
  const students = await store.list('students');
  const counts = { High: 0, Medium: 0, Low: 0 };
  const currentCounts = { High: 0, Medium: 0, Low: 0 };
  const changes = [];
  for (const s of students) {
    const before = evaluate(s, current), after = evaluate(s, next);
    counts[after.riskLevel]++; currentCounts[before.riskLevel]++;
    if (before.riskLevel !== after.riskLevel) changes.push({ id: s.id, name: s.name, class: s.class, from: before.riskLevel, to: after.riskLevel });
  }
  res.json({ total: students.length, counts, currentCounts, changes: changes.slice(0, 12), changedCount: changes.length });
}));

// ---------- PulsePath plans ----------
app.get('/api/plans', auth, teacherOnly, h(async (req, res) => {
  const students = new Map((await store.list('students')).map((s) => [s.id, s]));
  const plans = (await store.list('plans'))
    .filter((p) => students.has(p.studentId) && (!req.query.status || p.status === req.query.status))
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
    .map((p) => ({ ...p, studentName: students.get(p.studentId).name, studentClass: students.get(p.studentId).class }));
  res.json({ plans });
}));

app.post('/api/plans', auth, teacherOnly, h(async (req, res) => {
  const { studentId, title, actions, dueDate } = req.body || {};
  const s = await store.get('students', String(studentId || ''));
  if (!s) return bad(res, 'Student not found.', 404);
  const t = String(title || '').trim();
  if (t.length < 3 || t.length > 120) return bad(res, 'Title must be 3-120 characters.');
  const acts = (Array.isArray(actions) ? actions : []).map((a) => String(a).trim()).filter(Boolean);
  if (acts.length < 1 || acts.length > 8) return bad(res, 'Add between 1 and 8 actions.');
  if (acts.some((a) => a.length > 200)) return bad(res, 'Each action must be 200 characters or fewer.');
  const due = new Date(dueDate);
  if (!dueDate || isNaN(due)) return bad(res, 'Choose a valid due date.');
  const startWeek = latestWeek(s);
  const plan = {
    id: crypto.randomUUID(), studentId: s.id, title: t, actions: acts.map((text) => ({ text, done: false })),
    dueDate: due.toISOString().slice(0, 10), status: 'active', startWeek, baseline: planBaseline(s, startWeek),
    followUps: [], createdBy: req.user.name, createdAt: new Date().toISOString(),
  };
  await store.insert('plans', plan);
  res.status(201).json({ plan });
}));

app.patch('/api/plans/:id', auth, teacherOnly, h(async (req, res) => {
  const p = await store.get('plans', req.params.id);
  if (!p) return bad(res, 'Plan not found.', 404);
  const patch = {};
  const { status, toggleAction } = req.body || {};
  if (status !== undefined) {
    if (!['active', 'completed', 'cancelled'].includes(status)) return bad(res, 'Invalid status.');
    patch.status = status;
  }
  if (toggleAction !== undefined) {
    if (!Number.isInteger(toggleAction) || !p.actions[toggleAction]) return bad(res, 'Action not found.');
    patch.actions = p.actions.map((a, i) => (i === toggleAction ? { ...a, done: !a.done } : a));
  }
  if (!Object.keys(patch).length) return bad(res, 'Nothing to update.');
  res.json({ plan: await store.update('plans', p.id, patch) });
}));

app.post('/api/plans/:id/followups', auth, teacherOnly, h(async (req, res) => {
  const p = await store.get('plans', req.params.id);
  if (!p) return bad(res, 'Plan not found.', 404);
  const note = String(req.body?.note || '').trim();
  const outcome = req.body?.outcome;
  if (note.length < 3 || note.length > 500) return bad(res, 'Follow-up note must be 3-500 characters.');
  if (!['improving', 'no_change', 'worsening'].includes(outcome)) return bad(res, 'Choose an outcome.');
  const fu = { date: new Date().toISOString().slice(0, 10), note, outcome, by: req.user.name };
  res.status(201).json({ plan: await store.update('plans', p.id, { followUps: [...p.followUps, fu] }) });
}));

// ---------- Support Impact Tracker ----------
app.get('/api/impact', auth, teacherOnly, h(async (req, res) => {
  const students = new Map((await store.list('students')).map((s) => [s.id, s]));
  const items = (await store.list('plans')).filter((p) => students.has(p.studentId)).map((p) => {
    const s = students.get(p.studentId);
    return { planId: p.id, title: p.title, status: p.status, studentId: s.id, studentName: s.name, studentClass: s.class, startWeek: p.startWeek, followUps: p.followUps.length, ...impact(p, s) };
  });
  const measured = items.filter((i) => i.weeksSince > 0);
  const count = (o) => measured.filter((i) => i.outcome === o).length;
  res.json({
    items,
    summary: {
      plans: items.length, measured: measured.length, improving: count('improving'), steady: count('steady'), declining: count('declining'),
      avgAttendanceChange: r1(avg(measured.map((i) => i.attendanceChange).filter((x) => x != null))),
      avgScoreChange: r1(avg(measured.map((i) => i.scoreChange).filter((x) => x != null))),
    },
  });
}));

// ---------- CSV import (admin) ----------
app.post('/api/import/validate', auth, adminOnly, h(async (req, res) => {
  const { report } = validateImport(req.body?.csv, await store.list('students'));
  res.json({ report });
}));

app.post('/api/import/commit', auth, adminOnly, h(async (req, res) => {
  const mode = req.body?.mode === 'replace' ? 'replace' : 'merge';
  const existing = await store.list('students');
  const { report, groups } = validateImport(req.body?.csv, existing);
  if (report.errorCount > 0) return res.status(422).json({ error: 'The file still has errors. Fix them and validate again.', report });
  const base = mode === 'replace' ? [] : existing;
  const byKey = new Map(base.map((s) => [key(s.name, s.class), s]));
  for (const [k, g] of groups) {
    const cur = byKey.get(k);
    const incoming = [...g.records.values()];
    if (cur) {
      const m = new Map(cur.records.map((r) => [r.week, r]));
      incoming.forEach((r) => m.set(r.week, r));
      cur.records = [...m.values()].sort((a, b) => a.week - b.week);
    } else {
      byKey.set(k, { id: crypto.randomUUID(), name: g.name, class: g.class, synthetic: false, records: incoming.sort((a, b) => a.week - b.week) });
    }
  }
  await store.replaceAll('students', [...byKey.values()]);
  if (mode === 'replace') await store.replaceAll('plans', []);
  res.json({ ok: true, mode, report });
}));

app.post('/api/admin/reseed', auth, adminOnly, h(async (req, res) => { const result = await seedDemoData(store); await seedStudentUser(store); res.json({ ok: true, ...result }); }));

// ---------- serve the built frontend (production) ----------
const dist = path.join(__dirname, '..', 'client', 'dist');
if (fs.existsSync(dist)) {
  app.use(express.static(dist));
  app.get(/^\/(?!api\/).*/, (req, res) => res.sendFile(path.join(dist, 'index.html')));
}
app.use('/api', (req, res) => bad(res, 'Not found.', 404));
app.use((err, req, res, next) => { console.error(err); bad(res, 'Something went wrong on the server.', 500); });

(async () => {
  try {
    store = await createStore();
  } catch (e) {
    console.error('\nCould not connect to MongoDB:', e.message);
    console.error('Check MONGODB_URI, your Atlas user/password, and that your IP is allowed in Atlas Network Access.\n');
    process.exit(1);
  }
  await seedSettings(store);
  const createdUsers = await seedUsers(store);
  if (!(await store.list('students')).length) console.log('Seeded demo data:', await seedDemoData(store));
  const createdStudent = await seedStudentUser(store);
  if (createdStudent) console.log('Created demo student account: student@classpulse.demo');
  if (createdUsers) console.log('Created demo accounts: admin@classpulse.demo and teacher@classpulse.demo');
  app.listen(PORT, () => console.log(`ClassPulse AI API running on http://localhost:${PORT} (storage: ${store.mode})`));
})();
