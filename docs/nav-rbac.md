# Navigation RBAC System

## Overview

This document explains the client-side RBAC (Role-Based Access Control) system for navigation items.

**Key Insight**: Navigation visibility is UX only, not security. This app doesn't use Clerk Organizations — every check is based on the signed-in User's `role` (Admin or Staff), sourced from `publicMetadata`.

## Architecture

### Core Files

1. **`src/hooks/use-nav.ts`** - Single hook that handles all filtering logic (fully client-side)
2. **`src/types/index.ts`** - Type definitions with `access` property (`PermissionCheck`)

### Why Client-Side?

- **Navigation visibility is UX only** - Users can't bypass security by seeing/hiding nav items
- **Clerk provides the role client-side** - `useUser()` gives us `user.publicMetadata.role`
- **Zero server calls** - Instant filtering, no loading states, no UI flashing

**Note**: For actual security (Convex queries/mutations), always use server-side checks
(`requireAdmin` / `requireAssignedRole` in `convex/lib/identity.ts`). Hiding a nav item
never substitutes for a server-side check.

## Usage

### In `nav-config.ts`

```typescript
{
  title: 'Manage Staff',
  url: '/dashboard/staff',
  icon: 'teams',
  access: { role: 'admin' }
}
```

### In Components

```typescript
import { useFilteredNavItems } from '@/hooks/use-nav';

function MyComponent() {
  const filteredItems = useFilteredNavItems(navItems);
  // filteredItems is automatically filtered based on role
}
```

### Plan/Feature Checks

`plan`/`feature` on `PermissionCheck` are accepted but not filtered on client-side (they'd
require Clerk's server-side `has()` function). An item with only a `plan`/`feature` check
is shown as-is; enforce the actual restriction at the page level.

## Adding New Items

Just add to `nav-config.ts`:

```typescript
{
  title: 'New Feature',
  url: '/dashboard/new',
  icon: 'star',
  access: { role: 'admin' }
}
```
