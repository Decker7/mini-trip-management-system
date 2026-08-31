import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Mask } from '@/components/mask';
import { Skeleton } from '@/components/ui/skeleton';

type StaffActivityEntry = { staffId: string; count: number };

function initials(name: string) {
  const parts = name.trim().split(/\s+/);
  return (parts[0]?.[0] ?? '?') + (parts.length > 1 ? (parts[parts.length - 1]?.[0] ?? '') : '');
}

export function StaffLeaderboard({
  data,
  resolveName
}: {
  data: StaffActivityEntry[] | undefined;
  resolveName: (staffId: string) => string | undefined;
}) {
  const maxCount = data?.[0]?.count ?? 0;

  return (
    <Card className='h-full'>
      <CardHeader>
        <CardTitle>Team activity</CardTitle>
        <CardDescription>Active Registrations processed, by account</CardDescription>
      </CardHeader>
      <CardContent className='flex flex-col gap-3'>
        {!data ? (
          <Skeleton className='h-[220px] w-full rounded-lg' />
        ) : data.length === 0 ? (
          <div className='text-muted-foreground flex h-[220px] items-center justify-center text-sm'>
            No Registrations recorded yet.
          </div>
        ) : (
          data.map((entry, index) => {
            const name = resolveName(entry.staffId) ?? 'Unknown account';
            const width = maxCount > 0 ? Math.max(8, (entry.count / maxCount) * 100) : 0;
            return (
              <div key={entry.staffId} className='flex items-center gap-3'>
                <span className='text-muted-foreground w-4 shrink-0 text-xs font-medium tabular-nums'>
                  {index + 1}
                </span>
                <Avatar className='size-7 shrink-0'>
                  <AvatarFallback className='text-xs'>{initials(name)}</AvatarFallback>
                </Avatar>
                <div className='min-w-0 flex-1'>
                  <p className='truncate text-sm font-medium'>
                    {name === 'You' || name === 'Unknown account' ? name : <Mask>{name}</Mask>}
                  </p>
                  <div className='bg-muted mt-1 h-1.5 w-full overflow-hidden rounded-full'>
                    <div
                      className='bg-primary h-full rounded-full transition-all'
                      style={{ width: `${width}%` }}
                    />
                  </div>
                </div>
                <span className='text-sm font-medium tabular-nums'>{entry.count}</span>
              </div>
            );
          })
        )}
      </CardContent>
    </Card>
  );
}
