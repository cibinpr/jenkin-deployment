import fs from 'node:fs/promises';
import path from 'node:path';
import { config } from '../config.js';
import { run } from '../exec.js';

async function render(name: string, vars: Record<string, string>): Promise<string> {
  let tpl = await fs.readFile(path.join(config.templatesDir, name), 'utf8');
  for (const [k, v] of Object.entries(vars)) tpl = tpl.replaceAll(`{{${k}}}`, v);
  return tpl;
}

export async function writeVhost(domain: string, root: string, ssl: boolean): Promise<void> {
  const conf = await render(ssl ? 'nginx-vhost-ssl.conf' : 'nginx-vhost.conf', {
    DOMAIN: domain,
    ROOT: root,
    PHP_SOCKET: config.phpSocket,
  });
  const avail = path.join(config.nginxAvailable, `${domain}.conf`);
  const enabled = path.join(config.nginxEnabled, `${domain}.conf`);
  await fs.writeFile(avail, conf, { mode: 0o644 });
  await fs.rm(enabled, { force: true });
  await fs.symlink(avail, enabled);
}

export async function removeVhost(domain: string): Promise<void> {
  await fs.rm(path.join(config.nginxEnabled, `${domain}.conf`), { force: true });
  await fs.rm(path.join(config.nginxAvailable, `${domain}.conf`), { force: true });
}

/** Test config first; never reload a broken config. */
export async function reloadNginx(): Promise<void> {
  await run('nginx', ['-t']);
  await run('systemctl', ['reload', 'nginx']);
}
