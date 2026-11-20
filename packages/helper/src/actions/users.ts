import fs from 'node:fs/promises';
import path from 'node:path';
import { config } from '../config.js';
import { run } from '../exec.js';

export const homeOf = (user: string) => path.join(config.homeBase, user);

export async function ensureUser(user: string): Promise<void> {
  try {
    await run('id', ['-u', user]);
  } catch {
    await run('useradd', ['--create-home', '--home-dir', homeOf(user), '--shell', '/usr/sbin/nologin', user]);
  }
  // nginx (www-data) must traverse the home dir but not list it
  await fs.chmod(homeOf(user), 0o711);
}

export async function idsOf(user: string): Promise<{ uid: number; gid: number }> {
  const st = await fs.stat(homeOf(user));
  return { uid: st.uid, gid: st.gid };
}
