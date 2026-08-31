import { describe, expect, it } from 'vitest';
import { isAssignedRole } from './user-role';

describe('isAssignedRole', () => {
  it('treats Staff as an assigned role', () => {
    expect(isAssignedRole('staff')).toBe(true);
  });

  it('treats Admin as an assigned role', () => {
    expect(isAssignedRole('admin')).toBe(true);
  });

  it('treats Unassigned (no role) as not assigned', () => {
    expect(isAssignedRole(undefined)).toBe(false);
  });
});
