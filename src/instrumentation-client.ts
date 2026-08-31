// This file configures the initialization of Sentry on the client.
// The added config here will be used whenever a users loads a page in their browser.
// https://docs.sentry.io/platforms/javascript/guides/nextjs/
import * as Sentry from '@sentry/nextjs';
import posthog from 'posthog-js';
import { buildPostHogInitConfig } from '@/lib/posthog-config';

if (!process.env.NEXT_PUBLIC_SENTRY_DISABLED) {
  Sentry.init({
    dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,

    // Adds request headers and IP for users, for more info visit
    sendDefaultPii: true,

    // Define how likely traces are sampled. Adjust this value in production, or use tracesSampler for greater control.
    tracesSampleRate: 1,

    // Setting this option to true will print useful information to the console while you're setting up Sentry.
    debug: false
  });
}

// PostHog: session replay + feature flags only (see
// docs/adr/0003-posthog-cloud-eu-and-users-only-identification.md). No-ops
// until both env vars are set, e.g. before a personal PostHog project exists.
if (process.env.NEXT_PUBLIC_POSTHOG_KEY && process.env.NEXT_PUBLIC_POSTHOG_HOST) {
  posthog.init(
    process.env.NEXT_PUBLIC_POSTHOG_KEY,
    buildPostHogInitConfig(process.env.NEXT_PUBLIC_POSTHOG_HOST)
  );
}

// Required by Next.js to instrument router transitions for Sentry tracing.
// eslint-disable-next-line @typescript-eslint/no-explicit-any -- Sentry SDK v10 typing mismatch
export const onRouterTransitionStart = (Sentry as any).captureRouterTransitionStart;
