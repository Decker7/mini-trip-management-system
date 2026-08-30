/// <reference types="vite/client" />
import { convexTest } from 'convex-test';
import { expect, test } from 'vitest';
import { api, internal } from './_generated/api';
import schema from './schema';
import { LIST_ALL_LIMITS, STRIPE_SYSTEM_ACTOR } from './registrations';

const modules = import.meta.glob('./**/*.ts');

const admin = { subject: 'user_admin', role: 'admin' as const };
const staff = { subject: 'user_staff', role: 'staff' as const };
// Signed in but no role assigned — matches an account whose Staff access was revoked.
const revoked = { subject: 'user_revoked' };

const validTrip = {
  name: 'Bali Retreat',
  destination: 'Bali',
  startDate: '2026-09-10',
  endDate: '2026-09-15',
  capacity: 2,
  price: 300,
  description: 'A relaxing retreat'
};

const validParticipant = {
  fullName: 'Jane Doe',
  icPassportNumber: 'A1234567',
  email: 'jane@example.com',
  phone: '+60123456789'
};

async function createTrip(
  t: ReturnType<typeof convexTest>,
  overrides: Partial<typeof validTrip> = {}
) {
  return t.withIdentity(admin).mutation(api.trips.create, { ...validTrip, ...overrides });
}

test('register rejects an unauthenticated caller', async () => {
  const t = convexTest(schema, modules);
  const tripId = await createTrip(t);
  await expect(
    t.mutation(api.registrations.register, { tripId, ...validParticipant })
  ).rejects.toThrow();
});

test('register rejects a signed-in caller with no role (e.g. revoked access)', async () => {
  const t = convexTest(schema, modules);
  const tripId = await createTrip(t);
  await expect(
    t.withIdentity(revoked).mutation(api.registrations.register, { tripId, ...validParticipant })
  ).rejects.toThrow();
});

test('register creates a Participant and an unpaid, registered Registration', async () => {
  const t = convexTest(schema, modules);
  const tripId = await createTrip(t);

  const registrationId = await t
    .withIdentity(staff)
    .mutation(api.registrations.register, { tripId, ...validParticipant });

  const registration = await t.run((ctx) => ctx.db.get(registrationId));
  expect(registration).toMatchObject({
    tripId,
    paymentStatus: 'unpaid',
    registrationStatus: 'registered',
    registeredBy: staff.subject
  });

  const participant = await t.run((ctx) => ctx.db.get(registration!.participantId));
  expect(participant).toMatchObject(validParticipant);
});

test('register reuses an existing Participant matched by icPassportNumber', async () => {
  const t = convexTest(schema, modules);
  const tripA = await createTrip(t, { name: 'Trip A' });
  const tripB = await createTrip(t, { name: 'Trip B' });

  const regA = await t
    .withIdentity(staff)
    .mutation(api.registrations.register, { tripId: tripA, ...validParticipant });
  const regB = await t
    .withIdentity(staff)
    .mutation(api.registrations.register, { tripId: tripB, ...validParticipant });

  const [registrationA, registrationB] = await Promise.all([
    t.run((ctx) => ctx.db.get(regA)),
    t.run((ctx) => ctx.db.get(regB))
  ]);
  expect(registrationA!.participantId).toEqual(registrationB!.participantId);

  const participantCount = await t.run((ctx) => ctx.db.query('participants').collect());
  expect(participantCount).toHaveLength(1);
});

test("register refreshes an existing Participant's contact details on reuse", async () => {
  const t = convexTest(schema, modules);
  const tripA = await createTrip(t, { name: 'Trip A' });
  const tripB = await createTrip(t, { name: 'Trip B' });

  const regA = await t
    .withIdentity(staff)
    .mutation(api.registrations.register, { tripId: tripA, ...validParticipant });

  const updatedDetails = {
    ...validParticipant,
    fullName: 'Jane D. Doe',
    email: 'jane.doe@example.com',
    phone: '+60199999999'
  };
  await t
    .withIdentity(staff)
    .mutation(api.registrations.register, { tripId: tripB, ...updatedDetails });

  const registrationA = await t.run((ctx) => ctx.db.get(regA));
  const participant = await t.run((ctx) => ctx.db.get(registrationA!.participantId));
  expect(participant).toMatchObject(updatedDetails);
});

test('register rejects a duplicate active Registration for the same Trip', async () => {
  const t = convexTest(schema, modules);
  const tripId = await createTrip(t);
  await t.withIdentity(staff).mutation(api.registrations.register, { tripId, ...validParticipant });

  await expect(
    t.withIdentity(staff).mutation(api.registrations.register, { tripId, ...validParticipant })
  ).rejects.toThrow();
});

test('register allows re-registering after the prior Registration was cancelled', async () => {
  const t = convexTest(schema, modules);
  const tripId = await createTrip(t);
  const firstId = await t
    .withIdentity(staff)
    .mutation(api.registrations.register, { tripId, ...validParticipant });
  await t.withIdentity(staff).mutation(api.registrations.cancel, { registrationId: firstId });

  await expect(
    t.withIdentity(staff).mutation(api.registrations.register, { tripId, ...validParticipant })
  ).resolves.toBeDefined();
});

test('register rejects once the Trip is at capacity', async () => {
  const t = convexTest(schema, modules);
  const tripId = await createTrip(t, { capacity: 1 });
  await t.withIdentity(staff).mutation(api.registrations.register, { tripId, ...validParticipant });

  await expect(
    t.withIdentity(staff).mutation(api.registrations.register, {
      tripId,
      ...validParticipant,
      icPassportNumber: 'B7654321'
    })
  ).rejects.toThrow();
});

test('register succeeds again once a cancellation frees a slot at capacity', async () => {
  const t = convexTest(schema, modules);
  const tripId = await createTrip(t, { capacity: 1 });
  const firstId = await t
    .withIdentity(staff)
    .mutation(api.registrations.register, { tripId, ...validParticipant });
  await t.withIdentity(staff).mutation(api.registrations.cancel, { registrationId: firstId });

  await expect(
    t.withIdentity(staff).mutation(api.registrations.register, {
      tripId,
      ...validParticipant,
      icPassportNumber: 'B7654321'
    })
  ).resolves.toBeDefined();
});

test('register rejects a missing full name or IC/passport number', async () => {
  const t = convexTest(schema, modules);
  const tripId = await createTrip(t);

  await expect(
    t
      .withIdentity(staff)
      .mutation(api.registrations.register, { tripId, ...validParticipant, fullName: '  ' })
  ).rejects.toThrow();

  await expect(
    t
      .withIdentity(staff)
      .mutation(api.registrations.register, { tripId, ...validParticipant, icPassportNumber: '' })
  ).rejects.toThrow();
});

test('register rejects a non-existent Trip', async () => {
  const t = convexTest(schema, modules);
  const tripId = await createTrip(t);
  await t.withIdentity(admin).mutation(api.trips.remove, { tripId });

  await expect(
    t.withIdentity(staff).mutation(api.registrations.register, { tripId, ...validParticipant })
  ).rejects.toThrow();
});

test('cancel rejects an unauthenticated caller', async () => {
  const t = convexTest(schema, modules);
  const tripId = await createTrip(t);
  const registrationId = await t
    .withIdentity(staff)
    .mutation(api.registrations.register, { tripId, ...validParticipant });

  await expect(t.mutation(api.registrations.cancel, { registrationId })).rejects.toThrow();
});

test('cancel rejects a signed-in caller with no role (e.g. revoked access)', async () => {
  const t = convexTest(schema, modules);
  const tripId = await createTrip(t);
  const registrationId = await t
    .withIdentity(staff)
    .mutation(api.registrations.register, { tripId, ...validParticipant });

  await expect(
    t.withIdentity(revoked).mutation(api.registrations.cancel, { registrationId })
  ).rejects.toThrow();
});

test('cancel rejects an already-cancelled Registration', async () => {
  const t = convexTest(schema, modules);
  const tripId = await createTrip(t);
  const registrationId = await t
    .withIdentity(staff)
    .mutation(api.registrations.register, { tripId, ...validParticipant });
  await t.withIdentity(staff).mutation(api.registrations.cancel, { registrationId });

  await expect(
    t.withIdentity(staff).mutation(api.registrations.cancel, { registrationId })
  ).rejects.toThrow();
});

test('cancel rejects a non-existent Registration', async () => {
  const t = convexTest(schema, modules);
  const tripId = await createTrip(t);
  const registrationId = await t
    .withIdentity(staff)
    .mutation(api.registrations.register, { tripId, ...validParticipant });
  await t.run((ctx) => ctx.db.delete(registrationId));

  await expect(
    t.withIdentity(staff).mutation(api.registrations.cancel, { registrationId })
  ).rejects.toThrow();
});

test('setPaymentStatus updates the Registration and rejects an unauthenticated caller', async () => {
  const t = convexTest(schema, modules);
  const tripId = await createTrip(t);
  const registrationId = await t
    .withIdentity(staff)
    .mutation(api.registrations.register, { tripId, ...validParticipant });

  await expect(
    t.mutation(api.registrations.setPaymentStatus, { registrationId, paymentStatus: 'paid' })
  ).rejects.toThrow();

  await t
    .withIdentity(staff)
    .mutation(api.registrations.setPaymentStatus, { registrationId, paymentStatus: 'paid' });
  const registration = await t.run((ctx) => ctx.db.get(registrationId));
  expect(registration!.paymentStatus).toBe('paid');

  await t
    .withIdentity(admin)
    .mutation(api.registrations.setPaymentStatus, { registrationId, paymentStatus: 'refunded' });
  const refunded = await t.run((ctx) => ctx.db.get(registrationId));
  expect(refunded!.paymentStatus).toBe('refunded');
});

test('setPaymentStatus rejects a signed-in caller with no role (e.g. revoked access)', async () => {
  const t = convexTest(schema, modules);
  const tripId = await createTrip(t);
  const registrationId = await t
    .withIdentity(staff)
    .mutation(api.registrations.register, { tripId, ...validParticipant });

  await expect(
    t
      .withIdentity(revoked)
      .mutation(api.registrations.setPaymentStatus, { registrationId, paymentStatus: 'paid' })
  ).rejects.toThrow();
});

test('setPaymentStatus rejects a non-existent Registration', async () => {
  const t = convexTest(schema, modules);
  const tripId = await createTrip(t);
  const registrationId = await t
    .withIdentity(staff)
    .mutation(api.registrations.register, { tripId, ...validParticipant });
  await t.run((ctx) => ctx.db.delete(registrationId));

  await expect(
    t
      .withIdentity(staff)
      .mutation(api.registrations.setPaymentStatus, { registrationId, paymentStatus: 'paid' })
  ).rejects.toThrow();
});

test('listByTrip rejects an unauthenticated caller and returns the joined roster', async () => {
  const t = convexTest(schema, modules);
  const tripId = await createTrip(t, { capacity: 5 });
  await t.withIdentity(staff).mutation(api.registrations.register, { tripId, ...validParticipant });
  await t.withIdentity(staff).mutation(api.registrations.register, {
    tripId,
    fullName: 'John Smith',
    icPassportNumber: 'C1111111',
    email: 'john@example.com',
    phone: '+60111111111'
  });

  await expect(t.query(api.registrations.listByTrip, { tripId })).rejects.toThrow();
  await expect(
    t.withIdentity(revoked).query(api.registrations.listByTrip, { tripId })
  ).rejects.toThrow();

  const roster = await t.withIdentity(staff).query(api.registrations.listByTrip, { tripId });
  expect(roster).toHaveLength(2);
  const names = roster.map((r) => r.fullName);
  expect(names).toContain('Jane Doe');
  expect(names).toContain('John Smith');
  expect(roster[0]).toMatchObject({
    paymentStatus: 'unpaid',
    registrationStatus: 'registered'
  });
});

test('listAll rejects an unauthenticated caller and returns every Registration across Trips', async () => {
  const t = convexTest(schema, modules);
  const tripA = await createTrip(t, { name: 'Bali Retreat' });
  const tripB = await createTrip(t, { name: 'Tokyo Tour' });

  await t
    .withIdentity(staff)
    .mutation(api.registrations.register, { tripId: tripA, ...validParticipant });
  await t.withIdentity(staff).mutation(api.registrations.register, {
    tripId: tripB,
    fullName: 'John Smith',
    icPassportNumber: 'C1111111',
    email: 'john@example.com',
    phone: '+60111111111'
  });

  await expect(t.query(api.registrations.listAll, {})).rejects.toThrow();
  await expect(t.withIdentity(revoked).query(api.registrations.listAll, {})).rejects.toThrow();

  const all = await t.withIdentity(staff).query(api.registrations.listAll, {});
  expect(all.truncated).toBe(false);
  expect(all.rows).toHaveLength(2);
  const byName = Object.fromEntries(all.rows.map((r) => [r.fullName, r.tripName]));
  expect(byName).toEqual({ 'Jane Doe': 'Bali Retreat', 'John Smith': 'Tokyo Tour' });
});

test('listAll filters by search across name and IC/passport number', async () => {
  const t = convexTest(schema, modules);
  const tripA = await createTrip(t, { name: 'Bali Retreat' });
  const tripB = await createTrip(t, { name: 'Tokyo Tour' });

  await t
    .withIdentity(staff)
    .mutation(api.registrations.register, { tripId: tripA, ...validParticipant });
  await t.withIdentity(staff).mutation(api.registrations.register, {
    tripId: tripB,
    fullName: 'John Smith',
    icPassportNumber: 'C1111111',
    email: 'john@example.com',
    phone: '+60111111111'
  });

  const byName = await t.withIdentity(staff).query(api.registrations.listAll, { search: 'jane' });
  expect(byName.rows.map((r) => r.fullName)).toEqual(['Jane Doe']);

  const byIc = await t.withIdentity(staff).query(api.registrations.listAll, { search: 'c1111111' });
  expect(byIc.rows.map((r) => r.fullName)).toEqual(['John Smith']);
});

test('listAll filters by tripId', async () => {
  const t = convexTest(schema, modules);
  const tripA = await createTrip(t, { name: 'Bali Retreat' });
  const tripB = await createTrip(t, { name: 'Tokyo Tour' });

  await t
    .withIdentity(staff)
    .mutation(api.registrations.register, { tripId: tripA, ...validParticipant });
  await t.withIdentity(staff).mutation(api.registrations.register, {
    tripId: tripB,
    fullName: 'John Smith',
    icPassportNumber: 'C1111111',
    email: 'john@example.com',
    phone: '+60111111111'
  });

  const forTripA = await t.withIdentity(staff).query(api.registrations.listAll, { tripId: tripA });
  expect(forTripA.rows.map((r) => r.fullName)).toEqual(['Jane Doe']);
});

test('listAll filters by payment status', async () => {
  const t = convexTest(schema, modules);
  const tripA = await createTrip(t, { name: 'Bali Retreat' });
  const tripB = await createTrip(t, { name: 'Tokyo Tour' });

  const regA = await t
    .withIdentity(staff)
    .mutation(api.registrations.register, { tripId: tripA, ...validParticipant });
  await t.withIdentity(staff).mutation(api.registrations.register, {
    tripId: tripB,
    fullName: 'John Smith',
    icPassportNumber: 'C1111111',
    email: 'john@example.com',
    phone: '+60111111111'
  });
  await t.withIdentity(staff).mutation(api.registrations.setPaymentStatus, {
    registrationId: regA,
    paymentStatus: 'paid'
  });

  const paid = await t
    .withIdentity(staff)
    .query(api.registrations.listAll, { paymentStatus: 'paid' });
  expect(paid.rows.map((r) => r.fullName)).toEqual(['Jane Doe']);
});

test('listAll returns every Trip a searched Participant is registered on', async () => {
  const t = convexTest(schema, modules);
  const tripA = await createTrip(t, { name: 'Bali Retreat' });
  const tripB = await createTrip(t, { name: 'Tokyo Tour' });

  await t
    .withIdentity(staff)
    .mutation(api.registrations.register, { tripId: tripA, ...validParticipant });
  await t
    .withIdentity(staff)
    .mutation(api.registrations.register, { tripId: tripB, ...validParticipant });

  const found = await t.withIdentity(staff).query(api.registrations.listAll, { search: 'jane' });
  expect(found.rows).toHaveLength(2);
  const tripNames = found.rows.map((r) => r.tripName);
  expect(tripNames).toContain('Bali Retreat');
  expect(tripNames).toContain('Tokyo Tour');
});

test('listAll combines search with a Trip filter', async () => {
  const t = convexTest(schema, modules);
  const tripA = await createTrip(t, { name: 'Bali Retreat' });
  const tripB = await createTrip(t, { name: 'Tokyo Tour' });

  await t
    .withIdentity(staff)
    .mutation(api.registrations.register, { tripId: tripA, ...validParticipant });
  await t
    .withIdentity(staff)
    .mutation(api.registrations.register, { tripId: tripB, ...validParticipant });

  const found = await t
    .withIdentity(staff)
    .query(api.registrations.listAll, { search: 'jane', tripId: tripB });
  expect(found.rows).toHaveLength(1);
  expect(found.rows[0]).toMatchObject({ fullName: 'Jane Doe', tripName: 'Tokyo Tour' });
});

test('listAll combines search with a Payment Status filter', async () => {
  const t = convexTest(schema, modules);
  const tripA = await createTrip(t, { name: 'Bali Retreat' });
  const tripB = await createTrip(t, { name: 'Tokyo Tour' });

  const regA = await t
    .withIdentity(staff)
    .mutation(api.registrations.register, { tripId: tripA, ...validParticipant });
  await t
    .withIdentity(staff)
    .mutation(api.registrations.register, { tripId: tripB, ...validParticipant });
  await t
    .withIdentity(staff)
    .mutation(api.registrations.setPaymentStatus, { registrationId: regA, paymentStatus: 'paid' });

  const found = await t
    .withIdentity(staff)
    .query(api.registrations.listAll, { search: 'jane', paymentStatus: 'paid' });
  expect(found.rows).toHaveLength(1);
  expect(found.rows[0]).toMatchObject({ tripName: 'Bali Retreat', paymentStatus: 'paid' });
});

test('listAll search matches on IC/passport substring, not just a prefix', async () => {
  const t = convexTest(schema, modules);
  const tripId = await createTrip(t);
  await t.withIdentity(staff).mutation(api.registrations.register, { tripId, ...validParticipant });

  const found = await t.withIdentity(staff).query(api.registrations.listAll, { search: '23456' });
  expect(found.rows.map((r) => r.fullName)).toEqual(['Jane Doe']);
});

test('listAll does not report truncation for a dataset sitting exactly on the cap', async () => {
  const t = convexTest(schema, modules);
  const limit = LIST_ALL_LIMITS.unscopedRegistrations;

  // Seed exactly `limit` Registrations directly, bypassing the register
  // mutation's Trip/Capacity rules — this is about the read cap, not
  // registration validation.
  const { tripId, participantId } = await t.run(async (ctx) => {
    const tripId = await ctx.db.insert('trips', {
      name: 'Cap Trip',
      destination: 'Nowhere',
      startDate: '2026-09-10',
      endDate: '2026-09-15',
      capacity: limit + 1,
      price: 100,
      createdBy: admin.subject
    });
    const participantId = await ctx.db.insert('participants', validParticipant);
    for (let i = 0; i < limit; i++) {
      await ctx.db.insert('registrations', {
        tripId,
        participantId,
        paymentStatus: 'unpaid',
        registrationStatus: 'registered',
        registeredAt: i,
        registeredBy: staff.subject
      });
    }
    return { tripId, participantId };
  });

  // Exactly at the cap is a complete answer, not a clipped one.
  const atCap = await t.withIdentity(staff).query(api.registrations.listAll, {});
  expect(atCap.rows).toHaveLength(limit);
  expect(atCap.truncated).toBe(false);

  // One row beyond it genuinely is clipped.
  await t.run(async (ctx) => {
    await ctx.db.insert('registrations', {
      tripId,
      participantId,
      paymentStatus: 'unpaid',
      registrationStatus: 'registered',
      registeredAt: limit,
      registeredBy: staff.subject
    });
  });

  const overCap = await t.withIdentity(staff).query(api.registrations.listAll, {});
  expect(overCap.rows).toHaveLength(limit);
  expect(overCap.truncated).toBe(true);
});

test('listAll does not call a search-plus-Trip result partial over other Trips rows', async () => {
  const t = convexTest(schema, modules);
  const perParticipant = LIST_ALL_LIMITS.registrationsPerParticipant;

  // One Participant whose overall history exceeds the per-Participant cap,
  // but who holds a single Registration on the Trip being filtered to.
  const { targetTripId } = await t.run(async (ctx) => {
    const participantId = await ctx.db.insert('participants', validParticipant);
    const makeTrip = (name: string) =>
      ctx.db.insert('trips', {
        name,
        destination: 'Nowhere',
        startDate: '2026-09-10',
        endDate: '2026-09-15',
        capacity: 10,
        price: 100,
        createdBy: admin.subject
      });

    const targetTripId = await makeTrip('Target Trip');
    await ctx.db.insert('registrations', {
      tripId: targetTripId,
      participantId,
      paymentStatus: 'unpaid',
      registrationStatus: 'registered',
      registeredAt: 0,
      registeredBy: staff.subject
    });

    const otherTripId = await makeTrip('Other Trip');
    for (let i = 0; i < perParticipant + 1; i++) {
      await ctx.db.insert('registrations', {
        tripId: otherTripId,
        participantId,
        paymentStatus: 'unpaid',
        registrationStatus: 'cancelled',
        registeredAt: i + 1,
        registeredBy: staff.subject
      });
    }
    return { targetTripId };
  });

  // Scoped to the Trip, the answer is that one row — and it is complete. The
  // rows past the cap all belong to a Trip the filter excludes anyway.
  const scoped = await t
    .withIdentity(staff)
    .query(api.registrations.listAll, { search: 'jane', tripId: targetTripId });
  expect(scoped.rows).toHaveLength(1);
  expect(scoped.truncated).toBe(false);

  // Unscoped, the same Participant's history genuinely does overflow the cap.
  const unscoped = await t.withIdentity(staff).query(api.registrations.listAll, { search: 'jane' });
  expect(unscoped.truncated).toBe(true);
});

test('listAll does not call a search-plus-Payment-Status result partial over other statuses', async () => {
  const t = convexTest(schema, modules);
  const perParticipant = LIST_ALL_LIMITS.registrationsPerParticipant;

  // A Participant whose overall history exceeds the per-Participant cap, but
  // who holds a single `paid` Registration among a sea of `unpaid` ones.
  await t.run(async (ctx) => {
    const participantId = await ctx.db.insert('participants', validParticipant);
    const tripId = await ctx.db.insert('trips', {
      name: 'Busy Trip',
      destination: 'Nowhere',
      startDate: '2026-09-10',
      endDate: '2026-09-15',
      capacity: 10,
      price: 100,
      createdBy: admin.subject
    });

    await ctx.db.insert('registrations', {
      tripId,
      participantId,
      paymentStatus: 'paid',
      registrationStatus: 'registered',
      registeredAt: 0,
      registeredBy: staff.subject
    });
    for (let i = 0; i < perParticipant + 1; i++) {
      await ctx.db.insert('registrations', {
        tripId,
        participantId,
        paymentStatus: 'unpaid',
        registrationStatus: 'cancelled',
        registeredAt: i + 1,
        registeredBy: staff.subject
      });
    }
  });

  // Scoped to `paid`, the answer is that one row — and it is complete. The
  // rows past the cap are all `unpaid`, which the filter excludes anyway.
  const scoped = await t
    .withIdentity(staff)
    .query(api.registrations.listAll, { search: 'jane', paymentStatus: 'paid' });
  expect(scoped.rows).toHaveLength(1);
  expect(scoped.truncated).toBe(false);

  // Unscoped, the same Participant's history genuinely does overflow the cap.
  const unscoped = await t.withIdentity(staff).query(api.registrations.listAll, { search: 'jane' });
  expect(unscoped.truncated).toBe(true);
});

test('listAll does not call a search-plus-Trip-plus-Payment-Status result partial over other statuses on the same Trip', async () => {
  const t = convexTest(schema, modules);
  const perParticipant = LIST_ALL_LIMITS.registrationsPerParticipant;

  // A Participant whose history on a single Trip exceeds the per-Participant
  // cap (reachable via repeated cancel/re-register cycles), but who holds a
  // single `paid` Registration among a sea of `unpaid` ones on that same Trip.
  const { tripId } = await t.run(async (ctx) => {
    const participantId = await ctx.db.insert('participants', validParticipant);
    const tripId = await ctx.db.insert('trips', {
      name: 'Busy Trip',
      destination: 'Nowhere',
      startDate: '2026-09-10',
      endDate: '2026-09-15',
      capacity: 10,
      price: 100,
      createdBy: admin.subject
    });

    await ctx.db.insert('registrations', {
      tripId,
      participantId,
      paymentStatus: 'paid',
      registrationStatus: 'registered',
      registeredAt: 0,
      registeredBy: staff.subject
    });
    for (let i = 0; i < perParticipant + 1; i++) {
      await ctx.db.insert('registrations', {
        tripId,
        participantId,
        paymentStatus: 'unpaid',
        registrationStatus: 'cancelled',
        registeredAt: i + 1,
        registeredBy: staff.subject
      });
    }
    return { tripId };
  });

  // Scoped to this Trip and `paid`, the answer is that one row — and it is
  // complete. The rows past the cap are all `unpaid` on the same Trip, which
  // the Payment Status filter excludes anyway. Reading via `by_trip_and_participant`
  // first (ungated on Payment Status) would cap this at the raw per-Participant
  // limit and misreport `truncated: true`.
  const scoped = await t
    .withIdentity(staff)
    .query(api.registrations.listAll, { search: 'jane', tripId, paymentStatus: 'paid' });
  expect(scoped.rows).toHaveLength(1);
  expect(scoped.truncated).toBe(false);
});

test('listAll does not drop a search-plus-Trip-plus-Payment-Status match under a same-status glut on another Trip', async () => {
  const t = convexTest(schema, modules);
  const perParticipant = LIST_ALL_LIMITS.registrationsPerParticipant;

  // A Participant with one `paid` Registration on the Trip being queried, and
  // enough other `paid` Registrations on a *different* Trip to overflow the
  // per-Participant cap. An index read scoped only by (Participant, Payment
  // Status) — ignoring Trip — would cap and slice across both Trips combined,
  // and could drop the matching row for the queried Trip entirely if it isn't
  // among the first rows read.
  const { targetTripId } = await t.run(async (ctx) => {
    const participantId = await ctx.db.insert('participants', validParticipant);
    const makeTrip = (name: string) =>
      ctx.db.insert('trips', {
        name,
        destination: 'Nowhere',
        startDate: '2026-09-10',
        endDate: '2026-09-15',
        capacity: 10,
        price: 100,
        createdBy: admin.subject
      });

    const otherTripId = await makeTrip('Other Trip');
    for (let i = 0; i < perParticipant + 1; i++) {
      await ctx.db.insert('registrations', {
        tripId: otherTripId,
        participantId,
        paymentStatus: 'paid',
        registrationStatus: 'cancelled',
        registeredAt: i,
        registeredBy: staff.subject
      });
    }

    // Inserted after the glut, so a read merely capped by creation order
    // (ignoring Trip) would miss it.
    const targetTripId = await makeTrip('Target Trip');
    await ctx.db.insert('registrations', {
      tripId: targetTripId,
      participantId,
      paymentStatus: 'paid',
      registrationStatus: 'registered',
      registeredAt: perParticipant + 2,
      registeredBy: staff.subject
    });

    return { targetTripId };
  });

  const scoped = await t.withIdentity(staff).query(api.registrations.listAll, {
    search: 'jane',
    tripId: targetTripId,
    paymentStatus: 'paid'
  });
  expect(scoped.rows).toHaveLength(1);
  expect(scoped.truncated).toBe(false);
});

test('listAll caps keep total documents scanned under Convex per-query ceiling', () => {
  // Convex scans at most 32,000 documents per query. Capping each read alone
  // is not enough — the search path issues one read per matched Participant,
  // so the caps multiply. This pins the aggregate arithmetic so raising any
  // single cap can't quietly push a real query over the ceiling.
  const CONVEX_DOCUMENTS_SCANNED_CEILING = 32000;
  const {
    participantsScan,
    matchedParticipants,
    registrationsPerParticipant,
    scopedRegistrations,
    unscopedRegistrations
  } = LIST_ALL_LIMITS;

  // Search: scan Participants, then one capped read per match, then a Trip
  // lookup per resulting row (Participants are already in memory).
  const searchRows = matchedParticipants * (registrationsPerParticipant + 1);
  const searchWorstCase = participantsScan + searchRows + searchRows;

  // Non-search: read Registrations, then a Trip and a Participant per row.
  const scopedWorstCase = scopedRegistrations + 2 * scopedRegistrations;
  const unscopedWorstCase = unscopedRegistrations + 2 * unscopedRegistrations;

  expect(searchWorstCase).toBeLessThan(CONVEX_DOCUMENTS_SCANNED_CEILING);
  expect(scopedWorstCase).toBeLessThan(CONVEX_DOCUMENTS_SCANNED_CEILING);
  expect(unscopedWorstCase).toBeLessThan(CONVEX_DOCUMENTS_SCANNED_CEILING);
});

test('listAll reports truncated=false when every matching row fits', async () => {
  const t = convexTest(schema, modules);
  const tripId = await createTrip(t);
  await t.withIdentity(staff).mutation(api.registrations.register, { tripId, ...validParticipant });

  // Each filter path reports its own completeness, so callers can trust a
  // false here to mean "this is the whole answer".
  for (const args of [{}, { search: 'jane' }, { tripId }, { paymentStatus: 'unpaid' as const }]) {
    const result = await t.withIdentity(staff).query(api.registrations.listAll, args);
    expect(result.truncated).toBe(false);
    expect(result.rows.length).toBeGreaterThan(0);
  }
});

test('getSendablePaymentLinkInfo rejects a cancelled Registration', async () => {
  const t = convexTest(schema, modules);
  const tripId = await createTrip(t);
  const registrationId = await t
    .withIdentity(staff)
    .mutation(api.registrations.register, { tripId, ...validParticipant });
  await t.withIdentity(staff).mutation(api.registrations.cancel, { registrationId });

  await expect(
    t.query(internal.registrations.getSendablePaymentLinkInfo, { registrationId })
  ).rejects.toThrow();
});

test('getSendablePaymentLinkInfo rejects a Registration that is not Unpaid', async () => {
  const t = convexTest(schema, modules);
  const tripId = await createTrip(t);
  const registrationId = await t
    .withIdentity(staff)
    .mutation(api.registrations.register, { tripId, ...validParticipant });
  await t
    .withIdentity(staff)
    .mutation(api.registrations.setPaymentStatus, { registrationId, paymentStatus: 'paid' });

  await expect(
    t.query(internal.registrations.getSendablePaymentLinkInfo, { registrationId })
  ).rejects.toThrow();
});

test('getSendablePaymentLinkInfo rejects a Trip with no price set', async () => {
  const t = convexTest(schema, modules);
  const registrationId = await t.run(async (ctx) => {
    const tripId = await ctx.db.insert('trips', {
      name: 'No Price Trip',
      destination: 'Nowhere',
      startDate: '2026-09-10',
      endDate: '2026-09-15',
      capacity: 5,
      createdBy: staff.subject
    });
    const participantId = await ctx.db.insert('participants', validParticipant);
    return await ctx.db.insert('registrations', {
      tripId,
      participantId,
      paymentStatus: 'unpaid',
      registrationStatus: 'registered',
      registeredAt: Date.now(),
      registeredBy: staff.subject
    });
  });

  await expect(
    t.query(internal.registrations.getSendablePaymentLinkInfo, { registrationId })
  ).rejects.toThrow();
});

test('getSendablePaymentLinkInfo rejects a non-existent Registration', async () => {
  const t = convexTest(schema, modules);
  const tripId = await createTrip(t);
  const registrationId = await t
    .withIdentity(staff)
    .mutation(api.registrations.register, { tripId, ...validParticipant });
  await t.run((ctx) => ctx.db.delete(registrationId));

  await expect(
    t.query(internal.registrations.getSendablePaymentLinkInfo, { registrationId })
  ).rejects.toThrow();
});

test('getSendablePaymentLinkInfo returns the Trip price and Participant email for an eligible Registration', async () => {
  const t = convexTest(schema, modules);
  const tripId = await createTrip(t, { name: 'Bali Retreat', price: 250 });
  const registrationId = await t
    .withIdentity(staff)
    .mutation(api.registrations.register, { tripId, ...validParticipant });

  const info = await t.query(internal.registrations.getSendablePaymentLinkInfo, {
    registrationId
  });
  expect(info).toEqual({
    tripName: 'Bali Retreat',
    price: 250,
    participantEmail: validParticipant.email
  });
});

test('recordPaymentLinkSent persists the session id, sent-at, and sent-by onto the Registration', async () => {
  const t = convexTest(schema, modules);
  const tripId = await createTrip(t);
  const registrationId = await t
    .withIdentity(staff)
    .mutation(api.registrations.register, { tripId, ...validParticipant });

  await t.mutation(internal.registrations.recordPaymentLinkSent, {
    registrationId,
    sessionId: 'cs_test_123',
    sentAt: 1_000,
    sentBy: staff.subject
  });

  const registration = await t.run((ctx) => ctx.db.get(registrationId));
  expect(registration).toMatchObject({
    paymentLinkSessionId: 'cs_test_123',
    paymentLinkSentAt: 1_000,
    paymentLinkSentBy: staff.subject
  });
});

test('recordPaymentLinkSent rejects a non-existent Registration', async () => {
  const t = convexTest(schema, modules);
  const tripId = await createTrip(t);
  const registrationId = await t
    .withIdentity(staff)
    .mutation(api.registrations.register, { tripId, ...validParticipant });
  await t.run((ctx) => ctx.db.delete(registrationId));

  await expect(
    t.mutation(internal.registrations.recordPaymentLinkSent, {
      registrationId,
      sessionId: 'cs_test_123',
      sentAt: 1_000,
      sentBy: staff.subject
    })
  ).rejects.toThrow();
});

test('markPaidFromStripeSession sets Payment Status to Paid, clears the Payment Link, and logs a system-actor Activity Log entry', async () => {
  const t = convexTest(schema, modules);
  const tripId = await createTrip(t);
  const registrationId = await t
    .withIdentity(staff)
    .mutation(api.registrations.register, { tripId, ...validParticipant });
  await t.mutation(internal.registrations.recordPaymentLinkSent, {
    registrationId,
    sessionId: 'cs_test_paid',
    sentAt: 1_000,
    sentBy: staff.subject
  });

  await t.mutation(internal.registrations.markPaidFromStripeSession, {
    sessionId: 'cs_test_paid'
  });

  const registration = await t.run((ctx) => ctx.db.get(registrationId));
  expect(registration?.paymentStatus).toBe('paid');
  expect(registration?.paymentLinkSessionId).toBeUndefined();
  expect(registration?.paymentLinkSentAt).toBeUndefined();
  expect(registration?.paymentLinkSentBy).toBeUndefined();

  const history = await t
    .withIdentity(staff)
    .query(api.activityLogs.listByRegistration, { registrationId });
  expect(history.entries).toContainEqual(
    expect.objectContaining({
      field: 'paymentStatus',
      oldValue: 'unpaid',
      newValue: 'paid',
      changedBy: STRIPE_SYSTEM_ACTOR
    })
  );
});

test('markPaidFromStripeSession marks Paid even when the Registration was cancelled after the link was sent', async () => {
  const t = convexTest(schema, modules);
  const tripId = await createTrip(t);
  const registrationId = await t
    .withIdentity(staff)
    .mutation(api.registrations.register, { tripId, ...validParticipant });
  await t.mutation(internal.registrations.recordPaymentLinkSent, {
    registrationId,
    sessionId: 'cs_test_paid_after_cancel',
    sentAt: 1_000,
    sentBy: staff.subject
  });
  await t.withIdentity(staff).mutation(api.registrations.cancel, { registrationId });

  await t.mutation(internal.registrations.markPaidFromStripeSession, {
    sessionId: 'cs_test_paid_after_cancel'
  });

  const registration = await t.run((ctx) => ctx.db.get(registrationId));
  expect(registration).toMatchObject({
    paymentStatus: 'paid',
    registrationStatus: 'cancelled'
  });
});

test('markPaidFromStripeSession does not create a duplicate Activity Log entry when already Paid', async () => {
  const t = convexTest(schema, modules);
  const tripId = await createTrip(t);
  const registrationId = await t
    .withIdentity(staff)
    .mutation(api.registrations.register, { tripId, ...validParticipant });
  await t
    .withIdentity(staff)
    .mutation(api.registrations.setPaymentStatus, { registrationId, paymentStatus: 'paid' });
  await t.mutation(internal.registrations.recordPaymentLinkSent, {
    registrationId,
    sessionId: 'cs_test_already_paid',
    sentAt: 1_000,
    sentBy: staff.subject
  });

  await t.mutation(internal.registrations.markPaidFromStripeSession, {
    sessionId: 'cs_test_already_paid'
  });

  const history = await t
    .withIdentity(staff)
    .query(api.activityLogs.listByRegistration, { registrationId });
  expect(history.entries.filter((entry) => entry.changedBy === STRIPE_SYSTEM_ACTOR)).toHaveLength(
    0
  );
});

test('markPaidFromStripeSession is a no-op for an unrecognized session id', async () => {
  const t = convexTest(schema, modules);
  const tripId = await createTrip(t);
  const registrationId = await t
    .withIdentity(staff)
    .mutation(api.registrations.register, { tripId, ...validParticipant });

  await expect(
    t.mutation(internal.registrations.markPaidFromStripeSession, {
      sessionId: 'cs_test_unknown'
    })
  ).resolves.toBeNull();

  const registration = await t.run((ctx) => ctx.db.get(registrationId));
  expect(registration?.paymentStatus).toBe('unpaid');
});

test('clearExpiredPaymentLink clears the Payment Link fields when they still match the expired session', async () => {
  const t = convexTest(schema, modules);
  const tripId = await createTrip(t);
  const registrationId = await t
    .withIdentity(staff)
    .mutation(api.registrations.register, { tripId, ...validParticipant });
  await t.mutation(internal.registrations.recordPaymentLinkSent, {
    registrationId,
    sessionId: 'cs_test_expired',
    sentAt: 1_000,
    sentBy: staff.subject
  });

  await t.mutation(internal.registrations.clearExpiredPaymentLink, {
    sessionId: 'cs_test_expired'
  });

  const registration = await t.run((ctx) => ctx.db.get(registrationId));
  expect(registration?.paymentStatus).toBe('unpaid');
  expect(registration?.paymentLinkSessionId).toBeUndefined();
  expect(registration?.paymentLinkSentAt).toBeUndefined();
  expect(registration?.paymentLinkSentBy).toBeUndefined();
});

test('clearExpiredPaymentLink leaves a since-resent Payment Link untouched', async () => {
  const t = convexTest(schema, modules);
  const tripId = await createTrip(t);
  const registrationId = await t
    .withIdentity(staff)
    .mutation(api.registrations.register, { tripId, ...validParticipant });
  await t.mutation(internal.registrations.recordPaymentLinkSent, {
    registrationId,
    sessionId: 'cs_test_old',
    sentAt: 1_000,
    sentBy: staff.subject
  });
  // Staff resent the link before the old session's expiry notification arrived.
  await t.mutation(internal.registrations.recordPaymentLinkSent, {
    registrationId,
    sessionId: 'cs_test_new',
    sentAt: 2_000,
    sentBy: staff.subject
  });

  await t.mutation(internal.registrations.clearExpiredPaymentLink, {
    sessionId: 'cs_test_old'
  });

  const registration = await t.run((ctx) => ctx.db.get(registrationId));
  expect(registration).toMatchObject({
    paymentLinkSessionId: 'cs_test_new',
    paymentLinkSentAt: 2_000
  });
});

test('clearExpiredPaymentLink is a no-op for an unrecognized session id', async () => {
  const t = convexTest(schema, modules);
  await expect(
    t.mutation(internal.registrations.clearExpiredPaymentLink, {
      sessionId: 'cs_test_unknown'
    })
  ).resolves.toBeNull();
});
