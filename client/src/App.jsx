import { useState, useEffect, useCallback, useMemo } from 'react';
import { api, getToken, setToken, clearToken } from './api.js';
import { UIProvider, Loading, Avatar } from './components/ui.jsx';
import { Icon, LogoMark } from './components/icons.jsx';
import CommandPalette from './components/CommandPalette.jsx';
import Login from './components/Login.jsx';
import Dashboard from './components/Dashboard.jsx';
import Students from './components/Students.jsx';
import StudentProfile from './components/StudentProfile.jsx';
import PulsePath from './components/PulsePath.jsx';
import Impact from './components/Impact.jsx';
import Settings from './components/Settings.jsx';
import Assessments from './components/Assessments.jsx';
import StudentDashboard from './components/StudentDashboard.jsx';

const PAGES = [
  { id: 'dashboard', label: 'Dashboard', icon: 'dashboard' },
  { id: 'students', label: 'Students', icon: 'students' },
  { id: 'assessments', label: 'Assignments & tests', icon: 'assess' },
  { id: 'pulsepath', label: 'PulsePath plans', icon: 'plan' },
  { id: 'impact', label: 'Support impact', icon: 'impact' },
  { id: 'settings', label: 'Settings & data', icon: 'settings' },
];

/* ---- theme (light / dark), remembered per browser ---- */
function useTheme() {
  const read = () => { try { return localStorage.getItem('classpulse_theme'); } catch { return null; } };
  const [theme, setTheme] = useState(() => read() || (window.matchMedia?.('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'));
  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    try { localStorage.setItem('classpulse_theme', theme); } catch { /* private mode */ }
  }, [theme]);
  return [theme, useCallback(() => setTheme((t) => (t === 'dark' ? 'light' : 'dark')), [])];
}

/* ---- tiny hash router so refresh, back and shared links work ---- */
const parseHash = () => {
  const [page = 'dashboard', id] = window.location.hash.replace(/^#\/?/, '').split('/');
  return { page: page === 'student' && !id ? 'students' : page || 'dashboard', id };
};
function useRoute() {
  const [route, setRoute] = useState(parseHash);
  useEffect(() => {
    const on = () => { setRoute(parseHash()); window.scrollTo(0, 0); };
    window.addEventListener('hashchange', on);
    return () => window.removeEventListener('hashchange', on);
  }, []);
  const go = useCallback((page, id) => { window.location.hash = id ? `/${page}/${id}` : `/${page}`; }, []);
  return [route, go];
}

export default function App() {
  const [user, setUser] = useState(null);
  const [checking, setChecking] = useState(!!getToken());
  const [theme, toggleTheme] = useTheme();
  const [route, go] = useRoute();
  const [navOpen, setNavOpen] = useState(false);
  const [palette, setPalette] = useState(false);

  useEffect(() => {
    if (getToken()) api('/auth/me').then((d) => setUser(d.user)).catch(() => clearToken()).finally(() => setChecking(false));
    const out = () => setUser(null);
    window.addEventListener('classpulse-logout', out);
    return () => window.removeEventListener('classpulse-logout', out);
  }, []);

  useEffect(() => {
    const onKey = (e) => { if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') { e.preventDefault(); setPalette((p) => !p); } };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);
  useEffect(() => setNavOpen(false), [route.page, route.id]);

  const logout = () => { clearToken(); setUser(null); window.location.hash = ''; };
  const themeBtn = (
    <button className="icon-btn" onClick={toggleTheme} aria-label={theme === 'dark' ? 'Switch to light theme' : 'Switch to dark theme'} title="Toggle theme">
      <Icon name={theme === 'dark' ? 'sun' : 'moon'} />
    </button>
  );
  const pages = useMemo(() => PAGES, []);

  if (checking) return <UIProvider><div className="main"><Loading label="Checking your session…" /></div></UIProvider>;
  if (!user) return <UIProvider><Login themeButton={themeBtn} onLogin={(u, token) => { setToken(token); setUser(u); }} /></UIProvider>;

  if (user.role === 'student') {
    return (
      <UIProvider>
        <div className="student-shell">
          <nav className="student-topbar" aria-label="Student">
            <div className="brand"><LogoMark className="brand-mark" /><div><b>ClassPulse</b><small>My learning space</small></div></div>
            <div className="student-user"><span className="nm">{user.name}</span>{themeBtn}<button className="btn sm" onClick={logout}><Icon name="logout" />Sign out</button></div>
          </nav>
          <main className="student-main page"><StudentDashboard user={user} /></main>
        </div>
      </UIProvider>
    );
  }

  const active = route.page === 'student' ? 'students' : route.page;
  const openStudent = (id) => go('student', id);
  const known = PAGES.some((p) => p.id === route.page) || route.page === 'student';
  const page = known ? route.page : 'dashboard';
  const current = PAGES.find((p) => p.id === active);

  return (
    <UIProvider>
      <div className="app">
        <nav className={`side ${navOpen ? 'open' : ''}`} aria-label="Main">
          <a className="brand" href="#/dashboard"><LogoMark className="brand-mark" /><div><b>ClassPulse</b><small>Every learner, noticed early</small></div></a>
          {pages.map((p) => (
            <button key={p.id} className={`nav ${active === p.id ? 'active' : ''}`} onClick={() => go(p.id)} aria-current={active === p.id ? 'page' : undefined}>
              <Icon name={p.icon} />{p.label}
            </button>
          ))}
          <div className="side-foot">
            <div className="who"><Avatar name={user.name} /><div><strong>{user.name}</strong><span>{user.role === 'admin' ? 'Administrator' : 'Teacher'}</span></div></div>
            <button className="btn sm" onClick={logout}><Icon name="logout" />Sign out</button>
          </div>
        </nav>
        <div className={`scrim ${navOpen ? 'show' : ''}`} onClick={() => setNavOpen(false)} />

        <div className="workspace">
          <header className="topbar">
            <button className="icon-btn menu-btn" onClick={() => setNavOpen(true)} aria-label="Open menu"><Icon name="menu" /></button>
            <button className="search-trigger" onClick={() => setPalette(true)} aria-label="Search students and pages">
              <Icon name="search" /><span>Search students or jump to…</span><kbd>Ctrl K</kbd>
            </button>
            <div className="topbar-actions" aria-label={current?.label}>{themeBtn}</div>
          </header>
          <main className="main">
            <div className="page" key={`${page}-${route.id || ''}`}>
              {page === 'dashboard' && <Dashboard user={user} openStudent={openStudent} go={go} />}
              {page === 'students' && <Students openStudent={openStudent} />}
              {page === 'assessments' && <Assessments />}
              {page === 'student' && <StudentProfile id={route.id} back={() => go('students')} />}
              {page === 'pulsepath' && <PulsePath openStudent={openStudent} />}
              {page === 'impact' && <Impact openStudent={openStudent} />}
              {page === 'settings' && <Settings user={user} />}
            </div>
          </main>
        </div>
      </div>
      {palette && <CommandPalette pages={pages} go={go} onClose={() => setPalette(false)} onToggleTheme={toggleTheme} />}
    </UIProvider>
  );
}
