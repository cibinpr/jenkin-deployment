import { describe, it, expect } from 'vitest';

describe('passwords', () => {
  it('hashes and verifies', async () => {
    process.env.PANEL_DB = ':memory:';
    const { hashPassword, verifyPassword } = await import('./auth.js');
    const h = await hashPassword('correct horse battery');
    expect(await verifyPassword(h, 'correct horse battery')).toBe(true);
    expect(await verifyPassword(h, 'wrong')).toBe(false);
  });
});
