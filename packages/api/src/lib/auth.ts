import crypto from 'node:crypto';
import argon2 from 'argon2';
import type { FastifyReply, FastifyRequest } from 'fastify';
import { db } from '../db/index.js';
import { config } from '../config.js';

export const COOKIE = 'panel_session';
export type SessionUser = { id: number; username: string; role: 'admin' | 'client' };

declare module 'fastify' {
  interface FastifyRequest { user?: SessionUser }
}

const sha256 = (s: string) => crypto.createHash('sha256').update(s).digest('hex');

export const hashPassword = (pw: string) => argon2.hash(pw, { type: argon2.argon2id });
export const verifyPassword = (hash: string, pw: string) => argon2.verify(hash, pw).catch(() => false);

export function createSession(userId: number, ip: string, ua: string) {
  const token = crypto.randomBytes(32).toString('base64url');
  const expires = Date.now() + config.sessionHours * 3600_000;
  db.prepare('INSERT INTO sessions (id, user_id, expires_at, ip, user_agent) VALUES (?,?,?,?,?)').run(sha256(token), userId, expires, ip, ua.slice(0, 255));
  return { token, expires };
}

export function destroySession(token: string) {
  db.prepare('DELETE FROM sessions WHERE id = ?').run(sha256(token));
}

export function setSessionCookie(reply: FastifyReply, token: string) {
  reply.setCookie(COOKIE, token, {
    httpOnly: true, sameSite: 'strict', secure: config.secureCookies, path: '/', maxAge: config.sessionHours * 3600,
  });
}

export async function requireAuth(req: FastifyRequest, reply: FastifyReply) {
  const token = req.cookies[COOKIE];
  if (!token) return reply.code(401).send({ error: 'Not authenticated' });
  const row = db.prepare(
    `SELECT u.id, u.username, u.role, s.expires_at FROM sessions s JOIN users u ON u.id = s.user_id WHERE s.id = ?`,
  ).get(sha256(token)) as (SessionUser & { expires_at: number }) | undefined;
  if (!row || row.expires_at < Date.now()) return reply.code(401).send({ error: 'Session expired' });
  req.user = { id: row.id, username: row.username, role: row.role };
}

export const requireAdmin = async (req: FastifyRequest, reply: FastifyReply) => {
  await requireAuth(req, reply);
  if (!reply.sent && req.user?.role !== 'admin') return reply.code(403).send({ error: 'Forbidden' });
};

export const linuxUser = (userId: number) => `u_${userId}`;
