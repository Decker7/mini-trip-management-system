import type { PostHogConfig } from 'posthog-js';

/**
 * posthog-js's built-in session-replay convention classes (not something we
 * invented) — exported so every call site references one source instead of
 * repeating the string, where a typo would silently leave PII unmasked.
 */
export const PH_MASK_CLASS = 'ph-mask';
export const PH_NO_CAPTURE_CLASS = 'ph-no-capture';

/**
 * Deliberately narrow: this integration only covers session replay and
 * feature flags (see docs/adr/0003-posthog-cloud-eu-and-users-only-identification.md),
 * so autocapture and pageview events are switched off rather than left at
 * their default-on state, and no anonymous person profile is ever created —
 * only an explicit `identify()` call creates one.
 */
export function buildPostHogInitConfig(apiHost: string): Partial<PostHogConfig> {
  return {
    api_host: apiHost,
    person_profiles: 'identified_only',
    autocapture: false,
    capture_pageview: false,
    disable_session_recording: false,
    session_recording: {
      maskAllInputs: true
    }
  };
}
