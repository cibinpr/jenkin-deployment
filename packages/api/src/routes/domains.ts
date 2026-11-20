import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { db, audit } from '../db/index.js';
import { callHelper } from '../helper-client.js';
import { linuxUser, requireAuth } from '../lib/auth.js';

const DOMAIN_RE = /^(?=.{1,253}$)(?:(?!-)[a-z0-9-]{1,63}(?<!-)\.)+[a-z]{2,63}$/;
const createBody = z.object({
  name: z.string().max(253).transform((s) => s.trim().toLowerCase()).refine((s) => DOMAIN_RE.test(s), 'Invalid domain name'),
});
const sslBody = z.object({ email: z.string().email().max(254) });
const idParam = z.object({ id: z.coerce.number().int().positive() });

export async function domainRoutes(app: FastifyInstance) {
  app.addHook('preHandler', requireAuth);

  const owned = (id: number, userId: number, role: string) =>
    (role === 'admin'
      ? db.prepare('SELECT * FROM domains WHERE id = ?').get(id)
      : db.prepare('SELECT * FROM domains WHERE id = ? AND user_id = ?').get(id, userId)) as any;

  app.get('/api/domains', async (req) => {
    const u = req.user!;
    return u.role === 'admin'
      ? db.prepare('SELECT * FROM domains ORDER BY name').all()
      : db.prepare('SELECT * FROM domains WHERE user_id = ? ORDER BY name').all(u.id);
  });

  app.post('/api/domains', async (req, reply) => {
    const body = createBody.safeParse(req.body);
    if (!body.success) return reply.code(400).send({ error: body.error.issues[0]?.message });
    const u = req.user!;
    const name = body.data.name;
    if (db.prepare('SELECT 1 FROM domains WHERE name = ?').get(name)) return reply.code(409).send({ error: 'Domain already exists' });

    try {
      const res = await callHelper<{ root: string }>('create_domain', { user: linuxUser(u.id), domain: name });
      const info = db.prepare('INSERT INTO domains (user_id, name, web_root) VALUES (?,?,?)').run(u.id, name, res.root);
      audit(u.id, 'domain.create', name, req.ip, 'ok');
      return reply.code(201).send({ id: info.lastInsertRowid, name, web_root: res.root });
    } catch (e: any) {
      audit(u.id, 'domain.create', name, req.ip, 'error');
      return reply.code(500).send({ error: e.message });
    }
  });

  app.delete('/api/domains/:id', async (req, reply) => {
    const p = idParam.safeParse(req.params);
    if (!p.success) return reply.code(400).send({ error: 'Invalid id' });
    const u = req.user!;
    const d = owned(p.data.id, u.id, u.role);
    if (!d) return reply.code(404).send({ error: 'Not found' });
    try {
      await callHelper('remove_domain', { user: linuxUser(d.user_id), domain: d.name });
      db.prepare('DELETE FROM domains WHERE id = ?').run(d.id);
      audit(u.id, 'domain.delete', d.name, req.ip, 'ok');
      return { ok: true };
    } catch (e: any) {
      return reply.code(500).send({ error: e.message });
    }
  });

  app.post('/api/domains/:id/ssl', async (req, reply) => {
    const p = idParam.safeParse(req.params);
    const body = sslBody.safeParse(req.body);
    if (!p.success || !body.success) return reply.code(400).send({ error: 'Valid email required' });
    const u = req.user!;
    const d = owned(p.data.id, u.id, u.role);
    if (!d) return reply.code(404).send({ error: 'Not found' });
    try {
      await callHelper('issue_ssl', { user: linuxUser(d.user_id), domain: d.name, email: body.data.email });
      db.prepare("UPDATE domains SET ssl_status = 'active' WHERE id = ?").run(d.id);
      audit(u.id, 'ssl.issue', d.name, req.ip, 'ok');
      return { ok: true };
    } catch (e: any) {
      audit(u.id, 'ssl.issue', d.name, req.ip, 'error');
      return reply.code(500).send({ error: e.message });
    }
  });
}
