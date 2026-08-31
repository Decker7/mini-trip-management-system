import { isAssignedRole, type UserRole } from './user-role';

export type PostHogUser = {
  id: string;
  fullName: string | null;
  primaryEmail: string | undefined;
};

export type PostHogIdentity = {
  distinctId: string;
  properties: { email?: string; name?: string; role: 'admin' | 'staff' };
};

/**
 * Only a Staff/Admin User is ever a tracked identity in PostHog (see
 * docs/adr/0003-posthog-cloud-eu-and-users-only-identification.md). An
 * Unassigned account — signed in but with no Admin/Staff role — resolves to
 * `null` here just like no signed-in user at all; the caller resets any
 * previously-identified person in both cases instead of calling identify().
 */
export function resolvePostHogIdentity(
  role: UserRole,
  user: PostHogUser | null | undefined
): PostHogIdentity | null {
  if (!user || !isAssignedRole(role)) {
    return null;
  }

  return {
    distinctId: user.id,
    properties: {
      email: user.primaryEmail,
      name: user.fullName ?? undefined,
      role
    }
  };
}

export type PostHogSyncAction =
  | { type: 'identify'; identity: PostHogIdentity }
  | { type: 'reset' }
  | { type: 'noop' };

/**
 * Decides what to do with PostHog's identified person, given the distinct id
 * we last synced it to. Only ever returns `identify`/`reset` when the
 * resolved identity actually changed — including the very first call, where
 * `lastSyncedId` is the `undefined` sentinel (distinct from `null`, meaning
 * "resolved to no identity"): that lets a `null` identity still sync once on
 * load, clearing any identity PostHog's own persisted storage carried over
 * from a previous session on this browser — without ever repeating `reset()`
 * for an unchanged "still no identity" state, which would otherwise
 * fragment an ongoing session's replay.
 */
export function resolvePostHogSync(
  lastSyncedId: string | null | undefined,
  identity: PostHogIdentity | null
): PostHogSyncAction {
  const distinctId = identity?.distinctId ?? null;
  if (distinctId === lastSyncedId) {
    return { type: 'noop' };
  }
  return identity ? { type: 'identify', identity } : { type: 'reset' };
}
