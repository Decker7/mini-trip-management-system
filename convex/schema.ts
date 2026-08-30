import { defineSchema, defineTable } from 'convex/server';
import { v } from 'convex/values';

export default defineSchema({
  trips: defineTable({
    name: v.string(),
    destination: v.string(),
    startDate: v.string(),
    endDate: v.string(),
    capacity: v.number(),
    // Optional at the schema level so pre-existing Trips (created before this
    // field existed) stay valid; `create`/`update` require it for all new writes.
    price: v.optional(v.number()),
    description: v.optional(v.string()),
    createdBy: v.string()
  }),

  participants: defineTable({
    fullName: v.string(),
    icPassportNumber: v.string(),
    email: v.string(),
    phone: v.string(),
    passportFileId: v.optional(v.id('_storage'))
  }).index('by_icPassportNumber', ['icPassportNumber']),

  registrations: defineTable({
    tripId: v.id('trips'),
    participantId: v.id('participants'),
    paymentStatus: v.union(v.literal('unpaid'), v.literal('paid'), v.literal('refunded')),
    registrationStatus: v.union(v.literal('registered'), v.literal('cancelled')),
    registeredAt: v.number(),
    registeredBy: v.string(),
    // A Payment Link outstanding or most-recently sent for this Registration.
    // All three are set together and cleared together (paid or expired).
    paymentLinkSessionId: v.optional(v.string()),
    paymentLinkSentAt: v.optional(v.number()),
    paymentLinkSentBy: v.optional(v.string()),
    // Who last set `paymentStatus` — a Clerk subject, or `STRIPE_SYSTEM_ACTOR`
    // when Stripe's webhook confirmed the payment. Paid + this constant is
    // what locks the Roster dropdown down to the Refunded escape hatch.
    paymentStatusSetBy: v.optional(v.string())
  })
    .index('by_trip', ['tripId'])
    .index('by_participant', ['participantId'])
    .index('by_trip_and_participant', ['tripId', 'participantId'])
    .index('by_paymentStatus', ['paymentStatus'])
    .index('by_participant_and_paymentStatus', ['participantId', 'paymentStatus'])
    .index('by_trip_and_paymentStatus', ['tripId', 'paymentStatus'])
    .index('by_participant_and_trip_and_paymentStatus', [
      'participantId',
      'tripId',
      'paymentStatus'
    ]),

  activityLogs: defineTable({
    registrationId: v.id('registrations'),
    field: v.union(v.literal('paymentStatus'), v.literal('registrationStatus')),
    oldValue: v.string(),
    newValue: v.string(),
    changedBy: v.string(),
    changedAt: v.number()
  }).index('by_registration_and_changedAt', ['registrationId', 'changedAt']),

  notificationReads: defineTable({
    userId: v.string(),
    registrationId: v.id('registrations'),
    readAt: v.number()
  }).index('by_user_and_registration', ['userId', 'registrationId'])
});
