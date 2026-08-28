/// <reference types="vite/client" />
import { convexTest } from 'convex-test';
import { expect, test } from 'vitest';
import { api } from './_generated/api';
import schema from './schema';

const modules = import.meta.glob('./**/*.ts');

const admin = { subject: 'user_admin', role: 'admin' as const };
const staff = { subject: 'user_staff', role: 'staff' as const };

const validTrip = {
  name: 'Bali Retreat',
  destination: 'Bali',
  startDate: '2026-09-10',
  endDate: '2026-09-15',
  capacity: 2,
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

  const all = await t.withIdentity(staff).query(api.registrations.listAll, {});
  expect(all).toHaveLength(2);
  const byName = Object.fromEntries(all.map((r) => [r.fullName, r.tripName]));
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
  expect(byName.map((r) => r.fullName)).toEqual(['Jane Doe']);

  const byIc = await t.withIdentity(staff).query(api.registrations.listAll, { search: 'c1111111' });
  expect(byIc.map((r) => r.fullName)).toEqual(['John Smith']);
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
  expect(forTripA.map((r) => r.fullName)).toEqual(['Jane Doe']);
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
  expect(paid.map((r) => r.fullName)).toEqual(['Jane Doe']);
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
  expect(found).toHaveLength(2);
  const tripNames = found.map((r) => r.tripName);
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
  expect(found).toHaveLength(1);
  expect(found[0]).toMatchObject({ fullName: 'Jane Doe', tripName: 'Tokyo Tour' });
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
  expect(found).toHaveLength(1);
  expect(found[0]).toMatchObject({ tripName: 'Bali Retreat', paymentStatus: 'paid' });
});

test('listAll search matches on IC/passport substring, not just a prefix', async () => {
  const t = convexTest(schema, modules);
  const tripId = await createTrip(t);
  await t.withIdentity(staff).mutation(api.registrations.register, { tripId, ...validParticipant });

  const found = await t.withIdentity(staff).query(api.registrations.listAll, { search: '23456' });
  expect(found.map((r) => r.fullName)).toEqual(['Jane Doe']);
});
