'use node';

import Stripe from 'stripe';
import { ConvexError, v } from 'convex/values';
import { action, env } from './_generated/server';
import { internal } from './_generated/api';
import { requireAssignedRole } from './lib/identity';

/** Stripe expects amounts in the smallest unit of the currency — sen, for MYR. */
function toSubunits(amount: number) {
  return Math.round(amount * 100);
}

/**
 * Creates a Stripe Checkout Session for a Registration's Trip price and
 * emails it to the Participant via Resend. Nothing is persisted on the
 * Registration unless both the Stripe call and the email send succeed — see
 * `registrations.recordPaymentLinkSent`.
 */
export const sendPaymentLink = action({
  args: { registrationId: v.id('registrations') },
  handler: async (ctx, args) => {
    const identity = await requireAssignedRole(ctx);

    const info = await ctx.runQuery(internal.registrations.getSendablePaymentLinkInfo, {
      registrationId: args.registrationId
    });

    if (!env.STRIPE_SECRET_KEY) {
      throw new ConvexError('Stripe is not configured yet.');
    }
    if (!env.RESEND_API_KEY || !env.RESEND_FROM_EMAIL) {
      throw new ConvexError('Email sending is not configured yet.');
    }

    const stripe = new Stripe(env.STRIPE_SECRET_KEY);
    const session = await stripe.checkout.sessions.create({
      mode: 'payment',
      payment_method_types: ['card'],
      line_items: [
        {
          price_data: {
            currency: 'myr',
            product_data: { name: `${info.tripName} — Trip payment` },
            unit_amount: toSubunits(info.price)
          },
          quantity: 1
        }
      ],
      customer_email: info.participantEmail,
      success_url: `${env.APP_URL}/payment/success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${env.APP_URL}/payment/cancelled`,
      metadata: { registrationId: args.registrationId }
    });
    if (!session.url) {
      throw new ConvexError('Stripe did not return a checkout URL for this session.');
    }

    const emailResponse = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${env.RESEND_API_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        from: env.RESEND_FROM_EMAIL,
        to: info.participantEmail,
        subject: `Payment link for ${info.tripName}`,
        html:
          `<p>Please pay for <strong>${info.tripName}</strong> ` +
          `(RM ${info.price.toFixed(2)}) using the link below:</p>` +
          `<p><a href="${session.url}">${session.url}</a></p>`
      })
    });
    if (!emailResponse.ok) {
      const body = await emailResponse.text();
      throw new ConvexError(`Failed to send the payment-link email: ${body}`);
    }

    await ctx.runMutation(internal.registrations.recordPaymentLinkSent, {
      registrationId: args.registrationId,
      sessionId: session.id,
      sentAt: Date.now(),
      sentBy: identity.subject
    });

    return null;
  }
});
