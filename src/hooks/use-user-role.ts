'use client';

import { useUser } from '@clerk/nextjs';

export type UserRole = 'admin' | 'staff' | undefined;

/**
 * The signed-in User's Admin/Staff role, read client-side from Clerk's
 * publicMetadata. UX only (hiding/showing controls) — every mutation that
 * needs this re-checks the role server-side via `ctx.auth.getUserIdentity()`.
 */
export function useUserRole(): UserRole {
  const { user } = useUser();
  return user?.publicMetadata?.role as UserRole;
}
