import fs from 'node:fs/promises';
import path from 'node:path';

/**
 * Resolve `userPath` inside `root`. Throws if the final real path (after
 * following symlinks) escapes the root. For non-existent targets (create /
 * upload) the parent directory is checked instead.
 *
 * NOTE: this check has a TOCTOU window. The helper therefore also chowns
 * files to the site user and (TODO) should run fs ops in a child process
 * dropped to that uid/gid.
 */
export async function resolveInJail(root: string, userPath: string): Promise<string> {
  if (userPath.includes('\0')) throw new Error('Invalid path');

  const realRoot = await fs.realpath(root);
  const candidate = path.resolve(realRoot, userPath.replace(/^\/+/, ''));

  let real: string;
  try {
    real = await fs.realpath(candidate);
  } catch (e: any) {
    if (e.code !== 'ENOENT') throw e;
    const parent = await fs.realpath(path.dirname(candidate));
    real = path.join(parent, path.basename(candidate));
  }

  if (real !== realRoot && !real.startsWith(realRoot + path.sep)) {
    throw new Error('Path escapes jail');
  }
  return real;
}
