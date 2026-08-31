# PostHog for the Mini Trip Management System

Research pass on PostHog (posthog.com) as a potential analytics/observability addition to this
repo. Every factual claim below is linked to the specific PostHog docs/pricing page it came from,
pulled live on **2026-08-31**. Passages that are this repo's own reasoning rather than a PostHog
claim are marked with a **> Analysis:** blockquote — treat everything outside those blockquotes as
"PostHog says," and everything inside them as "we think."

Community sentiment (secondary source, not verified against PostHog docs) is called out
separately wherever it appears and is never used as the basis for a factual claim.

## 1. What PostHog is

PostHog's [docs homepage](https://posthog.com/docs) frames itself as a single platform bundling
"references for every product and tool" it ships — product analytics, session replay, feature
flags, experiments, surveys, error tracking, a CDP, web analytics, a managed data warehouse, AI
observability, logs, and workflow automation — rather than a single-purpose analytics tool.

Notably, [posthog.com](https://posthog.com)'s current homepage tagline has shifted from the
traditional "product analytics suite" framing to **"we make your product self-driving"** — it now
markets an AI layer ("Self-driving") that sits on top of the same event/replay/flag data and is
positioned to autonomously surface bugs, cluster survey feedback, and flag experiment validity
issues for human review. This is a meaningfully different pitch than "just add analytics," and is
worth noting explicitly since PostHog's positioning has evolved and training-data-era assumptions
about PostHog as a lightweight analytics tool undersell how much surface area the product now has.

> **Analysis:** for an internal ops tool, the "self-driving product" / AI-agent framing is aimed at
> a different buyer than us — it's built for teams shipping a consumer product to a large user base
> who want an AI layer watching funnels and experiments. That framing doesn't change what the
> underlying primitives (events, replay, flags) can do for us, but it does mean a lot of PostHog's
> current marketing and newer feature investment (Self-driving, PostHog AI, Replay Vision) isn't
> aimed at a 5-10 person internal staff tool at all.

## 2. Core features

Each feature below is cited to its own docs page, with free-vs-paid status per the live
[posthog.com/pricing](https://posthog.com/pricing) page (retrieved 2026-08-31).

| Feature | What PostHog says it does | Free tier (per pricing page) |
|---|---|---|
| Product analytics / autocapture | Automatically captures clicks, taps, form submissions, pageviews, page exits, copy/paste, heatmaps, dead clicks, and web vitals without manual instrumentation — see [autocapture docs](https://posthog.com/docs/product-analytics/autocapture) | 1M events/month free, then usage-based — [product analytics pricing](https://posthog.com/docs/product-analytics/pricing) |
| Session replay | "Records what real users do in your product and plays it back like a DVR, with a synced DevTools panel showing console logs, network requests, and errors" — [session replay docs](https://posthog.com/docs/session-replay/start-here) | 5,000 web recordings/month free (2,500 for mobile), then usage-based — [session replay pricing](https://posthog.com/docs/session-replay/pricing) |
| Feature flags | Roll out a feature "safely by testing a feature works in production with a small group before incrementally moving to progressively bigger groups" — [phased rollout docs](https://posthog.com/docs/feature-flags/phased-rollout), [feature flags docs](https://posthog.com/docs/feature-flags/manual) | 1M flag requests/month free per [posthog.com/pricing](https://posthog.com/pricing) |
| Experiments (A/B testing) | Test "a change against a control and find out whether it actually worked," using existing events/feature flags rather than separate instrumentation, with PostHog handling randomization and stats — [experiments docs](https://posthog.com/docs/experiments) | Billed together with feature flags (no separate free allotment) per [posthog.com/pricing](https://posthog.com/pricing) |
| Surveys | Collect NPS/PMF/churn/open-text feedback "targeted... on the same events, properties, cohorts, and feature flags you use everywhere else," each response linked to the respondent's session replay and person properties — [surveys docs](https://posthog.com/docs/surveys) | 1,500 responses/month free per [posthog.com/pricing](https://posthog.com/pricing) |
| Data warehouse | Syncs external business data (Stripe, Postgres, Salesforce, HubSpot, etc.) so it's queryable in the same SQL interface as product events, "no ETL pipeline to build" — [data warehouse docs](https://posthog.com/docs/data-warehouse) | 1M rows/month free (+ free historical sync) per [posthog.com/pricing](https://posthog.com/pricing) |
| CDP / data pipelines | Filters/reshapes/routes events in realtime or on a schedule to third-party destinations, built from "Hog functions" (template, custom code, or AI-generated) — [CDP docs](https://posthog.com/docs/cdp) | 10K events + 1M rows/month free per [posthog.com/pricing](https://posthog.com/pricing) |

## 3. Self-hosted vs Cloud (US/EU)

PostHog is explicit that **Cloud is the default recommendation**, not open-source self-hosting.
Per the [self-host docs](https://posthog.com/docs/self-host):

> "PostHog Cloud is far and away the best experience for the vast majority of our users."

They list self-hosting as reasonable only if infrastructure management is a core competency for
your team, you accept the risk of data loss with no uptime/support guarantees, you only need
free-tier features, and your volume stays roughly under ~300k events / ~1k recordings / ~300k flag
calls a month.

The [open-source self-host support page](https://posthog.com/docs/self-host/open-source/support)
is blunt about what changes if you self-host the OSS Docker Compose deployment (MIT licensed,
free): it runs on a single machine, is "unlikely to scale past a couple hundred thousand events
without significant effort," supports only **one project**, and is **missing features including
Experimentation, Advanced Paths, and Permissions**. PostHog states plainly: "as a small team, we
don't have the bandwidth for troubleshooting instance-specific issues for open-source users," and
the deployment is "provided without a guarantee."

**Verify-before-assuming note:** this is a materially more restrictive stance on self-hosting than
PostHog has held in earlier periods of the product's life (self-hosting used to be pitched more
evenly against Cloud). Current docs treat self-host-OSS as a hobbyist/edge-case path, not a
production-parity alternative to Cloud — don't assume otherwise from older writeups or memory.

On Cloud, there are two regions to choose at signup, per the
[GDPR compliance docs](https://posthog.com/docs/privacy/gdpr-compliance):

- **PostHog Cloud EU** — servers in Frankfurt, Germany. PostHog's own recommendation: "If you
  require robust GDPR compliance, we recommend using PostHog Cloud EU."
- **PostHog Cloud US** — servers in Virginia (us-east-1). Usable for EU personal data only with
  extra steps — PostHog's docs say you should anonymize EU user data (e.g. via realtime
  transformations) and note "you should not transfer EU users' personal data outside the EU"
  without EU Standard Contractual Clauses in place.

## 4. Next.js integration

PostHog's official guide is [docs/libraries/next-js](https://posthog.com/docs/libraries/next-js):

- **Client-side**: install `posthog-js`, set `NEXT_PUBLIC_POSTHOG_KEY` / `NEXT_PUBLIC_POSTHOG_HOST`
  (must be prefixed `NEXT_PUBLIC_` to reach the browser bundle), and initialize it in Next.js's
  `instrumentation-client.ts` convention file. The guide also documents the CSP directives needed
  if the app sets Content-Security-Policy headers (`script-src`/`connect-src` allowing
  `*.posthog.com`, `worker-src blob: data:` for replay).
- **Reverse proxy for ad-blocker resilience**: the Next.js guide explicitly recommends routing
  through a first-party domain — "use a [reverse proxy](https://posthog.com/docs/advanced/proxy)
  so everything is first-party." The dedicated
  [proxy docs](https://posthog.com/docs/advanced/proxy) explain why: "Ad blockers maintain lists of
  known analytics domains and block requests to them. A reverse proxy bypasses this by routing
  events through your own domain." PostHog offers a managed reverse proxy (Cloudflare-backed, free
  on Cloud, DNS-CNAME-only setup) as well as self-hosted proxy options; they also advise picking a
  "neutral" subdomain that avoids words like `analytics`, `tracking`, `telemetry`, `posthog`, or
  `ph`, since ad blockers target those terms specifically. Note: the managed proxy is **not
  HIPAA-compliant** because Cloudflare processes the traffic — irrelevant for this app's data, but
  worth knowing as a general limit.
- **Server-side**: for logic that never runs in a browser (server actions, route handlers,
  webhooks), PostHog's [Node SDK docs](https://posthog.com/docs/libraries/node) cover
  `posthog-node`: install it, instantiate a `PostHog` client with the project token, and call
  `capture()`. The SDK batches calls asynchronously via an internal queue and requires **Node.js
  20+**. Critically, for short-lived/serverless environments the docs call out that you must
  explicitly flush/shut down the client before the process exits, or queued events are lost —
  directly relevant to any Convex action or serverless route handler that finishes and returns
  before an async batch would otherwise flush.

## 5. Convex interaction

> **Analysis — not an official PostHog integration; no PostHog doc covers this directly.**
> PostHog has no documented Convex integration, so everything in this section is this repo's own
> reasoning about how the two systems would have to be wired together.
>
> Convex's own platform docs establish a hard constraint that shapes where PostHog capture calls
> can live: [Convex query-function docs](https://docs.convex.dev/functions/query-functions) state
> "queries cannot `fetch` from third party APIs. To call third party APIs, use
> [actions](https://docs.convex.dev/functions/actions)" — because queries must be deterministic,
> and an external network call is not. Convex's [actions docs](https://docs.convex.dev/functions/actions)
> confirm actions are the construct meant for third-party calls (e.g. "processing a payment with
> Stripe" is their own example), and the environment "supports `fetch`." Convex mutations are
> transactional writes and are governed by the same no-outbound-network-call rule as queries — this
> is treated as a well-known Convex platform rule rather than a separately-quotable doc passage,
> since the query docs address it directly but the mutation docs don't restate it verbatim.
>
> Practically, that means server-side PostHog capture from Convex can only happen from:
> - a Convex **action** (e.g. `convex/participants.ts` if it had an action wrapping a mutation) —
>   call `posthog-node`'s `capture()` and, per PostHog's own serverless guidance above, explicitly
>   `flush()`/`shutdown()` the client before the action returns, or
> - a Convex **HTTP action** (`convex/http.ts`) receiving a webhook — per
>   [Convex's HTTP actions docs](https://docs.convex.dev/functions/http-actions), these accept a
>   `Request`/return a `Response` at `<deployment>.convex.site`, can call `ctx.runQuery` /
>   `ctx.runMutation` / `ctx.runAction`, and are a natural place to `capture()` a PostHog event in
>   response to something like a Stripe or Clerk webhook landing.
>
> The alternative — and for most of this app's needs, the simpler path — is **client-side capture
> straight from the Next.js frontend** via `posthog-js`, since staff actions (opening a trip, editing
> a participant, viewing the roster table) already happen in the browser where `posthog-js` runs
> natively. Server-side capture from a Convex action only earns its complexity for events that
> genuinely originate server-side and have no client present to capture them — e.g. a Stripe webhook
> marking a registration paid, or a scheduled Convex cron job — not for routine UI interactions.

## 6. Concrete benefits for this app

> **Analysis.** This is an internal ops dashboard used by a small staff team (an operations lead
> plus several creator-ops staff) to manage trips, participants, registrations, and staff
> assignments — low external traffic, not a consumer product. PostHog's core value proposition
> (large-scale funnel/growth/retention analytics, experimentation for conversion optimization, an AI
> layer clustering feedback from thousands of survey responses) is built for products with a
> meaningfully larger and more anonymous user base than "a handful of named staff members." Most of
> PostHog's flagship features are a **mismatch** for this repo's actual usage pattern.
>
> Where it's genuinely useful here, specifically:
>
> - **Session replay for debugging reported UX bugs.** When an ops staffer says "the roster table
>   did something weird" (a real category of bug this repo has already dealt with — see the recent
>   `roster-table.tsx` width/Stripe-lock-hint fixes in git history), a replay lets you watch exactly
>   what happened instead of trying to reproduce a vague verbal report. With only a handful of
>   staff generating recordings, this app would likely never come close to the 5,000/month free
>   session replay allotment.
> - **Feature flags for gradually rolling out the in-progress participant-edit feature.** The repo
>   currently has uncommitted work at `src/features/participants/components/edit-participant-view.tsx`
>   and `src/features/participants/components/participant-form.tsx`. A feature flag would let this
>   ship to, say, the operations lead first, then the rest of creator-ops staff, without a
>   separate deploy per phase — matching PostHog's own phased-rollout pattern described in section 3.
>   Given the tiny total user count, this would also stay comfortably inside the free 1M-request
>   flag tier indefinitely.
> - **Lightweight usage analytics on which dashboards/features staff actually touch.** Autocapture
>   would answer basic internal questions (does anyone use the staff-listing page? does the
>   trip-listing filter ever get used?) without hand-rolling instrumentation — useful for prioritizing
>   what's worth polishing further versus what to leave alone or remove.
>
> Where it's overkill: A/B testing/experiments (there's no meaningful concept of "control vs
> variant" for a handful of staff performing job tasks), surveys (staff feedback is almost certainly
> better gathered by just asking them directly, e.g. Sylvia or the ops team in a standup, than via
> an in-app NPS widget), the data warehouse/CDP (this app already has a single source of truth in
> Convex; there's no second analytics tool or external data source that needs unifying), and the
> "Self-driving"/PostHog AI layer (built for scale and noise this app doesn't generate). Standing up
> PostHog purely for this app would mean paying attention to (and securing) a whole platform to use
> maybe two of its eight-plus products.

## 7. Pricing / free tier

**Retrieved live from [posthog.com/pricing](https://posthog.com/pricing) on 2026-08-31 — this
section will go stale as PostHog's pricing changes over time; re-verify before relying on it.**

Free tier (resets monthly, no credit card required):

| Product | Free allotment |
|---|---|
| Product analytics | 1,000,000 events |
| Session replay | 5,000 web recordings (2,500 mobile) |
| Feature flags | 1,000,000 requests |
| Experiments | billed with feature flags, no separate allotment |
| Surveys | 1,500 responses |
| Data warehouse | 1,000,000 rows synced (+ free historical sync) |
| CDP / data pipelines | 10,000 events + 1,000,000 rows |
| Error tracking | 100,000 exceptions |
| Logs | 10 GB ingested |
| AI observability | 100,000 events |

Beyond free tier, billing is usage-based with step-down volume pricing, confirmed on
[product-analytics/pricing](https://posthog.com/docs/product-analytics/pricing) and
[session-replay/pricing](https://posthog.com/docs/session-replay/pricing):

- Product analytics events: $0.0000500/event (1–2M/mo) stepping down to $0.0000090/event (250M+/mo)
- Session replay (web): $0.0050/recording (5–15k/mo) stepping down to $0.0015/recording (500k+/mo)
- Session replay (mobile): $0.0100/recording (2.5–15k/mo) stepping down to $0.0030/recording (500k+/mo)

The pricing page states "97% of companies use PostHog for free" and that the free tier is "the
same free tier every month — you only pay for what you use." Paid usage unlocks 6 projects
(vs. 1 on free), 7-year data retention (vs. 1 year), and email support.

> **Analysis:** given the volumes described in section 6 — a handful of staff, occasional replay
> sessions, one feature flag rollout — this app would almost certainly never leave the free tier on
> any product. Cost is not a real constraint here; the more relevant cost is operational/setup
> complexity relative to the actual payoff, not dollars.

## 8. Tradeoffs

**(a) Data privacy — this app handles participant PII (names, contact info, trip/registration
data).** Autocapture and session replay can capture that PII unless explicitly masked or excluded.
PostHog's own docs describe:

- **Session replay masking** — per the
  [session replay privacy docs](https://posthog.com/docs/session-replay/privacy), input elements
  are masked by default ("As any input element is highly likely to contain sensitive text such as
  email or password, we mask these by default"), with `maskAllInputs`, `maskInputOptions` (per
  input type — password masking flagged "Highly recommended as a minimum!!"), and a custom
  `maskInputFn(text, element)` for conditional logic. PostHog states masked data "is never sent
  over the network" — masking happens client-side before transmission.
- **Autocapture exclusion** — per the
  [autocapture docs](https://posthog.com/docs/product-analytics/autocapture), elements tagged
  `.ph-no-autocapture` or `[data-ph-no-autocapture]` are ignored by default, and
  `css_selector_ignorelist` / `element_attribute_ignorelist` / `url_ignorelist` config options let
  you exclude specific selectors, attributes, or URLs from capture entirely.

> **Analysis:** given that participant names, contact details, and registration data appear
> directly in form inputs and table cells across `participant-form.tsx`, `roster-table.tsx`, and the
> participant-detail views, this app could **not** turn on autocapture/replay with defaults alone —
> it would need an explicit masking/exclusion pass over every PII-bearing input and table column
> before enabling either feature, not an afterthought.

**(b) EU/US data residency choice at signup.** Already covered in section 3 — see
[privacy/gdpr-compliance docs](https://posthog.com/docs/privacy/gdpr-compliance). Given this app
manages participants who may include EU-resident trip participants (not just staff), the EU vs US
region choice is a real decision, not a formality.

**(c) Bundle size impact of `posthog-js` on the Next.js client bundle.** We could not find a hard,
current bundle-size figure published by PostHog themselves — not in their
[Next.js integration docs](https://posthog.com/docs/libraries/next-js), not on the
[pricing](https://posthog.com/pricing) or feature docs, and not in the
[posthog-js GitHub repository](https://github.com/PostHog/posthog-js)'s README (no size badge or
KB figure found there either). **We are stating this explicitly rather than inventing a number**:
if bundle size is a hard constraint for this app, it needs to be measured directly (e.g. with
`@next/bundle-analyzer` after adding the dependency) rather than assumed from a PostHog-published
figure, because no such figure exists in the primary sources we could locate.

## Open questions for a future `/grill-with-docs` session

- Self-host vs Cloud: given PostHog's own current stance that "PostHog Cloud is far and away the
  best experience for the vast majority of our users" and that OSS self-host drops Experimentation
  and caps at one project, is there any scenario where self-hosting makes sense for a team this
  size — or is Cloud's free tier simply the only sane option?
- EU vs US region: the team is based in Cyberjaya, Malaysia — neither PostHog Cloud region is
  network-local to APAC. (Note: this repo's backend is Convex, which has its own reactive database;
  it is not DynamoDB and we have not verified which region this project's Convex deployment actually
  runs in, so that should not be assumed when making this call.) Does it make more sense to pick
  PostHog Cloud US (simpler if no EU participant PII is ever in scope) or EU (better GDPR posture if
  any EU-resident participants are ever registered), and who actually owns that compliance call for
  this app?
- Does an internal ops tool at this scale actually justify PostHog's cost/complexity at all, versus
  a much simpler alternative (e.g. Sentry replay/session-only, a lightweight self-rolled Convex
  event-log table, or just... asking staff directly when something breaks)? Section 6 above argues
  most of PostHog's surface area is unused overhead here — is the juice (better bug reports via
  replay, safer feature rollout) worth standing up and securing an entire third-party platform for
  two features?
- If we do adopt it, who is responsible for the masking/exclusion pass over PII-bearing fields
  (section 8a) before any autocapture/replay actually goes live — this needs to happen before
  enablement, not after.
