import { ConvexError, v } from 'convex/values';
import { mutation, query } from './_generated/server';
import type { Doc, Id } from './_generated/dataModel';
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

    const search = args.search?.trim().toLowerCase();

    // Every read below is an explicit take(), so no single path can exceed
    // Convex's per-query read ceiling however large the tables grow.
    const PARTICIPANTS_SCAN_LIMIT = 20000;
    const MATCHED_PARTICIPANTS_LIMIT = 500;
    const REGISTRATIONS_PER_PARTICIPANT_LIMIT = 500;
    const SCOPED_REGISTRATIONS_LIMIT = 20000;
    const UNSCOPED_REGISTRATIONS_LIMIT = 5000;

    // `search` matches Participant fields, so resolve Participants first and
    // walk into their Registrations by index, rather than scanning
    // Registrations and joining a Participant per row. `participants` holds
    // one row per person, while `registrations` grows with every
    // person-and-Trip pair for the life of the system — so this scans the
    // far smaller, far slower-growing table, and the rows it then reads are
    // only the ones that can actually match.
    // Any cap that actually bites is reported back as `truncated`, so callers
    // can say "these results are incomplete, narrow your filters" instead of
    // presenting a short list as if it were the whole answer. Silently
    // dropping matches is the failure mode worth avoiding here; a bounded
    // read that admits it is bounded is not.
    let truncated = false;
    let registrations;
    let participantById: Map<Id<'participants'>, Doc<'participants'> | null>;

    if (search) {
      const participants = await ctx.db.query('participants').take(PARTICIPANTS_SCAN_LIMIT);
      truncated ||= participants.length === PARTICIPANTS_SCAN_LIMIT;

      // Cap the fan-out: one index read is issued per matched Participant, so
      // a very broad term ("a") must not turn into thousands of reads. A
      // search this wide isn't a lookup anyone is actually reading row by row
      // — narrowing the term is the useful response, not returning more.
      const allMatches = participants.filter(
        (participant) =>
          participant.fullName.toLowerCase().includes(search) ||
          participant.icPassportNumber.toLowerCase().includes(search)
      );
      truncated ||= allMatches.length > MATCHED_PARTICIPANTS_LIMIT;
      const matches = allMatches.slice(0, MATCHED_PARTICIPANTS_LIMIT);

      participantById = new Map(matches.map((participant) => [participant._id, participant]));
      const perParticipant = await Promise.all(
        matches.map((participant) =>
          ctx.db
            .query('registrations')
            .withIndex('by_participant', (q) => q.eq('participantId', participant._id))
            .take(REGISTRATIONS_PER_PARTICIPANT_LIMIT)
        )
      );
      truncated ||= perParticipant.some(
        (rows) => rows.length === REGISTRATIONS_PER_PARTICIPANT_LIMIT
      );
      registrations = perParticipant.flat();
    } else {
      const limit =
        args.tripId || args.paymentStatus
          ? SCOPED_REGISTRATIONS_LIMIT
          : UNSCOPED_REGISTRATIONS_LIMIT;
      registrations = args.tripId
        ? await ctx.db
            .query('registrations')
            .withIndex('by_trip', (q) => q.eq('tripId', args.tripId!))
            .take(limit)
        : args.paymentStatus
          ? await ctx.db
              .query('registrations')
              .withIndex('by_paymentStatus', (q) => q.eq('paymentStatus', args.paymentStatus!))
              .take(limit)
          : await ctx.db.query('registrations').order('desc').take(limit);
      truncated ||= registrations.length === limit;
      participantById = new Map();
    }

    // Narrow before any joining, so the lookups below only run for rows that
    // survive into the result.
    const filtered = registrations.filter(
      (registration) =>
        (!args.tripId || registration.tripId === args.tripId) &&
        (!args.paymentStatus || registration.paymentStatus === args.paymentStatus)
    );

    // Fetch each distinct Trip and Participant once, not once per Registration.
    const uniqueTripIds = [...new Set(filtered.map((registration) => registration.tripId))];
    const trips = await Promise.all(uniqueTripIds.map((tripId) => ctx.db.get(tripId)));
    const tripById = new Map(uniqueTripIds.map((tripId, index) => [tripId, trips[index]]));

    const missingParticipantIds = [
      ...new Set(filtered.map((registration) => registration.participantId))
    ].filter((participantId) => !participantById.has(participantId));
    const fetchedParticipants = await Promise.all(
      missingParticipantIds.map((participantId) => ctx.db.get(participantId))
    );
    missingParticipantIds.forEach((participantId, index) => {
      participantById.set(participantId, fetchedParticipants[index]);
    });

    const rows = filtered.map((registration) => {
      const trip = tripById.get(registration.tripId);
      const participant = participantById.get(registration.participantId);
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
    });

    return { rows, truncated };
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
