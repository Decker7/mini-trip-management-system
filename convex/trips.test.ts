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
  capacity: 20,
  price: 1200,
  description: 'A relaxing retreat'
};

test('create rejects an unauthenticated caller', async () => {
  const t = convexTest(schema, modules);
  await expect(t.mutation(api.trips.create, validTrip)).rejects.toThrow();
});

test('create rejects a Staff identity', async () => {
  const t = convexTest(schema, modules);
  await expect(t.withIdentity(staff).mutation(api.trips.create, validTrip)).rejects.toThrow();
});

test('create succeeds for an Admin identity and stamps createdBy', async () => {
  const t = convexTest(schema, modules);
  const tripId = await t.withIdentity(admin).mutation(api.trips.create, validTrip);
  const trip = await t.run((ctx) => ctx.db.get(tripId));
  expect(trip).toMatchObject({ ...validTrip, createdBy: admin.subject });
});

test('create rejects an end date before the start date', async () => {
  const t = convexTest(schema, modules);
  await expect(
    t.withIdentity(admin).mutation(api.trips.create, {
      ...validTrip,
      startDate: '2026-09-15',
      endDate: '2026-09-10'
    })
  ).rejects.toThrow();
});

test('create rejects a capacity of zero or less', async () => {
  const t = convexTest(schema, modules);
  await expect(
    t.withIdentity(admin).mutation(api.trips.create, { ...validTrip, capacity: 0 })
  ).rejects.toThrow();
});

test('create rejects a negative price', async () => {
  const t = convexTest(schema, modules);
  await expect(
    t.withIdentity(admin).mutation(api.trips.create, { ...validTrip, price: -1 })
  ).rejects.toThrow();
});

test('create rejects a missing name', async () => {
  const t = convexTest(schema, modules);
  await expect(
    t.withIdentity(admin).mutation(api.trips.create, { ...validTrip, name: '  ' })
  ).rejects.toThrow();
});

test('create rejects a missing destination', async () => {
  const t = convexTest(schema, modules);
  await expect(
    t.withIdentity(admin).mutation(api.trips.create, { ...validTrip, destination: '' })
  ).rejects.toThrow();
});

test('update rejects a Staff identity', async () => {
  const t = convexTest(schema, modules);
  const tripId = await t.withIdentity(admin).mutation(api.trips.create, validTrip);
  await expect(
    t.withIdentity(staff).mutation(api.trips.update, { tripId, ...validTrip, name: 'Renamed' })
  ).rejects.toThrow();
});

test('update lets an Admin change a trip', async () => {
  const t = convexTest(schema, modules);
  const tripId = await t.withIdentity(admin).mutation(api.trips.create, validTrip);
  await t
    .withIdentity(admin)
    .mutation(api.trips.update, { tripId, ...validTrip, name: 'Bali Retreat v2', capacity: 25 });
  const trip = await t.run((ctx) => ctx.db.get(tripId));
  expect(trip).toMatchObject({ name: 'Bali Retreat v2', capacity: 25 });
});

test('update rejects invalid fields the same way create does', async () => {
  const t = convexTest(schema, modules);
  const tripId = await t.withIdentity(admin).mutation(api.trips.create, validTrip);
  await expect(
    t.withIdentity(admin).mutation(api.trips.update, { tripId, ...validTrip, capacity: -1 })
  ).rejects.toThrow();
});

test('update rejects a non-existent trip', async () => {
  const t = convexTest(schema, modules);
  const tripId = await t.withIdentity(admin).mutation(api.trips.create, validTrip);
  await t.withIdentity(admin).mutation(api.trips.remove, { tripId });
  await expect(
    t.withIdentity(admin).mutation(api.trips.update, { tripId, ...validTrip })
  ).rejects.toThrow();
});

test('remove rejects a Staff identity', async () => {
  const t = convexTest(schema, modules);
  const tripId = await t.withIdentity(admin).mutation(api.trips.create, validTrip);
  await expect(t.withIdentity(staff).mutation(api.trips.remove, { tripId })).rejects.toThrow();
});

test('remove lets an Admin delete a trip', async () => {
  const t = convexTest(schema, modules);
  const tripId = await t.withIdentity(admin).mutation(api.trips.create, validTrip);
  await t.withIdentity(admin).mutation(api.trips.remove, { tripId });
  const trip = await t.run((ctx) => ctx.db.get(tripId));
  expect(trip).toBeNull();
});

test('list rejects an unauthenticated caller', async () => {
  const t = convexTest(schema, modules);
  await expect(t.query(api.trips.list, { today: '2026-09-12' })).rejects.toThrow();
});

test('list rejects a signed-in caller with no role (e.g. revoked access)', async () => {
  const t = convexTest(schema, modules);
  const revoked = { subject: 'user_revoked' };
  await expect(
    t.withIdentity(revoked).query(api.trips.list, { today: '2026-09-12' })
  ).rejects.toThrow();
});

test('get rejects a signed-in caller with no role (e.g. revoked access)', async () => {
  const t = convexTest(schema, modules);
  const tripId = await t.withIdentity(admin).mutation(api.trips.create, validTrip);
  const revoked = { subject: 'user_revoked' };
  await expect(
    t.withIdentity(revoked).query(api.trips.get, { tripId, today: '2026-09-12' })
  ).rejects.toThrow();
});

test('list derives Upcoming/Ongoing/Completed status from today', async () => {
  const t = convexTest(schema, modules);
  const asAdmin = t.withIdentity(admin);
  await asAdmin.mutation(api.trips.create, {
    ...validTrip,
    name: 'Future Trip',
    startDate: '2026-10-01',
    endDate: '2026-10-05'
  });
  await asAdmin.mutation(api.trips.create, {
    ...validTrip,
    name: 'Ongoing Trip',
    startDate: '2026-09-01',
    endDate: '2026-09-20'
  });
  await asAdmin.mutation(api.trips.create, {
    ...validTrip,
    name: 'Past Trip',
    startDate: '2026-08-01',
    endDate: '2026-08-05'
  });

  const trips = await t.withIdentity(staff).query(api.trips.list, { today: '2026-09-12' });
  const byName = Object.fromEntries(trips.map((trip) => [trip.name, trip.status]));
  expect(byName).toEqual({
    'Future Trip': 'upcoming',
    'Ongoing Trip': 'ongoing',
    'Past Trip': 'completed'
  });
});

test('list filters by search across name and destination', async () => {
  const t = convexTest(schema, modules);
  const asAdmin = t.withIdentity(admin);
  await asAdmin.mutation(api.trips.create, {
    ...validTrip,
    name: 'Bali Retreat',
    destination: 'Bali'
  });
  await asAdmin.mutation(api.trips.create, {
    ...validTrip,
    name: 'Tokyo Tour',
    destination: 'Tokyo'
  });

  const byName = await t
    .withIdentity(staff)
    .query(api.trips.list, { today: '2026-09-12', search: 'bali' });
  expect(byName.map((trip) => trip.name)).toEqual(['Bali Retreat']);

  const byDestination = await t
    .withIdentity(staff)
    .query(api.trips.list, { today: '2026-09-12', search: 'tokyo' });
  expect(byDestination.map((trip) => trip.name)).toEqual(['Tokyo Tour']);
});

test('list filters by derived status', async () => {
  const t = convexTest(schema, modules);
  const asAdmin = t.withIdentity(admin);
  await asAdmin.mutation(api.trips.create, {
    ...validTrip,
    name: 'Future Trip',
    startDate: '2026-10-01',
    endDate: '2026-10-05'
  });
  await asAdmin.mutation(api.trips.create, {
    ...validTrip,
    name: 'Ongoing Trip',
    startDate: '2026-09-01',
    endDate: '2026-09-20'
  });

  const trips = await t.withIdentity(staff).query(api.trips.list, {
    today: '2026-09-12',
    status: 'upcoming'
  });
  expect(trips.map((trip) => trip.name)).toEqual(['Future Trip']);
});

test('list filters by start date range', async () => {
  const t = convexTest(schema, modules);
  const asAdmin = t.withIdentity(admin);
  await asAdmin.mutation(api.trips.create, {
    ...validTrip,
    name: 'Early',
    startDate: '2026-09-01',
    endDate: '2026-09-03'
  });
  await asAdmin.mutation(api.trips.create, {
    ...validTrip,
    name: 'Late',
    startDate: '2026-11-01',
    endDate: '2026-11-03'
  });

  const trips = await t.withIdentity(staff).query(api.trips.list, {
    today: '2026-09-12',
    startDateFrom: '2026-10-01',
    startDateTo: '2026-12-01'
  });
  expect(trips.map((trip) => trip.name)).toEqual(['Late']);
});

test('get returns a single trip with derived status, or null when missing', async () => {
  const t = convexTest(schema, modules);
  const tripId = await t.withIdentity(admin).mutation(api.trips.create, {
    ...validTrip,
    startDate: '2026-09-01',
    endDate: '2026-09-20'
  });

  const trip = await t.withIdentity(staff).query(api.trips.get, { tripId, today: '2026-09-12' });
  expect(trip).toMatchObject({ name: validTrip.name, status: 'ongoing' });

  await t.withIdentity(admin).mutation(api.trips.remove, { tripId });
  const missing = await t.withIdentity(staff).query(api.trips.get, { tripId, today: '2026-09-12' });
  expect(missing).toBeNull();
});

test('remove rejects a Trip that has an active Registration', async () => {
  const t = convexTest(schema, modules);
  const tripId = await t.withIdentity(admin).mutation(api.trips.create, validTrip);
  await t.withIdentity(staff).mutation(api.registrations.register, {
    tripId,
    fullName: 'Jane Doe',
    icPassportNumber: 'A1234567',
    email: 'jane@example.com',
    phone: '+60123456789'
  });

  await expect(t.withIdentity(admin).mutation(api.trips.remove, { tripId })).rejects.toThrow();
});

test('remove cascades to delete cancelled Registrations and succeeds', async () => {
  const t = convexTest(schema, modules);
  const tripId = await t.withIdentity(admin).mutation(api.trips.create, validTrip);
  const registrationId = await t.withIdentity(staff).mutation(api.registrations.register, {
    tripId,
    fullName: 'Jane Doe',
    icPassportNumber: 'A1234567',
    email: 'jane@example.com',
    phone: '+60123456789'
  });
  await t.withIdentity(staff).mutation(api.registrations.cancel, { registrationId });

  await t.withIdentity(admin).mutation(api.trips.remove, { tripId });

  const missing = await t.withIdentity(staff).query(api.trips.get, { tripId, today: '2026-09-12' });
  expect(missing).toBeNull();
});
