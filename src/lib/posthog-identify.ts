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
 * Unassigned account — signed in but with no role — is not a "User" per
 * this system's own glossary, so it resolves to `null` here just like no
 * signed-in user at all; the caller resets any previously-identified
 * person in both cases instead of calling identify().
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
