import Link from 'next/link';
import { differenceInCalendarDays, format } from 'date-fns';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Icons } from '@/components/icons';
import { fromDateOnlyString } from '@/features/trips/lib/date';

type UpcomingTrip = {
  tripId: string;
  name: string;
  destination: string;
  startDate: string;
  capacity: number;
  registered: number;
};

function daysUntilLabel(startDate: string, today: string) {
  const days = differenceInCalendarDays(fromDateOnlyString(startDate), fromDateOnlyString(today));
  if (days === 0) return 'Starts today';
  if (days === 1) return 'Starts tomorrow';
  return `In ${days} days`;
}

export function UpcomingTripsPanel({
  data,
  today
}: {
  data: UpcomingTrip[] | undefined;
  today: string;
}) {
  return (
    <Card className='h-full'>
      <CardHeader>
        <CardTitle>Next up</CardTitle>
        <CardDescription>The soonest upcoming Trips</CardDescription>
      </CardHeader>
      <CardContent className='flex flex-col gap-1'>
        {!data ? (
          <div className='bg-muted h-[220px] w-full animate-pulse rounded-lg' />
        ) : data.length === 0 ? (
          <div className='text-muted-foreground flex h-[220px] items-center justify-center text-sm'>
            No upcoming Trips scheduled.
          </div>
        ) : (
          data.map((trip) => (
            <Link
              key={trip.tripId}
              href={`/dashboard/trips/${trip.tripId}`}
              className='flex items-center gap-3 rounded-lg -mx-1 px-1 py-2 transition-colors hover:bg-muted/50'
            >
              <div className='bg-primary/10 text-primary flex size-9 shrink-0 flex-col items-center justify-center rounded-lg'>
                <Icons.calendar className='size-4' />
              </div>
              <div className='min-w-0 flex-1'>
                <p className='truncate text-sm font-medium'>{trip.name}</p>
                <p className='text-muted-foreground truncate text-xs'>
                  {trip.destination} · {format(fromDateOnlyString(trip.startDate), 'MMM d, yyyy')}
                </p>
              </div>
              <div className='flex shrink-0 flex-col items-end gap-1'>
                <Badge variant='outline'>{daysUntilLabel(trip.startDate, today)}</Badge>
                <span className='text-muted-foreground text-xs tabular-nums'>
                  {trip.registered}/{trip.capacity} seats
                </span>
              </div>
            </Link>
          ))
        )}
      </CardContent>
    </Card>
  );
}
