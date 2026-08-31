# PostHog on Cloud EU, and only Staff/Admin Users are ever identified

We're adding PostHog for two narrow use cases: session replay for debugging staff-reported UX bugs, and feature flags for staging the participant-edit rollout. We chose PostHog Cloud's EU region over self-hosting or the US region — PostHog's own docs say self-hosting the open-source build caps at one project, drops Experimentation and Permissions, and ships "without a guarantee," which isn't worth the maintenance burden for a tool this size; EU sidesteps any GDPR question if an EU-resident Participant is ever in scope, at no cost difference on the free tier.

We also decided PostHog will only ever `identify()` a Staff/Admin User, never a Participant — Participants don't log in and have no PostHog-trackable identity of their own. Any Participant PII visible on screen (names, IC numbers) is a masking problem to solve before enabling capture, not something to build tracking around.
