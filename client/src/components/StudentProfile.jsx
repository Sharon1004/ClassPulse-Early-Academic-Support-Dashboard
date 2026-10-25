import { useState } from 'react';
import { AreaChart, Area, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceLine } from 'recharts';
import { useApi } from '../api.js';
import { Loading, ErrorBox, Empty, RiskBadge, Kpi, Avatar, Gauge, ChartTip, RISK_COLOR } from './ui.jsx';
import { Icon } from './icons.jsx';
import { PlanCard, PlanForm } from './PulsePath.jsx';

const ALERT_ICON = { LOW_ATTENDANCE: 'attendance', ATTENDANCE_DROP: 'trend', LOW_SCORE: 'score', SCORE_DECLINE: 'trend' };

export default function StudentProfile({ id, back }) {
  const { data, loading, error, reload } = useApi(`/students/${id}`);
  const [creating, setCreating] = useState(false);
  const backBtn = <button className="link back" onClick={back}><Icon name="back" />Back to students</button>;
  if (error) return <>{backBtn}<ErrorBox error={error} onRetry={reload} /></>;
  if (!data) return <Loading />;
  const { student, evaluation: ev, thresholds: th, plans } = data;
  const scores = student.records.filter((r) => r.score != null);
  const color = RISK_COLOR[ev.riskLevel];

  return (
    <div style={{ opacity: loading ? 0.65 : 1, transition: 'opacity .2s' }}>
      {backBtn}
      <div className="profile-head">
        <Avatar name={student.name} size="lg" />
        <div className="grow">
          <h1>{student.name}</h1>
          <p>Class {student.class}{student.synthetic ? ' · synthetic demo record' : ''} · data up to week {ev.metrics.latestWeek}</p>
          <div style={{ marginTop: 10 }}><RiskBadge level={ev.riskLevel} /></div>
        </div>
        <Gauge value={ev.riskScore} color={color} />
      </div>

      <div className="kpis">
        <Kpi label="Attendance, last 4 weeks" value={ev.metrics.recentAttendance} decimals={1} suffix="%" />
        <Kpi label="Attendance, whole period" value={ev.metrics.overallAttendance} decimals={1} suffix="%" />
        <Kpi label="Average of last 2 assessments" value={ev.metrics.recentScore} decimals={1} suffix="%" />
        <Kpi label="Active alerts" value={ev.alerts.length} tone={ev.alerts.length ? 'med' : 'good'} />
      </div>

      <section className="panel">
        <div className="panel-head"><div><h2>Why this student is flagged</h2><p>Each alert names the rule, the value it saw, and the threshold it crossed.</p></div></div>
        {ev.alerts.length === 0 ? <Empty title="No alerts" icon="checkCircle">Attendance and scores are within your thresholds.</Empty> : (
          <div className="why">
            {ev.alerts.map((a) => (
              <div key={a.code} className={`why-item ${a.severity === 'high' ? 'high' : ''}`}>
                <div className="why-icon"><Icon name={ALERT_ICON[a.code] || 'alert'} /></div>
                <div>
                  <h3>{a.title} <span className={`badge ${a.severity === 'high' ? 'high' : 'medium'}`}>{a.severity}</span></h3>
                  <p>{a.explanation}</p>
                  <div className="rule"><span>Measured: <b>{a.metric}</b></span><span>Observed: <b>{a.value}</b></span><span>Trigger: <b>{a.threshold}</b></span></div>
                </div>
              </div>
            ))}
          </div>
        )}
        {ev.alerts.length > 0 && <p className="note mt">Risk points: 20 for each medium alert and 35 for each high alert, capped at 100. Change the thresholds in Settings.</p>}
      </section>

      <div className="grid g2" style={{ marginBottom: 20 }}>
        <section className="panel"><div className="panel-head"><h2>Weekly attendance</h2></div>
          <ResponsiveContainer width="100%" height={230}>
            <AreaChart data={student.records} margin={{ left: -12, right: 8, top: 8 }}>
              <defs><linearGradient id="pAtt" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" style={{ stopColor: 'var(--brand)', stopOpacity: 0.35 }} /><stop offset="100%" style={{ stopColor: 'var(--brand)', stopOpacity: 0 }} /></linearGradient></defs>
              <CartesianGrid vertical={false} /><XAxis dataKey="week" tickLine={false} axisLine={false} /><YAxis domain={[0, 100]} tickLine={false} axisLine={false} />
              <Tooltip content={<ChartTip />} />
              <ReferenceLine y={th.attendanceMin} stroke="var(--high)" strokeDasharray="4 4" />
              <Area type="monotone" dataKey="attendance" name="Attendance" stroke="var(--brand)" strokeWidth={2.5} fill="url(#pAtt)" />
            </AreaChart>
          </ResponsiveContainer>
          <p className="note">Dashed line: attendance threshold ({th.attendanceMin}%).</p>
        </section>
        <section className="panel"><div className="panel-head"><h2>Assessment scores</h2></div>
          {scores.length === 0 ? <Empty title="No assessment scores recorded" icon="score" /> : (
            <ResponsiveContainer width="100%" height={230}>
              <LineChart data={scores} margin={{ left: -12, right: 8, top: 8 }}>
                <CartesianGrid vertical={false} /><XAxis dataKey="week" tickLine={false} axisLine={false} /><YAxis domain={[0, 100]} tickLine={false} axisLine={false} />
                <Tooltip content={<ChartTip />} />
                <ReferenceLine y={th.scoreMin} stroke="var(--high)" strokeDasharray="4 4" />
                <Line type="monotone" dataKey="score" name="Score" stroke="var(--info)" strokeWidth={2.5} dot={{ r: 4, fill: 'var(--info)' }} />
              </LineChart>
            </ResponsiveContainer>
          )}
          <p className="note">Dashed line: score threshold ({th.scoreMin}%).</p>
        </section>
      </div>

      <section className="panel">
        <div className="panel-head">
          <div><h2>PulsePath support plans</h2><p>You decide what support looks like. Actions below are only suggestions.</p></div>
          {!creating && <button className="btn primary" onClick={() => setCreating(true)}><Icon name="plus" />Create support plan</button>}
        </div>
        {creating && <PlanForm student={student} suggested={ev.suggestedActions} onCancel={() => setCreating(false)} onCreated={() => { setCreating(false); reload(); }} />}
        {plans.length === 0 && !creating ? <Empty title="No support plans yet" icon="plan">Create a plan to track actions and follow-ups for this student.</Empty> : plans.map((p) => <PlanCard key={p.id} plan={p} onChange={reload} showImpact />)}
      </section>
    </div>
  );
}
