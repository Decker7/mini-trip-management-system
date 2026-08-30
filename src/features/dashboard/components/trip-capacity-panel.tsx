import Link from 'next/link';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { Progress, ProgressTrack, ProgressIndicator } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { Skeleton } from '@/components/ui/skeleton';

type TripFillRate = {
  tripId: string;
  name: string;
  capacity: number;
  registered: number;
  fillRate: number;
};

export function TripCapacityPanel({ data }: { data: TripFillRate[] | undefined }) {
  return (
    <Card className='h-full'>
      <CardHeader>
        <CardTitle>Trips filling up</CardTitle>
        <CardDescription>Upcoming and ongoing Trips ranked by seats filled</CardDescription>
      </CardHeader>
      <CardContent className='flex flex-col gap-4'>
        {!data ? (
          <Skeleton className='h-[220px] w-full rounded-lg' />
        ) : data.length === 0 ? (
          <div className='text-muted-foreground flex h-[220px] items-center justify-center text-sm'>
            No active Trips to show yet.
          </div>
        ) : (
          data.map((trip) => {
            const percent = Math.round(trip.fillRate * 100);
            const isFull = trip.registered >= trip.capacity;
            const isNearFull = !isFull && trip.fillRate >= 0.9;
            return (
              <Link
                key={trip.tripId}
                href={`/dashboard/trips/${trip.tripId}`}
                aria-label={`View ${trip.name}`}
                className='group flex flex-col gap-1.5 rounded-lg -mx-1 px-1 py-0.5 transition-colors hover:bg-muted/50'
              >
                <div className='flex items-center justify-between gap-2 text-sm'>
                  <span className='truncate font-medium group-hover:underline'>{trip.name}</span>
                  <div className='flex shrink-0 items-center gap-2'>
                    {isFull ? <Badge variant='destructive'>Full</Badge> : null}
                    {isNearFull ? <Badge variant='secondary'>Almost full</Badge> : null}
                    <span className='text-muted-foreground tabular-nums'>
                      {trip.registered}/{trip.capacity}
                    </span>
                  </div>
                </div>
                <Progress value={percent}>
                  <ProgressTrack>
                    <ProgressIndicator
                      className={cn(isFull && 'bg-destructive')}
                      style={
                        !isFull
                          ? {
                              backgroundColor: 'var(--chart-2)',
                              opacity: 0.4 + trip.fillRate * 0.6
                            }
                          : undefined
                      }
                    />
                  </ProgressTrack>
                </Progress>
              </Link>
            );
          })
        )}
      </CardContent>
    </Card>
  );
}
