import { describe, expect, it } from 'vitest';
import { resolvePostHogIdentity } from './posthog-identify';

describe('resolvePostHogIdentity', () => {
  const user = { id: 'user_123', fullName: 'Sylvia Tan', primaryEmail: 'sylvia@example.com' };

  it('identifies a Staff User by their Clerk id', () => {
    expect(resolvePostHogIdentity('staff', user)).toEqual({
      distinctId: 'user_123',
      properties: { email: 'sylvia@example.com', name: 'Sylvia Tan', role: 'staff' }
    });
  });

  it('identifies an Admin User the same way', () => {
    expect(resolvePostHogIdentity('admin', user)?.properties.role).toBe('admin');
  });

  it('never identifies an Unassigned account, even when signed in', () => {
    expect(resolvePostHogIdentity(undefined, user)).toBeNull();
  });

  it('resolves to null with no signed-in user at all', () => {
    expect(resolvePostHogIdentity('staff', null)).toBeNull();
    expect(resolvePostHogIdentity('staff', undefined)).toBeNull();
  });

  it('falls back to no name property when Clerk has none set', () => {
    expect(
      resolvePostHogIdentity('staff', { ...user, fullName: null })?.properties.name
    ).toBeUndefined();
  });
});
