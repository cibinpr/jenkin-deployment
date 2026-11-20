import { z } from 'zod';

export const DOMAIN_RE = /^(?=.{1,253}$)(?:(?!-)[a-z0-9-]{1,63}(?<!-)\.)+[a-z]{2,63}$/;

export const domainSchema = z
  .string()
  .max(253)
  .transform((s) => s.toLowerCase())
  .refine((s) => DOMAIN_RE.test(s), 'Invalid domain');

export const linuxUserSchema = z.string().regex(/^u_[0-9]{1,9}$/, 'Invalid user');
export const emailSchema = z.string().max(254).regex(/^[^\s@'"`$\\;|&<>]+@[^\s@'"`$\\;|&<>]+\.[a-z]{2,}$/i);
export const relPathSchema = z.string().max(4096).refine((p) => !p.includes('\0'), 'Invalid path');

export const requestSchema = z.discriminatedUnion('action', [
  z.object({ action: z.literal('create_domain'), params: z.object({ user: linuxUserSchema, domain: domainSchema }) }),
  z.object({ action: z.literal('remove_domain'), params: z.object({ user: linuxUserSchema, domain: domainSchema }) }),
  z.object({
    action: z.literal('issue_ssl'),
    params: z.object({ user: linuxUserSchema, domain: domainSchema, email: emailSchema }),
  }),
  z.object({ action: z.literal('reload_nginx'), params: z.object({}).default({}) }),
  z.object({
    action: z.literal('fs_op'),
    params: z.discriminatedUnion('op', [
      z.object({ op: z.literal('list'), user: linuxUserSchema, path: relPathSchema }),
      z.object({ op: z.literal('read'), user: linuxUserSchema, path: relPathSchema }),
      z.object({ op: z.literal('write'), user: linuxUserSchema, path: relPathSchema, content: z.string().max(5 * 1024 * 1024) }),
      z.object({ op: z.literal('mkdir'), user: linuxUserSchema, path: relPathSchema }),
      z.object({ op: z.literal('delete'), user: linuxUserSchema, path: relPathSchema }),
      z.object({ op: z.literal('rename'), user: linuxUserSchema, path: relPathSchema, to: relPathSchema }),
    ]),
  }),
]);

export type HelperRequest = z.infer<typeof requestSchema>;
