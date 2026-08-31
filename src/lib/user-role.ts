export type UserRole = 'admin' | 'staff' | undefined;
export type AssignedRole = 'admin' | 'staff';

/** A "User" per this system's glossary — Unassigned accounts are not one. */
export function isAssignedRole(role: UserRole): role is AssignedRole {
  return role === 'admin' || role === 'staff';
}
