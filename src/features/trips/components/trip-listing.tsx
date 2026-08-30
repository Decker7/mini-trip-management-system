'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useMutation, useQuery } from 'convex/react';
import { parseAsIsoDate, parseAsString, parseAsStringEnum, useQueryStates } from 'nuqs';
import { toast } from 'sonner';
import { api } from '../../../../convex/_generated/api';
import type { Id } from '../../../../convex/_generated/dataModel';
import { AlertModal } from '@/components/modal/alert-modal';
import { Button, buttonVariants } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Icons } from '@/components/icons';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow
} from '@/components/ui/table';
import { useDebounce } from '@/hooks/use-debounce';
import { useUserRole } from '@/hooks/use-user-role';
import { cn } from '@/lib/utils';
import { toDateOnlyString, todayDateOnlyString } from '@/features/trips/lib/date';
import { TripStatusBadge } from './trip-status-badge';

const TRIP_STATUSES = ['upcoming', 'ongoing', 'completed'] as const;

export function TripListing() {
  const isAdmin = useUserRole() === 'admin';

  const [params, setParams] = useQueryStates({
    search: parseAsString.withDefault(''),
    status: parseAsStringEnum([...TRIP_STATUSES]),
    startDateFrom: parseAsIsoDate,
    startDateTo: parseAsIsoDate
  });

  const debouncedSearch = useDebounce(params.search, 300);

  const trips = useQuery(api.trips.list, {
    today: todayDateOnlyString(),
    search: debouncedSearch || undefined,
    status: params.status ?? undefined,
    startDateFrom: params.startDateFrom ? toDateOnlyString(params.startDateFrom) : undefined,
    startDateTo: params.startDateTo ? toDateOnlyString(params.startDateTo) : undefined
  });

  const [deleteTarget, setDeleteTarget] = useState<{ id: Id<'trips'>; name: string } | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const removeTrip = useMutation(api.trips.remove);

  async function handleConfirmDelete() {
    if (!deleteTarget) return;
    setIsDeleting(true);
    try {
      await removeTrip({ tripId: deleteTarget.id });
      toast.success('Trip deleted');
      setDeleteTarget(null);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Couldn't delete the trip.");
    } finally {
      setIsDeleting(false);
    }
  }

  const columnCount = isAdmin ? 7 : 6;

  return (
    <div className='space-y-4'>
      <AlertModal
        isOpen={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onConfirm={handleConfirmDelete}
        loading={isDeleting}
        title='Delete this trip?'
        description={
          deleteTarget ? `"${deleteTarget.name}" will be permanently removed.` : undefined
        }
      />

      <div className='flex flex-col gap-3 md:flex-row md:items-center md:justify-between'>
        <div className='relative w-full md:max-w-xs'>
          <Icons.search className='text-muted-foreground absolute top-1/2 left-2.5 h-4 w-4 -translate-y-1/2' />
          <Input
            value={params.search}
            onChange={(e) => setParams({ search: e.target.value || null })}
            placeholder='Search by name or destination...'
            className='pl-8'
          />
        </div>

        <div className='flex flex-wrap items-center gap-2'>
          <Select
            value={params.status ?? 'all'}
            onValueChange={(value) => {
              if (value === null) return;
              setParams({
                status: value === 'all' ? null : (value as (typeof TRIP_STATUSES)[number])
              });
            }}
          >
            <SelectTrigger className='w-[140px]'>
              <SelectValue placeholder='Status' />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value='all'>All statuses</SelectItem>
              <SelectItem value='upcoming'>Upcoming</SelectItem>
              <SelectItem value='ongoing'>Ongoing</SelectItem>
              <SelectItem value='completed'>Completed</SelectItem>
            </SelectContent>
          </Select>

          <Input
            type='date'
            value={params.startDateFrom ? toDateOnlyString(params.startDateFrom) : ''}
            onChange={(e) =>
              setParams({
                startDateFrom: e.target.value ? new Date(`${e.target.value}T00:00:00`) : null
              })
            }
            className='w-[150px]'
            aria-label='Start date from'
          />
          <Input
            type='date'
            value={params.startDateTo ? toDateOnlyString(params.startDateTo) : ''}
            onChange={(e) =>
              setParams({
                startDateTo: e.target.value ? new Date(`${e.target.value}T00:00:00`) : null
              })
            }
            className='w-[150px]'
            aria-label='Start date to'
          />
        </div>
      </div>

      <Card>
        <CardContent className='p-0'>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Destination</TableHead>
                <TableHead>Dates</TableHead>
                <TableHead>Capacity</TableHead>
                <TableHead>Price</TableHead>
                <TableHead>Status</TableHead>
                {isAdmin && <TableHead className='w-[100px] text-right'>Actions</TableHead>}
              </TableRow>
            </TableHeader>
            <TableBody>
              {trips === undefined && (
                <TableRow>
                  <TableCell
                    colSpan={columnCount}
                    className='text-muted-foreground h-24 text-center'
                  >
                    Loading trips...
                  </TableCell>
                </TableRow>
              )}
              {trips?.length === 0 && (
                <TableRow>
                  <TableCell
                    colSpan={columnCount}
                    className='text-muted-foreground h-24 text-center'
                  >
                    No trips found.
                  </TableCell>
                </TableRow>
              )}
              {trips?.map((trip) => (
                <TableRow key={trip._id}>
                  <TableCell className='font-medium'>
                    <Link href={`/dashboard/trips/${trip._id}`} className='hover:underline'>
                      {trip.name}
                    </Link>
                  </TableCell>
                  <TableCell>{trip.destination}</TableCell>
                  <TableCell>
                    {trip.startDate} &ndash; {trip.endDate}
                  </TableCell>
                  <TableCell>{trip.capacity}</TableCell>
                  <TableCell>
                    {trip.price === undefined ? '—' : `$${trip.price.toFixed(2)}`}
                  </TableCell>
                  <TableCell>
                    <TripStatusBadge status={trip.status} />
                  </TableCell>
                  {isAdmin && (
                    <TableCell className='text-right'>
                      <div className='flex justify-end gap-1'>
                        <Link
                          href={`/dashboard/trips/${trip._id}/edit`}
                          className={cn(buttonVariants({ variant: 'ghost', size: 'icon' }))}
                        >
                          <Icons.edit className='h-4 w-4' />
                          <span className='sr-only'>Edit</span>
                        </Link>
                        <Button
                          variant='ghost'
                          size='icon'
                          onClick={() => setDeleteTarget({ id: trip._id, name: trip.name })}
                        >
                          <Icons.trash className='h-4 w-4' />
                          <span className='sr-only'>Delete</span>
                        </Button>
                      </div>
                    </TableCell>
                  )}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
