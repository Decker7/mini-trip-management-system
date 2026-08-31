/**
 * PostHog feature flag keys, centralised so a flag's key only needs
 * updating in one place. The rollout itself (who the flag is on for) is
 * configured in the PostHog project dashboard, not in code.
 */
export const PARTICIPANT_EDIT_ROLLOUT_FLAG = 'participant-edit-rollout';

/**
 * Kill-switch for the Trip group-analytics call in trip-detail.tsx (see
 * docs/adr/0004-posthog-custom-events-exceptions-and-group-analytics.md) —
 * lets that instrumentation be turned off from the PostHog dashboard without
 * a deploy if it ever misbehaves.
 */
export const TRIP_ANALYTICS_ROLLOUT_FLAG = 'trip-analytics-rollout';
