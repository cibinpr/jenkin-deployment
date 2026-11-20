import { useEffect, useState } from 'react';
import { api } from '../api';

export default function Domains() {
  const [list, setList] = useState<any[]>([]);
  const [name, setName] = useState('');
  const [msg, setMsg] = useState('');
  const load = () => api('/api/domains').then(setList);
  useEffect(() => { load(); }, []);

  const run = async (fn: () => Promise<unknown>, okMsg: string) => {
    setMsg('Working…');
    try { await fn(); setMsg(okMsg); await load(); } catch (e: any) { setMsg('Error: ' + e.message); }
  };

  return (
    <>
      <form className="row" onSubmit={(e) => { e.preventDefault(); run(() => api('/api/domains', 'POST', { name }), 'Domain added'); setName(''); }}>
        <input placeholder="example.com" value={name} onChange={(e) => setName(e.target.value)} />
        <button type="submit">Add domain</button>
      </form>
      {msg && <p>{msg}</p>}
      <table>
        <thead><tr><th>Domain</th><th>Web root</th><th>SSL</th><th /></tr></thead>
        <tbody>
          {list.map((d) => (
            <tr key={d.id}>
              <td>{d.name}</td><td><code>{d.web_root}</code></td><td>{d.ssl_status}</td>
              <td className="actions">
                <button onClick={() => {
                  const email = prompt('Email for Let\'s Encrypt notices:');
                  if (email) run(() => api(`/api/domains/${d.id}/ssl`, 'POST', { email }), 'SSL issued');
                }}>Get SSL</button>
                <button className="danger" onClick={() => confirm(`Remove ${d.name}? Files are kept.`) && run(() => api(`/api/domains/${d.id}`, 'DELETE'), 'Removed')}>Remove</button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </>
  );
}
