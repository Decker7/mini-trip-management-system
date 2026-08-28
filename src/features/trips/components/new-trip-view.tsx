'use client';

import { useUser } from '@clerk/nextjs';
import PageContainer from '@/components/layout/page-container';
import { useUserRole } from '@/hooks/use-user-role';
import { TripForm } from './trip-form';

export function NewTripView() {
  const { isLoaded } = useUser();
  const role = useUserRole();
  const isReady = isLoaded;
  const isAdmin = role === 'admin';

  return (
    <PageContainer
      access={!isReady || isAdmin}
      accessFallback={
        <div className='text-muted-foreground text-center text-lg'>
          Only Admins can create Trips.
        </div>
      }
      isLoading={!isReady}
    >
      <TripForm initialData={null} pageTitle='Create New Trip' />
    </PageContainer>
  );
}
