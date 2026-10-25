import { useEffect, useMemo, useRef, useState } from 'react';
import { api } from '../api.js';
import { Icon } from './icons.jsx';
import { Avatar } from './ui.jsx';

// Ctrl/⌘+K quick switcher: jump to any page or open any student.
export default function CommandPalette({ pages, go, onClose, onToggleTheme }) {
  const [q, setQ] = useState('');
  const [students, setStudents] = useState([]);
  const [i, setI] = useState(0);
  const listRef = useRef(null);

  useEffect(() => { api('/students').then((d) => setStudents(d.students)).catch(() => {}); }, []);

  const items = useMemo(() => {
    const t = q.trim().toLowerCase();
    const nav = pages.filter((p) => !t || p.label.toLowerCase().includes(t)).map((p) => ({ key: `p-${p.id}`, group: 'Go to', icon: p.icon, label: p.label, run: () => go(p.id) }));
    const act = [{ key: 'theme', group: 'Actions', icon: 'moon', label: 'Switch light / dark theme', run: onToggleTheme }].filter((a) => !t || a.label.toLowerCase().includes(t) || 'theme dark light'.includes(t));
    const stu = students.filter((s) => t && (s.name.toLowerCase().includes(t) || s.class.toLowerCase().includes(t))).slice(0, 8)
      .map((s) => ({ key: `s-${s.id}`, group: 'Students', student: s, label: s.name, hint: `${s.class} · ${s.riskLevel} risk`, run: () => go('student', s.id) }));
    return [...stu, ...nav, ...act];
  }, [q, students, pages, go, onToggleTheme]);

  useEffect(() => setI(0), [q]);
  useEffect(() => { listRef.current?.querySelector('[aria-selected="true"]')?.scrollIntoView({ block: 'nearest' }); }, [i]);

  const choose = (it) => { onClose(); it?.run(); };
  const onKey = (e) => {
    if (e.key === 'ArrowDown') { e.preventDefault(); setI((n) => Math.min(items.length - 1, n + 1)); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setI((n) => Math.max(0, n - 1)); }
    else if (e.key === 'Enter') { e.preventDefault(); choose(items[i]); }
    else if (e.key === 'Escape') onClose();
  };

  let last = '';
  return (
    <div className="overlay" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className="cmdk" role="dialog" aria-modal="true" aria-label="Quick search" onKeyDown={onKey}>
        <div className="cmdk-input">
          <Icon name="search" />
          <input autoFocus value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search students, or jump to a page…" aria-label="Search" role="combobox" aria-expanded="true" aria-controls="cmdk-list" />
          <kbd>Esc</kbd>
        </div>
        <div className="cmdk-list" id="cmdk-list" role="listbox" ref={listRef}>
          {items.length === 0 && <p className="note" style={{ padding: 16 }}>No match for “{q}”. Try a student’s first name or a class like 9-A.</p>}
          {items.map((it, idx) => {
            const head = it.group !== last ? <div className="cmdk-group" key={`g-${it.group}`}>{it.group}</div> : null;
            last = it.group;
            return [head,
              <button key={it.key} role="option" aria-selected={idx === i} className="cmdk-item" onMouseMove={() => setI(idx)} onClick={() => choose(it)}>
                {it.student ? <Avatar name={it.student.name} size="sm" /> : <Icon name={it.icon} />}
                <span>{it.label}</span>{it.hint && <small>{it.hint}</small>}
              </button>];
          })}
        </div>
        <div className="cmdk-foot"><span><kbd>↑</kbd> <kbd>↓</kbd> to move</span><span><kbd>Enter</kbd> to open</span></div>
      </div>
    </div>
  );
}
