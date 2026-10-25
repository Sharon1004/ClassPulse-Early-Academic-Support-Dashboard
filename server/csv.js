// CSV parsing and strict validation for imports.
// Format: name,class,week,attendance_pct[,score_pct]   (one row per student per week)
function parseCsv(text) {
  text = text.replace(/^\uFEFF/, '');
  const rows = [];
  let cells = [], cur = '', q = false, line = 1, rowLine = 1;
  const endRow = () => { cells.push(cur); if (cells.some((c) => c.trim() !== '')) rows.push({ line: rowLine, cells }); cells = []; cur = ''; };
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (q) {
      if (c === '"') { if (text[i + 1] === '"') { cur += '"'; i++; } else q = false; }
      else { if (c === '\n') line++; cur += c; }
    } else if (c === '"') q = true;
    else if (c === ',') { cells.push(cur); cur = ''; }
    else if (c === '\n' || c === '\r') {
      if (c === '\r' && text[i + 1] === '\n') i++;
      endRow(); line++; rowLine = line;
    } else cur += c;
  }
  if (cur !== '' || cells.length) endRow();
  return rows;
}

const key = (name, cls) => `${name.trim().toLowerCase()}|${cls.trim().toLowerCase()}`;
const MAX_ROWS = 5000;

function validateImport(text, existingStudents) {
  const report = { rowCount: 0, studentCount: 0, newStudents: 0, updatedStudents: 0, errorCount: 0, errors: [], preview: [] };
  const groups = new Map();
  const err = (line, message) => { report.errorCount++; if (report.errors.length < 50) report.errors.push({ line, message }); };

  const rows = parseCsv(String(text || ''));
  if (!rows.length) { err(0, 'The file is empty.'); return { report, groups }; }
  const header = rows[0].cells.map((h) => h.trim().toLowerCase());
  const missing = ['name', 'class', 'week', 'attendance_pct'].filter((h) => !header.includes(h));
  if (missing.length) { err(1, `Missing required column(s): ${missing.join(', ')}. Expected: name,class,week,attendance_pct,score_pct`); return { report, groups }; }
  if (rows.length - 1 > MAX_ROWS) { err(0, `Too many rows (${rows.length - 1}). The limit is ${MAX_ROWS}.`); return { report, groups }; }
  if (rows.length === 1) { err(0, 'The file has a header but no data rows.'); return { report, groups }; }

  const col = (n) => header.indexOf(n);
  const seen = new Set();
  for (const { line, cells } of rows.slice(1)) {
    report.rowCount++;
    if (cells.length !== header.length) { err(line, `Expected ${header.length} columns but found ${cells.length}.`); continue; }
    const name = cells[col('name')].trim();
    const cls = cells[col('class')].trim();
    const weekRaw = cells[col('week')].trim();
    const attRaw = cells[col('attendance_pct')].trim();
    const scRaw = col('score_pct') >= 0 ? cells[col('score_pct')].trim() : '';
    const before = report.errorCount;
    if (name.length < 2 || name.length > 60) err(line, 'name must be 2-60 characters.');
    else if (/^[=+\-@]/.test(name)) err(line, 'name must not start with = + - or @.');
    if (cls.length < 1 || cls.length > 20) err(line, 'class must be 1-20 characters.');
    const week = Number(weekRaw);
    if (weekRaw === '' || !Number.isInteger(week) || week < 1 || week > 60) err(line, `week must be a whole number from 1 to 60 (got "${weekRaw}").`);
    const att = Number(attRaw);
    if (attRaw === '' || !Number.isFinite(att) || att < 0 || att > 100) err(line, `attendance_pct must be a number from 0 to 100 (got "${attRaw}").`);
    let score = null;
    if (scRaw !== '') {
      score = Number(scRaw);
      if (!Number.isFinite(score) || score < 0 || score > 100) err(line, `score_pct must be empty or a number from 0 to 100 (got "${scRaw}").`);
    }
    if (report.errorCount > before) continue;
    const k = key(name, cls);
    if (seen.has(`${k}|${week}`)) { err(line, `Duplicate row for ${name} (${cls}), week ${week}.`); continue; }
    seen.add(`${k}|${week}`);
    if (!groups.has(k)) groups.set(k, { name, class: cls, records: new Map() });
    groups.get(k).records.set(week, { week, attendance: Math.round(att * 10) / 10, score: score == null ? null : Math.round(score * 10) / 10 });
  }

  const existing = new Set(existingStudents.map((s) => key(s.name, s.class)));
  report.studentCount = groups.size;
  for (const k of groups.keys()) existing.has(k) ? report.updatedStudents++ : report.newStudents++;
  report.preview = [...groups.values()].slice(0, 5).map((g) => ({ name: g.name, class: g.class, weeks: g.records.size }));
  return { report, groups };
}

module.exports = { parseCsv, validateImport, key };
