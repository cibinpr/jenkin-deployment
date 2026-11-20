import { useEffect, useState } from 'react';
import { api } from '../api';

const join = (a: string, b: string) => (a.endsWith('/') ? a + b : a + '/' + b);
const parent = (p: string) => p.split('/').slice(0, -1).join('/') || '/';

export default function Files() {
  const [path, setPath] = useState('/');
  const [items, setItems] = useState<any[]>([]);
  const [editing, setEditing] = useState<{ path: string; content: string } | null>(null);
  const [err, setErr] = useState('');

  const load = (p = path) =>
    api(`/api/files/list?path=${encodeURIComponent(p)}`).then((r) => { setItems(r.items); setPath(r.path); setErr(''); }).catch((e) => setErr(e.message));
  useEffect(() => { load('/'); }, []);

  const act = (fn: () => Promise<unknown>) => fn().then(() => load()).catch((e) => setErr(e.message));

  async function open(it: any) {
    const full = join(path, it.name);
    if (it.type === 'dir') return load(full);
    const r = await api(`/api/files/read?path=${encodeURIComponent(full)}`).catch((e) => { setErr(e.message); return null; });
    if (r) setEditing({ path: full, content: r.content });
  }

  if (editing) {
    return (
      <>
        <div className="row"><strong>{editing.path}</strong><span className="spacer" />
          <button onClick={() => act(() => api('/api/files/write', 'PUT', editing).then(() => setEditing(null)))}>Save</button>
          <button onClick={() => setEditing(null)}>Cancel</button>
        </div>
        {err && <p className="err">{err}</p>}
        <textarea className="editor" value={editing.content} onChange={(e) => setEditing({ ...editing, content: e.target.value })} />
      </>
    );
  }

  return (
    <>
      <div className="row">
        <button disabled={path === '/'} onClick={() => load(parent(path))}>↑ Up</button>
        <code>{path}</code><span className="spacer" />
        <button onClick={() => { const n = prompt('Folder name:'); if (n) act(() => api('/api/files/mkdir', 'POST', { path: join(path, n) })); }}>New folder</button>
        <button onClick={() => { const n = prompt('File name:'); if (n) act(() => api('/api/files/write', 'PUT', { path: join(path, n), content: '' })); }}>New file</button>
      </div>
      {err && <p className="err">{err}</p>}
      <table>
        <thead><tr><th>Name</th><th>Size</th><th>Mode</th><th /></tr></thead>
        <tbody>
          {items.map((it) => (
            <tr key={it.name}>
              <td><a href="#" onClick={(e) => { e.preventDefault(); open(it); }}>{it.type === 'dir' ? '📁' : '📄'} {it.name}</a></td>
              <td>{it.type === 'dir' ? '' : it.size}</td><td>{it.mode}</td>
              <td className="actions">
                <button onClick={() => { const n = prompt('New name:', it.name); if (n) act(() => api('/api/files/rename', 'POST', { path: join(path, it.name), to: join(path, n) })); }}>Rename</button>
                <button className="danger" onClick={() => confirm(`Delete ${it.name}?`) && act(() => api(`/api/files?path=${encodeURIComponent(join(path, it.name))}`, 'DELETE'))}>Delete</button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </>
  );
}
