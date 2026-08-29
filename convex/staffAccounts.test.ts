/// <reference types="vite/client" />
import { convexTest } from 'convex-test';
import { afterEach, expect, test, vi } from 'vitest';
import { api } from './_generated/api';
import schema from './schema';

const modules = import.meta.glob('./**/*.ts');

const admin = { subject: 'user_admin', role: 'admin' as const };
const staff = { subject: 'user_staff', role: 'staff' as const };

const clerkUser = {
  id: 'user_clerk_1',
  first_name: 'Jane',
  last_name: 'Doe',
  email_addresses: [{ id: 'idn_1', email_address: 'jane@example.com' }],
  primary_email_address_id: 'idn_1',
  public_metadata: { role: 'staff' }
};

function mockFetchOnce(body: unknown, ok = true, status = 200) {
  return vi.fn().mockResolvedValueOnce({
    ok,
    status,
    text: async () => JSON.stringify(body),
    json: async () => body
  });
}

afterEach(() => {
  vi.unstubAllGlobals();
});

test('listUsers rejects an unauthenticated caller', async () => {
  const t = convexTest(schema, modules);
  await expect(t.action(api.staffAccounts.listUsers, {})).rejects.toThrow();
});

test('listUsers rejects a Staff identity', async () => {
  const t = convexTest(schema, modules);
  await expect(t.withIdentity(staff).action(api.staffAccounts.listUsers, {})).rejects.toThrow();
});

test('listUsers maps Clerk Users to Staff accounts for an Admin identity', async () => {
  const fetchMock = mockFetchOnce([clerkUser]);
  vi.stubGlobal('fetch', fetchMock);

  const t = convexTest(schema, modules);
  const users = await t.withIdentity(admin).action(api.staffAccounts.listUsers, {});

  expect(users).toEqual([
    { userId: 'user_clerk_1', fullName: 'Jane Doe', email: 'jane@example.com', role: 'staff' }
  ]);
  expect(fetchMock).toHaveBeenCalledWith(
    expect.stringContaining('/users?limit=500'),
    expect.objectContaining({
      headers: expect.objectContaining({ Authorization: expect.stringContaining('Bearer ') })
    })
  );
});

test('listUsers reports a null role for a User with no role assigned yet', async () => {
  vi.stubGlobal('fetch', mockFetchOnce([{ ...clerkUser, public_metadata: {} }]));

  const t = convexTest(schema, modules);
  const users = await t.withIdentity(admin).action(api.staffAccounts.listUsers, {});

  expect(users[0].role).toBeNull();
});

test('updateUserRole rejects a Staff identity', async () => {
  const t = convexTest(schema, modules);
  await expect(
    t
      .withIdentity(staff)
      .action(api.staffAccounts.updateUserRole, { userId: 'user_clerk_1', role: 'admin' })
  ).rejects.toThrow();
});

test('updateUserRole merges the new role into the existing publicMetadata', async () => {
  const getMock = mockFetchOnce({
    ...clerkUser,
    public_metadata: { role: 'staff', favoriteColor: 'blue' }
  });
  const patchMock = mockFetchOnce({});
  const fetchMock = vi.fn().mockImplementationOnce(getMock).mockImplementationOnce(patchMock);
  vi.stubGlobal('fetch', fetchMock);

  const t = convexTest(schema, modules);
  await t
    .withIdentity(admin)
    .action(api.staffAccounts.updateUserRole, { userId: 'user_clerk_1', role: 'admin' });

  expect(fetchMock).toHaveBeenCalledTimes(2);
  const [patchUrl, patchInit] = fetchMock.mock.calls[1];
  expect(patchUrl).toContain('/users/user_clerk_1');
  expect(patchInit).toMatchObject({ method: 'PATCH' });
  expect(JSON.parse(patchInit.body)).toEqual({
    public_metadata: { role: 'admin', favoriteColor: 'blue' }
  });
});

test('revokeStaffAccess rejects a Staff identity', async () => {
  const t = convexTest(schema, modules);
  await expect(
    t.withIdentity(staff).action(api.staffAccounts.revokeStaffAccess, { userId: 'user_clerk_1' })
  ).rejects.toThrow();
});

test('revokeStaffAccess rejects revoking an Admin account', async () => {
  vi.stubGlobal('fetch', mockFetchOnce({ ...clerkUser, public_metadata: { role: 'admin' } }));

  const t = convexTest(schema, modules);
  await expect(
    t.withIdentity(admin).action(api.staffAccounts.revokeStaffAccess, { userId: 'user_clerk_1' })
  ).rejects.toThrow();
});

test('revokeStaffAccess clears the role while preserving other publicMetadata', async () => {
  const getMock = mockFetchOnce({
    ...clerkUser,
    public_metadata: { role: 'staff', favoriteColor: 'blue' }
  });
  const patchMock = mockFetchOnce({});
  const fetchMock = vi.fn().mockImplementationOnce(getMock).mockImplementationOnce(patchMock);
  vi.stubGlobal('fetch', fetchMock);

  const t = convexTest(schema, modules);
  await t
    .withIdentity(admin)
    .action(api.staffAccounts.revokeStaffAccess, { userId: 'user_clerk_1' });

  const [patchUrl, patchInit] = fetchMock.mock.calls[1];
  expect(patchUrl).toContain('/users/user_clerk_1');
  expect(patchInit).toMatchObject({ method: 'PATCH' });
  expect(JSON.parse(patchInit.body)).toEqual({ public_metadata: { favoriteColor: 'blue' } });
});

test('inviteStaff rejects a Staff identity', async () => {
  const t = convexTest(schema, modules);
  await expect(
    t.withIdentity(staff).action(api.staffAccounts.inviteStaff, { emailAddress: 'a@example.com' })
  ).rejects.toThrow();
});

test('inviteStaff rejects a blank email address', async () => {
  const t = convexTest(schema, modules);
  await expect(
    t.withIdentity(admin).action(api.staffAccounts.inviteStaff, { emailAddress: '   ' })
  ).rejects.toThrow();
});

test('inviteStaff sends an invitation with the Staff role', async () => {
  const fetchMock = mockFetchOnce({});
  vi.stubGlobal('fetch', fetchMock);

  const t = convexTest(schema, modules);
  await t
    .withIdentity(admin)
    .action(api.staffAccounts.inviteStaff, { emailAddress: 'new@example.com' });

  const [url, init] = fetchMock.mock.calls[0];
  expect(url).toContain('/invitations');
  expect(init).toMatchObject({ method: 'POST' });
  expect(JSON.parse(init.body)).toEqual({
    email_address: 'new@example.com',
    public_metadata: { role: 'staff' }
  });
});
