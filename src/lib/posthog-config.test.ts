import { describe, expect, it } from 'vitest';
import { buildPostHogInitConfig } from './posthog-config';

describe('buildPostHogInitConfig', () => {
  it('never creates an anonymous person profile — only identify() does', () => {
    expect(buildPostHogInitConfig('https://eu.i.posthog.com').person_profiles).toBe(
      'identified_only'
    );
  });

  it('keeps scope to session replay and feature flags: no autocapture, no pageview events', () => {
    const config = buildPostHogInitConfig('https://eu.i.posthog.com');
    expect(config.autocapture).toBe(false);
    expect(config.capture_pageview).toBe(false);
  });

  it('masks every form input in session replay by default', () => {
    expect(
      buildPostHogInitConfig('https://eu.i.posthog.com').session_recording?.maskAllInputs
    ).toBe(true);
  });

  it('passes the given API host through untouched', () => {
    expect(buildPostHogInitConfig('https://us.i.posthog.com').api_host).toBe(
      'https://us.i.posthog.com'
    );
  });
});
