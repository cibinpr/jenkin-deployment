import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { authenticator } from 'otplib';
import { db, audit } from '../db/index.js';
import { COOKIE, createSession, destroySession, hashPassword, requireAuth, setSessionCookie, verifyPassword } from '../lib/auth.js';

const loginBody = z.object({
  username: z.string().min(1).max(64),
  password: z.string().min(1).max(256),
  totp: z.string().regex(/^\d{6}$/).optional(),
});

// Hash of a random password, computed once, so unknown-user logins cost the same as real ones
const dummyHash = hashPassword(crypto.randomUUID());

export async function authRoutes(app: FastifyInstance) {
  app.post('/api/auth/login', { config: { rateLimit: { max: 5, timeWindow: '1 minute' } } }, async (req, reply) => {
    const body = loginBody.safeParse(req.body);
    if (!body.success) return reply.code(400).send({ error: 'Invalid input' });
    const { username, password, totp } = body.data;

    const user = db.prepare('SELECT * FROM users WHERE username = ?').get(username) as any;
    const valid = await verifyPassword(user?.password_hash ?? (await dummyHash), password);
    if (!user || !valid) {
      audit(user?.id ?? null, 'login', username, req.ip, 'fail');
      return reply.code(401).send({ error: 'Invalid credentials' });
    }
    if (user.totp_secret) {
      if (!totp) return reply.code(401).send({ error: 'TOTP required', totpRequired: true });
      if (!authenticator.check(totp, user.totp_secret)) {
        audit(user.id, 'login', username, req.ip, 'bad_totp');
        return reply.code(401).send({ error: 'Invalid code' });
      }
    }
    const s = createSession(user.id, req.ip, req.headers['user-agent'] ?? '');
    setSessionCookie(reply, s.token);
    audit(user.id, 'login', username, req.ip, 'ok');
    return { id: user.id, username: user.username, role: user.role };
  });

  app.post('/api/auth/logout', { preHandler: requireAuth }, async (req, reply) => {
    const t = req.cookies[COOKIE];
    if (t) destroySession(t);
    reply.clearCookie(COOKIE, { path: '/' });
    return { ok: true };
  });

  app.get('/api/auth/me', { preHandler: requireAuth }, async (req) => req.user);
}
