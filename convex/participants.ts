import { ConvexError, v } from 'convex/values';
import { mutation, query } from './_generated/server';
import { requireAssignedRole } from './lib/identity';

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
