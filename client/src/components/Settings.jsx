import { useState, useEffect, useRef } from 'react';
import { api, useApi } from '../api.js';
import { Loading, ErrorBox, PageHead, useToast, useConfirm, RISK_COLOR } from './ui.jsx';
import { Icon } from './icons.jsx';

const FIELDS = [
  ['attendanceMin', 'Minimum attendance', 'Alert when the 4-week attendance average falls below this.', 0, 100, '%'],
  ['attendanceDrop', 'Attendance drop', 'Alert when attendance falls this far (last 3 weeks vs the 3 before).', 1, 50, ' pts'],
  ['scoreMin', 'Minimum score', 'Alert when the last 2 assessments average below this.', 0, 100, '%'],
  ['scoreDrop', 'Score drop', 'Alert when the assessment average falls this far versus the 2 before.', 1, 50, ' pts'],
];
const TEMPLATE = 'name,class,week,attendance_pct,score_pct\nAsha Example,9-A,1,95,78\nAsha Example,9-A,2,90,\nAsha Example,9-A,3,88,74\n';

const Delta = ({ now, was, goodWhenDown = true }) => {
  const d = now - was;
  if (!d) return <span className="delta same">no change</span>;
  const worse = goodWhenDown ? d > 0 : d < 0;
  return <span className={`delta ${worse ? 'up' : 'down'}`}>{d > 0 ? '+' : ''}{d}</span>;
};

/* What-if simulator: move a slider, see how many students would be flagged, before saving anything. */
function Thresholds({ isAdmin }) {
  const notify = useToast();
  const { data, error, reload } = useApi('/settings');
  const [form, setForm] = useState(null);
  const [preview, setPreview] = useState(null);
  const [busy, setBusy] = useState(false);
  const seq = useRef(0);
  useEffect(() => { if (data) setForm(data.thresholds); }, [data]);

  useEffect(() => {
    if (!form) return;
    const id = ++seq.current;
    const t = setTimeout(() => {
      api('/settings/preview', { method: 'POST', body: Object.fromEntries(FIELDS.map(([k]) => [k, Number(form[k])])) })
        .then((p) => id === seq.current && setPreview(p)).catch(() => {});
    }, 160);
    return () => clearTimeout(t);
  }, [form]);

  if (error) return <ErrorBox error={error} onRetry={reload} />;
  if (!form) return <Loading rows={1} />;
  const dirty = FIELDS.some(([k]) => Number(form[k]) !== data.thresholds[k]);
  const save = async () => {
    setBusy(true);
    try { await api('/settings', { method: 'PUT', body: Object.fromEntries(FIELDS.map(([k]) => [k, Number(form[k])])) }); notify('Thresholds saved. Alerts now use the new values.'); reload(); }
    catch (err) { notify(err.message, 'err'); } finally { setBusy(false); }
  };

  return (
    <section className="panel">
      <div className="panel-head"><div><h2>Alert thresholds</h2><p>Drag a slider to see what would change before you save. {isAdmin ? '' : 'Only administrators can save changes, but you can explore freely.'}</p></div></div>
      <div className="sim">
        <div>
          {FIELDS.map(([k, label, help, min, max, unit]) => (
            <div className="slider" key={k}>
              <div className="slider-top"><label htmlFor={k}>{label}</label><output htmlFor={k}>{form[k]}{unit}</output></div>
              <input id={k} type="range" min={min} max={max} step="1" value={form[k]} onChange={(e) => setForm({ ...form, [k]: Number(e.target.value) })} />
              <span className="note">{help}</span>
            </div>
          ))}
          <div className="plan-actions">
            {isAdmin && <button className="btn primary" disabled={busy || !dirty} onClick={save}>{busy ? 'Saving…' : 'Save thresholds'}</button>}
            <button className="btn" disabled={!dirty && JSON.stringify(form) === JSON.stringify(data.defaults)} onClick={() => setForm(data.defaults)}>Reset to defaults</button>
            {dirty && <button className="btn ghost" onClick={() => setForm(data.thresholds)}>Undo changes</button>}
          </div>
        </div>
        <aside className="sim-result" aria-live="polite">
          <h3>What would happen</h3>
          {!preview ? <p className="note">Calculating…</p> : (<>
            <p className="note">Of {preview.total} students:</p>
            {[['High', 'Needs attention'], ['Medium', 'Watch list'], ['Low', 'On track']].map(([lvl, label]) => (
              <div key={lvl} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', padding: '8px 0', borderBottom: '1px solid var(--line)' }}>
                <span><i style={{ display: 'inline-block', width: 10, height: 10, borderRadius: 3, background: RISK_COLOR[lvl], marginRight: 8 }} />{label}</span>
                <span><b className="num" style={{ fontFamily: 'var(--font-display)', fontSize: '1.3rem' }}>{preview.counts[lvl]}</b><Delta now={preview.counts[lvl]} was={preview.currentCounts[lvl]} goodWhenDown={lvl !== 'Low'} /></span>
              </div>
            ))}
            {preview.changedCount > 0 ? (<>
              <p className="note mt">{preview.changedCount} student{preview.changedCount === 1 ? '' : 's'} would change level:</p>
              <ul className="changes">{preview.changes.map((c) => <li key={c.id}><strong>{c.name}</strong><span className={`badge ${c.from.toLowerCase()}`}>{c.from}</span><Icon name="back" size={14} style={{ transform: 'rotate(180deg)' }} /><span className={`badge ${c.to.toLowerCase()}`}>{c.to}</span></li>)}</ul>
              {preview.changedCount > preview.changes.length && <p className="note">…and {preview.changedCount - preview.changes.length} more.</p>}
            </>) : <p className="note mt">No student would change level with these values.</p>}
          </>)}
        </aside>
      </div>
    </section>
  );
}

function Import() {
  const notify = useToast();
  const confirm = useConfirm();
  const [csv, setCsv] = useState('');
  const [fileName, setFileName] = useState('');
  const [report, setReport] = useState(null);
  const [mode, setMode] = useState('merge');
  const [busy, setBusy] = useState(false);
  const [over, setOver] = useState(false);

  const load = async (f) => {
    setReport(null);
    if (!f) return;
    if (f.size > 1_500_000) { notify('That file is larger than 1.5 MB.', 'err'); return; }
    setFileName(f.name); setCsv(await f.text());
  };
  const validate = async () => {
    setBusy(true);
    try { setReport((await api('/import/validate', { method: 'POST', body: { csv } })).report); } catch (e) { notify(e.message, 'err'); } finally { setBusy(false); }
  };
  const commit = async () => {
    if (mode === 'replace' && !(await confirm({ title: 'Replace all students?', body: 'This deletes every current student and support plan. It cannot be undone.', confirmLabel: 'Replace everything', danger: true }))) return;
    setBusy(true);
    try {
      const d = await api('/import/commit', { method: 'POST', body: { csv, mode } });
      notify(`Imported ${d.report.studentCount} students (${d.report.newStudents} new, ${d.report.updatedStudents} updated).`);
      setCsv(''); setFileName(''); setReport(null);
    } catch (e) { if (e.data?.report) setReport(e.data.report); notify(e.message, 'err'); } finally { setBusy(false); }
  };
  const download = () => {
    const url = URL.createObjectURL(new Blob([TEMPLATE], { type: 'text/csv' }));
    const a = Object.assign(document.createElement('a'), { href: url, download: 'classpulse_template.csv' }); a.click(); URL.revokeObjectURL(url);
  };
  const ok = report && report.errorCount === 0;
  return (
    <section className="panel">
      <div className="panel-head"><div><h2>Import student data (CSV)</h2><p>One row per student per week. Columns: name, class, week (1–60), attendance_pct (0–100), score_pct (0–100, may be empty). Use synthetic or properly consented data only.</p></div><button type="button" className="btn sm" onClick={download}><Icon name="download" />Download template</button></div>
      <label className={`drop ${over ? 'over' : ''}`} onDragOver={(e) => { e.preventDefault(); setOver(true); }} onDragLeave={() => setOver(false)} onDrop={(e) => { e.preventDefault(); setOver(false); load(e.dataTransfer.files[0]); }}>
        <input type="file" accept=".csv,text/csv" onChange={(e) => load(e.target.files[0])} />
        <Icon name="upload" size={26} />
        <strong>{fileName || 'Drop a CSV here, or select a file'}</strong>
        <span className="note">{fileName ? 'Choose another file to replace it.' : 'Maximum 1.5 MB.'}</span>
      </label>
      <div className="row mt">
        <div style={{ flex: '2 1 260px' }}><label htmlFor="m">If a student already exists</label><select id="m" value={mode} onChange={(e) => setMode(e.target.value)}><option value="merge">Merge: add or update weeks</option><option value="replace">Replace all students (deletes plans)</option></select></div>
        <button className="btn auto" disabled={!csv || busy} onClick={validate}>{busy ? 'Working…' : 'Validate file'}</button>
        <button className="btn primary auto" disabled={!ok || busy} onClick={commit}>Import {ok ? `${report.studentCount} students` : ''}</button>
      </div>
      {report && (
        <div style={{ marginTop: 16 }} role="status">
          <p><strong>{fileName}</strong>: {report.rowCount} rows read, {report.studentCount} students found{ok ? ` (${report.newStudents} new, ${report.updatedStudents} to update).` : '.'}</p>
          {ok ? <p style={{ color: 'var(--ok)', fontWeight: 600 }}>No problems found. You can import this file.</p> : (
            <>
              <p className="form-error">{report.errorCount} problem{report.errorCount === 1 ? '' : 's'} found. Fix the file and validate again.</p>
              <div className="table-wrap panel" style={{ marginBottom: 0 }}><table><thead><tr><th>Line</th><th>Problem</th></tr></thead><tbody>{report.errors.map((e, i) => <tr key={i}><td>{e.line || '—'}</td><td>{e.message}</td></tr>)}</tbody></table></div>
              {report.errorCount > report.errors.length && <p className="note">Showing the first {report.errors.length} problems.</p>}
            </>
          )}
        </div>
      )}
    </section>
  );
}

function Reseed() {
  const notify = useToast();
  const confirm = useConfirm();
  const [busy, setBusy] = useState(false);
  const run = async () => {
    if (!(await confirm({ title: 'Restore the demo data?', body: 'This replaces all current students and plans with fresh synthetic ones.', confirmLabel: 'Restore demo data', danger: true }))) return;
    setBusy(true);
    try { const d = await api('/admin/reseed', { method: 'POST' }); notify(`Demo data restored: ${d.students} students, ${d.plans} plans.`); } catch (e) { notify(e.message, 'err'); } finally { setBusy(false); }
  };
  return <section className="panel"><div className="panel-head"><div><h2>Demo data</h2><p>Restore the synthetic demo students and plans. This replaces all current students and plans.</p></div><button className="btn danger" disabled={busy} onClick={run}>{busy ? 'Restoring…' : 'Restore demo data'}</button></div></section>;
}

export default function Settings({ user }) {
  const isAdmin = user.role === 'admin';
  const { data } = useApi('/health');
  return (
    <div>
      <PageHead title="Settings & data">Storage: {data ? (data.storage === 'mongodb' ? 'MongoDB Atlas (data persists)' : 'local file (resets if the host restarts; see README to add MongoDB)') : 'checking…'}</PageHead>
      <Thresholds isAdmin={isAdmin} />
      {isAdmin ? <><Import /><Reseed /></> : <p className="note">CSV import and demo data tools are available to administrators.</p>}
    </div>
  );
}
