export type UserRole = 'admin' | 'staff' | undefined;
export type AssignedRole = 'admin' | 'staff';

/**
 * Whether `role` belongs to an account that can act in the system. An
 * Unassigned account (a User with no Admin/Staff role, per CONTEXT.md —
 * whether never assigned one or revoked) is excluded — it cannot act in the
 * system, and must never be identified in PostHog.
 */
export function isAssignedRole(role: UserRole): role is AssignedRole {
  return role === 'admin' || role === 'staff';
}
