import type { FastifyInstance } from 'fastify';
import os from 'node:os';
import fs from 'node:fs/promises';
import { requireAuth } from '../lib/auth.js';

export async function statsRoutes(app: FastifyInstance) {
  app.get('/api/stats', { preHandler: requireAuth }, async () => {
    let disk: { total: number; free: number } | null = null;
    try {
      const s = await fs.statfs('/');
      disk = { total: s.blocks * s.bsize, free: s.bavail * s.bsize };
    } catch {}
    return {
      hostname: os.hostname(), uptime: os.uptime(), cpus: os.cpus().length,
      load: os.loadavg(), mem: { total: os.totalmem(), free: os.freemem() }, disk,
    };
  });
}
