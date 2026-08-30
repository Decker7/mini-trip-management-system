/// <reference types="vite/client" />
import { convexTest } from 'convex-test';
import { expect, test } from 'vitest';
import { api } from './_generated/api';
import schema from './schema';
import { ACTIVITY_LOG_LIMIT } from './activityLogs';
import type { Id } from './_generated/dataModel';
import type { MutationCtx } from './_generated/server';

const modules = import.meta.glob('./**/*.ts');

const admin = { subject: 'user_admin', role: 'admin' as const };
const staff = { subject: 'user_staff', role: 'staff' as const };

const validTrip = {
  name: 'Bali Retreat',
  destination: 'Bali',
  startDate: '2026-09-10',
  endDate: '2026-09-15',
  capacity: 5,
  price: 300,
  description: 'A relaxing retreat'
};

const validParticipant = {
  fullName: 'Jane Doe',
  icPassportNumber: 'A1234567',
  email: 'jane@example.com',
  phone: '+60123456789'
};

/** Creates a Trip and registers one Participant onto it. */
async function seedRegistration(t: ReturnType<typeof convexTest>) {
  const tripId = await t.withIdentity(admin).mutation(api.trips.create, validTrip);
  const registrationId = await t
    .withIdentity(staff)
    .mutation(api.registrations.register, { tripId, ...validParticipant });
  return { tripId, registrationId };
}

async function readLog(t: ReturnType<typeof convexTest>, registrationId: Id<'registrations'>) {
  return await t.run((ctx: MutationCtx) =>
    ctx.db
      .query('activityLogs')
      .withIndex('by_registration_and_changedAt', (q) => q.eq('registrationId', registrationId))
      .collect()
  );
}

test('register does not record an Activity Log entry', async () => {
  const t = convexTest(schema, modules);
  const { registrationId } = await seedRegistration(t);

  expect(await readLog(t, registrationId)).toEqual([]);
});

test('setPaymentStatus records the field, both values, who changed it and when', async () => {
  const t = convexTest(schema, modules);
  const { registrationId } = await seedRegistration(t);

  const before = Date.now();
  await t
    .withIdentity(staff)
    .mutation(api.registrations.setPaymentStatus, { registrationId, paymentStatus: 'paid' });
  const after = Date.now();

  const entries = await readLog(t, registrationId);
  expect(entries).toHaveLength(1);
  expect(entries[0]).toMatchObject({
    registrationId,
    field: 'paymentStatus',
    oldValue: 'unpaid',
    newValue: 'paid',
    changedBy: staff.subject
  });
  expect(entries[0].changedAt).toBeGreaterThanOrEqual(before);
  expect(entries[0].changedAt).toBeLessThanOrEqual(after);
});

test('setPaymentStatus records one entry per change, not per call', async () => {
  const t = convexTest(schema, modules);
  const { registrationId } = await seedRegistration(t);

  const asStaff = t.withIdentity(staff);
  await asStaff.mutation(api.registrations.setPaymentStatus, {
    registrationId,
    paymentStatus: 'paid'
  });
  // Re-setting the same status changes nothing, so there is nothing to record.
  await asStaff.mutation(api.registrations.setPaymentStatus, {
    registrationId,
    paymentStatus: 'paid'
  });
  await asStaff.mutation(api.registrations.setPaymentStatus, {
    registrationId,
    paymentStatus: 'refunded'
  });

  const entries = await readLog(t, registrationId);
  expect(entries.map((entry) => [entry.oldValue, entry.newValue])).toEqual([
    ['unpaid', 'paid'],
    ['paid', 'refunded']
  ]);
});

test('cancel records a registrationStatus entry', async () => {
  const t = convexTest(schema, modules);
  const { registrationId } = await seedRegistration(t);

  await t.withIdentity(admin).mutation(api.registrations.cancel, { registrationId });

  const entries = await readLog(t, registrationId);
  expect(entries).toHaveLength(1);
  expect(entries[0]).toMatchObject({
    field: 'registrationStatus',
    oldValue: 'registered',
    newValue: 'cancelled',
    changedBy: admin.subject
  });
});

test('a rejected change records nothing', async () => {
  const t = convexTest(schema, modules);
  const { registrationId } = await seedRegistration(t);

  await t.withIdentity(staff).mutation(api.registrations.cancel, { registrationId });
  await expect(
    t.withIdentity(staff).mutation(api.registrations.cancel, { registrationId })
  ).rejects.toThrow();

  expect(await readLog(t, registrationId)).toHaveLength(1);
});

test('listByRegistration rejects an unauthenticated caller', async () => {
  const t = convexTest(schema, modules);
  const { registrationId } = await seedRegistration(t);

  await expect(t.query(api.activityLogs.listByRegistration, { registrationId })).rejects.toThrow();
});

test('listByRegistration rejects a signed-in caller with no role (e.g. revoked access)', async () => {
  const t = convexTest(schema, modules);
  const { registrationId } = await seedRegistration(t);
  const revoked = { subject: 'user_revoked' };

  await expect(
    t.withIdentity(revoked).query(api.activityLogs.listByRegistration, { registrationId })
  ).rejects.toThrow();
});

test('listByRegistration returns an empty history for an unchanged Registration', async () => {
  const t = convexTest(schema, modules);
  const { registrationId } = await seedRegistration(t);

  const result = await t
    .withIdentity(staff)
    .query(api.activityLogs.listByRegistration, { registrationId });
  expect(result).toEqual({ entries: [], truncated: false });
});

test("listByRegistration returns only this Registration's entries, newest first", async () => {
  const t = convexTest(schema, modules);
  const { registrationId } = await seedRegistration(t);

  const asStaff = t.withIdentity(staff);
  await asStaff.mutation(api.registrations.setPaymentStatus, {
    registrationId,
    paymentStatus: 'paid'
  });
  await asStaff.mutation(api.registrations.setPaymentStatus, {
    registrationId,
    paymentStatus: 'refunded'
  });
  await asStaff.mutation(api.registrations.cancel, { registrationId });

  const { entries, truncated } = await asStaff.query(api.activityLogs.listByRegistration, {
    registrationId
  });
  expect(truncated).toBe(false);
  expect(entries.map((entry) => [entry.field, entry.oldValue, entry.newValue])).toEqual([
    ['registrationStatus', 'registered', 'cancelled'],
    ['paymentStatus', 'paid', 'refunded'],
    ['paymentStatus', 'unpaid', 'paid']
  ]);
});

test("listByRegistration does not leak another Registration's history", async () => {
  const t = convexTest(schema, modules);
  const { tripId, registrationId } = await seedRegistration(t);
  const otherRegistrationId = await t.withIdentity(staff).mutation(api.registrations.register, {
    tripId,
    fullName: 'John Smith',
    icPassportNumber: 'B7654321',
    email: 'john@example.com',
    phone: '+60129876543'
  });

  await t
    .withIdentity(staff)
    .mutation(api.registrations.setPaymentStatus, { registrationId, paymentStatus: 'paid' });

  const { entries } = await t
    .withIdentity(staff)
    .query(api.activityLogs.listByRegistration, { registrationId: otherRegistrationId });
  expect(entries).toEqual([]);
});

test('listByRegistration keeps the newest entries and reports the older ones as truncated', async () => {
  const t = convexTest(schema, modules);
  const { registrationId } = await seedRegistration(t);

  const overflow = ACTIVITY_LOG_LIMIT + 1;
  await t.run(async (ctx) => {
    for (let index = 0; index < overflow; index++) {
      await ctx.db.insert('activityLogs', {
        registrationId,
        field: 'paymentStatus',
        oldValue: 'unpaid',
        newValue: String(index),
        changedBy: staff.subject,
        changedAt: index
      });
    }
  });

  const { entries, truncated } = await t
    .withIdentity(staff)
    .query(api.activityLogs.listByRegistration, { registrationId });
  expect(truncated).toBe(true);
  expect(entries).toHaveLength(ACTIVITY_LOG_LIMIT);
  // Newest first, and it is the *oldest* entry that was dropped.
  expect(entries[0].newValue).toBe(String(overflow - 1));
  expect(entries.at(-1)!.newValue).toBe(String(1));
});

test('listByRegistration does not report truncation for a history sitting exactly on the cap', async () => {
  const t = convexTest(schema, modules);
  const { registrationId } = await seedRegistration(t);

  await t.run(async (ctx) => {
    for (let index = 0; index < ACTIVITY_LOG_LIMIT; index++) {
      await ctx.db.insert('activityLogs', {
        registrationId,
        field: 'paymentStatus',
        oldValue: 'unpaid',
        newValue: String(index),
        changedBy: staff.subject,
        changedAt: index
      });
    }
  });

  const { entries, truncated } = await t
    .withIdentity(staff)
    .query(api.activityLogs.listByRegistration, { registrationId });
  expect(truncated).toBe(false);
  expect(entries).toHaveLength(ACTIVITY_LOG_LIMIT);
});
