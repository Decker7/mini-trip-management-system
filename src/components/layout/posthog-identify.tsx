'use client';

import { useEffect, useRef } from 'react';
import { useUser } from '@clerk/nextjs';
import posthog from 'posthog-js';
import { useUserRole } from '@/hooks/use-user-role';
import { resolvePostHogIdentity } from '@/lib/posthog-identify';

/**
 * Keeps PostHog's identified person in sync with the signed-in Staff/Admin
 * User — see `resolvePostHogIdentity` for why Participants never appear
 * here. `posthog.reset()` rotates the session-replay session id, so it's
 * only called on an actual identified→unidentified transition (real
 * sign-out, or losing a role) — not on every render with no identity, which
 * would otherwise fragment the very session replay this integration exists
 * to capture (e.g. on first load, before anyone has signed in at all).
 */
export function PostHogIdentify() {
  const { user, isLoaded } = useUser();
  const role = useUserRole();
  const wasIdentifiedRef = useRef(false);

  const userId = user?.id;
  const userFullName = user?.fullName;
  const userEmail = user?.primaryEmailAddress?.emailAddress;

  useEffect(() => {
    if (!isLoaded) return;

    const identity = resolvePostHogIdentity(
      role,
      userId ? { id: userId, fullName: userFullName ?? null, primaryEmail: userEmail } : null
    );

    if (identity) {
      posthog.identify(identity.distinctId, identity.properties);
      wasIdentifiedRef.current = true;
    } else if (wasIdentifiedRef.current) {
      posthog.reset();
      wasIdentifiedRef.current = false;
    }
  }, [isLoaded, role, userId, userFullName, userEmail]);

  return null;
}
