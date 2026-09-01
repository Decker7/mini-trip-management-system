/// <reference types="vite/client" />
import { convexTest } from 'convex-test';
import { expect, test } from 'vitest';
import { api } from './_generated/api';
import type { Doc, Id } from './_generated/dataModel';
import schema from './schema';

const modules = import.meta.glob('./**/*.ts');

const admin = { subject: 'user_admin', role: 'admin' as const };
const staff = { subject: 'user_staff', role: 'staff' as const };
const roleless = { subject: 'user_roleless' };

const validParticipant = {
  fullName: 'Jane Doe',
  icPassportNumber: 'A1234567',
  email: 'jane@example.com',
  phone: '+60123456789'
};

async function seedParticipant(t: ReturnType<typeof convexTest>) {
  return await t.run((ctx) => ctx.db.insert('participants', validParticipant));
}

function samplePdf() {
  return new Blob(['%PDF-1.4 fake passport scan'], { type: 'application/pdf' });
}

function sampleImage() {
  return new Blob(['fake image bytes'], { type: 'image/png' });
}

test('get rejects an unauthenticated caller', async () => {
  const t = convexTest(schema, modules);
  const participantId = await seedParticipant(t);
  await expect(t.query(api.participants.get, { participantId })).rejects.toThrow();
});

test('get rejects an authenticated caller with no role assigned', async () => {
  const t = convexTest(schema, modules);
  const participantId = await seedParticipant(t);
  await expect(
    t.withIdentity(roleless).query(api.participants.get, { participantId })
  ).rejects.toThrow();
});

test('get returns null for a non-existent Participant', async () => {
  const t = convexTest(schema, modules);
  const participantId = await seedParticipant(t);
  await t.run((ctx) => ctx.db.delete(participantId));

  const result = await t.withIdentity(staff).query(api.participants.get, { participantId });
  expect(result).toBeNull();
});

test('get returns the Participant with a null passportUrl before any upload', async () => {
  const t = convexTest(schema, modules);
  const participantId = await seedParticipant(t);

  const result = await t.withIdentity(staff).query(api.participants.get, { participantId });
  expect(result).toMatchObject({ ...validParticipant, passportUrl: null });
});

test('generateUploadUrl rejects an unauthenticated caller', async () => {
  const t = convexTest(schema, modules);
  await expect(t.mutation(api.participants.generateUploadUrl, {})).rejects.toThrow();
});

test('generateUploadUrl returns a URL for an authenticated caller', async () => {
  const t = convexTest(schema, modules);
  const url = await t.withIdentity(staff).mutation(api.participants.generateUploadUrl, {});
  expect(typeof url).toBe('string');
});

test('generateUploadUrl rejects an authenticated caller with no role assigned', async () => {
  const t = convexTest(schema, modules);
  await expect(
    t.withIdentity(roleless).mutation(api.participants.generateUploadUrl, {})
  ).rejects.toThrow();
});

test('setPassport rejects an unauthenticated caller', async () => {
  const t = convexTest(schema, modules);
  const participantId = await seedParticipant(t);
  const storageId = await t.run((ctx) => ctx.storage.store(samplePdf()));

  await expect(
    t.mutation(api.participants.setPassport, { participantId, storageId })
  ).rejects.toThrow();
});

test('setPassport rejects an authenticated caller with no role assigned', async () => {
  const t = convexTest(schema, modules);
  const participantId = await seedParticipant(t);
  const storageId = await t.run((ctx) => ctx.storage.store(samplePdf()));

  await expect(
    t.withIdentity(roleless).mutation(api.participants.setPassport, { participantId, storageId })
  ).rejects.toThrow();
});

test('setPassport rejects a non-existent Participant', async () => {
  const t = convexTest(schema, modules);
  const participantId = await seedParticipant(t);
  await t.run((ctx) => ctx.db.delete(participantId));
  const storageId = await t.run((ctx) => ctx.storage.store(samplePdf()));

  await expect(
    t.withIdentity(staff).mutation(api.participants.setPassport, { participantId, storageId })
  ).rejects.toThrow();
});

test('setPassport rejects a storage id that does not resolve to a real file', async () => {
  const t = convexTest(schema, modules);
  const participantId = await seedParticipant(t);
  // A blob that was stored and then deleted leaves a syntactically valid
  // storage id with nothing behind it — the same shape a stale or invented
  // id would have.
  const storageId = await t.run((ctx) => ctx.storage.store(samplePdf()));
  await t.run((ctx) => ctx.storage.delete(storageId));

  await expect(
    t.withIdentity(staff).mutation(api.participants.setPassport, { participantId, storageId })
  ).rejects.toThrow();

  const participant = await t.run((ctx) => ctx.db.get(participantId));
  expect(participant!.passportFileId).toBeUndefined();
});

test('setPassport rejects a file over the size limit', async () => {
  const t = convexTest(schema, modules);
  const participantId = await seedParticipant(t);
  const oversized = new Blob([new Uint8Array(11 * 1024 * 1024)], { type: 'image/png' });
  const storageId = await t.run((ctx) => ctx.storage.store(oversized));

  await expect(
    t.withIdentity(staff).mutation(api.participants.setPassport, { participantId, storageId })
  ).rejects.toThrow();

  const participant = await t.run((ctx) => ctx.db.get(participantId));
  expect(participant!.passportFileId).toBeUndefined();
});

test("setPassport attaches the file as the Participant's passport", async () => {
  const t = convexTest(schema, modules);
  const participantId = await seedParticipant(t);
  const storageId = await t.run((ctx) => ctx.storage.store(samplePdf()));

  await t.withIdentity(staff).mutation(api.participants.setPassport, { participantId, storageId });

  const participant = await t.run((ctx) => ctx.db.get(participantId));
  expect(participant!.passportFileId).toEqual(storageId);

  const result = await t.withIdentity(staff).query(api.participants.get, { participantId });
  expect(result!.passportUrl).not.toBeNull();
});

test('setPassport replaces a previous passport and deletes the old file', async () => {
  const t = convexTest(schema, modules);
  const participantId = await seedParticipant(t);
  const asStaff = t.withIdentity(staff);

  const firstId = await t.run((ctx) => ctx.storage.store(samplePdf()));
  await asStaff.mutation(api.participants.setPassport, { participantId, storageId: firstId });

  const secondId = await t.run((ctx) => ctx.storage.store(sampleImage()));
  await asStaff.mutation(api.participants.setPassport, { participantId, storageId: secondId });

  const participant = await t.run((ctx) => ctx.db.get(participantId));
  expect(participant!.passportFileId).toEqual(secondId);

  const oldFileUrl = await t.run((ctx) => ctx.storage.getUrl(firstId));
  expect(oldFileUrl).toBeNull();
});

test('update rejects an unauthenticated caller', async () => {
  const t = convexTest(schema, modules);
  const participantId = await seedParticipant(t);

  await expect(
    t.mutation(api.participants.update, {
      participantId,
      ...validParticipant,
      fullName: 'Jane Roe'
    })
  ).rejects.toThrow();
});

test('update rejects an authenticated caller with no role assigned', async () => {
  const t = convexTest(schema, modules);
  const participantId = await seedParticipant(t);

  await expect(
    t.withIdentity(roleless).mutation(api.participants.update, {
      participantId,
      ...validParticipant,
      fullName: 'Jane Roe'
    })
  ).rejects.toThrow();
});

test('update rejects a Staff caller', async () => {
  const t = convexTest(schema, modules);
  const participantId = await seedParticipant(t);

  await expect(
    t.withIdentity(staff).mutation(api.participants.update, {
      participantId,
      ...validParticipant,
      fullName: 'Jane Roe'
    })
  ).rejects.toThrow();

  const participant = await t.run((ctx) => ctx.db.get(participantId));
  expect(participant!.fullName).toBe(validParticipant.fullName);
});

test('update rejects a non-existent Participant', async () => {
  const t = convexTest(schema, modules);
  const participantId = await seedParticipant(t);
  await t.run((ctx) => ctx.db.delete(participantId));

  await expect(
    t.withIdentity(admin).mutation(api.participants.update, { participantId, ...validParticipant })
  ).rejects.toThrow();
});

test.each(['fullName', 'icPassportNumber', 'email', 'phone'] as const)(
  'update rejects a blank %s',
  async (field) => {
    const t = convexTest(schema, modules);
    const participantId = await seedParticipant(t);

    await expect(
      t.withIdentity(admin).mutation(api.participants.update, {
        participantId,
        ...validParticipant,
        [field]: '  '
      })
    ).rejects.toThrow();
  }
);

test('update rejects an IC/passport number already used by another Participant', async () => {
  const t = convexTest(schema, modules);
  const participantId = await seedParticipant(t);
  const otherId = await t.run((ctx) =>
    ctx.db.insert('participants', {
      fullName: 'Other Person',
      icPassportNumber: 'B7654321',
      email: 'other@example.com',
      phone: '+60198765432'
    })
  );

  await expect(
    t.withIdentity(admin).mutation(api.participants.update, {
      participantId,
      ...validParticipant,
      icPassportNumber: 'B7654321'
    })
  ).rejects.toThrow();

  const other = await t.run((ctx) => ctx.db.get(otherId));
  expect(other!.icPassportNumber).toBe('B7654321');
});

test('update re-submitting the same IC/passport number does not conflict with itself', async () => {
  const t = convexTest(schema, modules);
  const participantId = await seedParticipant(t);

  await t.withIdentity(admin).mutation(api.participants.update, {
    participantId,
    ...validParticipant,
    fullName: 'Jane Roe'
  });

  const participant = await t.run((ctx) => ctx.db.get(participantId));
  expect(participant).toMatchObject({ ...validParticipant, fullName: 'Jane Roe' });
});

test('update saves the new field values', async () => {
  const t = convexTest(schema, modules);
  const participantId = await seedParticipant(t);

  await t.withIdentity(admin).mutation(api.participants.update, {
    participantId,
    fullName: 'Jane Roe',
    icPassportNumber: 'C9999999',
    email: 'jane.roe@example.com',
    phone: '+60111222333'
  });

  const participant = await t.run((ctx) => ctx.db.get(participantId));
  expect(participant).toMatchObject({
    fullName: 'Jane Roe',
    icPassportNumber: 'C9999999',
    email: 'jane.roe@example.com',
    phone: '+60111222333'
  });
});

// `remove` derives "today" from the real clock rather than taking it as an
// argument (see convex/participants.ts), so these Trip fixtures are dated
// relative to the actual current date instead of a fixed string — a fixed
// past/future date would silently drift as time passes.
function daysFromToday(offsetDays: number) {
  return new Date(Date.now() + offsetDays * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
}

async function seedTrip(
  t: ReturnType<typeof convexTest>,
  overrides: { startDate: string; endDate: string }
) {
  return await t.run((ctx) =>
    ctx.db.insert('trips', {
      name: 'Sample Trip',
      destination: 'Somewhere',
      startDate: overrides.startDate,
      endDate: overrides.endDate,
      capacity: 10,
      price: 100,
      createdBy: staff.subject
    })
  );
}

async function seedRegistration(
  t: ReturnType<typeof convexTest>,
  args: {
    tripId: Id<'trips'>;
    participantId: Id<'participants'>;
    paymentStatus: Doc<'registrations'>['paymentStatus'];
  }
) {
  return await t.run((ctx) =>
    ctx.db.insert('registrations', {
      tripId: args.tripId,
      participantId: args.participantId,
      paymentStatus: args.paymentStatus,
      registrationStatus: 'registered',
      registeredAt: Date.now(),
      registeredBy: staff.subject
    })
  );
}

test('remove rejects an unauthenticated caller', async () => {
  const t = convexTest(schema, modules);
  const participantId = await seedParticipant(t);

  await expect(t.mutation(api.participants.remove, { participantId })).rejects.toThrow();
});

test('remove rejects an authenticated caller with no role assigned', async () => {
  const t = convexTest(schema, modules);
  const participantId = await seedParticipant(t);

  await expect(
    t.withIdentity(roleless).mutation(api.participants.remove, { participantId })
  ).rejects.toThrow();
});

test('remove rejects a Staff caller', async () => {
  const t = convexTest(schema, modules);
  const participantId = await seedParticipant(t);

  await expect(
    t.withIdentity(staff).mutation(api.participants.remove, { participantId })
  ).rejects.toThrow();

  expect(await t.run((ctx) => ctx.db.get(participantId))).not.toBeNull();
});

test('remove rejects a non-existent Participant', async () => {
  const t = convexTest(schema, modules);
  const participantId = await seedParticipant(t);
  await t.run((ctx) => ctx.db.delete(participantId));

  await expect(
    t.withIdentity(admin).mutation(api.participants.remove, { participantId })
  ).rejects.toThrow();
});

test('remove deletes a Participant with no Registrations', async () => {
  const t = convexTest(schema, modules);
  const participantId = await seedParticipant(t);

  await t.withIdentity(admin).mutation(api.participants.remove, { participantId });

  expect(await t.run((ctx) => ctx.db.get(participantId))).toBeNull();
});

test('remove rejects a Participant with a paid Registration for an ongoing Trip', async () => {
  const t = convexTest(schema, modules);
  const participantId = await seedParticipant(t);
  const tripId = await seedTrip(t, { startDate: daysFromToday(-5), endDate: daysFromToday(5) });
  await seedRegistration(t, { tripId, participantId, paymentStatus: 'paid' });

  await expect(
    t.withIdentity(admin).mutation(api.participants.remove, { participantId })
  ).rejects.toThrow();

  expect(await t.run((ctx) => ctx.db.get(participantId))).not.toBeNull();
});

test('remove rejects a Participant with a paid Registration for an upcoming Trip', async () => {
  const t = convexTest(schema, modules);
  const participantId = await seedParticipant(t);
  const tripId = await seedTrip(t, { startDate: daysFromToday(5), endDate: daysFromToday(10) });
  await seedRegistration(t, { tripId, participantId, paymentStatus: 'paid' });

  await expect(
    t.withIdentity(admin).mutation(api.participants.remove, { participantId })
  ).rejects.toThrow();

  expect(await t.run((ctx) => ctx.db.get(participantId))).not.toBeNull();
});

test('remove allows a Participant whose paid Registration is for a completed Trip', async () => {
  const t = convexTest(schema, modules);
  const participantId = await seedParticipant(t);
  const tripId = await seedTrip(t, { startDate: daysFromToday(-10), endDate: daysFromToday(-5) });
  await seedRegistration(t, { tripId, participantId, paymentStatus: 'paid' });

  await t.withIdentity(admin).mutation(api.participants.remove, { participantId });

  expect(await t.run((ctx) => ctx.db.get(participantId))).toBeNull();
});

test('remove allows a Participant whose ongoing-Trip Registration is unpaid', async () => {
  const t = convexTest(schema, modules);
  const participantId = await seedParticipant(t);
  const tripId = await seedTrip(t, { startDate: daysFromToday(-5), endDate: daysFromToday(5) });
  await seedRegistration(t, { tripId, participantId, paymentStatus: 'unpaid' });

  await t.withIdentity(admin).mutation(api.participants.remove, { participantId });

  expect(await t.run((ctx) => ctx.db.get(participantId))).toBeNull();
});

test('remove allows a Participant whose ongoing-Trip Registration is refunded', async () => {
  const t = convexTest(schema, modules);
  const participantId = await seedParticipant(t);
  const tripId = await seedTrip(t, { startDate: daysFromToday(-5), endDate: daysFromToday(5) });
  await seedRegistration(t, { tripId, participantId, paymentStatus: 'refunded' });

  await t.withIdentity(admin).mutation(api.participants.remove, { participantId });

  expect(await t.run((ctx) => ctx.db.get(participantId))).toBeNull();
});

test('remove cascades the Registrations and their activity history', async () => {
  const t = convexTest(schema, modules);
  const participantId = await seedParticipant(t);
  const tripId = await seedTrip(t, { startDate: daysFromToday(-10), endDate: daysFromToday(-5) });
  const registrationId = await seedRegistration(t, {
    tripId,
    participantId,
    paymentStatus: 'unpaid'
  });
  await t.run((ctx) =>
    ctx.db.insert('activityLogs', {
      registrationId,
      field: 'paymentStatus',
      oldValue: 'unpaid',
      newValue: 'paid',
      changedBy: staff.subject,
      changedAt: Date.now()
    })
  );

  await t.withIdentity(admin).mutation(api.participants.remove, { participantId });

  expect(await t.run((ctx) => ctx.db.get(registrationId))).toBeNull();
  const remainingLogs = await t.run((ctx) =>
    ctx.db
      .query('activityLogs')
      .withIndex('by_registration_and_changedAt', (q) => q.eq('registrationId', registrationId))
      .collect()
  );
  expect(remainingLogs).toHaveLength(0);
});

test('remove deletes the passport file along with the Participant', async () => {
  const t = convexTest(schema, modules);
  const participantId = await seedParticipant(t);
  const storageId = await t.run((ctx) => ctx.storage.store(samplePdf()));
  await t.withIdentity(staff).mutation(api.participants.setPassport, { participantId, storageId });

  await t.withIdentity(admin).mutation(api.participants.remove, { participantId });

  expect(await t.run((ctx) => ctx.storage.getUrl(storageId))).toBeNull();
});

test('setPassport re-submitting the currently attached file does not delete it', async () => {
  const t = convexTest(schema, modules);
  const participantId = await seedParticipant(t);
  const asStaff = t.withIdentity(staff);

  const storageId = await t.run((ctx) => ctx.storage.store(samplePdf()));
  await asStaff.mutation(api.participants.setPassport, { participantId, storageId });

  // Not a flow the UI itself drives (each upload mints a fresh storage id),
  // but nothing stops a direct call from resubmitting the id already on
  // file — that must be a no-op, not a self-inflicted deletion.
  await asStaff.mutation(api.participants.setPassport, { participantId, storageId });

  const participant = await t.run((ctx) => ctx.db.get(participantId));
  expect(participant!.passportFileId).toEqual(storageId);

  const result = await asStaff.query(api.participants.get, { participantId });
  expect(result!.passportUrl).not.toBeNull();
});
