/// <reference types="vite/client" />
import { convexTest } from 'convex-test';
import { expect, test } from 'vitest';
import { api } from './_generated/api';
import schema from './schema';
import { DASHBOARD_LIMITS, ANALYTICS_LIMITS } from './dashboard';

const modules = import.meta.glob('./**/*.ts');

const admin = { subject: 'user_admin', role: 'admin' as const };
const today = '2026-06-15';

test('getStats rejects an unauthenticated caller', async () => {
  const t = convexTest(schema, modules);
  await expect(t.query(api.dashboard.getStats, { today })).rejects.toThrow();
});

test('getStats rejects a signed-in caller with no role (e.g. revoked access)', async () => {
  const t = convexTest(schema, modules);
  const revoked = { subject: 'user_revoked' };
  await expect(t.withIdentity(revoked).query(api.dashboard.getStats, { today })).rejects.toThrow();
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
      price: 100,
      createdBy: admin.subject
    });
    await ctx.db.insert('trips', {
      name: 'Ongoing Trip',
      destination: 'Tokyo',
      startDate: '2026-06-10',
      endDate: '2026-06-20',
      capacity: 10,
      price: 100,
      createdBy: admin.subject
    });
    await ctx.db.insert('trips', {
      name: 'Completed Trip',
      destination: 'Cairo',
      startDate: '2026-01-01',
      endDate: '2026-01-05',
      capacity: 10,
      price: 100,
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

test('getAnalytics rejects an unauthenticated caller', async () => {
  const t = convexTest(schema, modules);
  await expect(t.query(api.dashboard.getAnalytics, { today })).rejects.toThrow();
});

const DAY_MS = 24 * 60 * 60 * 1000;
const todayMs = Date.parse(`${today}T00:00:00.000Z`);

test('getAnalytics computes payment breakdown, fill rates, upcoming trips, staff activity, and recent activity', async () => {
  const t = convexTest(schema, modules);
  const staffA = { subject: 'user_staff_a', role: 'staff' as const };
  const staffB = { subject: 'user_staff_b', role: 'staff' as const };

  const { almostFullTripId, upcomingTripId, laterUpcomingTripId, completedTripId, registrationId } =
    await t.run(async (ctx) => {
      const almostFullTripId = await ctx.db.insert('trips', {
        name: 'Almost Full Trip',
        destination: 'Bali',
        startDate: '2026-07-01',
        endDate: '2026-07-05',
        capacity: 2,
        price: 100,
        createdBy: admin.subject
      });
      const upcomingTripId = await ctx.db.insert('trips', {
        name: 'Soonest Upcoming Trip',
        destination: 'Tokyo',
        startDate: '2026-06-20',
        endDate: '2026-06-25',
        capacity: 10,
        price: 100,
        createdBy: admin.subject
      });
      const laterUpcomingTripId = await ctx.db.insert('trips', {
        name: 'Later Upcoming Trip',
        destination: 'Seoul',
        startDate: '2026-08-01',
        endDate: '2026-08-05',
        capacity: 10,
        price: 100,
        createdBy: admin.subject
      });
      const completedTripId = await ctx.db.insert('trips', {
        name: 'Completed Trip',
        destination: 'Cairo',
        startDate: '2026-01-01',
        endDate: '2026-01-05',
        capacity: 2,
        price: 100,
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

      // Fills the Almost Full Trip to 1/2 -> 50% fill rate, registered by Staff A.
      // Starts unpaid so the paymentStatus mutation below actually logs a change.
      const registrationId = await ctx.db.insert('registrations', {
        tripId: almostFullTripId,
        participantId,
        paymentStatus: 'unpaid',
        registrationStatus: 'registered',
        registeredAt: todayMs,
        registeredBy: staffA.subject
      });
      // Registered by Staff B, still active -> counts toward staff activity and
      // the unpaid slice of the payment breakdown.
      await ctx.db.insert('registrations', {
        tripId: upcomingTripId,
        participantId: otherParticipantId,
        paymentStatus: 'unpaid',
        registrationStatus: 'registered',
        registeredAt: todayMs - 3 * DAY_MS,
        registeredBy: staffB.subject
      });
      // Cancelled -> excluded from payment breakdown, fill rate, and staff activity.
      await ctx.db.insert('registrations', {
        tripId: completedTripId,
        participantId: otherParticipantId,
        paymentStatus: 'refunded',
        registrationStatus: 'cancelled',
        registeredAt: todayMs - 20 * DAY_MS,
        registeredBy: staffA.subject
      });

      return {
        almostFullTripId,
        upcomingTripId,
        laterUpcomingTripId,
        completedTripId,
        registrationId
      };
    });

  await t.withIdentity(admin).mutation(api.registrations.setPaymentStatus, {
    registrationId,
    paymentStatus: 'paid'
  });

  const analytics = await t.withIdentity(admin).query(api.dashboard.getAnalytics, { today });

  expect(analytics.paymentBreakdown).toEqual({ paid: 1, unpaid: 1, refunded: 0 });

  // Completed Trip is excluded even though it's the fullest (1/2 seats, cancelled
  // registration aside it's actually 0 active seats — but the point is it never
  // appears at all once completed).
  expect(analytics.tripFillRates.map((t) => t.tripId)).not.toContain(completedTripId);
  expect(analytics.tripFillRates[0]).toMatchObject({
    tripId: almostFullTripId,
    registered: 1,
    capacity: 2,
    fillRate: 0.5
  });

  // Almost Full Trip (2026-07-01) also qualifies as upcoming and sorts
  // between the other two by start date.
  expect(analytics.upcomingTrips.map((t) => t.tripId)).toEqual([
    upcomingTripId,
    almostFullTripId,
    laterUpcomingTripId
  ]);

  expect(analytics.staffActivity).toEqual(
    expect.arrayContaining([
      { staffId: staffA.subject, count: 1 },
      { staffId: staffB.subject, count: 1 }
    ])
  );

  // registeredAt=todayMs, setPaymentStatus logged after -> the payment status
  // change is the newest Activity Log entry.
  expect(analytics.recentActivity[0]).toMatchObject({
    field: 'paymentStatus',
    oldValue: 'unpaid',
    newValue: 'paid',
    tripName: 'Almost Full Trip',
    participantName: 'Jane Doe'
  });

  // Bucketed into "today" and "3 days ago", both inside the 14-day window;
  // the 20-day-old Registration falls outside it and is not counted anywhere.
  const trendByDate = new Map(
    analytics.registrationTrend.map((bucket) => [bucket.date, bucket.count])
  );
  expect(analytics.registrationTrend).toHaveLength(14);
  expect(trendByDate.get(today)).toBe(1);
  expect(trendByDate.get(new Date(todayMs - 3 * DAY_MS).toISOString().slice(0, 10))).toBe(1);
  expect([...trendByDate.values()].reduce((sum, count) => sum + count, 0)).toBe(2);
});

test('getAnalytics does not report truncation for a Trip count sitting exactly on the cap', async () => {
  const t = convexTest(schema, modules);
  const limit = ANALYTICS_LIMITS.trips;

  await t.run(async (ctx) => {
    for (let i = 0; i < limit; i++) {
      await ctx.db.insert('trips', {
        name: `Trip ${i}`,
        destination: 'Somewhere',
        startDate: '2026-07-01',
        endDate: '2026-07-05',
        capacity: 10,
        price: 100,
        createdBy: admin.subject
      });
    }
  });

  const atCap = await t.withIdentity(admin).query(api.dashboard.getAnalytics, { today });
  expect(atCap.tripsTruncated).toBe(false);

  await t.run(async (ctx) => {
    await ctx.db.insert('trips', {
      name: 'One Too Many',
      destination: 'Somewhere Else',
      startDate: '2026-07-01',
      endDate: '2026-07-05',
      capacity: 10,
      price: 100,
      createdBy: admin.subject
    });
  });

  const overCap = await t.withIdentity(admin).query(api.dashboard.getAnalytics, { today });
  expect(overCap.tripsTruncated).toBe(true);
});

test('getAnalytics only returns staffActivity to an Admin, never to Staff', async () => {
  const t = convexTest(schema, modules);
  const staff = { subject: 'user_staff', role: 'staff' as const };

  await t.run(async (ctx) => {
    const tripId = await ctx.db.insert('trips', {
      name: 'Trip',
      destination: 'Somewhere',
      startDate: '2026-07-01',
      endDate: '2026-07-05',
      capacity: 10,
      price: 100,
      createdBy: admin.subject
    });
    const participantId = await ctx.db.insert('participants', {
      fullName: 'Jane Doe',
      icPassportNumber: 'A1234567',
      email: 'jane@example.com',
      phone: '0123456789'
    });
    await ctx.db.insert('registrations', {
      tripId,
      participantId,
      paymentStatus: 'unpaid',
      registrationStatus: 'registered',
      registeredAt: todayMs,
      registeredBy: staff.subject
    });
  });

  const asStaff = await t.withIdentity(staff).query(api.dashboard.getAnalytics, { today });
  expect(asStaff.staffActivity).toEqual([]);

  const asAdmin = await t.withIdentity(admin).query(api.dashboard.getAnalytics, { today });
  expect(asAdmin.staffActivity).toEqual([{ staffId: staff.subject, count: 1 }]);
});
