import { ConvexError, v } from 'convex/values';
import { mutation, query } from './_generated/server';
import { requireAssignedRole } from './lib/identity';
import { deriveStatus } from './trips';

/**
 * Kept in sync with `MAX_PASSPORT_FILE_SIZE` in
 * `src/features/participants/lib/passport.ts` — the client picks this to
 * reject an oversized file before spending an upload, and this is the
 * authoritative check, since the client-side one is only a courtesy.
 */
const MAX_PASSPORT_FILE_BYTES = 10 * 1024 * 1024;

export const get = query({
  args: { participantId: v.id('participants') },
  handler: async (ctx, args) => {
    await requireAssignedRole(ctx);
    const participant = await ctx.db.get(args.participantId);
    if (!participant) return null;

    return {
      _id: participant._id,
      fullName: participant.fullName,
      icPassportNumber: participant.icPassportNumber,
      email: participant.email,
      phone: participant.phone,
      passportUrl: participant.passportFileId
        ? await ctx.storage.getUrl(participant.passportFileId)
        : null
    };
  }
});

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

export const update = mutation({
  args: {
    participantId: v.id('participants'),
    fullName: v.string(),
    icPassportNumber: v.string(),
    email: v.string(),
    phone: v.string()
  },
  handler: async (ctx, args) => {
    await requireAssignedRole(ctx);
    validateParticipantFields(args);

    const existing = await ctx.db.get(args.participantId);
    if (!existing) {
      throw new ConvexError('Participant not found.');
    }

    // Two Participant rows sharing an IC/passport number would break the
    // by-IC lookup `registrations.register` relies on to merge repeat
    // registrants into a single record — so an edit can't hand one
    // Participant's IC number to another that already has it.
    const duplicate = await ctx.db
      .query('participants')
      .withIndex('by_icPassportNumber', (q) => q.eq('icPassportNumber', args.icPassportNumber))
      .first();
    if (duplicate && duplicate._id !== args.participantId) {
      throw new ConvexError('This IC/passport number is already used by another participant.');
    }

    await ctx.db.patch(args.participantId, {
      fullName: args.fullName,
      icPassportNumber: args.icPassportNumber,
      email: args.email,
      phone: args.phone
    });
  }
});

export const remove = mutation({
  args: { participantId: v.id('participants'), today: v.string() },
  handler: async (ctx, args) => {
    await requireAssignedRole(ctx);

    const participant = await ctx.db.get(args.participantId);
    if (!participant) {
      throw new ConvexError('Participant not found.');
    }

    const registrations = await ctx.db
      .query('registrations')
      .withIndex('by_participant', (q) => q.eq('participantId', args.participantId))
      .collect();

    // A paid Registration for a Trip that hasn't finished yet represents
    // money already collected for a commitment that hasn't been honoured —
    // deleting the Participant out from under it would strand that
    // Registration's Trip roster and payment records with no way back to
    // who paid. The fix is to refund (or wait for the Trip to complete),
    // not to delete through it.
    const paidRegistrations = registrations.filter(
      (registration) => registration.paymentStatus === 'paid'
    );
    const paidTrips = await Promise.all(paidRegistrations.map((r) => ctx.db.get(r.tripId)));
    const hasUnresolvedPaidTrip = paidTrips.some(
      (trip) => trip && deriveStatus(trip, args.today) !== 'completed'
    );
    if (hasUnresolvedPaidTrip) {
      throw new ConvexError(
        'This Participant has a paid Registration for a Trip that is ongoing or upcoming. Refund it, or wait until the Trip completes, before deleting.'
      );
    }

    // Every Registration this Participant holds is removed along with them —
    // a deleted Participant can't be left dangling off Trip rosters. Each
    // Registration's activity history goes with it too, since a history of
    // changes to a Registration that no longer exists has nothing left to
    // explain.
    for (const registration of registrations) {
      const logs = await ctx.db
        .query('activityLogs')
        .withIndex('by_registration_and_changedAt', (q) => q.eq('registrationId', registration._id))
        .collect();
      for (const log of logs) {
        await ctx.db.delete(log._id);
      }
      await ctx.db.delete(registration._id);
    }

    if (participant.passportFileId) {
      await ctx.storage.delete(participant.passportFileId);
    }

    await ctx.db.delete(args.participantId);
  }
});

export const generateUploadUrl = mutation({
  args: {},
  handler: async (ctx) => {
    await requireAssignedRole(ctx);
    return await ctx.storage.generateUploadUrl();
  }
});

export const setPassport = mutation({
  args: { participantId: v.id('participants'), storageId: v.id('_storage') },
  handler: async (ctx, args) => {
    await requireAssignedRole(ctx);

    // The file the client already uploaded to `args.storageId` is left in
    // place on every rejection below: a mutation's writes are all-or-nothing,
    // so a `storage.delete` followed by one of these throws would itself be
    // rolled back along with everything else the throw undoes — cleanup and
    // rejection can't be committed by the same transaction.
    const participant = await ctx.db.get(args.participantId);
    if (!participant) {
      throw new ConvexError('Participant not found.');
    }

    // A storage id that doesn't resolve to a real file — stale, already
    // deleted, or simply invented — must reject outright rather than fall
    // through as if it were a valid, empty file: `metadata` is only absent
    // when there's genuinely nothing at `args.storageId` to attach.
    const metadata = await ctx.db.system.get('_storage', args.storageId);
    if (!metadata) {
      throw new ConvexError('The uploaded file could not be found.');
    }

    // File type (image/PDF) is enforced by the upload control's accept
    // filter, not re-checked here: the browser's declared Content-Type is
    // exactly as spoofable as a header on a direct API call, so a server-side
    // check on it would be a check on data the caller controls either way —
    // not a real boundary. Size is different: it's measured by Convex from
    // the bytes actually stored, so this is the one server-side check that
    // catches a client that skipped or bypassed the picker's own limit.
    if (metadata.size > MAX_PASSPORT_FILE_BYTES) {
      throw new ConvexError('Passport must be under 10 MB.');
    }

    const previousFileId = participant.passportFileId;
    await ctx.db.patch(args.participantId, { passportFileId: args.storageId });
    // One passport on file per Participant: the new file replaces the old
    // one outright, so the old blob is deleted rather than kept around.
    // Guarded against `args.storageId` — re-submitting the file already on
    // file, which the normal upload flow never does but a direct call
    // could — since deleting it here would otherwise destroy the very file
    // `passportFileId` was just set to.
    if (previousFileId && previousFileId !== args.storageId) {
      await ctx.storage.delete(previousFileId);
    }
  }
});
