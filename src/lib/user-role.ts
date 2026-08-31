export type UserRole = 'admin' | 'staff' | undefined;
export type AssignedRole = 'admin' | 'staff';

/**
 * Whether `role` belongs to a logged-in account that can act in the system.
 * An Unassigned account (a User with no Admin/Staff role, per CONTEXT.md) is
 * excluded — it can't log in, and must never be identified in PostHog.
 */
export function isAssignedRole(role: UserRole): role is AssignedRole {
  return role === 'admin' || role === 'staff';
}
