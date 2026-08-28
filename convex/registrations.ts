import { ConvexError, v } from 'convex/values';
import { mutation, query } from './_generated/server';
import { requireIdentity } from './lib/identity';

const paymentStatus = v.union(v.literal('unpaid'), v.literal('paid'), v.literal('refunded'));

function validateParticipantFields(args: {
  fullName: string;
  icPassportNumber: string;
  email: string;
  phone: string;
}) {
  if (!args.fullName.trim()) {
    throw new ConvexError('Full name is required.');
  }
  if (!args.icPassportNumber.trim()) {
    throw new ConvexError('IC/passport number is required.');
  }
  if (!args.email.trim()) {
    throw new ConvexError('Email is required.');
  }
  if (!args.phone.trim()) {
    throw new ConvexError('Phone is required.');
  }
}

export const register = mutation({
  args: {
    tripId: v.id('trips'),
    fullName: v.string(),
    icPassportNumber: v.string(),
    email: v.string(),
    phone: v.string()
  },
  handler: async (ctx, args) => {
    const identity = await requireIdentity(ctx);
    validateParticipantFields(args);

    const trip = await ctx.db.get(args.tripId);
    if (!trip) {
      throw new ConvexError('Trip not found.');
    }

    const existingParticipant = await ctx.db
      .query('participants')
      .withIndex('by_icPassportNumber', (q) => q.eq('icPassportNumber', args.icPassportNumber))
      .first();

    let participantId;
    if (existingParticipant) {
      participantId = existingParticipant._id;
      await ctx.db.patch(participantId, {
        fullName: args.fullName,
        email: args.email,
        phone: args.phone
      });
    } else {
      participantId = await ctx.db.insert('participants', {
        fullName: args.fullName,
        icPassportNumber: args.icPassportNumber,
        email: args.email,
        phone: args.phone
      });
    }

    const existingRegistrations = await ctx.db
      .query('registrations')
      .withIndex('by_trip_and_participant', (q) =>
        q.eq('tripId', args.tripId).eq('participantId', participantId)
      )
      .collect();
    if (
      existingRegistrations.some((registration) => registration.registrationStatus !== 'cancelled')
    ) {
      throw new ConvexError('This Participant is already registered for this Trip.');
    }

    const tripRegistrations = await ctx.db
      .query('registrations')
      .withIndex('by_trip', (q) => q.eq('tripId', args.tripId))
      .collect();
    const activeCount = tripRegistrations.filter(
      (registration) => registration.registrationStatus !== 'cancelled'
    ).length;
    if (activeCount >= trip.capacity) {
      throw new ConvexError('This Trip is already at full capacity.');
    }

    return await ctx.db.insert('registrations', {
      tripId: args.tripId,
      participantId,
      paymentStatus: 'unpaid',
      registrationStatus: 'registered',
      registeredAt: Date.now(),
      registeredBy: identity.subject
    });
  }
});

export const cancel = mutation({
  args: { registrationId: v.id('registrations') },
  handler: async (ctx, args) => {
    await requireIdentity(ctx);
    const registration = await ctx.db.get(args.registrationId);
    if (!registration) {
      throw new ConvexError('Registration not found.');
    }
    if (registration.registrationStatus === 'cancelled') {
      throw new ConvexError('This Registration is already cancelled.');
    }
    await ctx.db.patch(args.registrationId, { registrationStatus: 'cancelled' });
  }
});

export const setPaymentStatus = mutation({
  args: { registrationId: v.id('registrations'), paymentStatus },
  handler: async (ctx, args) => {
    await requireIdentity(ctx);
    const registration = await ctx.db.get(args.registrationId);
    if (!registration) {
      throw new ConvexError('Registration not found.');
    }
    await ctx.db.patch(args.registrationId, { paymentStatus: args.paymentStatus });
  }
});

export const listAll = query({
  args: {
    search: v.optional(v.string()),
    tripId: v.optional(v.id('trips')),
    paymentStatus: v.optional(paymentStatus)
  },
  handler: async (ctx, args) => {
    await requireIdentity(ctx);

    // Filtering (search/paymentStatus) happens in-memory below, so the fetch
    // must not truncate before filtering or a match outside the truncated
    // window would silently disappear from filtered results. This bound is
    // set high enough that it never truncates at this app's realistic scale,
    // while staying well under Convex's per-query read ceiling so an
    // unusually large table degrades to "may omit very old rows" rather than
    // throwing and breaking the page outright.
    const UNSCOPED_REGISTRATIONS_LIMIT = 5000;
    const registrations = args.tripId
      ? await ctx.db
          .query('registrations')
          .withIndex('by_trip', (q) => q.eq('tripId', args.tripId!))
          .collect()
      : await ctx.db.query('registrations').order('desc').take(UNSCOPED_REGISTRATIONS_LIMIT);

    const search = args.search?.trim().toLowerCase();

    const filtered = registrations.filter(
      (registration) => !args.paymentStatus || registration.paymentStatus === args.paymentStatus
    );

    const uniqueTripIds = [...new Set(filtered.map((registration) => registration.tripId))];
    const trips = await Promise.all(uniqueTripIds.map((tripId) => ctx.db.get(tripId)));
    const tripById = new Map(uniqueTripIds.map((tripId, index) => [tripId, trips[index]]));

    const joined = await Promise.all(
      filtered.map(async (registration) => {
        const participant = await ctx.db.get(registration.participantId);
        const trip = tripById.get(registration.tripId);
        return {
          _id: registration._id,
          tripId: registration.tripId,
          tripName: trip?.name ?? '',
          participantId: registration.participantId,
          fullName: participant?.fullName ?? '',
          icPassportNumber: participant?.icPassportNumber ?? '',
          email: participant?.email ?? '',
          phone: participant?.phone ?? '',
          paymentStatus: registration.paymentStatus,
          registrationStatus: registration.registrationStatus,
          registeredAt: registration.registeredAt
        };
      })
    );

    if (!search) return joined;

    return joined.filter(
      (entry) =>
        entry.fullName.toLowerCase().includes(search) ||
        entry.icPassportNumber.toLowerCase().includes(search)
    );
  }
});

export const listByTrip = query({
  args: { tripId: v.id('trips') },
  handler: async (ctx, args) => {
    await requireIdentity(ctx);
    const registrations = await ctx.db
      .query('registrations')
      .withIndex('by_trip', (q) => q.eq('tripId', args.tripId))
      .collect();

    return await Promise.all(
      registrations.map(async (registration) => {
        const participant = await ctx.db.get(registration.participantId);
        return {
          _id: registration._id,
          participantId: registration.participantId,
          fullName: participant?.fullName ?? '',
          icPassportNumber: participant?.icPassportNumber ?? '',
          email: participant?.email ?? '',
          phone: participant?.phone ?? '',
          paymentStatus: registration.paymentStatus,
          registrationStatus: registration.registrationStatus,
          registeredAt: registration.registeredAt
        };
      })
    );
  }
});
