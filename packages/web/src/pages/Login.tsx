import { useState } from 'react';
import { api } from '../api';

export default function Login({ onLogin }: { onLogin: (u: any) => void }) {
  const [username, setU] = useState('');
  const [password, setP] = useState('');
  const [totp, setT] = useState('');
  const [needTotp, setNeed] = useState(false);
  const [err, setErr] = useState('');

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setErr('');
    try {
      onLogin(await api('/api/auth/login', 'POST', { username, password, totp: totp || undefined }));
    } catch (e: any) {
      if (e.data?.totpRequired) setNeed(true);
      else setErr(e.message);
    }
  }

  return (
    <form className="card login" onSubmit={submit}>
      <h2>MyPanel</h2>
      <input placeholder="Username" value={username} onChange={(e) => setU(e.target.value)} autoFocus />
      <input placeholder="Password" type="password" value={password} onChange={(e) => setP(e.target.value)} />
      {needTotp && <input placeholder="6-digit code" value={totp} onChange={(e) => setT(e.target.value)} inputMode="numeric" />}
      {err && <p className="err">{err}</p>}
      <button type="submit">Sign in</button>
    </form>
  );
}
