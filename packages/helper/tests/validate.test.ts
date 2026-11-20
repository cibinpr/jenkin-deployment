import { describe, it, expect } from 'vitest';
import { requestSchema } from '../src/validate.js';

const ok = (d: string) => requestSchema.safeParse({ action: 'create_domain', params: { user: 'u_1', domain: d } }).success;

describe('domain validation', () => {
  it('accepts normal domains', () => {
    expect(ok('example.com')).toBe(true);
    expect(ok('Sub.Example.co.uk')).toBe(true);
  });
  it('rejects injection and junk', () => {
    for (const d of ['a.com; rm -rf /', '../x.com', 'a b.com', '-a.com', 'a.com\n', 'localhost', '$(id).com', 'a.com/../x'])
      expect(ok(d)).toBe(false);
  });
  it('rejects bad users', () => {
    expect(requestSchema.safeParse({ action: 'create_domain', params: { user: 'root', domain: 'a.com' } }).success).toBe(false);
  });
  it('rejects unknown actions', () => {
    expect(requestSchema.safeParse({ action: 'exec', params: { cmd: 'id' } }).success).toBe(false);
  });
});
