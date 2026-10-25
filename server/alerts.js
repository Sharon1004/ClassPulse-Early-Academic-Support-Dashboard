// Explainable early-warning rules. Every alert states the rule, the observed value,
// the threshold and a plain-language explanation. No hidden scoring.
const DEFAULTS = { attendanceMin: 75, attendanceDrop: 10, scoreMin: 50, scoreDrop: 12 };

const avg = (a) => (a.length ? a.reduce((s, x) => s + x, 0) / a.length : null);
const r1 = (n) => (n == null ? null : Math.round(n * 10) / 10);
const sorted = (s) => [...s.records].sort((a, b) => a.week - b.week);
const latestWeek = (s) => (s.records.length ? Math.max(...s.records.map((r) => r.week)) : 0);

function metrics(s) {
  const recs = sorted(s);
  const att = recs.map((r) => r.attendance);
  const sc = recs.filter((r) => r.score != null).map((r) => r.score);
  const rec3 = att.slice(-3), prev3 = att.slice(-6, -3);
  const recSc = sc.slice(-2), prevSc = sc.slice(-4, -2);
  const hasDrop = rec3.length === 3 && prev3.length === 3;
  return {
    latestWeek: latestWeek(s),
    overallAttendance: r1(avg(att)),
    recentAttendance: r1(avg(att.slice(-4))),
    recentAttendance3: r1(avg(rec3)),
    previousAttendance3: hasDrop ? r1(avg(prev3)) : null,
    attendanceChange: hasDrop ? r1(avg(rec3) - avg(prev3)) : null,
    recentScore: r1(avg(recSc)),
    previousScore: prevSc.length ? r1(avg(prevSc)) : null,
    scoreChange: recSc.length && prevSc.length ? r1(avg(recSc) - avg(prevSc)) : null,
  };
}

const SUGGESTIONS = {
  LOW_ATTENDANCE: ['Contact the guardian to understand the reasons for absences', 'Agree a clear attendance target for the next 4 weeks'],
  ATTENDANCE_DROP: ['Hold a short, private check-in conversation with the student'],
  LOW_SCORE: ['Schedule a weekly 20-minute catch-up session', 'Share targeted practice material for weak topics'],
  SCORE_DECLINE: ['Review the last two assessments together to find topic gaps'],
};

function evaluate(s, th) {
  const m = metrics(s);
  const alerts = [];
  const add = (code, title, severity, metric, value, threshold, explanation) =>
    alerts.push({ code, title, severity, metric, value, threshold, explanation });

  if (m.recentAttendance != null && m.recentAttendance < th.attendanceMin) {
    add('LOW_ATTENDANCE', 'Low attendance', m.recentAttendance < th.attendanceMin - 10 ? 'high' : 'medium',
      'Average attendance, last 4 weeks', m.recentAttendance, th.attendanceMin,
      `Average attendance over the last 4 weeks is ${m.recentAttendance}%, below the ${th.attendanceMin}% threshold.`);
  }
  if (m.attendanceChange != null && m.attendanceChange <= -th.attendanceDrop) {
    add('ATTENDANCE_DROP', 'Attendance dropping', m.attendanceChange <= -2 * th.attendanceDrop ? 'high' : 'medium',
      'Attendance change (last 3 vs previous 3 weeks)', m.attendanceChange, -th.attendanceDrop,
      `Attendance fell ${Math.abs(m.attendanceChange)} points, from ${m.previousAttendance3}% to ${m.recentAttendance3}%, comparing the last 3 weeks with the 3 before. The alert triggers at a drop of ${th.attendanceDrop} points.`);
  }
  if (m.recentScore != null && m.recentScore < th.scoreMin) {
    add('LOW_SCORE', 'Low assessment scores', m.recentScore < th.scoreMin - 10 ? 'high' : 'medium',
      'Average of last 2 assessments', m.recentScore, th.scoreMin,
      `The average of the last 2 assessments is ${m.recentScore}%, below the ${th.scoreMin}% threshold.`);
  }
  if (m.scoreChange != null && m.scoreChange <= -th.scoreDrop) {
    add('SCORE_DECLINE', 'Scores declining', m.scoreChange <= -2 * th.scoreDrop ? 'high' : 'medium',
      'Score change (last 2 vs previous 2 assessments)', m.scoreChange, -th.scoreDrop,
      `Assessment average fell ${Math.abs(m.scoreChange)} points, from ${m.previousScore}% to ${m.recentScore}%. The alert triggers at a drop of ${th.scoreDrop} points.`);
  }
  alerts.sort((a, b) => (a.severity === b.severity ? 0 : a.severity === 'high' ? -1 : 1));
  const riskScore = Math.min(100, alerts.reduce((t, a) => t + (a.severity === 'high' ? 35 : 20), 0));
  const riskLevel = alerts.some((a) => a.severity === 'high') || alerts.length >= 3 ? 'High' : alerts.length ? 'Medium' : 'Low';
  const suggestedActions = [...new Set(alerts.flatMap((a) => SUGGESTIONS[a.code] || []))];
  return { metrics: m, alerts, riskScore, riskLevel, suggestedActions };
}

// --- PulsePath impact: compare data up to the plan start with data after it ---
function windowStats(recs) {
  return {
    attendance: r1(avg(recs.slice(-3).map((r) => r.attendance))),
    score: r1(avg(recs.filter((r) => r.score != null).slice(-2).map((r) => r.score))),
  };
}
const planBaseline = (s, startWeek) => windowStats(sorted(s).filter((r) => r.week <= startWeek));
function planCurrent(s, startWeek) {
  const after = sorted(s).filter((r) => r.week > startWeek);
  return { ...windowStats(after), weeksSince: after.length };
}

function impact(plan, s) {
  const cur = planCurrent(s, plan.startWeek);
  const d = (a, b) => (a == null || b == null ? null : r1(a - b));
  const attendanceChange = d(cur.attendance, plan.baseline.attendance);
  const scoreChange = d(cur.score, plan.baseline.score);
  let outcome = 'awaiting';
  if (cur.weeksSince > 0) {
    const up = (attendanceChange != null && attendanceChange >= 2) || (scoreChange != null && scoreChange >= 3);
    const down = (attendanceChange != null && attendanceChange <= -2) || (scoreChange != null && scoreChange <= -3);
    outcome = up && !down ? 'improving' : down && !up ? 'declining' : 'steady';
  }
  return { baseline: plan.baseline, current: { attendance: cur.attendance, score: cur.score }, weeksSince: cur.weeksSince, attendanceChange, scoreChange, outcome };
}

module.exports = { DEFAULTS, evaluate, metrics, planBaseline, planCurrent, impact, latestWeek, r1, avg };
