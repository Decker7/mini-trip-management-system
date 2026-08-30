import { Card, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Icons } from '@/components/icons';
import { cn } from '@/lib/utils';

const numberFormatter = new Intl.NumberFormat('en-US');

export function StatCard({
  label,
  value,
  icon,
  truncated,
  tone = 'default'
}: {
  label: string;
  value: number | undefined;
  icon: keyof typeof Icons;
  truncated?: boolean;
  tone?: 'default' | 'warning';
}) {
  const Icon = Icons[icon];
  return (
    <Card>
      <CardHeader>
        <div className='flex items-center justify-between'>
          <CardDescription>{label}</CardDescription>
          <div
            className={cn(
              'flex size-8 shrink-0 items-center justify-center rounded-full',
              tone === 'warning' ? 'bg-amber-500/10 text-amber-600' : 'bg-primary/10 text-primary'
            )}
          >
            <Icon className='size-4' />
          </div>
        </div>
        <CardTitle className='text-3xl font-semibold tabular-nums'>
          {value === undefined ? (
            <span className='bg-muted inline-block h-8 w-16 animate-pulse rounded' />
          ) : (
            <>
              {numberFormatter.format(value)}
              {truncated ? '+' : ''}
            </>
          )}
        </CardTitle>
      </CardHeader>
    </Card>
  );
}
