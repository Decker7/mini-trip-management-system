'use client';

import { useUser } from '@clerk/nextjs';
import { useQuery } from 'convex/react';
import PageContainer from '@/components/layout/page-container';
import { useUserRole } from '@/hooks/use-user-role';
import { todayDateOnlyString } from '@/features/trips/lib/date';
import { api } from '../../../../convex/_generated/api';
import type { Id } from '../../../../convex/_generated/dataModel';
import { TripForm } from './trip-form';

export function EditTripView({ tripId }: { tripId: Id<'trips'> }) {
  const { isLoaded } = useUser();
  const role = useUserRole();
  const trip = useQuery(api.trips.get, { tripId, today: todayDateOnlyString() });

  const isReady = isLoaded && trip !== undefined;
  const isAdmin = role === 'admin';

  return (
    <PageContainer
      access={!isReady || (isAdmin && trip !== null)}
      accessFallback={
        <div className='text-muted-foreground text-center text-lg'>
          {trip === null ? 'This trip no longer exists.' : 'Only Admins can edit Trips.'}
        </div>
      }
      isLoading={!isReady}
    >
      {trip && (
        <TripForm
          initialData={{
            _id: trip._id,
            name: trip.name,
            destination: trip.destination,
            startDate: trip.startDate,
            endDate: trip.endDate,
            capacity: trip.capacity,
            description: trip.description
          }}
          pageTitle='Edit Trip'
        />
      )}
    </PageContainer>
  );
}
