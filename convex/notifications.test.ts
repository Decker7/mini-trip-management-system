/// <reference types="vite/client" />
import { convexTest } from 'convex-test';
import { expect, test } from 'vitest';
import { api } from './_generated/api';
import schema from './schema';
import { NOTIFICATIONS_LIMIT } from './notifications';

const modules = import.meta.glob('./**/*.ts');

const admin = { subject: 'user_admin', role: 'admin' as const };
const staff = { subject: 'user_staff', role: 'staff' as const };
const otherStaff = { subject: 'user_other_staff', role: 'staff' as const };

const validTrip = {
  name: 'Bali Retreat',
  destination: 'Bali',
  startDate: '2026-09-10',
  endDate: '2026-09-15',
  capacity: 50
};

function participant(suffix: string) {
  return {
    fullName: `Jane Doe ${suffix}`,
    icPassportNumber: `A${suffix.padStart(7, '0')}`,
    email: `jane${suffix}@example.com`,
    phone: '+60123456789'
  };
}

async function seedTrip(t: ReturnType<typeof convexTest>) {
  return await t.withIdentity(admin).mutation(api.trips.create, validTrip);
}

test('list rejects an unauthenticated caller', async () => {
  const t = convexTest(schema, modules);
  await expect(t.query(api.notifications.list, {})).rejects.toThrow();
});

test('list rejects a signed-in caller with no role', async () => {
  const t = convexTest(schema, modules);
  const roleless = { subject: 'user_roleless' };
  await expect(t.withIdentity(roleless).query(api.notifications.list, {})).rejects.toThrow();
});

test('a new registration shows up as an unread notification', async () => {
  const t = convexTest(schema, modules);
  const tripId = await seedTrip(t);
  await t.withIdentity(staff).mutation(api.registrations.register, { tripId, ...participant('1') });

  const { notifications, truncated } = await t
    .withIdentity(staff)
    .query(api.notifications.list, {});

  expect(truncated).toBe(false);
  expect(notifications).toHaveLength(1);
  expect(notifications[0]).toMatchObject({
    tripId,
    tripName: 'Bali Retreat',
    participantName: 'Jane Doe 1',
    read: false
  });
});

test('markRead marks a notification read for that caller only', async () => {
  const t = convexTest(schema, modules);
  const tripId = await seedTrip(t);
  const registrationId = await t
    .withIdentity(staff)
    .mutation(api.registrations.register, { tripId, ...participant('1') });

  await t.withIdentity(staff).mutation(api.notifications.markRead, { registrationId });

  const asStaff = await t.withIdentity(staff).query(api.notifications.list, {});
  expect(asStaff.notifications[0].read).toBe(true);

  const asOtherStaff = await t.withIdentity(otherStaff).query(api.notifications.list, {});
  expect(asOtherStaff.notifications[0].read).toBe(false);
});

test('markRead is idempotent', async () => {
  const t = convexTest(schema, modules);
  const tripId = await seedTrip(t);
  const registrationId = await t
    .withIdentity(staff)
    .mutation(api.registrations.register, { tripId, ...participant('1') });

  const asStaff = t.withIdentity(staff);
  await asStaff.mutation(api.notifications.markRead, { registrationId });
  await asStaff.mutation(api.notifications.markRead, { registrationId });

  const rows = await t.run((ctx) => ctx.db.query('notificationReads').collect());
  expect(rows).toHaveLength(1);
});

test('markAllRead marks every notification in the feed as read for that caller', async () => {
  const t = convexTest(schema, modules);
  const tripId = await seedTrip(t);
  const asStaff = t.withIdentity(staff);
  await asStaff.mutation(api.registrations.register, { tripId, ...participant('1') });
  await asStaff.mutation(api.registrations.register, { tripId, ...participant('2') });

  await asStaff.mutation(api.notifications.markAllRead, {});

  const { notifications } = await asStaff.query(api.notifications.list, {});
  expect(notifications.every((n) => n.read)).toBe(true);
});

test('keeps the newest registrations and reports older ones as truncated', async () => {
  const t = convexTest(schema, modules);
  const tripId = await t.withIdentity(admin).mutation(api.trips.create, {
    ...validTrip,
    capacity: NOTIFICATIONS_LIMIT + 5
  });
  const asStaff = t.withIdentity(staff);

  for (let index = 0; index < NOTIFICATIONS_LIMIT + 1; index++) {
    await asStaff.mutation(api.registrations.register, {
      tripId,
      ...participant(String(index))
    });
  }

  const { notifications, truncated } = await asStaff.query(api.notifications.list, {});
  expect(truncated).toBe(true);
  expect(notifications).toHaveLength(NOTIFICATIONS_LIMIT);
  // Newest first: the very first Registration made is the one dropped.
  expect(notifications.map((n) => n.participantName)).not.toContain('Jane Doe 0');
});
