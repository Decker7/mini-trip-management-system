'use client';

import Link from 'next/link';
import { useQuery } from 'convex/react';
import { formatDistanceToNow } from 'date-fns';
import { api } from '../../../../convex/_generated/api';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Mask } from '@/components/mask';
import { Skeleton } from '@/components/ui/skeleton';

const PANEL_LIMIT = 6;

export function PendingPaymentsPanel() {
  const result = useQuery(api.registrations.listAll, { paymentStatus: 'unpaid' });

  const rows = result?.rows
    .filter((row) => row.registrationStatus === 'registered')
    .toSorted((a, b) => a.registeredAt - b.registeredAt)
    .slice(0, PANEL_LIMIT);

  return (
    <Card className='h-full'>
      <CardHeader>
        <CardTitle>Pending payments</CardTitle>
        <CardDescription>Oldest unpaid Registrations to follow up on</CardDescription>
      </CardHeader>
      <CardContent className='flex flex-col gap-1'>
        {!rows ? (
          <Skeleton className='h-[220px] w-full rounded-lg' />
        ) : rows.length === 0 ? (
          <div className='text-muted-foreground flex h-[220px] items-center justify-center text-sm'>
            No unpaid Registrations right now.
          </div>
        ) : (
          rows.map((row) => (
            <Link
              key={row._id}
              href={`/dashboard/trips/${row.tripId}`}
              aria-label={`View registration for ${row.tripName}`}
              className='flex items-center gap-3 rounded-lg -mx-1 px-1 py-2 transition-colors hover:bg-muted/50'
            >
              <div className='min-w-0 flex-1'>
                <p className='truncate text-sm font-medium'>
                  <Mask>{row.fullName}</Mask>
                </p>
                <p className='text-muted-foreground truncate text-xs'>{row.tripName}</p>
              </div>
              <div className='flex shrink-0 flex-col items-end gap-1'>
                <Badge variant='outline'>Unpaid</Badge>
                <span className='text-muted-foreground text-xs'>
                  {formatDistanceToNow(row.registeredAt, { addSuffix: true })}
                </span>
              </div>
            </Link>
          ))
        )}
      </CardContent>
    </Card>
  );
}
