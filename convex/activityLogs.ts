import { v } from 'convex/values';
import { query } from './_generated/server';
import { requireIdentity } from './lib/identity';

/**
 * Read cap for `listByRegistration`. A Registration accumulates one entry per
 * Payment Status or Registration Status change, so a real history is a handful
 * of rows — this exists so a single Registration edited in a loop can't grow a
 * history that blows past Convex's per-query read ceiling.
 *
 * Exported so tests can exercise the exact-limit boundary without hard-coding
 * the number.
 */
export const ACTIVITY_LOG_LIMIT = 100;

export const listByRegistration = query({
  args: { registrationId: v.id('registrations') },
  handler: async (ctx, args) => {
    await requireIdentity(ctx);

    // Newest first: a history panel is read from the most recent change
    // backwards, and it also means the cap drops the *oldest* entries rather
    // than hiding what just happened.
    //
    // Ordering comes from the `changedAt` component of the index, so the rows
    // arrive in the same order as the timestamps the UI renders.
    //
    // Take one row more than the cap and report truncation only when that
    // extra row comes back — reading exactly `ACTIVITY_LOG_LIMIT` rows is
    // ambiguous between "exactly that many exist" and "more exist, cut off
    // here", and calling it truncated would cry wolf on a history that happens
    // to land on the cap.
    const scanned = await ctx.db
      .query('activityLogs')
      .withIndex('by_registration_and_changedAt', (q) =>
        q.eq('registrationId', args.registrationId)
      )
      .order('desc')
      .take(ACTIVITY_LOG_LIMIT + 1);

    return {
      entries: scanned.slice(0, ACTIVITY_LOG_LIMIT).map((entry) => ({
        _id: entry._id,
        field: entry.field,
        oldValue: entry.oldValue,
        newValue: entry.newValue,
        changedBy: entry.changedBy,
        changedAt: entry.changedAt
      })),
      truncated: scanned.length > ACTIVITY_LOG_LIMIT
    };
  }
});
