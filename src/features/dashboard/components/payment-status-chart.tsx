'use client';

import * as React from 'react';
import { Cell, Label, Pie, PieChart } from 'recharts';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import {
  ChartConfig,
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent
} from '@/components/ui/chart';
import { Skeleton } from '@/components/ui/skeleton';

const chartConfig = {
  paid: { label: 'Paid', color: 'var(--chart-1)' },
  unpaid: { label: 'Unpaid', color: 'var(--chart-2)' },
  refunded: { label: 'Refunded', color: 'var(--chart-3)' }
} satisfies ChartConfig;

type Breakdown = { paid: number; unpaid: number; refunded: number };

export function PaymentStatusChart({ data }: { data: Breakdown | undefined }) {
  const chartData = React.useMemo(() => {
    if (!data) return [];
    return (['paid', 'unpaid', 'refunded'] as const)
      .map((key) => ({ key, value: data[key], fill: `var(--color-${key})` }))
      .filter((entry) => entry.value > 0);
  }, [data]);

  const total = data ? data.paid + data.unpaid + data.refunded : undefined;

  return (
    <Card className='h-full'>
      <CardHeader>
        <CardTitle>Payment status</CardTitle>
        <CardDescription>Active Registrations by Payment Status</CardDescription>
      </CardHeader>
      <CardContent className='flex flex-col items-center gap-4'>
        {!data ? (
          <Skeleton className='h-[220px] w-full rounded-lg' />
        ) : total === 0 ? (
          <div className='text-muted-foreground flex h-[220px] items-center justify-center text-sm'>
            No active Registrations yet.
          </div>
        ) : (
          <>
            <ChartContainer config={chartConfig} className='mx-auto h-[220px] w-full'>
              <PieChart>
                <ChartTooltip content={<ChartTooltipContent hideLabel />} />
                <Pie
                  data={chartData}
                  dataKey='value'
                  nameKey='key'
                  innerRadius={60}
                  outerRadius={85}
                  strokeWidth={4}
                  stroke='var(--card)'
                >
                  {chartData.map((entry) => (
                    <Cell key={entry.key} fill={entry.fill} />
                  ))}
                  <Label
                    content={({ viewBox }) => {
                      if (!viewBox || !('cx' in viewBox)) return null;
                      return (
                        <text
                          x={viewBox.cx}
                          y={viewBox.cy}
                          textAnchor='middle'
                          dominantBaseline='middle'
                        >
                          <tspan
                            x={viewBox.cx}
                            y={viewBox.cy}
                            className='fill-foreground text-2xl font-semibold'
                          >
                            {total}
                          </tspan>
                          <tspan
                            x={viewBox.cx}
                            y={(viewBox.cy ?? 0) + 20}
                            className='fill-muted-foreground text-xs'
                          >
                            Registered
                          </tspan>
                        </text>
                      );
                    }}
                  />
                </Pie>
              </PieChart>
            </ChartContainer>
            <div className='flex w-full flex-wrap justify-center gap-x-4 gap-y-1.5 text-sm'>
              {(['paid', 'unpaid', 'refunded'] as const).map((key) => (
                <div key={key} className='flex items-center gap-1.5'>
                  <span
                    className='size-2.5 shrink-0 rounded-[2px]'
                    style={{ backgroundColor: chartConfig[key].color }}
                  />
                  <span className='text-muted-foreground'>{chartConfig[key].label}</span>
                  <span className='font-medium tabular-nums'>{data[key]}</span>
                </div>
              ))}
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}
