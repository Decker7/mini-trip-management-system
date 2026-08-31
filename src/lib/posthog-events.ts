/**
 * PostHog custom event names, centralised like feature-flags.ts so an
 * event's name only needs updating in one place. Trip metadata only — never
 * a Participant field — so these are safe to capture unconditionally (see
 * docs/adr/0004-posthog-custom-events-exceptions-and-group-analytics.md).
 */
export const TRIP_CREATED_EVENT = 'trip_created';
export const TRIP_DELETED_EVENT = 'trip_deleted';
