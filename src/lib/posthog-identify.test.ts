import { describe, expect, it } from 'vitest';
import { resolvePostHogIdentity, resolvePostHogSync } from './posthog-identify';

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

describe('resolvePostHogSync', () => {
  const identity = {
    distinctId: 'user_123',
    properties: { email: 'sylvia@example.com', name: 'Sylvia Tan', role: 'staff' as const }
  };

  it('clears a stale identity from a previous session on the very first resolution, even when the current one is null', () => {
    // lastSyncedId is `undefined` — this component instance has never synced before,
    // e.g. a fresh page load where PostHog's own persisted storage may still carry
    // an identity left over from a different Staff member's earlier session.
    expect(resolvePostHogSync(undefined, null)).toEqual({ type: 'reset' });
  });

  it('identifies on the very first resolution when already signed in', () => {
    expect(resolvePostHogSync(undefined, identity)).toEqual({ type: 'identify', identity });
  });

  it('does not repeat reset() when identity is still null on a later render', () => {
    expect(resolvePostHogSync(null, null)).toEqual({ type: 'noop' });
  });

  it('does not repeat identify() when the same person is still identified', () => {
    expect(resolvePostHogSync('user_123', identity)).toEqual({ type: 'noop' });
  });

  it('resets on a real sign-out transition (was identified, now null)', () => {
    expect(resolvePostHogSync('user_123', null)).toEqual({ type: 'reset' });
  });

  it('re-identifies when a different person is now signed in', () => {
    const other = { ...identity, distinctId: 'user_456' };
    expect(resolvePostHogSync('user_123', other)).toEqual({ type: 'identify', identity: other });
  });
});
