import fs from 'node:fs';
import Fastify from 'fastify';
import cookie from '@fastify/cookie';
import rateLimit from '@fastify/rate-limit';
import fastifyStatic from '@fastify/static';
import { config } from './config.js';
import './db/index.js';
import { authRoutes } from './routes/auth.js';
import { domainRoutes } from './routes/domains.js';
import { fileRoutes } from './routes/files.js';
import { statsRoutes } from './routes/stats.js';

const app = Fastify({ logger: true, bodyLimit: 8 * 1024 * 1024, trustProxy: '127.0.0.1' });

await app.register(cookie);
await app.register(rateLimit, { max: 300, timeWindow: '1 minute' });

// Security headers
app.addHook('onSend', async (_req, reply) => {
  reply.header('X-Content-Type-Options', 'nosniff');
  reply.header('X-Frame-Options', 'DENY');
  reply.header('Referrer-Policy', 'same-origin');
  reply.header('Content-Security-Policy', "default-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:");
});

// CSRF defence (with SameSite=Strict cookies): state-changing calls need a custom header.
app.addHook('onRequest', async (req, reply) => {
  if (req.url.startsWith('/api/') && !['GET', 'HEAD', 'OPTIONS'].includes(req.method)) {
    if (req.headers['x-requested-with'] !== 'panel') return reply.code(403).send({ error: 'Missing CSRF header' });
  }
});

await app.register(authRoutes);
await app.register(domainRoutes);
await app.register(fileRoutes);
await app.register(statsRoutes);

if (fs.existsSync(config.webDist)) {
  await app.register(fastifyStatic, { root: config.webDist });
  app.setNotFoundHandler((req, reply) =>
    req.url.startsWith('/api/') ? reply.code(404).send({ error: 'Not found' }) : reply.sendFile('index.html'));
}

app.listen({ port: config.port, host: config.host });
