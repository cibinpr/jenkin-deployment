import { useEffect, useState } from 'react';
import { api } from '../api';

const gb = (n: number) => (n / 1024 ** 3).toFixed(1) + ' GB';

export default function Dashboard() {
  const [s, setS] = useState<any>(null);
  useEffect(() => {
    const load = () => api('/api/stats').then(setS).catch(() => {});
    load();
    const t = setInterval(load, 5000);
    return () => clearInterval(t);
  }, []);
  if (!s) return <p>Loading…</p>;
  const memUsed = s.mem.total - s.mem.free;
  return (
    <div className="grid">
      <div className="card"><h3>Host</h3><p>{s.hostname}</p><p>{s.cpus} CPUs · up {(s.uptime / 3600).toFixed(1)} h</p></div>
      <div className="card"><h3>Load</h3><p>{s.load.map((l: number) => l.toFixed(2)).join(' · ')}</p></div>
      <div className="card"><h3>Memory</h3><p>{gb(memUsed)} / {gb(s.mem.total)}</p></div>
      {s.disk && <div className="card"><h3>Disk</h3><p>{gb(s.disk.total - s.disk.free)} / {gb(s.disk.total)}</p></div>}
    </div>
  );
}
