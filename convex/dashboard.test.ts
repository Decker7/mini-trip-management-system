/// <reference types="vite/client" />
import { convexTest } from 'convex-test';
import { expect, test } from 'vitest';
import { api } from './_generated/api';
import schema from './schema';
import { DASHBOARD_LIMITS } from './dashboard';

const modules = import.meta.glob('./**/*.ts');

const admin = { subject: 'user_admin', role: 'admin' as const };
const today = '2026-06-15';

test('getStats rejects an unauthenticated caller', async () => {
  const t = convexTest(schema, modules);
  await expect(t.query(api.dashboard.getStats, { today })).rejects.toThrow();
});

test('getStats reports Trip, Participant, and Payment Status counts', async () => {
  const t = convexTest(schema, modules);

  const { participantId } = await t.run(async (ctx) => {
    const upcomingTripId = await ctx.db.insert('trips', {
      name: 'Upcoming Trip',
      destination: 'Bali',
      startDate: '2026-07-01',
      endDate: '2026-07-05',
      capacity: 10,
      createdBy: admin.subject
    });
    await ctx.db.insert('trips', {
      name: 'Ongoing Trip',
      destination: 'Tokyo',
      startDate: '2026-06-10',
      endDate: '2026-06-20',
      capacity: 10,
      createdBy: admin.subject
    });
    await ctx.db.insert('trips', {
      name: 'Completed Trip',
      destination: 'Cairo',
      startDate: '2026-01-01',
      endDate: '2026-01-05',
      capacity: 10,
      createdBy: admin.subject
    });

    const participantId = await ctx.db.insert('participants', {
      fullName: 'Jane Doe',
      icPassportNumber: 'A1234567',
      email: 'jane@example.com',
      phone: '0123456789'
    });
    const otherParticipantId = await ctx.db.insert('participants', {
      fullName: 'John Smith',
      icPassportNumber: 'B7654321',
      email: 'john@example.com',
      phone: '0198765432'
    });

    await ctx.db.insert('registrations', {
      tripId: upcomingTripId,
      participantId,
      paymentStatus: 'paid',
      registrationStatus: 'registered',
      registeredAt: 1,
      registeredBy: admin.subject
    });
    await ctx.db.insert('registrations', {
      tripId: upcomingTripId,
      participantId: otherParticipantId,
      paymentStatus: 'unpaid',
      registrationStatus: 'registered',
      registeredAt: 2,
      registeredBy: admin.subject
    });
    // A cancelled Registration no longer occupies a seat, so it's excluded
    // from the paid/unpaid split even though it still carries a status.
    await ctx.db.insert('registrations', {
      tripId: upcomingTripId,
      participantId: otherParticipantId,
      paymentStatus: 'paid',
      registrationStatus: 'cancelled',
      registeredAt: 3,
      registeredBy: admin.subject
    });

    return { participantId };
  });

  const stats = await t.withIdentity(admin).query(api.dashboard.getStats, { today });

  expect(stats).toMatchObject({
    tripCount: 3,
    upcomingTripCount: 1,
    participantCount: 2,
    paidRegistrationCount: 1,
    unpaidRegistrationCount: 1,
    tripCountTruncated: false,
    participantCountTruncated: false,
    paidRegistrationCountTruncated: false,
    unpaidRegistrationCountTruncated: false
  });
  expect(participantId).toBeDefined();
});

test('getStats does not report truncation for a Participant count sitting exactly on the cap', async () => {
  const t = convexTest(schema, modules);
  const limit = DASHBOARD_LIMITS.participants;

  await t.run(async (ctx) => {
    for (let i = 0; i < limit; i++) {
      await ctx.db.insert('participants', {
        fullName: `Participant ${i}`,
        icPassportNumber: `P${i}`,
        email: `p${i}@example.com`,
        phone: '0100000000'
      });
    }
  });

  const atCap = await t.withIdentity(admin).query(api.dashboard.getStats, { today });
  expect(atCap.participantCount).toBe(limit);
  expect(atCap.participantCountTruncated).toBe(false);

  await t.run(async (ctx) => {
    await ctx.db.insert('participants', {
      fullName: 'One Too Many',
      icPassportNumber: 'OVER',
      email: 'over@example.com',
      phone: '0100000001'
    });
  });

  const overCap = await t.withIdentity(admin).query(api.dashboard.getStats, { today });
  expect(overCap.participantCount).toBe(limit);
  expect(overCap.participantCountTruncated).toBe(true);
});
