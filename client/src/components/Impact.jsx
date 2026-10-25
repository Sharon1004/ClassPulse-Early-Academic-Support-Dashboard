import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend, ReferenceLine } from 'recharts';
import { useApi } from '../api.js';
import { Loading, ErrorBox, Empty, Kpi, Avatar, PageHead, ChartTip, signed } from './ui.jsx';

export default function Impact({ openStudent }) {
  const { data, error, reload } = useApi('/impact');
  if (error) return <ErrorBox error={error} onRetry={reload} />;
  if (!data) return <Loading />;
  const { summary: s, items } = data;
  const measured = items.filter((i) => i.weeksSince > 0);
  const chart = measured.map((i) => ({ name: i.studentName.split(' ')[0], Attendance: i.attendanceChange, Score: i.scoreChange }));
  return (
    <div>
      <PageHead title="Support impact">How attendance and scores changed after each support plan started.</PageHead>
      {items.length === 0 ? <div className="panel"><Empty title="No support plans yet" icon="impact">Create a plan from a student’s profile to start tracking impact.</Empty></div> : (<>
        <div className="kpis">
          <Kpi label="Plans tracked" value={s.plans} />
          <Kpi label="With new data since start" value={s.measured} />
          <Kpi label="Improving" value={s.improving} tone="good" />
          <Kpi label="Avg attendance change" value={signed(s.avgAttendanceChange, ' pts')} />
          <Kpi label="Avg score change" value={signed(s.avgScoreChange, ' pts')} />
        </div>
        {chart.length > 0 && (
          <section className="panel"><div className="panel-head"><div><h2>Change since plan start, by student</h2><p>Percentage points, after versus before.</p></div></div>
            <ResponsiveContainer width="100%" height={280}>
              <BarChart data={chart} margin={{ left: -10, right: 8, top: 8 }} barGap={4}>
                <CartesianGrid vertical={false} /><XAxis dataKey="name" tickLine={false} axisLine={false} /><YAxis tickLine={false} axisLine={false} />
                <Tooltip content={<ChartTip unit=" pts" labelPrefix="" />} cursor={{ fill: 'var(--surface-2)' }} /><Legend iconType="circle" /><ReferenceLine y={0} stroke="var(--faint)" />
                <Bar dataKey="Attendance" fill="var(--brand)" radius={[6, 6, 0, 0]} /><Bar dataKey="Score" fill="var(--info)" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </section>
        )}
        <section className="panel table-wrap"><h2>All plans</h2>
          <table style={{ marginTop: 14 }}>
            <thead><tr><th>Student</th><th>Plan</th><th>Attendance</th><th>Score</th><th>Weeks of data</th><th>Outcome</th></tr></thead>
            <tbody>{items.map((i) => (
              <tr key={i.planId}>
                <td><div className="cell-name"><Avatar name={i.studentName} /><div><button className="link" onClick={() => openStudent(i.studentId)}>{i.studentName}</button><small>{i.studentClass}</small></div></div></td>
                <td>{i.title}<br /><span className="note">{i.status} · {i.followUps} follow-up{i.followUps === 1 ? '' : 's'}</span></td>
                <td className="num">{i.baseline.attendance ?? '—'}% → {i.current.attendance == null ? '—' : `${i.current.attendance}%`}<br /><span className="note">{signed(i.attendanceChange, ' pts')}</span></td>
                <td className="num">{i.baseline.score ?? '—'}% → {i.current.score == null ? '—' : `${i.current.score}%`}<br /><span className="note">{signed(i.scoreChange, ' pts')}</span></td>
                <td className="num">{i.weeksSince}</td><td><span className={`badge ${i.outcome}`}>{i.outcome.replace('_', ' ')}</span></td>
              </tr>))}
            </tbody>
          </table>
        </section>
        <p className="note">How this is measured: “before” is the average of the 3 weeks of attendance (and last 2 assessments) up to the plan start; “after” uses only data recorded after the start. Improving means attendance up 2+ points or scores up 3+ points. This shows association, not proof that the plan caused the change.</p>
      </>)}
    </div>
  );
}
