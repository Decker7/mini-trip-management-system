'use client';

import { Area, AreaChart, CartesianGrid, XAxis } from 'recharts';
import { format, parseISO } from 'date-fns';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import {
  ChartConfig,
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent
} from '@/components/ui/chart';
import { Skeleton } from '@/components/ui/skeleton';

const chartConfig = {
  count: {
    label: 'Registrations',
    color: 'var(--chart-1)'
  }
} satisfies ChartConfig;

export function RegistrationTrendChart({
  data
}: {
  data: { date: string; count: number }[] | undefined;
}) {
  const total = data?.reduce((sum, point) => sum + point.count, 0);

  return (
    <Card className='h-full'>
      <CardHeader>
        <CardTitle>Registration activity</CardTitle>
        <CardDescription>
          {total === undefined
            ? 'Loading…'
            : `${total} new Registration${total === 1 ? '' : 's'} in the last 14 days`}
        </CardDescription>
      </CardHeader>
      <CardContent>
        {!data ? (
          <Skeleton className='h-[240px] w-full rounded-lg' />
        ) : total === 0 ? (
          <div className='text-muted-foreground flex h-[240px] items-center justify-center text-sm'>
            No Registrations in the last 14 days.
          </div>
        ) : (
          <ChartContainer config={chartConfig} className='h-[240px] w-full'>
            <AreaChart data={data} margin={{ left: 0, right: 12, top: 8, bottom: 0 }}>
              <defs>
                <linearGradient id='registrationTrendFill' x1='0' y1='0' x2='0' y2='1'>
                  <stop offset='5%' stopColor='var(--color-count)' stopOpacity={0.35} />
                  <stop offset='95%' stopColor='var(--color-count)' stopOpacity={0.02} />
                </linearGradient>
              </defs>
              <CartesianGrid vertical={false} strokeDasharray='3 3' />
              <XAxis
                dataKey='date'
                tickLine={false}
                axisLine={false}
                tickMargin={8}
                minTickGap={24}
                tickFormatter={(value: string) => format(parseISO(value), 'MMM d')}
              />
              <ChartTooltip
                cursor={false}
                content={
                  <ChartTooltipContent
                    labelFormatter={(value) => format(parseISO(String(value)), 'EEEE, MMM d')}
                    indicator='dot'
                  />
                }
              />
              <Area
                dataKey='count'
                type='monotone'
                fill='url(#registrationTrendFill)'
                stroke='var(--color-count)'
                strokeWidth={2}
              />
            </AreaChart>
          </ChartContainer>
        )}
      </CardContent>
    </Card>
  );
}
