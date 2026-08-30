import { httpRouter } from 'convex/server';
import Stripe from 'stripe';
import { httpAction, env } from './_generated/server';
import { internal } from './_generated/api';
import type { Id } from './_generated/dataModel';

/**
 * `sendPaymentLink` stamps every Checkout Session with the Registration it
 * belongs to, immutably, at creation — read that back rather than trying to
 * resolve a Registration from the session id itself, which can change (a
 * resend overwrites it) independently of the session.
 */
function registrationIdFromSession(session: Stripe.Checkout.Session): Id<'registrations'> | null {
  const registrationId = session.metadata?.registrationId;
  return registrationId ? (registrationId as Id<'registrations'>) : null;
}

const http = httpRouter();

http.route({
  path: '/stripe/webhook',
  method: 'POST',
  handler: httpAction(async (ctx, request) => {
    const signature = request.headers.get('stripe-signature');
    if (!signature || !env.STRIPE_SECRET_KEY || !env.STRIPE_WEBHOOK_SECRET) {
      return new Response('Stripe is not configured.', { status: 400 });
    }

    // The fetch-based http client and Web Crypto-based signature provider
    // avoid any dependency on Node built-ins, so this file stays on Convex's
    // default runtime rather than needing "use node".
    const stripe = new Stripe(env.STRIPE_SECRET_KEY, {
      httpClient: Stripe.createFetchHttpClient()
    });
    const cryptoProvider = Stripe.createSubtleCryptoProvider();

    // Signature verification needs the exact raw bytes Stripe signed —
    // parsing as JSON first would let whitespace/key-order differences break
    // the signature check.
    const body = await request.text();

    let event: Stripe.Event;
    try {
      event = await stripe.webhooks.constructEventAsync(
        body,
        signature,
        env.STRIPE_WEBHOOK_SECRET,
        undefined,
        cryptoProvider
      );
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Invalid signature';
      return new Response(message, { status: 400 });
    }

    switch (event.type) {
      case 'checkout.session.completed': {
        const session = event.data.object as Stripe.Checkout.Session;
        const registrationId = registrationIdFromSession(session);
        if (registrationId) {
          await ctx.runMutation(internal.registrations.markPaidFromStripeSession, {
            registrationId
          });
        }
        break;
      }
      case 'checkout.session.expired': {
        const session = event.data.object as Stripe.Checkout.Session;
        const registrationId = registrationIdFromSession(session);
        if (registrationId) {
          await ctx.runMutation(internal.registrations.clearExpiredPaymentLink, {
            registrationId,
            sessionId: session.id
          });
        }
        break;
      }
      default:
        break;
    }

    return new Response(null, { status: 200 });
  })
});

export default http;
