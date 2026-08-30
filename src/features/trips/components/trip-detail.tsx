'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useMutation, useQuery } from 'convex/react';
import { toast } from 'sonner';
import { api } from '../../../../convex/_generated/api';
import type { Id } from '../../../../convex/_generated/dataModel';
import { AlertModal } from '@/components/modal/alert-modal';
import { Button, buttonVariants } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Icons } from '@/components/icons';
import { useUserRole } from '@/hooks/use-user-role';
import { cn } from '@/lib/utils';
import { todayDateOnlyString } from '@/features/trips/lib/date';
import { RegisterParticipantSheet } from '@/features/registrations/components/register-participant-sheet';
import { RosterTable } from '@/features/registrations/components/roster-table';
import { TripStatusBadge } from './trip-status-badge';

export function TripDetail({ tripId }: { tripId: Id<'trips'> }) {
  const router = useRouter();
  const isAdmin = useUserRole() === 'admin';

  const trip = useQuery(api.trips.get, { tripId, today: todayDateOnlyString() });
  const roster = useQuery(api.registrations.listByTrip, { tripId });
  const removeTrip = useMutation(api.trips.remove);

  const [isDeleteOpen, setIsDeleteOpen] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  async function handleConfirmDelete() {
    setIsDeleting(true);
    try {
      await removeTrip({ tripId });
      toast.success('Trip deleted');
      router.push('/dashboard/trips');
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Couldn't delete the trip.");
      setIsDeleting(false);
    }
  }

  if (trip === undefined) {
    return <div className='text-muted-foreground p-6'>Loading trip...</div>;
  }

  if (trip === null) {
    return <div className='text-muted-foreground p-6'>This trip no longer exists.</div>;
  }

  const activeRegistrations = roster?.filter(
    (entry) => entry.registrationStatus !== 'cancelled'
  ).length;
  const capacityLabel =
    activeRegistrations === undefined
      ? trip.capacity
      : `${activeRegistrations} / ${trip.capacity} (${Math.max(trip.capacity - activeRegistrations, 0)} remaining)`;

  return (
    <div className='mx-auto w-full max-w-6xl space-y-6'>
      <Card>
        <AlertModal
          isOpen={isDeleteOpen}
          onClose={() => setIsDeleteOpen(false)}
          onConfirm={handleConfirmDelete}
          loading={isDeleting}
          title='Delete this trip?'
          description={`"${trip.name}" will be permanently removed.`}
        />

        <CardHeader className='flex flex-row items-start justify-between gap-4'>
          <div className='space-y-1.5'>
            <CardTitle className='text-2xl font-bold'>{trip.name}</CardTitle>
            <TripStatusBadge status={trip.status} />
          </div>
          {isAdmin && (
            <div className='flex shrink-0 gap-2'>
              <Link
                href={`/dashboard/trips/${trip._id}/edit`}
                className={cn(buttonVariants({ variant: 'outline', size: 'sm' }))}
              >
                <Icons.edit className='mr-2 h-4 w-4' /> Edit
              </Link>
              <Button variant='destructive' size='sm' onClick={() => setIsDeleteOpen(true)}>
                <Icons.trash className='mr-2 h-4 w-4' /> Delete
              </Button>
            </div>
          )}
        </CardHeader>
        <CardContent className='grid grid-cols-1 gap-6 md:grid-cols-2'>
          <div>
            <p className='text-muted-foreground text-sm'>Destination</p>
            <p className='font-medium'>{trip.destination}</p>
          </div>
          <div>
            <p className='text-muted-foreground text-sm'>Capacity</p>
            <p className='font-medium'>{capacityLabel}</p>
          </div>
          <div>
            <p className='text-muted-foreground text-sm'>Price</p>
            <p className='font-medium'>
              {trip.price === undefined ? '—' : `$${trip.price.toFixed(2)}`}
            </p>
          </div>
          <div>
            <p className='text-muted-foreground text-sm'>Start Date</p>
            <p className='font-medium'>{trip.startDate}</p>
          </div>
          <div>
            <p className='text-muted-foreground text-sm'>End Date</p>
            <p className='font-medium'>{trip.endDate}</p>
          </div>
          {trip.description && (
            <div className='md:col-span-2'>
              <p className='text-muted-foreground text-sm'>Description</p>
              <p className='font-medium'>{trip.description}</p>
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className='flex flex-row items-center justify-between gap-4'>
          <CardTitle className='text-lg font-semibold'>Roster</CardTitle>
          <RegisterParticipantSheet tripId={trip._id} />
        </CardHeader>
        <CardContent>
          <RosterTable tripId={trip._id} tripPrice={trip.price} />
        </CardContent>
      </Card>
    </div>
  );
}
