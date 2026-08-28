/// <reference types="vite/client" />
import { convexTest } from 'convex-test';
import { expect, test } from 'vitest';
import { api } from './_generated/api';
import schema from './schema';

const modules = import.meta.glob('./**/*.ts');

const staff = { subject: 'user_staff', role: 'staff' as const };

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

test('setPassport rejects an unauthenticated caller', async () => {
  const t = convexTest(schema, modules);
  const participantId = await seedParticipant(t);
  const storageId = await t.run((ctx) => ctx.storage.store(samplePdf()));

  await expect(
    t.mutation(api.participants.setPassport, { participantId, storageId })
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
