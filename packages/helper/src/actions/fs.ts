import fs from 'node:fs/promises';
import path from 'node:path';
import { config } from '../config.js';
import { resolveInJail } from '../jail.js';
import { homeOf, idsOf } from './users.js';

type Op = import('../validate.js').HelperRequest & { action: 'fs_op' };

export async function fsOp(p: Op['params']) {
  const root = homeOf(p.user);
  const target = await resolveInJail(root, p.path);
  const { uid, gid } = await idsOf(p.user);
  const realRoot = await fs.realpath(root);

  switch (p.op) {
    case 'list': {
      const entries = await fs.readdir(target, { withFileTypes: true });
      const items = await Promise.all(
        entries.map(async (e) => {
          const st = await fs.lstat(path.join(target, e.name));
          return {
            name: e.name,
            type: e.isDirectory() ? 'dir' : e.isSymbolicLink() ? 'link' : 'file',
            size: st.size,
            mtime: st.mtimeMs,
            mode: (st.mode & 0o777).toString(8),
          };
        }),
      );
      items.sort((a, b) => (a.type === b.type ? a.name.localeCompare(b.name) : a.type === 'dir' ? -1 : 1));
      return { path: '/' + path.relative(realRoot, target), items };
    }
    case 'read': {
      const st = await fs.stat(target);
      if (!st.isFile()) throw new Error('Not a file');
      if (st.size > config.maxFileBytes) throw new Error('File too large to edit');
      return { content: await fs.readFile(target, 'utf8') };
    }
    case 'write': {
      await fs.writeFile(target, p.content, { mode: 0o644 });
      await fs.chown(target, uid, gid);
      return {};
    }
    case 'mkdir': {
      await fs.mkdir(target, { recursive: true });
      await fs.chown(target, uid, gid);
      return {};
    }
    case 'delete': {
      if (target === realRoot) throw new Error('Cannot delete home directory');
      await fs.rm(target, { recursive: true, force: false });
      return {};
    }
    case 'rename': {
      const dest = await resolveInJail(root, p.to);
      if (target === realRoot) throw new Error('Cannot move home directory');
      await fs.rename(target, dest);
      return {};
    }
  }
}
