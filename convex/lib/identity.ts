import { ConvexError } from 'convex/values';
import type { MutationCtx, QueryCtx } from '../_generated/server';

// Clerk's JWT template adds `role` as a custom claim on top of the standard
// OIDC identity fields; the generated UserIdentity type doesn't know about it.
export type IdentityWithRole = {
  subject: string;
  role?: 'admin' | 'staff';
};

export async function getIdentity(ctx: QueryCtx | MutationCtx) {
  return (await ctx.auth.getUserIdentity()) as IdentityWithRole | null;
}

export async function requireIdentity(ctx: QueryCtx | MutationCtx) {
  const identity = await getIdentity(ctx);
  if (!identity) {
    throw new ConvexError('You must be signed in to do that.');
  }
  return identity;
}

export async function requireAdmin(ctx: MutationCtx) {
  const identity = await requireIdentity(ctx);
  if (identity.role !== 'admin') {
    throw new ConvexError('Only Admins can perform this action.');
  }
  return identity;
}

/**
 * Requires an identity with either role, rejecting one that is signed in but
 * has no role assigned yet. `requireIdentity` alone doesn't check this, which
 * is fine for most existing endpoints, but not for ones handling PII like a
 * Participant's passport.
 */
export async function requireAssignedRole(ctx: QueryCtx | MutationCtx) {
  const identity = await requireIdentity(ctx);
  if (identity.role !== 'admin' && identity.role !== 'staff') {
    throw new ConvexError('Your account has not been assigned a role yet.');
  }
  return identity;
}
