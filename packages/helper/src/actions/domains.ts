import fs from 'node:fs/promises';
import path from 'node:path';
import { run } from '../exec.js';
import { ensureUser, homeOf, idsOf } from './users.js';
import { reloadNginx, removeVhost, writeVhost } from './nginx.js';

const siteRoot = (user: string, domain: string) => path.join(homeOf(user), 'domains', domain, 'public_html');

export async function createDomain(user: string, domain: string) {
  await ensureUser(user);
  const root = siteRoot(user, domain);
  const { uid, gid } = await idsOf(user);
  await fs.mkdir(root, { recursive: true });
  // chown each level we may have created
  for (const dir of [path.dirname(path.dirname(root)), path.dirname(root), root]) {
    await fs.chown(dir, uid, gid);
    await fs.chmod(dir, 0o755);
  }
  const index = path.join(root, 'index.html');
  try {
    await fs.access(index);
  } catch {
    await fs.writeFile(index, `<!doctype html><title>${domain}</title><h1>${domain} is ready</h1>\n`);
    await fs.chown(index, uid, gid);
  }
  await writeVhost(domain, root, false);
  try {
    await reloadNginx();
  } catch (e) {
    await removeVhost(domain); // roll back so nginx stays healthy
    throw e;
  }
  return { root };
}

export async function removeDomain(user: string, domain: string) {
  await removeVhost(domain);
  await reloadNginx();
  // Site files are kept on purpose (safe default). Delete via file manager.
  return {};
}

export async function issueSsl(user: string, domain: string, email: string) {
  const root = siteRoot(user, domain);
  await run('certbot', [
    'certonly', '--webroot', '-w', root,
    '-d', domain, '-d', `www.${domain}`,
    '--non-interactive', '--agree-tos', '-m', email,
  ], 300_000);
  await writeVhost(domain, root, true);
  await reloadNginx();
  return {};
}
