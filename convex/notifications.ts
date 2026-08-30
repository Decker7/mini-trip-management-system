import { v } from 'convex/values';
import { mutation, query, type MutationCtx, type QueryCtx } from './_generated/server';
import { requireAssignedRole } from './lib/identity';
import type { Doc } from './_generated/dataModel';

/**
 * Read cap for the notification feed. New Registrations are the only event
 * source, so this is also "how far back a Staff/Admin can see" — wide enough
 * to cover a busy day without scanning the whole table.
 */
export const NOTIFICATIONS_LIMIT = 50;

/**
 * The most recent Registrations, newest first, capped at
 * `NOTIFICATIONS_LIMIT`. Shared by `list` and `markAllRead` so both agree on
 * exactly which Registrations make up "the feed" at read time.
 */
async function recentRegistrations(ctx: QueryCtx | MutationCtx) {
  const scanned = await ctx.db
    .query('registrations')
    .order('desc')
    .take(NOTIFICATIONS_LIMIT + 1);
  return {
    registrations: scanned.slice(0, NOTIFICATIONS_LIMIT) as Doc<'registrations'>[],
    truncated: scanned.length > NOTIFICATIONS_LIMIT
  };
}

/**
 * Read status per Registration for one caller, via a point lookup per
 * Registration rather than a scan of the (ever-growing) `notificationReads`
 * table — so this stays bounded by the size of `registrations`, capped above,
 * instead of by how long this user has been marking things read.
 */
async function readMarkers(
  ctx: QueryCtx | MutationCtx,
  userId: string,
  registrations: Doc<'registrations'>[]
) {
  const rows = await Promise.all(
    registrations.map((registration) =>
      ctx.db
        .query('notificationReads')
        .withIndex('by_user_and_registration', (q) =>
          q.eq('userId', userId).eq('registrationId', registration._id)
        )
        .first()
    )
  );
  return new Set(registrations.filter((_, index) => rows[index] !== null).map((r) => r._id));
}

export const list = query({
  args: {},
  handler: async (ctx) => {
    const identity = await requireAssignedRole(ctx);
    const { registrations, truncated } = await recentRegistrations(ctx);

    const tripIds = [...new Set(registrations.map((r) => r.tripId))];
    const participantIds = [...new Set(registrations.map((r) => r.participantId))];
    const [trips, participants] = await Promise.all([
      Promise.all(tripIds.map((id) => ctx.db.get(id))),
      Promise.all(participantIds.map((id) => ctx.db.get(id)))
    ]);
    const tripById = new Map(tripIds.map((id, index) => [id, trips[index]]));
    const participantById = new Map(participantIds.map((id, index) => [id, participants[index]]));

    const readIds = await readMarkers(ctx, identity.subject, registrations);

    return {
      truncated,
      notifications: registrations.map((registration) => {
        const trip = tripById.get(registration.tripId);
        const participant = participantById.get(registration.participantId);
        return {
          registrationId: registration._id,
          tripId: registration.tripId,
          tripName: trip?.name ?? 'Unknown trip',
          participantName: participant?.fullName ?? 'Unknown participant',
          registeredAt: registration.registeredAt,
          read: readIds.has(registration._id)
        };
      })
    };
  }
});

export const markRead = mutation({
  args: { registrationId: v.id('registrations') },
  handler: async (ctx, args) => {
    const identity = await requireAssignedRole(ctx);

    const existing = await ctx.db
      .query('notificationReads')
      .withIndex('by_user_and_registration', (q) =>
        q.eq('userId', identity.subject).eq('registrationId', args.registrationId)
      )
      .first();
    if (existing) {
      return;
    }

    await ctx.db.insert('notificationReads', {
      userId: identity.subject,
      registrationId: args.registrationId,
      readAt: Date.now()
    });
  }
});

export const markAllRead = mutation({
  args: {},
  handler: async (ctx) => {
    const identity = await requireAssignedRole(ctx);
    const { registrations } = await recentRegistrations(ctx);
    const readIds = await readMarkers(ctx, identity.subject, registrations);

    const now = Date.now();
    const unread = registrations.filter((registration) => !readIds.has(registration._id));
    await Promise.all(
      unread.map((registration) =>
        ctx.db.insert('notificationReads', {
          userId: identity.subject,
          registrationId: registration._id,
          readAt: now
        })
      )
    );
  }
});
