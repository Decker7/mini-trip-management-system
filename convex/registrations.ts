import { ConvexError, v } from 'convex/values';
import { mutation, query } from './_generated/server';
import type { Doc, Id } from './_generated/dataModel';
import { requireIdentity } from './lib/identity';
import { recordActivityLog } from './lib/activityLog';

const paymentStatus = v.union(v.literal('unpaid'), v.literal('paid'), v.literal('refunded'));

/**
 * Read caps for `listAll`. Exported so tests can exercise the exact-limit
 * boundary without hard-coding the numbers.
 *
 * Convex scans at most 32,000 documents per query, and rows dropped by a
 * filter still count. These caps are budgeted so the *aggregate* of every
 * read on a single call stays well under that — capping each read alone is
 * not enough, because the search path issues one read per matched
 * Participant and those multiply:
 *
 *   search path   participantsScan 10,000
 *                 + matchedParticipants 200 x (registrationsPerParticipant 30 + 1) = 6,200
 *                 + up to 6,200 Trip lookups for the join
 *                 ~= 22,400
 *
 *   scoped path   scopedRegistrations 8,000
 *                 + up to 8,000 Trip and 8,000 Participant lookups
 *                 ~= 24,000
 *
 *   unscoped      unscopedRegistrations 5,000 + up to 10,000 join lookups
 *                 ~= 15,000
 *
 * Raising any of these means redoing that arithmetic, not just the one line.
 */
export const LIST_ALL_LIMITS = {
  participantsScan: 10000,
  matchedParticipants: 200,
  registrationsPerParticipant: 30,
  scopedRegistrations: 8000,
  unscopedRegistrations: 5000
} as const;

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
    const identity = await requireIdentity(ctx);
    const registration = await ctx.db.get(args.registrationId);
    if (!registration) {
      throw new ConvexError('Registration not found.');
    }
    if (registration.registrationStatus === 'cancelled') {
      throw new ConvexError('This Registration is already cancelled.');
    }
    await ctx.db.patch(args.registrationId, { registrationStatus: 'cancelled' });
    await recordActivityLog(ctx, {
      registrationId: args.registrationId,
      field: 'registrationStatus',
      oldValue: registration.registrationStatus,
      newValue: 'cancelled',
      changedBy: identity.subject
    });
  }
});

export const setPaymentStatus = mutation({
  args: { registrationId: v.id('registrations'), paymentStatus },
  handler: async (ctx, args) => {
    const identity = await requireIdentity(ctx);
    const registration = await ctx.db.get(args.registrationId);
    if (!registration) {
      throw new ConvexError('Registration not found.');
    }
    await ctx.db.patch(args.registrationId, { paymentStatus: args.paymentStatus });
    await recordActivityLog(ctx, {
      registrationId: args.registrationId,
      field: 'paymentStatus',
      oldValue: registration.paymentStatus,
      newValue: args.paymentStatus,
      changedBy: identity.subject
    });
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
    const {
      participantsScan: PARTICIPANTS_SCAN_LIMIT,
      matchedParticipants: MATCHED_PARTICIPANTS_LIMIT,
      registrationsPerParticipant: REGISTRATIONS_PER_PARTICIPANT_LIMIT,
      scopedRegistrations: SCOPED_REGISTRATIONS_LIMIT,
      unscopedRegistrations: UNSCOPED_REGISTRATIONS_LIMIT
    } = LIST_ALL_LIMITS;

    // `search` matches Participant fields, so resolve Participants first and
    // walk into their Registrations by index, rather than scanning
    // Registrations and joining a Participant per row. `participants` holds
    // one row per person, while `registrations` grows with every
    // person-and-Trip pair for the life of the system — so this scans the
    // far smaller, far slower-growing table, and the rows it then reads are
    // only the ones that can actually match.
    // A cap that actually bites is reported back as `truncated`, so callers can
    // say "these results are incomplete, narrow your filters" instead of
    // presenting a short list as if it were the whole answer. `truncated` means
    // strictly "rows existed that this query never examined, and any of them
    // could have matched" — so it stays accurate through the filtering below,
    // which can only ever narrow what was examined.
    //
    // Every capped read asks for one row more than it needs and reports
    // truncation only when that extra row comes back. Reading exactly `limit`
    // rows is ambiguous — it could mean "exactly limit exist" (complete) or
    // "more exist, cut off here" (truncated) — and treating that as truncated
    // would cry wolf on datasets that happen to land on the cap.
    let truncated = false;
    let registrations;
    let participantById: Map<Id<'participants'>, Doc<'participants'> | null>;

    if (search) {
      const scanned = await ctx.db.query('participants').take(PARTICIPANTS_SCAN_LIMIT + 1);
      truncated ||= scanned.length > PARTICIPANTS_SCAN_LIMIT;
      const participants = scanned.slice(0, PARTICIPANTS_SCAN_LIMIT);

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
      // Push whichever filter is active down into the index rather than
      // reading a Participant's whole history and discarding rows afterwards.
      // Each read then returns only rows that can survive into the result, so
      // this cap is not reachable off rows the filter was always going to
      // drop — which is what would otherwise mark a complete filtered result
      // as partial.
      const perParticipant = await Promise.all(
        matches.map((participant) =>
          args.tripId
            ? ctx.db
                .query('registrations')
                .withIndex('by_trip_and_participant', (q) =>
                  q.eq('tripId', args.tripId!).eq('participantId', participant._id)
                )
                .take(REGISTRATIONS_PER_PARTICIPANT_LIMIT + 1)
            : args.paymentStatus
              ? ctx.db
                  .query('registrations')
                  .withIndex('by_participant_and_paymentStatus', (q) =>
                    q.eq('participantId', participant._id).eq('paymentStatus', args.paymentStatus!)
                  )
                  .take(REGISTRATIONS_PER_PARTICIPANT_LIMIT + 1)
              : ctx.db
                  .query('registrations')
                  .withIndex('by_participant', (q) => q.eq('participantId', participant._id))
                  .take(REGISTRATIONS_PER_PARTICIPANT_LIMIT + 1)
        )
      );
      truncated ||= perParticipant.some(
        (rows) => rows.length > REGISTRATIONS_PER_PARTICIPANT_LIMIT
      );
      registrations = perParticipant.flatMap((rows) =>
        rows.slice(0, REGISTRATIONS_PER_PARTICIPANT_LIMIT)
      );
    } else {
      const limit =
        args.tripId || args.paymentStatus
          ? SCOPED_REGISTRATIONS_LIMIT
          : UNSCOPED_REGISTRATIONS_LIMIT;
      const scanned = args.tripId
        ? await ctx.db
            .query('registrations')
            .withIndex('by_trip', (q) => q.eq('tripId', args.tripId!))
            .take(limit + 1)
        : args.paymentStatus
          ? await ctx.db
              .query('registrations')
              .withIndex('by_paymentStatus', (q) => q.eq('paymentStatus', args.paymentStatus!))
              .take(limit + 1)
          : await ctx.db
              .query('registrations')
              .order('desc')
              .take(limit + 1);
      truncated ||= scanned.length > limit;
      registrations = scanned.slice(0, limit);
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
