// Synthetic demo data. All names are invented; no real student information.
const crypto = require('crypto');
const bcrypt = require('bcryptjs');
const { DEFAULTS, planBaseline } = require('./alerts');

function rng(seed) { // deterministic, so the demo looks the same every time
  let a = seed;
  return () => {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const FIRST = ['Aarav','Diya','Kabir','Meera','Rohan','Ananya','Vihaan','Isha','Arjun','Saanvi','Dev','Tara','Ishaan','Naina','Reyansh','Kiara','Aditya','Riya','Krish','Myra','Neel','Pooja','Samar','Zoya','Yash','Leela','Harsh','Anika','Veer','Sana','Om','Pihu','Rudra','Ira','Lakshya','Navya'];
const LAST = ['Rao','Reddy','Naidu','Sharma','Iyer','Khan','Patel','Das','Menon','Singh','Verma','Joshi'];
const CLASSES = ['9-A', '9-B', '10-A'];
const PROFILES = ['decline', 'lowAtt', 'lowScore', 'recovering', 'stalled', 'steady', 'steady', 'steady', 'steady', 'steady', 'steady', 'steady'];
const clamp = (x) => Math.max(0, Math.min(100, Math.round(x * 10) / 10));

function makeRecords(profile, r) {
  const n = (x) => (r() * 2 - 1) * x;
  const out = [];
  for (let w = 1; w <= 12; w++) {
    let att, sc;
    if (profile === 'decline') { att = w <= 6 ? 92 + n(3) : 92 - (w - 6) * 4.8 + n(2); sc = w <= 6 ? 74 + n(5) : 74 - (w - 6) * 4 + n(3); }
    else if (profile === 'lowAtt') { att = 66 + n(5); sc = 62 + n(7); }
    else if (profile === 'lowScore') { att = 88 + n(4); sc = 42 + n(6); }
    else if (profile === 'recovering') { att = w <= 6 ? 70 + n(4) : 70 + (w - 6) * 3.3 + n(2); sc = w <= 6 ? 46 + n(5) : 46 + (w - 6) * 4 + n(3); }
    else if (profile === 'stalled') { att = 68 + n(4); sc = 46 + n(5); }
    else { att = 93 + n(3); sc = 72 + n(7); }
    out.push({ week: w, attendance: clamp(att), score: w % 2 === 0 ? clamp(sc) : null });
  }
  return out;
}

async function seedUsers(store) {
  if ((await store.list('users')).length) return false;
  const pw = process.env.DEMO_PASSWORD || 'ClassPulse@2026'; // demo-only default for local use
  const hash = await bcrypt.hash(pw, 10);
  await store.replaceAll('users', [
    { id: crypto.randomUUID(), name: 'Demo Admin', email: 'admin@classpulse.demo', role: 'admin', passwordHash: hash },
    { id: crypto.randomUUID(), name: 'Demo Teacher', email: 'teacher@classpulse.demo', role: 'teacher', passwordHash: hash },
  ]);
  return true;
}

async function seedStudentUser(store) {
  const students = await store.list('students');
  if (!students.length) return false;
  const existing = (await store.list('users')).find((u) => u.role === 'student' && u.email === 'student@classpulse.demo');
  if (existing) {
    if (existing.studentId !== students[0].id) await store.update('users', existing.id, { studentId: students[0].id });
    return false;
  }
  const pw = process.env.DEMO_PASSWORD || 'ClassPulse@2026';
  await store.insert('users', { id: crypto.randomUUID(), name: `Student Demo (${students[0].name})`, email: 'student@classpulse.demo', role: 'student', studentId: students[0].id, passwordHash: await bcrypt.hash(pw, 10) });
  return true;
}

async function seedSettings(store) {
  if (!(await store.get('settings', 'thresholds'))) await store.insert('settings', { id: 'thresholds', ...DEFAULTS });
}

// Replaces all students and plans with fresh synthetic data.
async function seedDemoData(store) {
  const r = rng(2026);
  const students = [];
  FIRST.forEach((first, i) => {
    const profile = PROFILES[i % 12];
    students.push({
      id: crypto.randomUUID(), name: `${first} ${LAST[(i * 7) % 12]}`, class: CLASSES[Math.floor(i / 12)],
      synthetic: true, profile, records: makeRecords(profile, r),
    });
  });
  const day = 86400000;
  const plans = students.filter((s) => s.profile === 'recovering' || s.profile === 'stalled').map((s, i) => {
    const startWeek = 6;
    const done = s.profile === 'recovering';
    const created = Date.now() - 6 * 7 * day;
    return {
      id: crypto.randomUUID(), studentId: s.id, startWeek, baseline: planBaseline(s, startWeek),
      title: i % 2 ? 'Weekly mentoring and attendance check' : 'Catch-up sessions and guardian contact',
      actions: [
        { text: 'Contact the guardian to understand the reasons for absences', done: true },
        { text: 'Schedule a weekly 20-minute catch-up session', done },
        { text: 'Share targeted practice material for weak topics', done },
      ],
      dueDate: new Date(created + 35 * day).toISOString().slice(0, 10), status: done ? 'completed' : 'active',
      followUps: [
        { date: new Date(created + 14 * day).toISOString().slice(0, 10), note: 'Met student; agreed a simple weekly routine.', outcome: 'no_change' },
        { date: new Date(created + 28 * day).toISOString().slice(0, 10), note: done ? 'Attendance and quiz marks are clearly better.' : 'Little change so far; trying a different approach.', outcome: done ? 'improving' : 'no_change' },
      ],
      createdBy: 'Demo Teacher', createdAt: new Date(created).toISOString(),
    };
  });
  await store.replaceAll('students', students);
  await store.replaceAll('plans', plans);
  return { students: students.length, plans: plans.length };
}

module.exports = { seedUsers, seedSettings, seedDemoData, seedStudentUser };
