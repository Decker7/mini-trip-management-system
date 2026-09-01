# Mini Trip Management System

Manage Trips, Participants, and Registrations — built with Next.js, Convex, Clerk, and shadcn/ui.

See [`CONTEXT.md`](./CONTEXT.md) for the domain glossary (Trip, Participant, Registration, etc.) and the [spec](https://github.com/Decker7/mini-trip-management-system/issues/4) / [tickets](https://github.com/Decker7/mini-trip-management-system/issues?q=is%3Aissue) for what's being built.

## What it's for

Admins and Staff log in to create Trips, register Participants onto them, and track each registration's payment and status — with search/filter across both, and every write checked server-side against the caller's role.

## Stack

- [Next.js](https://nextjs.org) (App Router) on the [next-shadcn-dashboard-starter](https://github.com/Kiranism/next-shadcn-dashboard-starter) template
- [Convex](https://convex.dev) — database and backend functions
- [Clerk](https://clerk.com) — authentication, with Admin/Staff role stored in `publicMetadata.role`
- Deployed on [Vercel](https://vercel.com)

## Task brief, as given

**Timeline**

| Stage | Date |
|---|---|
| Invitation & task sent | Thu, 27 Aug, afternoon (task window: 5 days, includes Merdeka Day) |
| 1st interview — online | Wed, 2 Sept, 9am |
| 2nd interview — face-to-face, Wisma Khaledda | Thu, 3 Sept, 9am — for candidates who passed the 1st interview |

**Task: Mini Trip Management System**

**Wajib / Core**

| Requirement |
|---|
| Login |
| Role: Admin / Staff |
| CRUD Trip |
| Register Participant |
| Relationship: Trip → Participant |
| Search / Filter |
| Validation |
| Git repository |

**Additional Features**

| Requirement |
|---|
| Upload passport |
| Payment status |
| Simple dashboard |

**Bonus — pick up if time permits**

| Requirement |
|---|
| Prevent duplicate participant registration |
| Trip capacity — e.g. max 40 participants, blocked once full |
| Simple activity/status history |

> Not every feature needs to be finished — prioritize based on time available. The exercise is meant to show the ability to read a requirement → design the database → develop → debug → use Git → deliver.

## Setup

1. Install dependencies:

   ```bash
   bun install
   ```

2. Set up Convex (creates a free account/project on first run, and writes `CONVEX_DEPLOYMENT` + `NEXT_PUBLIC_CONVEX_URL` into `.env.local`):

   ```bash
   npx convex dev
   ```

   Leave this running in a terminal while you develop — it watches `convex/` and pushes changes live.

3. Set up Clerk. Either run the quick-start (no account needed, provisions a dev instance):

   ```bash
   npx clerk@latest init
   ```

   or grab your own keys from the [Clerk Dashboard](https://dashboard.clerk.com). Either way, copy `env.example.txt` to `.env.local` and fill in the Clerk keys.

4. Wire Convex to Clerk: in the Clerk Dashboard, create a JWT template named **convex** that adds a custom `role` claim sourced from `user.public_metadata.role`. Then set `CLERK_JWT_ISSUER_DOMAIN` in `.env.local` to your Clerk Frontend API URL (Clerk Dashboard → Configure → API Keys), without the `https://` prefix.

5. Assign yourself the Admin role: in the Clerk Dashboard, open your user and set `publicMetadata` to `{ "role": "admin" }`.

6. Run the app:

   ```bash
   bun dev
   ```

## Testing

Convex functions are tested directly with [`convex-test`](https://docs.convex.dev/testing/convex-test) — no browser needed:

```bash
bun test
```

This requires step 2 above (`npx convex dev`) to have run at least once, so `convex/_generated/` exists.

## Deployment

Deployed to Vercel. Push a Convex production deployment with `npx convex deploy`, then set the resulting `NEXT_PUBLIC_CONVEX_URL` (and the Clerk keys) as environment variables in the Vercel project.
