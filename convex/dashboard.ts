import { v } from 'convex/values';
import { query } from './_generated/server';
import { requireAssignedRole } from './lib/identity';
import { deriveStatus } from './trips';
import type { Doc, Id } from './_generated/dataModel';

/**
 * Read caps for `getStats`. Each stat is its own bounded read (trips,
 * participants, paid Registrations, unpaid Registrations), so the worst-case
 * total stays well under Convex's 32,000-document scan ceiling.
 */
export const DASHBOARD_LIMITS = {
  trips: 5000,
  participants: 5000,
  registrationsPerPaymentStatus: 5000
} as const;

export const getStats = query({
  args: { today: v.string() },
  handler: async (ctx, args) => {
    await requireAssignedRole(ctx);

    const {
      trips: TRIPS_LIMIT,
      participants: PARTICIPANTS_LIMIT,
      registrationsPerPaymentStatus: REGISTRATIONS_LIMIT
    } = DASHBOARD_LIMITS;

    const scannedTrips = await ctx.db.query('trips').take(TRIPS_LIMIT + 1);
    const tripCountTruncated = scannedTrips.length > TRIPS_LIMIT;
    const trips = scannedTrips.slice(0, TRIPS_LIMIT);
    const upcomingTripCount = trips.filter(
      (trip) => deriveStatus(trip, args.today) === 'upcoming'
    ).length;

    const scannedParticipants = await ctx.db.query('participants').take(PARTICIPANTS_LIMIT + 1);
    const participantCountTruncated = scannedParticipants.length > PARTICIPANTS_LIMIT;

    const [scannedPaid, scannedUnpaid] = await Promise.all([
      ctx.db
        .query('registrations')
        .withIndex('by_paymentStatus', (q) => q.eq('paymentStatus', 'paid'))
        .take(REGISTRATIONS_LIMIT + 1),
      ctx.db
        .query('registrations')
        .withIndex('by_paymentStatus', (q) => q.eq('paymentStatus', 'unpaid'))
        .take(REGISTRATIONS_LIMIT + 1)
    ]);
    const paidRegistrationCountTruncated = scannedPaid.length > REGISTRATIONS_LIMIT;
    const unpaidRegistrationCountTruncated = scannedUnpaid.length > REGISTRATIONS_LIMIT;
    // Cancelled Registrations still carry a Payment Status, but they no
    // longer occupy a seat, so they're excluded from this paid/unpaid split.
    const paidRegistrationCount = scannedPaid
      .slice(0, REGISTRATIONS_LIMIT)
      .filter((registration) => registration.registrationStatus === 'registered').length;
    const unpaidRegistrationCount = scannedUnpaid
      .slice(0, REGISTRATIONS_LIMIT)
      .filter((registration) => registration.registrationStatus === 'registered').length;

    return {
      tripCount: trips.length,
      tripCountTruncated,
      upcomingTripCount,
      participantCount: Math.min(scannedParticipants.length, PARTICIPANTS_LIMIT),
      participantCountTruncated,
      paidRegistrationCount,
      paidRegistrationCountTruncated,
      unpaidRegistrationCount,
      unpaidRegistrationCountTruncated
    };
  }
});

/**
 * Read caps for `getAnalytics`. Every derived figure below is computed from
 * these two capped scans held in memory, so the total stays well under
 * Convex's 32,000-document scan ceiling regardless of how many downstream
 * figures are derived from them.
 */
export const ANALYTICS_LIMITS = {
  trips: 500,
  registrations: 5000,
  recentActivity: 8
} as const;

const TREND_DAYS = 14;
const DAY_MS = 24 * 60 * 60 * 1000;

/** `YYYY-MM-DD` in UTC, matching the `today` date-only strings used elsewhere. */
function dateOnly(ms: number) {
  return new Date(ms).toISOString().slice(0, 10);
}

export const getAnalytics = query({
  args: { today: v.string() },
  handler: async (ctx, args) => {
    await requireAssignedRole(ctx);

    const {
      trips: TRIPS_LIMIT,
      registrations: REGISTRATIONS_LIMIT,
      recentActivity: RECENT_LIMIT
    } = ANALYTICS_LIMITS;

    const scannedTrips = await ctx.db.query('trips').take(TRIPS_LIMIT + 1);
    const tripsTruncated = scannedTrips.length > TRIPS_LIMIT;
    const trips = scannedTrips.slice(0, TRIPS_LIMIT);

    // Newest first, so a cap here drops the oldest Registrations rather than
    // the most recent ones — the trend chart and recent-activity feed both
    // care about recency, not completeness.
    const scannedRegistrations = await ctx.db
      .query('registrations')
      .order('desc')
      .take(REGISTRATIONS_LIMIT + 1);
    const registrationsTruncated = scannedRegistrations.length > REGISTRATIONS_LIMIT;
    const registrations = scannedRegistrations.slice(0, REGISTRATIONS_LIMIT);

    const activeRegistrations = registrations.filter(
      (registration) => registration.registrationStatus === 'registered'
    );

    // Payment Status split — only among seats still held, matching the
    // paid/unpaid split already reported by `getStats`.
    const paymentBreakdown = {
      paid: activeRegistrations.filter((r) => r.paymentStatus === 'paid').length,
      unpaid: activeRegistrations.filter((r) => r.paymentStatus === 'unpaid').length,
      refunded: activeRegistrations.filter((r) => r.paymentStatus === 'refunded').length
    };

    // Registration trend: one bucket per day for the last `TREND_DAYS` days,
    // pre-seeded at zero so a quiet day still renders as a point rather than
    // a gap. `registeredAt` (not `_creationTime`) is the field this buckets
    // on, since it's the timestamp the rest of the app treats as canonical.
    const cutoff = Date.parse(`${args.today}T00:00:00.000Z`) - (TREND_DAYS - 1) * DAY_MS;
    const trendBuckets = new Map<string, number>();
    for (let i = 0; i < TREND_DAYS; i++) {
      trendBuckets.set(dateOnly(cutoff + i * DAY_MS), 0);
    }
    for (const registration of registrations) {
      if (registration.registeredAt < cutoff) continue;
      const key = dateOnly(registration.registeredAt);
      if (trendBuckets.has(key)) {
        trendBuckets.set(key, (trendBuckets.get(key) ?? 0) + 1);
      }
    }
    const registrationTrend = [...trendBuckets.entries()].map(([date, count]) => ({ date, count }));

    // Seats held per Trip, derived once and reused for both the fill-rate
    // chart and the upcoming-trips panel below.
    const registeredByTrip = new Map<Id<'trips'>, number>();
    for (const registration of activeRegistrations) {
      registeredByTrip.set(
        registration.tripId,
        (registeredByTrip.get(registration.tripId) ?? 0) + 1
      );
    }

    // Trips filling up: only ones still taking or holding seats are
    // actionable, so a Trip that already completed doesn't crowd out one an
    // Admin or Staff can still do something about.
    const tripFillRates = trips
      .map((trip) => {
        const registered = registeredByTrip.get(trip._id) ?? 0;
        return {
          tripId: trip._id,
          name: trip.name,
          capacity: trip.capacity,
          registered,
          fillRate: trip.capacity > 0 ? registered / trip.capacity : 0,
          status: deriveStatus(trip, args.today)
        };
      })
      .filter((trip) => trip.status !== 'completed')
      .sort((a, b) => b.fillRate - a.fillRate)
      .slice(0, 6);

    const upcomingTrips = trips
      .filter((trip) => deriveStatus(trip, args.today) === 'upcoming')
      .sort((a, b) => a.startDate.localeCompare(b.startDate))
      .slice(0, 5)
      .map((trip) => ({
        tripId: trip._id,
        name: trip.name,
        destination: trip.destination,
        startDate: trip.startDate,
        capacity: trip.capacity,
        registered: registeredByTrip.get(trip._id) ?? 0
      }));

    // Active Registrations processed per Staff/Admin account, for a
    // leaderboard panel. `staffId` is a Clerk user id — resolving it to a
    // name is left to the client, which already has Admin-gated access to
    // `staffAccounts.listUsers`.
    const registeredByStaff = new Map<string, number>();
    for (const registration of activeRegistrations) {
      registeredByStaff.set(
        registration.registeredBy,
        (registeredByStaff.get(registration.registeredBy) ?? 0) + 1
      );
    }
    const staffActivity = [...registeredByStaff.entries()]
      .map(([staffId, count]) => ({ staffId, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 6);

    // Recent activity feed — newest Payment/Registration Status changes
    // across every Registration, denormalized for display. `activityLogs`
    // rows are inserted in real time, so ordering by insertion order here
    // matches ordering by `changedAt`, and no dedicated index is needed for
    // a feed this shallow.
    const recentLogs = await ctx.db.query('activityLogs').order('desc').take(RECENT_LIMIT);

    const registrationIds = [...new Set(recentLogs.map((log) => log.registrationId))];
    const registrationDocs = await Promise.all(registrationIds.map((id) => ctx.db.get(id)));
    const registrationById = new Map<Id<'registrations'>, Doc<'registrations'> | null>(
      registrationIds.map((id, index) => [id, registrationDocs[index]])
    );

    const tripIds = [
      ...new Set(
        [...registrationById.values()]
          .filter((r): r is Doc<'registrations'> => r !== null)
          .map((r) => r.tripId)
      )
    ];
    const participantIds = [
      ...new Set(
        [...registrationById.values()]
          .filter((r): r is Doc<'registrations'> => r !== null)
          .map((r) => r.participantId)
      )
    ];
    const [tripDocs, participantDocs] = await Promise.all([
      Promise.all(tripIds.map((id) => ctx.db.get(id))),
      Promise.all(participantIds.map((id) => ctx.db.get(id)))
    ]);
    const tripById = new Map(tripIds.map((id, index) => [id, tripDocs[index]]));
    const participantById = new Map(
      participantIds.map((id, index) => [id, participantDocs[index]])
    );

    const recentActivity = recentLogs.map((log) => {
      const registration = registrationById.get(log.registrationId);
      const trip = registration ? tripById.get(registration.tripId) : undefined;
      const participant = registration
        ? participantById.get(registration.participantId)
        : undefined;
      return {
        _id: log._id,
        field: log.field,
        oldValue: log.oldValue,
        newValue: log.newValue,
        changedBy: log.changedBy,
        changedAt: log.changedAt,
        tripId: registration?.tripId ?? null,
        tripName: trip?.name ?? 'Unknown trip',
        participantName: participant?.fullName ?? 'Unknown participant'
      };
    });

    return {
      tripsTruncated,
      registrationsTruncated,
      paymentBreakdown,
      registrationTrend,
      tripFillRates,
      upcomingTrips,
      staffActivity,
      recentActivity
    };
  }
});
