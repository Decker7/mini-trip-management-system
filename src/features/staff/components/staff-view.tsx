'use client';

import { useUser } from '@clerk/nextjs';
import PageContainer from '@/components/layout/page-container';
import { useUserRole } from '@/hooks/use-user-role';
import { StaffListing } from './staff-listing';

export function StaffView() {
  const { isLoaded } = useUser();
  const role = useUserRole();
  const isReady = isLoaded;
  const isAdmin = role === 'admin';

  return (
    <PageContainer
      pageTitle='Manage Staff'
      pageDescription='See who has access, invite new Staff, and change roles.'
      access={!isReady || isAdmin}
      accessFallback={
        <div className='text-muted-foreground text-center text-lg'>
          Only Admins can manage Staff accounts.
        </div>
      }
      isLoading={!isReady}
    >
      <StaffListing />
    </PageContainer>
  );
}
