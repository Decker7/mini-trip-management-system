import Link from 'next/link';
import { formatDistanceToNow } from 'date-fns';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { Icons } from '@/components/icons';
import { cn } from '@/lib/utils';
import { Skeleton } from '@/components/ui/skeleton';

type ActivityEntry = {
  _id: string;
  field: 'paymentStatus' | 'registrationStatus';
  oldValue: string;
  newValue: string;
  changedBy: string;
  changedAt: number;
  tripId: string | null;
  tripName: string;
  participantName: string;
};

function capitalize(value: string) {
  return value.charAt(0).toUpperCase() + value.slice(1);
}

function entryIcon(entry: ActivityEntry) {
  if (entry.field === 'registrationStatus') {
    return entry.newValue === 'cancelled' ? Icons.xCircle : Icons.circleCheck;
  }
  return Icons.creditCard;
}

function entryDescription(entry: ActivityEntry) {
  const fieldLabel = entry.field === 'paymentStatus' ? 'Payment' : 'Registration';
  return `${fieldLabel} changed to ${capitalize(entry.newValue)} for ${entry.participantName}`;
}

export function RecentActivityFeed({
  data,
  currentSubject,
  resolveActorName
}: {
  data: ActivityEntry[] | undefined;
  currentSubject: string | null | undefined;
  resolveActorName?: (subject: string) => string | undefined;
}) {
  return (
    <Card className='h-full'>
      <CardHeader>
        <CardTitle>Recent activity</CardTitle>
        <CardDescription>Latest Payment and Registration Status changes</CardDescription>
      </CardHeader>
      <CardContent className='flex flex-col gap-1'>
        {!data ? (
          <Skeleton className='h-[260px] w-full rounded-lg' />
        ) : data.length === 0 ? (
          <div className='text-muted-foreground flex h-[260px] items-center justify-center text-sm'>
            No activity recorded yet.
          </div>
        ) : (
          data.map((entry) => {
            const Icon = entryIcon(entry);
            const actorName =
              entry.changedBy === currentSubject
                ? 'You'
                : (resolveActorName?.(entry.changedBy) ?? 'A team member');
            const content = (
              <div className='flex items-start gap-3 rounded-lg -mx-1 px-1 py-2 transition-colors hover:bg-muted/50'>
                <div
                  className={cn(
                    'flex size-8 shrink-0 items-center justify-center rounded-full',
                    entry.field === 'registrationStatus' && entry.newValue === 'cancelled'
                      ? 'bg-destructive/10 text-destructive'
                      : 'bg-primary/10 text-primary'
                  )}
                >
                  <Icon className='size-4' />
                </div>
                <div className='min-w-0 flex-1'>
                  <p className='text-sm'>{entryDescription(entry)}</p>
                  <p className='text-muted-foreground truncate text-xs'>
                    {entry.tripName} · {actorName} ·{' '}
                    {formatDistanceToNow(entry.changedAt, { addSuffix: true })}
                  </p>
                </div>
              </div>
            );
            return entry.tripId ? (
              <Link key={entry._id} href={`/dashboard/trips/${entry.tripId}`}>
                {content}
              </Link>
            ) : (
              <div key={entry._id}>{content}</div>
            );
          })
        )}
      </CardContent>
    </Card>
  );
}
