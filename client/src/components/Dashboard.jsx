import { useState } from 'react';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceLine } from 'recharts';
import { useApi } from '../api.js';
import { Loading, ErrorBox, Empty, RiskBadge, Kpi, Avatar, Sparkline, ChartTip, RISK_COLOR } from './ui.jsx';
import { Icon } from './icons.jsx';

const greeting = () => { const h = new Date().getHours(); return h < 12 ? 'Good morning' : h < 17 ? 'Good afternoon' : 'Good evening'; };

// Colour bucket for a weekly attendance value, relative to the teacher's own threshold.
const bucket = (v, min) => (v == null ? 'c-none' : v < min ? 'c0' : v < min + 8 ? 'c1' : v < min + 15 ? 'c2' : v < 92 ? 'c3' : 'c4');

function RiskSplit({ counts, total }) {
  const parts = [['High', 'r-high', counts.High], ['Medium', 'r-med', counts.Medium], ['Low', 'r-low', counts.Low]];
  return (
    <>
      <div className="riskbar" role="img" aria-label={`${counts.High} high, ${counts.Medium} medium, ${counts.Low} low risk of ${total} students`}>
        {parts.map(([k, cls, n]) => n > 0 && <i key={k} className={cls} style={{ flexGrow: n }} title={`${k}: ${n}`} />)}
      </div>
      <div className="legend">
        {parts.map(([k, cls, n]) => <span key={k}><i className={`${cls}`} style={{ background: RISK_COLOR[k] }} />{k === 'Low' ? 'On track' : k === 'Medium' ? 'Watch' : 'Needs attention'} <b>{n}</b></span>)}
      </div>
    </>
  );
}

function PulseGrid({ heat, th, openStudent }) {
  if (!heat.rows.length) return null;
  return (
    <section className="panel">
      <div className="panel-head">
        <div><h2>Pulse grid</h2><p>Weekly attendance for every student, riskiest first. Select a name to open their profile.</p></div>
        <div className="legend" style={{ margin: 0 }} aria-label="Colour scale">
          <span>Low</span><span className="scale"><i className="c0" /><i className="c1" /><i className="c2" /><i className="c3" /><i className="c4" /></span><span>High</span>
        </div>
      </div>
      <div className="pgrid">
        <div className="pgrid-inner" style={{ '--cols': heat.weeks.length }}>
          <div className="pgrid-row"><span />{heat.weeks.map((w) => <span key={w} className="pgrid-head">{w}</span>)}</div>
          {heat.rows.map((r) => (
            <div className="pgrid-row" key={r.id}>
              <button className="pgrid-name" onClick={() => openStudent(r.id)} title={`${r.name} (${r.class})`}><i className={r.riskLevel.toLowerCase()} />{r.name}</button>
              {r.values.map((v, i) => <span key={i} className={`pgrid-cell ${bucket(v, th.attendanceMin)}`} title={`${r.name}, week ${heat.weeks[i]}: ${v == null ? 'no data' : v + '%'}`} />)}
            </div>
          ))}
        </div>
      </div>
      <p className="note mt">Columns are weeks. Red cells fall below your {th.attendanceMin}% attendance threshold.</p>
    </section>
  );
}

export default function Dashboard({ user, openStudent, go }) {
  const [cls, setCls] = useState('');
  const { data, loading, error, reload } = useApi('/dashboard' + (cls ? `?class=${encodeURIComponent(cls)}` : ''));
  if (error) return <ErrorBox error={error} onRetry={reload} />;
  if (!data) return <Loading />;
  const th = data.thresholds;
  const flagged = data.counts.High + data.counts.Medium;
  const attSpark = data.trend.map((t) => t.attendance);
  const scoreSpark = data.trend.filter((t) => t.score != null).map((t) => t.score);

  return (
    <div style={{ opacity: loading ? 0.65 : 1, transition: 'opacity .2s' }}>
      <div className="head">
        <div className="hello">
          <h1>{greeting()}, {user.name.split(' ').pop()}</h1>
          <p>{data.total === 0 ? 'Import a class to get started.' : flagged === 0 ? 'Everyone is within your thresholds today.' : `${flagged} of ${data.total} students may need a closer look. Each one shows why.`}</p>
        </div>
        <div className="head-actions">
          <div style={{ minWidth: 170 }}>
            <label htmlFor="cls">Class</label>
            <select id="cls" value={cls} onChange={(e) => setCls(e.target.value)}>
              <option value="">All classes</option>
              {data.classes.map((c) => <option key={c}>{c}</option>)}
            </select>
          </div>
        </div>
      </div>

      {data.total === 0 ? (
        <section className="panel"><Empty title="No students yet" icon="students" action={<button className="btn primary" onClick={() => go('settings')}><Icon name="upload" />Import a CSV</button>}>Import attendance and scores to see who needs support.</Empty></section>
      ) : (<>
        <div className="kpis">
          <Kpi label="Students" value={data.total} hint={cls || 'across all classes'} />
          <Kpi label="Need attention" value={data.counts.High} tone="high" hint="High-risk alerts" />
          <Kpi label="On the watch list" value={data.counts.Medium} tone="med" hint="Medium-risk alerts" />
          <Kpi label="Attendance, last 4 weeks" value={data.avgAttendance} decimals={1} suffix="%" spark={attSpark} />
          <Kpi label="Active support plans" value={data.activePlans} tone="good" hint="Tracked in PulsePath" />
        </div>

        <div className="grid g-main" style={{ marginBottom: 20 }}>
          <section className="panel">
            <div className="panel-head"><div><h2>Needs attention first</h2><p>Highest risk at the top. The reason is shown, not hidden.</p></div><button className="btn sm" onClick={() => go('students')}>All students</button></div>
            {data.attention.length === 0 ? <Empty title="No students are flagged" icon="checkCircle">Everyone is within the current thresholds.</Empty> : (
              <div className="attn">
                {data.attention.map((s) => (
                  <button key={s.id} className={`attn-item ${s.riskLevel === 'High' ? 'high' : ''}`} onClick={() => openStudent(s.id)}>
                    <Avatar name={s.name} />
                    <div style={{ minWidth: 0 }}>
                      <strong>{s.name} <span className="note">{s.class}</span></strong>
                      <p>{s.topAlert}{s.alertCount > 1 ? ` (+${s.alertCount - 1} more)` : ''}</p>
                    </div>
                    <div className="attn-side"><RiskBadge level={s.riskLevel} /><Sparkline data={s.spark} color={RISK_COLOR[s.riskLevel]} /></div>
                  </button>
                ))}
              </div>
            )}
          </section>

          <div style={{ display: 'grid', gap: 20, alignContent: 'start' }}>
            <section className="panel" style={{ margin: 0 }}>
              <div className="panel-head"><div><h2>Class at a glance</h2><p>How {cls || 'all classes'} split by risk level.</p></div></div>
              <RiskSplit counts={data.counts} total={data.total} />
            </section>
            <section className="panel flat" style={{ margin: 0 }}>
              <h3 style={{ marginBottom: 6 }}>Teacher in control</h3>
              <p className="note" style={{ margin: 0 }}>A flag is a prompt for review, not a verdict. Thresholds are yours to tune, and nothing happens to a student without a teacher’s decision.</p>
              <button className="btn sm mt" onClick={() => go('settings')}><Icon name="settings" />Tune thresholds</button>
            </section>
          </div>
        </div>

        <PulseGrid heat={data.heat} th={th} openStudent={openStudent} />

        <div className="grid g2">
          <section className="panel"><div className="panel-head"><div><h2>Average attendance by week</h2></div></div>
            <ResponsiveContainer width="100%" height={240}>
              <AreaChart data={data.trend} margin={{ left: -12, right: 8, top: 8 }}>
                <defs><linearGradient id="gAtt" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" style={{ stopColor: 'var(--brand)', stopOpacity: 0.35 }} /><stop offset="100%" style={{ stopColor: 'var(--brand)', stopOpacity: 0 }} /></linearGradient></defs>
                <CartesianGrid vertical={false} /><XAxis dataKey="week" tickLine={false} axisLine={false} /><YAxis domain={[40, 100]} tickLine={false} axisLine={false} />
                <Tooltip content={<ChartTip />} />
                <ReferenceLine y={th.attendanceMin} stroke="var(--high)" strokeDasharray="4 4" />
                <Area type="monotone" dataKey="attendance" name="Attendance" stroke="var(--brand)" strokeWidth={2.5} fill="url(#gAtt)" />
              </AreaChart>
            </ResponsiveContainer>
            <p className="note">Dashed line: your attendance threshold ({th.attendanceMin}%).</p>
          </section>
          <section className="panel"><div className="panel-head"><div><h2>Average assessment score by week</h2></div></div>
            <ResponsiveContainer width="100%" height={240}>
              <AreaChart data={data.trend.filter((t) => t.score != null)} margin={{ left: -12, right: 8, top: 8 }}>
                <defs><linearGradient id="gSc" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" style={{ stopColor: 'var(--info)', stopOpacity: 0.3 }} /><stop offset="100%" style={{ stopColor: 'var(--info)', stopOpacity: 0 }} /></linearGradient></defs>
                <CartesianGrid vertical={false} /><XAxis dataKey="week" tickLine={false} axisLine={false} /><YAxis domain={[20, 100]} tickLine={false} axisLine={false} />
                <Tooltip content={<ChartTip />} />
                <ReferenceLine y={th.scoreMin} stroke="var(--high)" strokeDasharray="4 4" />
                <Area type="monotone" dataKey="score" name="Score" stroke="var(--info)" strokeWidth={2.5} fill="url(#gSc)" dot={{ r: 3, fill: 'var(--info)' }} />
              </AreaChart>
            </ResponsiveContainer>
            <p className="note">Dashed line: your score threshold ({th.scoreMin}%). Assessments are recorded in some weeks only.</p>
          </section>
        </div>
      </>)}
    </div>
  );
}
