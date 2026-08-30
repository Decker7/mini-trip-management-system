import { v } from 'convex/values';
import { query } from './_generated/server';
import { requireAssignedRole } from './lib/identity';
import { deriveStatus } from './trips';

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
