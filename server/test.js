// Integration test: starts the API on a temporary database and exercises the core workflow.
// Run with: npm test --prefix server
const { spawn } = require('child_process');
const path = require('path');
const os = require('os');
const assert = require('assert');

const PORT = 5055, BASE = `http://localhost:${PORT}/api`;
const env = { ...process.env, PORT, DB_FILE: path.join(os.tmpdir(), `classpulse-test-${Date.now()}.json`), MONGODB_URI: '', JWT_SECRET: 'test-secret-test-secret', DEMO_PASSWORD: 'TestPass#123', NODE_ENV: 'development' };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
let tests = 0, failed = 0;

async function call(method, url, body, token) {
  const res = await fetch(BASE + url, { method, headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) }, body: body ? JSON.stringify(body) : undefined });
  return { status: res.status, data: await res.json().catch(() => null) };
}
async function t(name, fn) {
  tests++;
  try { await fn(); console.log('  PASS', name); } catch (e) { failed++; console.log('  FAIL', name, '-', e.message); }
}

(async () => {
  const server = spawn(process.execPath, [path.join(__dirname, 'index.js')], { env, stdio: 'ignore' });
  try {
    for (let i = 0; i < 40; i++) { try { if ((await fetch(BASE + '/health')).ok) break; } catch {} await sleep(250); }
    let admin, teacher, student, studentId, planId, assessmentId, submissionId;
    await t('health reports file storage', async () => assert.strictEqual((await call('GET', '/health')).data.storage, 'file'));
    await t('rejects unauthenticated access', async () => assert.strictEqual((await call('GET', '/students')).status, 401));
    await t('rejects wrong password', async () => assert.strictEqual((await call('POST', '/auth/login', { email: 'admin@classpulse.demo', password: 'nope' })).status, 401));
    await t('admin, teacher, and student can sign in', async () => {
      admin = (await call('POST', '/auth/login', { email: 'admin@classpulse.demo', password: 'TestPass#123' })).data.token;
      teacher = (await call('POST', '/auth/login', { email: 'teacher@classpulse.demo', password: 'TestPass#123' })).data.token;
      student = (await call('POST', '/auth/login', { email: 'student@classpulse.demo', password: 'TestPass#123' })).data.token;
      assert.ok(admin && teacher && student);
    });
    await t('student role is limited to its own dashboard', async () => {
      assert.strictEqual((await call('GET', '/dashboard', null, student)).status, 403);
      const d = (await call('GET', '/student/dashboard', null, student)).data;
      assert.ok(d.student.id && d.student.name && Array.isArray(d.assessments));
    });
    await t('teacher creates a persistent assignment with a test question', async () => {
      const created = await call('POST', '/assessments', { title: 'Demo fractions quiz', description: 'Choose the right answer', type: 'test', classTarget: 'all', dueDate: '2099-12-31', maxScore: 10, questions: [{ prompt: 'What is 1/2 as a decimal?', type: 'choice', options: ['0.25', '0.5', '0.75'], correctAnswer: '0.5' }] }, teacher);
      assert.strictEqual(created.status, 201); assessmentId = created.data.assessment.id;
      assert.strictEqual((await call('POST', '/assessments', { title: 'No', type: 'assignment', dueDate: '2099-12-31', maxScore: 10, questions: [] }, student)).status, 403);
      const list = (await call('GET', '/assessments', null, teacher)).data.assessments;
      assert.ok(list.some((a) => a.id === assessmentId));
    });
    await t('student can submit once and cannot see the answer key or unreleased mark', async () => {
      const list = (await call('GET', '/student/dashboard', null, student)).data.assessments;
      const a = list.find((x) => x.id === assessmentId);
      assert.ok(a && !('correctAnswer' in a.questions[0]));
      const submitted = await call('POST', `/assessments/${assessmentId}/submit`, { answers: [{ questionId: a.questions[0].id, answer: '0.5' }] }, student);
      assert.strictEqual(submitted.status, 201); submissionId = submitted.data.submission.id;
      assert.strictEqual((await call('POST', `/assessments/${assessmentId}/submit`, { answers: [{ questionId: a.questions[0].id, answer: '0.5' }] }, student)).status, 409);
      const dashboard = (await call('GET', '/student/dashboard', null, student)).data;
      assert.strictEqual(dashboard.assessments.find((x) => x.id === assessmentId).submission.score, null);
    });
    await t('teacher can grade, release, and see assessment analytics', async () => {
      assert.strictEqual((await call('PATCH', `/submissions/${submissionId}/grade`, { score: 8, feedback: 'Good work', release: true }, teacher)).status, 200);
      const d = (await call('GET', '/student/dashboard', null, student)).data;
      assert.strictEqual(d.assessments.find((x) => x.id === assessmentId).submission.score, 8);
      assert.strictEqual(d.assessments.find((x) => x.id === assessmentId).submission.feedback, 'Good work');
      const analytics = (await call('GET', '/teacher/analytics', null, teacher)).data;
      assert.ok(analytics.summary.released >= 1 && analytics.scoresByAssessment.some((x) => x.title === 'Demo fractions quiz'));
      assert.strictEqual((await call('PATCH', `/submissions/${submissionId}/grade`, { score: 11, release: true }, teacher)).status, 400);
    });
    await t('dashboard metrics come from data and add up', async () => {
      const d = (await call('GET', '/dashboard', null, teacher)).data;
      assert.strictEqual(d.total, 36);
      assert.strictEqual(d.counts.High + d.counts.Medium + d.counts.Low, 36);
      assert.ok(d.counts.High > 0 && d.counts.Low > 0 && d.trend.length === 12 && d.attention.length > 0);
    });
    await t('class filter narrows results', async () => {
      const d = (await call('GET', '/dashboard?class=9-A', null, teacher)).data;
      assert.strictEqual(d.total, 12);
    });
    await t('student list filters by risk', async () => {
      const r = (await call('GET', '/students?risk=High', null, teacher)).data.students;
      assert.ok(r.length > 0 && r.every((s) => s.riskLevel === 'High'));
      studentId = r[0].id;
    });
    await t('alerts are explainable', async () => {
      const d = (await call('GET', `/students/${studentId}`, null, teacher)).data;
      assert.ok(d.evaluation.alerts.length > 0);
      for (const a of d.evaluation.alerts) assert.ok(a.explanation && a.threshold !== undefined && a.value !== undefined);
    });
    await t('teacher cannot change thresholds', async () => assert.strictEqual((await call('PUT', '/settings', { attendanceMin: 60, attendanceDrop: 10, scoreMin: 40, scoreDrop: 12 }, teacher)).status, 403));
    await t('admin threshold validation', async () => assert.strictEqual((await call('PUT', '/settings', { attendanceMin: 500, attendanceDrop: 10, scoreMin: 40, scoreDrop: 12 }, admin)).status, 400));
    await t('lower thresholds reduce flagged students', async () => {
      const before = (await call('GET', '/dashboard', null, admin)).data.counts;
      assert.strictEqual((await call('PUT', '/settings', { attendanceMin: 40, attendanceDrop: 40, scoreMin: 20, scoreDrop: 40 }, admin)).status, 200);
      const after = (await call('GET', '/dashboard', null, admin)).data.counts;
      assert.ok(after.Low > before.Low);
      await call('PUT', '/settings', { attendanceMin: 75, attendanceDrop: 10, scoreMin: 50, scoreDrop: 12 }, admin);
    });
    await t('dashboard exposes heatmap rows and sparklines', async () => {
      const d = (await call('GET', '/dashboard', null, teacher)).data;
      assert.ok(d.heat.weeks.length > 0 && d.heat.rows.length > 0);
      assert.strictEqual(d.heat.rows[0].values.length, d.heat.weeks.length);
      assert.ok(Array.isArray(d.attention[0].spark));
    });
    await t('threshold preview is read-only and validates input', async () => {
      const cur = (await call('GET', '/settings', null, teacher)).data.thresholds;
      const before = (await call('GET', '/dashboard', null, teacher)).data.counts;
      const p = (await call('POST', '/settings/preview', { attendanceMin: 95, attendanceDrop: 2, scoreMin: 90, scoreDrop: 2 }, teacher)).data;
      assert.ok(p.counts.High + p.counts.Medium >= before.High + before.Medium && p.changedCount > 0);
      assert.deepStrictEqual((await call('GET', '/settings', null, teacher)).data.thresholds, cur); // nothing saved
      assert.strictEqual((await call('POST', '/settings/preview', { attendanceMin: 'x' }, teacher)).status, 400);
      assert.strictEqual((await call('POST', '/settings/preview', cur, student)).status, 403);
    });
    await t('plan validation rejects bad input', async () => assert.strictEqual((await call('POST', '/plans', { studentId, title: 'x', actions: [], dueDate: 'bad' }, teacher)).status, 400));
    await t('create plan, toggle action, add follow-up', async () => {
      const c = await call('POST', '/plans', { studentId, title: 'Test support plan', actions: ['Call guardian', 'Weekly check-in'], dueDate: '2026-12-01' }, teacher);
      assert.strictEqual(c.status, 201);
      planId = c.data.plan.id;
      const p = await call('PATCH', `/plans/${planId}`, { toggleAction: 0 }, teacher);
      assert.strictEqual(p.data.plan.actions[0].done, true);
      const f = await call('POST', `/plans/${planId}/followups`, { note: 'Spoke to guardian', outcome: 'improving' }, teacher);
      assert.strictEqual(f.data.plan.followUps.length, 1);
      assert.strictEqual((await call('PATCH', `/plans/${planId}`, { status: 'completed' }, teacher)).data.plan.status, 'completed');
    });
    await t('impact tracker lists plans; seeded plans show measured change', async () => {
      const d = (await call('GET', '/impact', null, teacher)).data;
      assert.ok(d.items.some((i) => i.planId === planId && i.outcome === 'awaiting'));
      assert.ok(d.summary.measured > 0 && d.summary.improving > 0 && d.summary.avgAttendanceChange > 0);
    });
    await t('CSV validation reports row errors', async () => {
      const bad = 'name,class,week,attendance_pct,score_pct\nAsha Test,9-A,1,95,80\nBob,9-A,x,150,\nAsha Test,9-A,1,90,\n';
      const r = (await call('POST', '/import/validate', { csv: bad }, admin)).data.report;
      assert.ok(r.errorCount >= 3 && r.errors.every((e) => e.line > 0));
    });
    await t('CSV commit refused when invalid; teacher blocked', async () => {
      assert.strictEqual((await call('POST', '/import/commit', { csv: 'name,class\nA,B' }, admin)).status, 422);
      assert.strictEqual((await call('POST', '/import/validate', { csv: 'x' }, teacher)).status, 403);
    });
    await t('valid CSV imports new and updates existing students', async () => {
      const csv = 'name,class,week,attendance_pct,score_pct\nAsha Test,9-A,1,95,80\nAsha Test,9-A,2,90,\n';
      const v = (await call('POST', '/import/validate', { csv }, admin)).data.report;
      assert.strictEqual(v.errorCount, 0); assert.strictEqual(v.newStudents, 1);
      assert.strictEqual((await call('POST', '/import/commit', { csv, mode: 'merge' }, admin)).status, 200);
      assert.strictEqual((await call('GET', '/dashboard', null, admin)).data.total, 37);
    });
    await t('reseed restores demo data', async () => {
      assert.strictEqual((await call('POST', '/admin/reseed', null, admin)).status, 200);
      assert.strictEqual((await call('GET', '/dashboard', null, admin)).data.total, 36);
    });
  } finally { server.kill(); }
  console.log(`\n${tests - failed}/${tests} tests passed`);
  process.exit(failed ? 1 : 0);
})();
