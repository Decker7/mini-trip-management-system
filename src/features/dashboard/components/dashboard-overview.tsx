'use client';

import { useQuery } from 'convex/react';
import { api } from '../../../../convex/_generated/api';
import { Card, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Icons } from '@/components/icons';
import { todayDateOnlyString } from '@/features/trips/lib/date';

function StatCard({
  label,
  value,
  icon,
  truncated
}: {
  label: string;
  value: number | undefined;
  icon: keyof typeof Icons;
  truncated?: boolean;
}) {
  const Icon = Icons[icon];
  return (
    <Card>
      <CardHeader>
        <div className='flex items-center justify-between'>
          <CardDescription>{label}</CardDescription>
          <Icon className='text-muted-foreground size-4' />
        </div>
        <CardTitle className='text-3xl font-semibold tabular-nums'>
          {value === undefined ? (
            <span className='bg-muted inline-block h-8 w-16 animate-pulse rounded' />
          ) : (
            <>
              {value}
              {truncated ? '+' : ''}
            </>
          )}
        </CardTitle>
      </CardHeader>
    </Card>
  );
}

export function DashboardOverview() {
  const stats = useQuery(api.dashboard.getStats, { today: todayDateOnlyString() });

  return (
    <div className='grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4'>
      <StatCard
        label='Total Trips'
        value={stats?.tripCount}
        truncated={stats?.tripCountTruncated}
        icon='calendar'
      />
      <StatCard
        label='Upcoming Trips'
        value={stats?.upcomingTripCount}
        truncated={stats?.tripCountTruncated}
        icon='clock'
      />
      <StatCard
        label='Total Participants'
        value={stats?.participantCount}
        truncated={stats?.participantCountTruncated}
        icon='user'
      />
      <StatCard
        label='Paid Registrations'
        value={stats?.paidRegistrationCount}
        truncated={stats?.paidRegistrationCountTruncated}
        icon='circleCheck'
      />
      <StatCard
        label='Unpaid Registrations'
        value={stats?.unpaidRegistrationCount}
        truncated={stats?.unpaidRegistrationCountTruncated}
        icon='alertCircle'
      />
    </div>
  );
}
