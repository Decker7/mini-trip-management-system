'use client';

import { useEffect, useRef } from 'react';
import { useUser } from '@clerk/nextjs';
import posthog from 'posthog-js';
import { useUserRole } from '@/hooks/use-user-role';
import {
  resolvePostHogIdentity,
  resolvePostHogSync,
  type PostHogIdentity
} from '@/lib/posthog-identify';

/**
 * Keeps PostHog's identified person in sync with the signed-in Staff/Admin
 * User — see `resolvePostHogIdentity` for why Participants never appear
 * here, and `resolvePostHogSync` for why `identify`/`reset` only fire on an
 * actual change instead of every render.
 */
export function PostHogIdentify() {
  const { user, isLoaded } = useUser();
  const role = useUserRole();
  const lastSyncedRef = useRef<PostHogIdentity | null | undefined>(undefined);

  const userId = user?.id;
  const userFullName = user?.fullName;
  const userEmail = user?.primaryEmailAddress?.emailAddress;

  useEffect(() => {
    if (!isLoaded) return;

    const identity = resolvePostHogIdentity(
      role,
      userId ? { id: userId, fullName: userFullName ?? null, primaryEmail: userEmail } : null
    );
    const action = resolvePostHogSync(lastSyncedRef.current, identity);
    if (action.type === 'noop') return;

    lastSyncedRef.current = identity;
    if (action.type === 'identify') {
      posthog.identify(action.identity.distinctId, action.identity.properties);
    } else {
      posthog.reset();
    }
  }, [isLoaded, role, userId, userFullName, userEmail]);

  return null;
}
