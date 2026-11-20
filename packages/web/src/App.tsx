import { useEffect, useState } from 'react';
import { api } from './api';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import Domains from './pages/Domains';
import Files from './pages/Files';

type User = { id: number; username: string; role: string };
const tabs = ['Dashboard', 'Domains', 'Files'] as const;

export default function App() {
  const [user, setUser] = useState<User | null>(null);
  const [ready, setReady] = useState(false);
  const [tab, setTab] = useState<(typeof tabs)[number]>('Dashboard');

  useEffect(() => {
    api('/api/auth/me').then(setUser).catch(() => {}).finally(() => setReady(true));
  }, []);

  if (!ready) return null;
  if (!user) return <Login onLogin={setUser} />;

  return (
    <div className="shell">
      <header>
        <strong>MyPanel</strong>
        <nav>
          {tabs.map((t) => (
            <button key={t} className={t === tab ? 'active' : ''} onClick={() => setTab(t)}>{t}</button>
          ))}
        </nav>
        <span className="spacer" />
        <span>{user.username}</span>
        <button onClick={() => api('/api/auth/logout', 'POST').then(() => setUser(null))}>Log out</button>
      </header>
      <main>
        {tab === 'Dashboard' && <Dashboard />}
        {tab === 'Domains' && <Domains />}
        {tab === 'Files' && <Files />}
      </main>
    </div>
  );
}
