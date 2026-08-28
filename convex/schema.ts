import { defineSchema, defineTable } from 'convex/server';
import { v } from 'convex/values';

export default defineSchema({
  trips: defineTable({
    name: v.string(),
    destination: v.string(),
    startDate: v.string(),
    endDate: v.string(),
    capacity: v.number(),
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
    registeredBy: v.string()
  })
    .index('by_trip', ['tripId'])
    .index('by_participant', ['participantId']),

  activityLogs: defineTable({
    registrationId: v.id('registrations'),
    field: v.union(v.literal('paymentStatus'), v.literal('registrationStatus')),
    oldValue: v.string(),
    newValue: v.string(),
    changedBy: v.string(),
    changedAt: v.number()
  }).index('by_registration', ['registrationId'])
});
