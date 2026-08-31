'use client';

import Link from 'next/link';
import { useQuery } from 'convex/react';
import { parseAsString, parseAsStringEnum, useQueryStates } from 'nuqs';
import { api } from '../../../../convex/_generated/api';
import type { Id } from '../../../../convex/_generated/dataModel';
import { Card, CardContent } from '@/components/ui/card';
import { Icons } from '@/components/icons';
import { Input } from '@/components/ui/input';
import { PH_MASK_CLASS } from '@/lib/posthog-config';
import { cn } from '@/lib/utils';
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
import {
  PAYMENT_STATUSES,
  PAYMENT_STATUS_LABEL
} from '@/features/registrations/lib/payment-status';
import { RegistrationStatusBadge } from '@/features/registrations/components/registration-status-badge';
import { todayDateOnlyString } from '@/features/trips/lib/date';

export function ParticipantListing() {
  const [params, setParams] = useQueryStates({
    search: parseAsString.withDefault(''),
    tripId: parseAsString,
    paymentStatus: parseAsStringEnum([...PAYMENT_STATUSES])
  });

  const debouncedSearch = useDebounce(params.search, 300);

  const trips = useQuery(api.trips.list, { today: todayDateOnlyString() });
  const result = useQuery(api.registrations.listAll, {
    search: debouncedSearch || undefined,
    tripId: params.tripId ? (params.tripId as Id<'trips'>) : undefined,
    paymentStatus: params.paymentStatus ?? undefined
  });

  const registrations = result?.rows;
  const columnCount = 6;

  return (
    <div className='space-y-4'>
      <div className='flex flex-col gap-3 md:flex-row md:items-center md:justify-between'>
        <div className='relative w-full md:max-w-xs'>
          <Icons.search className='text-muted-foreground absolute top-1/2 left-2.5 h-4 w-4 -translate-y-1/2' />
          <Input
            value={params.search}
            onChange={(e) => setParams({ search: e.target.value || null })}
            placeholder='Search by name or IC/passport...'
            className='pl-8'
          />
        </div>

        <div className='flex flex-wrap items-center gap-2'>
          <Select
            value={params.tripId ?? 'all'}
            onValueChange={(value) => {
              if (value === null) return;
              setParams({ tripId: value === 'all' ? null : value });
            }}
          >
            <SelectTrigger className='w-[180px]'>
              <SelectValue placeholder='Trip' />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value='all'>All Trips</SelectItem>
              {trips?.map((trip) => (
                <SelectItem key={trip._id} value={trip._id}>
                  {trip.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select
            value={params.paymentStatus ?? 'all'}
            onValueChange={(value) => {
              if (value === null) return;
              setParams({
                paymentStatus: value === 'all' ? null : (value as (typeof PAYMENT_STATUSES)[number])
              });
            }}
          >
            <SelectTrigger className='w-[140px]'>
              <SelectValue placeholder='Payment Status' />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value='all'>All statuses</SelectItem>
              {PAYMENT_STATUSES.map((status) => (
                <SelectItem key={status} value={status}>
                  {PAYMENT_STATUS_LABEL[status]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {result?.truncated && (
        <div className='border-border text-muted-foreground flex items-center gap-2 rounded-lg border border-dashed px-3 py-2 text-sm'>
          <Icons.warning className='h-4 w-4 shrink-0' />
          <span>
            Showing a partial list — there are more Participants than can be listed at once. Narrow
            the search or filters to see the rest.
          </span>
        </div>
      )}

      <Card>
        <CardContent className='p-0'>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>IC/Passport</TableHead>
                <TableHead>Trip</TableHead>
                <TableHead>Email</TableHead>
                <TableHead>Payment Status</TableHead>
                <TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {registrations === undefined && (
                <TableRow>
                  <TableCell
                    colSpan={columnCount}
                    className='text-muted-foreground h-24 text-center'
                  >
                    Loading Participants...
                  </TableCell>
                </TableRow>
              )}
              {registrations?.length === 0 && (
                <TableRow>
                  <TableCell
                    colSpan={columnCount}
                    className='text-muted-foreground h-24 text-center'
                  >
                    No Participants found.
                  </TableCell>
                </TableRow>
              )}
              {registrations?.map((entry) => (
                <TableRow key={entry._id}>
                  <TableCell className='font-medium'>
                    <Link
                      href={`/dashboard/participants/${entry.participantId}`}
                      className={cn(PH_MASK_CLASS, 'hover:underline')}
                    >
                      {entry.fullName}
                    </Link>
                  </TableCell>
                  <TableCell className={PH_MASK_CLASS}>{entry.icPassportNumber}</TableCell>
                  <TableCell>
                    <Link href={`/dashboard/trips/${entry.tripId}`} className='hover:underline'>
                      {entry.tripName}
                    </Link>
                  </TableCell>
                  <TableCell className={PH_MASK_CLASS}>{entry.email}</TableCell>
                  <TableCell>{PAYMENT_STATUS_LABEL[entry.paymentStatus]}</TableCell>
                  <TableCell>
                    <RegistrationStatusBadge status={entry.registrationStatus} />
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
