import { convexTest } from 'convex-test';
import { expect, test } from 'vitest';
import schema from './schema';
import { api } from './_generated/api';

test('whoami returns null when unauthenticated', async () => {
  const t = convexTest(schema);
  const result = await t.query(api.users.whoami, {});
  expect(result).toBeNull();
});

test("whoami returns the caller's subject and role", async () => {
  const t = convexTest(schema);
  const asAdmin = t.withIdentity({ subject: 'user_123', role: 'admin' });
  const result = await asAdmin.query(api.users.whoami, {});
  expect(result).toEqual({ subject: 'user_123', role: 'admin' });
});
