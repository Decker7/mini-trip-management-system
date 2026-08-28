import type { MutationCtx } from '../_generated/server';
import type { Doc, Id } from '../_generated/dataModel';

type LoggedField = Doc<'activityLogs'>['field'];

/**
 * Appends an Activity Log entry for a change to a Registration.
 *
 * Callers pass the value they read *before* patching, so `oldValue` is the
 * value that was actually replaced rather than one re-read afterwards. A
 * call where `oldValue` and `newValue` match is a no-op: the history records
 * changes, and letting a repeated "set it to what it already is" write an
 * entry would bury the real changes in noise.
 */
export async function recordActivityLog<Field extends LoggedField>(
  ctx: MutationCtx,
  args: {
    registrationId: Id<'registrations'>;
    field: Field;
    oldValue: Doc<'registrations'>[Field];
    newValue: Doc<'registrations'>[Field];
    changedBy: string;
  }
) {
  if (args.oldValue === args.newValue) {
    return;
  }
  await ctx.db.insert('activityLogs', {
    registrationId: args.registrationId,
    field: args.field,
    oldValue: args.oldValue,
    newValue: args.newValue,
    changedBy: args.changedBy,
    changedAt: Date.now()
  });
}
