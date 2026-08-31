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

function identitiesEqual(
  a: PostHogIdentity | null | undefined,
  b: PostHogIdentity | null
): boolean {
  if (a === b) return true;
  if (!a || !b) return false;
  return (
    a.distinctId === b.distinctId &&
    a.properties.email === b.properties.email &&
    a.properties.name === b.properties.name &&
    a.properties.role === b.properties.role
  );
}

/**
 * Decides what to do with PostHog's identified person, given the identity we
 * last synced it to. Only ever returns `identify`/`reset` when the resolved
 * identity actually changed — comparing every field, not just distinctId, so
 * a role/name/email change for the *same* person (e.g. promoted Staff to
 * Admin) still re-syncs — including the very first call, where `lastSynced`
 * is the `undefined` sentinel (distinct from `null`, meaning "resolved to no
 * identity"): that lets a `null` identity still sync once on load, clearing
 * any identity PostHog's own persisted storage carried over from a previous
 * session on this browser — without ever repeating `reset()` for an
 * unchanged "still no identity" state, which would otherwise fragment an
 * ongoing session's replay.
 */
export function resolvePostHogSync(
  lastSynced: PostHogIdentity | null | undefined,
  identity: PostHogIdentity | null
): PostHogSyncAction {
  if (identitiesEqual(lastSynced, identity)) {
    return { type: 'noop' };
  }
  return identity ? { type: 'identify', identity } : { type: 'reset' };
}
