'use client';

import { useClerk, useUser } from '@clerk/nextjs';
import { useConvexAuth } from 'convex/react';
import { Modal } from '@/components/ui/modal';
import { Button } from '@/components/ui/button';
import { isAssignedRole, useUserRole } from '@/hooks/use-user-role';

/**
 * Every dashboard query rejects a signed-in user with no Admin/Staff role
 * (e.g. access just revoked) via `requireAssignedRole`, which would otherwise
 * surface as an uncaught ConvexError. Gating here, before any page mounts its
 * queries, stops that crash instead of catching it after the fact.
 *
 * During sign-out there's a window where Clerk has already cleared the
 * session but the redirect to /auth/sign-in hasn't landed yet — `role` reads
 * as unassigned in that window too, so check Convex's own auth state first
 * and render nothing (rather than the no-role modal) until the redirect
 * completes.
 */
export function RoleGate({ children }: { children: React.ReactNode }) {
  const { isLoading: authLoading, isAuthenticated } = useConvexAuth();
  const { isLoaded } = useUser();
  const role = useUserRole();
  const { signOut } = useClerk();

  if (authLoading || !isAuthenticated) {
    return null;
  }

  if (isLoaded && !isAssignedRole(role)) {
    const handleSignOut = () => signOut({ redirectUrl: '/auth/sign-in' });
    return (
      <Modal
        title='No access yet'
        description='Your account is Unassigned — it has not been given a role yet. Contact an Admin to get access, then sign in again.'
        isOpen
        onClose={handleSignOut}
      >
        <div className='flex justify-end pt-4'>
          <Button onClick={handleSignOut}>Sign out</Button>
        </div>
      </Modal>
    );
  }

  return children;
}
