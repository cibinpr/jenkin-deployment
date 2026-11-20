import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { audit } from '../db/index.js';
import { callHelper } from '../helper-client.js';
import { linuxUser, requireAuth } from '../lib/auth.js';

const path = z.string().min(1).max(4096);
const listQ = z.object({ path: z.string().max(4096).default('/') });
const writeB = z.object({ path, content: z.string().max(5 * 1024 * 1024) });
const pathB = z.object({ path });
const renameB = z.object({ path, to: path });

export async function fileRoutes(app: FastifyInstance) {
  app.addHook('preHandler', requireAuth);

  const op = async (req: any, reply: any, name: string, params: Record<string, unknown>, log = true) => {
    const u = req.user!;
    try {
      const data = await callHelper('fs_op', { op: name, user: linuxUser(u.id), ...params });
      if (log) audit(u.id, `file.${name}`, String(params.path), req.ip, 'ok');
      return data;
    } catch (e: any) {
      if (log) audit(u.id, `file.${name}`, String(params.path), req.ip, 'error');
      return reply.code(400).send({ error: e.message });
    }
  };
  const bad = (reply: any) => reply.code(400).send({ error: 'Invalid input' });

  app.get('/api/files/list', async (req, reply) => {
    const q = listQ.safeParse(req.query);
    return q.success ? op(req, reply, 'list', { path: q.data.path }, false) : bad(reply);
  });
  app.get('/api/files/read', async (req, reply) => {
    const q = pathB.safeParse(req.query);
    return q.success ? op(req, reply, 'read', q.data, false) : bad(reply);
  });
  app.put('/api/files/write', async (req, reply) => {
    const b = writeB.safeParse(req.body);
    return b.success ? op(req, reply, 'write', b.data) : bad(reply);
  });
  app.post('/api/files/mkdir', async (req, reply) => {
    const b = pathB.safeParse(req.body);
    return b.success ? op(req, reply, 'mkdir', b.data) : bad(reply);
  });
  app.post('/api/files/rename', async (req, reply) => {
    const b = renameB.safeParse(req.body);
    return b.success ? op(req, reply, 'rename', b.data) : bad(reply);
  });
  app.delete('/api/files', async (req, reply) => {
    const b = pathB.safeParse(req.query);
    return b.success ? op(req, reply, 'delete', b.data) : bad(reply);
  });
}
