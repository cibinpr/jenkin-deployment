import net from 'node:net';
import fs from 'node:fs/promises';
import path from 'node:path';
import { config } from './config.js';
import { run } from './exec.js';
import { requestSchema } from './validate.js';
import { createDomain, issueSsl, removeDomain } from './actions/domains.js';
import { reloadNginx } from './actions/nginx.js';
import { fsOp } from './actions/fs.js';

const MAX_MSG = 8 * 1024 * 1024;

async function handle(raw: string) {
  let json: unknown;
  try {
    json = JSON.parse(raw);
  } catch {
    return { ok: false, error: 'Invalid JSON' };
  }
  const parsed = requestSchema.safeParse(json);
  if (!parsed.success) return { ok: false, error: 'Invalid request: ' + parsed.error.issues[0]?.message };
  const req = parsed.data;
  try {
    switch (req.action) {
      case 'create_domain': return { ok: true, data: await createDomain(req.params.user, req.params.domain) };
      case 'remove_domain': return { ok: true, data: await removeDomain(req.params.user, req.params.domain) };
      case 'issue_ssl': return { ok: true, data: await issueSsl(req.params.user, req.params.domain, req.params.email) };
      case 'reload_nginx': await reloadNginx(); return { ok: true, data: {} };
      case 'fs_op': return { ok: true, data: await fsOp(req.params) };
    }
  } catch (e: any) {
    console.error(`[helper] ${req.action} failed:`, e.message);
    return { ok: false, error: e.message };
  }
}

async function main() {
  if (process.getuid?.() !== 0 && !process.env.HELPER_ALLOW_NON_ROOT) {
    console.error('Helper must run as root (set HELPER_ALLOW_NON_ROOT=1 for local dev only).');
    process.exit(1);
  }
  const dir = path.dirname(config.socketPath);
  await fs.mkdir(dir, { recursive: true });
  await fs.rm(config.socketPath, { force: true });

  const server = net.createServer((sock) => {
    let buf = '';
    sock.setEncoding('utf8');
    sock.on('data', async (chunk) => {
      buf += chunk;
      if (buf.length > MAX_MSG) return sock.destroy();
      const nl = buf.indexOf('\n');
      if (nl === -1) return;
      const line = buf.slice(0, nl);
      buf = buf.slice(nl + 1);
      const res = await handle(line);
      sock.end(JSON.stringify(res) + '\n');
    });
    sock.on('error', () => {});
  });

  server.listen(config.socketPath, async () => {
    try {
      await run('chown', ['root:' + config.socketGroup, dir, config.socketPath]);
      await fs.chmod(dir, 0o750);
      await fs.chmod(config.socketPath, 0o660);
    } catch (e: any) {
      console.warn('[helper] could not set socket ownership:', e.message);
    }
    console.log(`[helper] listening on ${config.socketPath}`);
  });
}

main();
