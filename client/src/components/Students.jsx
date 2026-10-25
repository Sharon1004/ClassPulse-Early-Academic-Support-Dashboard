import { useState, useEffect } from 'react';
import { useApi } from '../api.js';
import { Loading, ErrorBox, Empty, RiskBadge, Avatar, Sparkline, PageHead, pct, RISK_COLOR } from './ui.jsx';
import { Icon } from './icons.jsx';

export default function Students({ openStudent }) {
  const [q, setQ] = useState('');
  const [debounced, setDebounced] = useState('');
  const [cls, setCls] = useState('');
  const [risk, setRisk] = useState('');
  useEffect(() => { const t = setTimeout(() => setDebounced(q), 250); return () => clearTimeout(t); }, [q]);
  const params = new URLSearchParams();
  if (debounced) params.set('q', debounced);
  if (cls) params.set('class', cls);
  const { data, loading, error, reload } = useApi('/students?' + params.toString());
  if (error) return <ErrorBox error={error} onRetry={reload} />;
  if (!data) return <Loading rows={1} />;

  const counts = { High: 0, Medium: 0, Low: 0 };
  data.students.forEach((s) => counts[s.riskLevel]++);
  const shown = risk ? data.students.filter((s) => s.riskLevel === risk) : data.students;
  const LEVELS = [['', 'All', data.students.length], ['High', 'High risk', counts.High], ['Medium', 'Medium risk', counts.Medium], ['Low', 'Low risk', counts.Low]];

  return (
    <div style={{ opacity: loading ? 0.65 : 1, transition: 'opacity .2s' }}>
      <PageHead title="Students">Sorted by risk, highest first. Select a student to see the full picture.</PageHead>

      <div className="panel">
        <div className="row">
          <div style={{ flex: '2 1 240px' }}><label htmlFor="q">Search by name</label><input id="q" type="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder="e.g. Meera" /></div>
          <div><label htmlFor="c">Class</label><select id="c" value={cls} onChange={(e) => setCls(e.target.value)}><option value="">All classes</option>{data.classes.map((c) => <option key={c}>{c}</option>)}</select></div>
        </div>
        <div className="chips mt" role="group" aria-label="Filter by risk level">
          {LEVELS.map(([v, label, n]) => <button key={label} className="chip" aria-pressed={risk === v} onClick={() => setRisk(v)}>{label}<span className="n">{n}</span></button>)}
        </div>
      </div>

      <div className="panel table-wrap">
        {shown.length === 0 ? <Empty title="No students match these filters" icon="search">Clear a filter or change the search.</Empty> : (
          <table>
            <thead><tr><th>Student</th><th>Attendance (4 wk)</th><th>Trend</th><th>Score (last 2)</th><th>Alerts</th><th>Risk</th><th /></tr></thead>
            <tbody>
              {shown.map((s) => (
                <tr key={s.id} className="click" onClick={() => openStudent(s.id)} tabIndex={0} onKeyDown={(e) => e.key === 'Enter' && openStudent(s.id)}>
                  <td><div className="cell-name"><Avatar name={s.name} /><div><strong>{s.name}</strong><small>Class {s.class}</small></div></div></td>
                  <td><div className="meter num"><span style={{ minWidth: 44 }}>{pct(s.recentAttendance)}</span><i style={{ '--w': `${s.recentAttendance ?? 0}%`, '--c': RISK_COLOR[s.riskLevel] }} /></div></td>
                  <td><Sparkline data={s.spark} color={RISK_COLOR[s.riskLevel]} /></td>
                  <td className="num">{pct(s.recentScore)}</td>
                  <td className="num">{s.alertCount || '—'}</td>
                  <td><RiskBadge level={s.riskLevel} /></td>
                  <td style={{ color: 'var(--faint)' }}><Icon name="back" style={{ transform: 'rotate(180deg)', width: 16 }} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
      <p className="note">{shown.length} student{shown.length === 1 ? '' : 's'} shown.</p>
    </div>
  );
}
