# Clerk Setup Guide

This project uses Clerk for authentication only — Organizations and Billing are disabled.

## Clerk Scopes Used

- **Authentication** - User sign-in/sign-up and session management
- Every User is assigned an Admin or Staff role via `publicMetadata.role` (see `convex/lib/identity.ts` and `convex/staffAccounts.ts`) — not via Clerk Organizations or organization membership roles.

## Navigation RBAC System

- Fully client-side navigation filtering using the `useNav` hook
- Supports `role` checks (client-side, instant) — see `docs/nav-rbac.md` for details
- Configured in `src/config/nav-config.ts` with `access` properties

## Organizations and Billing

This app does not use Clerk Organizations or Clerk Billing. Organizations is disabled on the
Clerk instance (Clerk Dashboard → Configure → Organizations, or `clerk disable orgs` via the
Clerk CLI). Some leftover starter-template pages referencing Organizations
(`/dashboard/workspaces`, `/dashboard/workspaces/team`, `/dashboard/billing`,
`/dashboard/exclusive`) are unreachable from the app's navigation and are not part of this
project's feature set.
