/// <reference types="vite/client" />
import { convexTest } from 'convex-test';
import Stripe from 'stripe';
import { afterEach, expect, test, vi } from 'vitest';
import { api, internal } from './_generated/api';
import type { Id } from './_generated/dataModel';
import schema from './schema';

const modules = import.meta.glob('./**/*.ts');

const admin = { subject: 'user_admin', role: 'admin' as const };
const staff = { subject: 'user_staff', role: 'staff' as const };

const STRIPE_SECRET_KEY = 'sk_test_fake';
const STRIPE_WEBHOOK_SECRET = 'whsec_test_fake';

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

function checkoutSessionEvent(
  type: string,
  sessionId: string,
  registrationId: Id<'registrations'> | null
) {
  return {
    id: 'evt_test_1',
    object: 'event',
    api_version: '2025-01-01',
    created: 1_700_000_000,
    type,
    data: {
      object: {
        id: sessionId,
        object: 'checkout.session',
        metadata: registrationId ? { registrationId } : {}
      }
    }
  };
}

async function signedPayload(event: unknown) {
  const payload = JSON.stringify(event);
  const signature = await Stripe.webhooks.generateTestHeaderStringAsync({
    payload,
    secret: STRIPE_WEBHOOK_SECRET,
    cryptoProvider: Stripe.createSubtleCryptoProvider()
  });
  return { payload, signature };
}

afterEach(() => {
  vi.unstubAllEnvs();
});

test('the webhook rejects a request with no Stripe signature header', async () => {
  vi.stubEnv('STRIPE_SECRET_KEY', STRIPE_SECRET_KEY);
  vi.stubEnv('STRIPE_WEBHOOK_SECRET', STRIPE_WEBHOOK_SECRET);
  const t = convexTest(schema, modules);

  const response = await t.fetch('/stripe/webhook', {
    method: 'POST',
    body: JSON.stringify(checkoutSessionEvent('checkout.session.completed', 'cs_test_1', null))
  });

  expect(response.status).toBe(400);
});

test('the webhook rejects an unconfigured Stripe (no secret/webhook key set)', async () => {
  const t = convexTest(schema, modules);

  const response = await t.fetch('/stripe/webhook', {
    method: 'POST',
    headers: { 'stripe-signature': 'anything' },
    body: JSON.stringify(checkoutSessionEvent('checkout.session.completed', 'cs_test_1', null))
  });

  expect(response.status).toBe(400);
});

test('the webhook rejects an invalid signature', async () => {
  vi.stubEnv('STRIPE_SECRET_KEY', STRIPE_SECRET_KEY);
  vi.stubEnv('STRIPE_WEBHOOK_SECRET', STRIPE_WEBHOOK_SECRET);
  const t = convexTest(schema, modules);

  const response = await t.fetch('/stripe/webhook', {
    method: 'POST',
    headers: { 'stripe-signature': 't=1700000000,v1=not-a-real-signature' },
    body: JSON.stringify(checkoutSessionEvent('checkout.session.completed', 'cs_test_1', null))
  });

  expect(response.status).toBe(400);
});

test('a validly signed checkout.session.completed marks the Registration Paid', async () => {
  vi.stubEnv('STRIPE_SECRET_KEY', STRIPE_SECRET_KEY);
  vi.stubEnv('STRIPE_WEBHOOK_SECRET', STRIPE_WEBHOOK_SECRET);
  const t = convexTest(schema, modules);

  const tripId = await t.withIdentity(admin).mutation(api.trips.create, validTrip);
  const registrationId = await t
    .withIdentity(staff)
    .mutation(api.registrations.register, { tripId, ...validParticipant });
  await t.mutation(internal.registrations.recordPaymentLinkSent, {
    registrationId,
    sessionId: 'cs_test_webhook_paid',
    sentAt: 1_000,
    sentBy: staff.subject
  });

  const { payload, signature } = await signedPayload(
    checkoutSessionEvent('checkout.session.completed', 'cs_test_webhook_paid', registrationId)
  );
  const response = await t.fetch('/stripe/webhook', {
    method: 'POST',
    headers: { 'stripe-signature': signature },
    body: payload
  });

  expect(response.status).toBe(200);
  const registration = await t.run((ctx) => ctx.db.get(registrationId));
  expect(registration?.paymentStatus).toBe('paid');
  expect(registration?.paymentLinkSessionId).toBeUndefined();
});

test('a completed payment on a session superseded by a resend still marks the Registration Paid', async () => {
  // Resending overwrites paymentLinkSessionId, but Stripe does not invalidate
  // the Checkout Session it replaces, so the participant can still pay via
  // the old link. The webhook must recognize that payment anyway.
  vi.stubEnv('STRIPE_SECRET_KEY', STRIPE_SECRET_KEY);
  vi.stubEnv('STRIPE_WEBHOOK_SECRET', STRIPE_WEBHOOK_SECRET);
  const t = convexTest(schema, modules);

  const tripId = await t.withIdentity(admin).mutation(api.trips.create, validTrip);
  const registrationId = await t
    .withIdentity(staff)
    .mutation(api.registrations.register, { tripId, ...validParticipant });
  await t.mutation(internal.registrations.recordPaymentLinkSent, {
    registrationId,
    sessionId: 'cs_test_old',
    sentAt: 1_000,
    sentBy: staff.subject
  });
  await t.mutation(internal.registrations.recordPaymentLinkSent, {
    registrationId,
    sessionId: 'cs_test_new',
    sentAt: 2_000,
    sentBy: staff.subject
  });

  const { payload, signature } = await signedPayload(
    checkoutSessionEvent('checkout.session.completed', 'cs_test_old', registrationId)
  );
  const response = await t.fetch('/stripe/webhook', {
    method: 'POST',
    headers: { 'stripe-signature': signature },
    body: payload
  });

  expect(response.status).toBe(200);
  const registration = await t.run((ctx) => ctx.db.get(registrationId));
  expect(registration?.paymentStatus).toBe('paid');
});

test('a validly signed checkout.session.expired clears the Payment Link fields', async () => {
  vi.stubEnv('STRIPE_SECRET_KEY', STRIPE_SECRET_KEY);
  vi.stubEnv('STRIPE_WEBHOOK_SECRET', STRIPE_WEBHOOK_SECRET);
  const t = convexTest(schema, modules);

  const tripId = await t.withIdentity(admin).mutation(api.trips.create, validTrip);
  const registrationId = await t
    .withIdentity(staff)
    .mutation(api.registrations.register, { tripId, ...validParticipant });
  await t.mutation(internal.registrations.recordPaymentLinkSent, {
    registrationId,
    sessionId: 'cs_test_webhook_expired',
    sentAt: 1_000,
    sentBy: staff.subject
  });

  const { payload, signature } = await signedPayload(
    checkoutSessionEvent('checkout.session.expired', 'cs_test_webhook_expired', registrationId)
  );
  const response = await t.fetch('/stripe/webhook', {
    method: 'POST',
    headers: { 'stripe-signature': signature },
    body: payload
  });

  expect(response.status).toBe(200);
  const registration = await t.run((ctx) => ctx.db.get(registrationId));
  expect(registration?.paymentStatus).toBe('unpaid');
  expect(registration?.paymentLinkSessionId).toBeUndefined();
});

test('an expiry notification for a session superseded by a resend leaves the newer link untouched', async () => {
  vi.stubEnv('STRIPE_SECRET_KEY', STRIPE_SECRET_KEY);
  vi.stubEnv('STRIPE_WEBHOOK_SECRET', STRIPE_WEBHOOK_SECRET);
  const t = convexTest(schema, modules);

  const tripId = await t.withIdentity(admin).mutation(api.trips.create, validTrip);
  const registrationId = await t
    .withIdentity(staff)
    .mutation(api.registrations.register, { tripId, ...validParticipant });
  await t.mutation(internal.registrations.recordPaymentLinkSent, {
    registrationId,
    sessionId: 'cs_test_old',
    sentAt: 1_000,
    sentBy: staff.subject
  });
  await t.mutation(internal.registrations.recordPaymentLinkSent, {
    registrationId,
    sessionId: 'cs_test_new',
    sentAt: 2_000,
    sentBy: staff.subject
  });

  const { payload, signature } = await signedPayload(
    checkoutSessionEvent('checkout.session.expired', 'cs_test_old', registrationId)
  );
  const response = await t.fetch('/stripe/webhook', {
    method: 'POST',
    headers: { 'stripe-signature': signature },
    body: payload
  });

  expect(response.status).toBe(200);
  const registration = await t.run((ctx) => ctx.db.get(registrationId));
  expect(registration).toMatchObject({
    paymentLinkSessionId: 'cs_test_new',
    paymentLinkSentAt: 2_000
  });
});

test('an unrecognized event type is accepted but changes nothing', async () => {
  vi.stubEnv('STRIPE_SECRET_KEY', STRIPE_SECRET_KEY);
  vi.stubEnv('STRIPE_WEBHOOK_SECRET', STRIPE_WEBHOOK_SECRET);
  const t = convexTest(schema, modules);

  const tripId = await t.withIdentity(admin).mutation(api.trips.create, validTrip);
  const registrationId = await t
    .withIdentity(staff)
    .mutation(api.registrations.register, { tripId, ...validParticipant });
  await t.mutation(internal.registrations.recordPaymentLinkSent, {
    registrationId,
    sessionId: 'cs_test_unrelated',
    sentAt: 1_000,
    sentBy: staff.subject
  });

  const { payload, signature } = await signedPayload(
    checkoutSessionEvent('payment_intent.succeeded', 'cs_test_unrelated', registrationId)
  );
  const response = await t.fetch('/stripe/webhook', {
    method: 'POST',
    headers: { 'stripe-signature': signature },
    body: payload
  });

  expect(response.status).toBe(200);
  const registration = await t.run((ctx) => ctx.db.get(registrationId));
  expect(registration?.paymentStatus).toBe('unpaid');
  expect(registration?.paymentLinkSessionId).toBe('cs_test_unrelated');
});

test('a completed session with no registrationId in its metadata is accepted but changes nothing', async () => {
  vi.stubEnv('STRIPE_SECRET_KEY', STRIPE_SECRET_KEY);
  vi.stubEnv('STRIPE_WEBHOOK_SECRET', STRIPE_WEBHOOK_SECRET);
  const t = convexTest(schema, modules);

  const { payload, signature } = await signedPayload(
    checkoutSessionEvent('checkout.session.completed', 'cs_test_no_metadata', null)
  );
  const response = await t.fetch('/stripe/webhook', {
    method: 'POST',
    headers: { 'stripe-signature': signature },
    body: payload
  });

  expect(response.status).toBe(200);
});
