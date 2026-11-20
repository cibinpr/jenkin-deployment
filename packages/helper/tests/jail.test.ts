import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { resolveInJail } from '../src/jail.js';

let base: string, root: string;

beforeAll(async () => {
  base = await fs.mkdtemp(path.join(os.tmpdir(), 'jail-'));
  root = path.join(base, 'u1');
  await fs.mkdir(path.join(root, 'sub'), { recursive: true });
  await fs.mkdir(path.join(base, 'u1-evil'));
  await fs.writeFile(path.join(root, 'sub', 'a.txt'), 'x');
  await fs.symlink('/etc', path.join(root, 'link-to-etc'));
  await fs.symlink(path.join(base, 'u1-evil'), path.join(root, 'link-to-evil'));
});
afterAll(() => fs.rm(base, { recursive: true, force: true }));

describe('resolveInJail', () => {
  it('allows existing files', async () => {
    expect(await resolveInJail(root, '/sub/a.txt')).toBe(path.join(await fs.realpath(root), 'sub/a.txt'));
  });
  it('allows the root itself', async () => {
    expect(await resolveInJail(root, '/')).toBe(await fs.realpath(root));
  });
  it('allows new files in existing folders', async () => {
    await expect(resolveInJail(root, '/sub/new.txt')).resolves.toBeTruthy();
  });
  it('rejects ../ traversal', async () => {
    await expect(resolveInJail(root, '../../etc/passwd')).rejects.toThrow();
    await expect(resolveInJail(root, '/sub/../../u1-evil')).rejects.toThrow();
  });
  it('rejects symlink escapes', async () => {
    await expect(resolveInJail(root, '/link-to-etc/passwd')).rejects.toThrow();
    await expect(resolveInJail(root, '/link-to-evil')).rejects.toThrow();
  });
  it('rejects null bytes', async () => {
    await expect(resolveInJail(root, 'a\0b')).rejects.toThrow();
  });
  it('rejects shared-prefix sibling', async () => {
    await expect(resolveInJail(root, '../u1-evil/x')).rejects.toThrow();
  });
});
