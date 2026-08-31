# Expanding PostHog beyond session replay and feature flags

[ADR 0003](0003-posthog-cloud-eu-and-users-only-identification.md) scoped PostHog to session replay and feature flags only. We're deliberately widening that scope to explore three more PostHog capabilities, while keeping the two constraints from 0003 intact: only a Staff/Admin User is ever `identify()`'d, and autocapture/pageview events stay off — every event below is captured by an explicit `posthog.capture()` call at a known call site, never automatically.

- **Custom events** (`src/lib/posthog-events.ts`): `trip_created` and `trip_deleted`, captured in `trip-form.tsx` and `trip-detail.tsx`. Trip metadata only (destination, capacity) — never a Participant field — so these are safe to capture unconditionally.
- **Exception capture**: `posthog.captureException()` in the same two catch blocks. This is distinct from Sentry (already wired in `instrumentation-client.ts`) because Sentry's automatic capture only sees *unhandled* errors — a caught mutation failure that we turn into a toast never reaches it. Routing it through PostHog too ties that failure to the User's session replay, which Sentry has no equivalent of.
- **Group analytics**: `posthog.group('trip', tripId, { name, destination })` in `trip-detail.tsx`, so PostHog insights can be filtered per-Trip instead of only per-User. Gated behind the `trip-analytics-rollout` feature flag (`src/lib/feature-flags.ts`) as a kill-switch, since it's the newest and least-proven of the three.

We did not enable blanket exception autocapture (`capture_exceptions: true`) — that would duplicate Sentry's own global handlers for every unhandled error. Manual `captureException()` calls stay scoped to places we already catch an error for a toast.
