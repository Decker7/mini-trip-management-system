'use client';

import { useEffect, useState } from 'react';
import { useAction, useQuery } from 'convex/react';
import { api } from '../../../../convex/_generated/api';
import { todayDateOnlyString } from '@/features/trips/lib/date';
import { useUserRole } from '@/hooks/use-user-role';
import { StatCard } from './stat-card';
import { RegistrationTrendChart } from './registration-trend-chart';
import { PaymentStatusChart } from './payment-status-chart';
import { TripCapacityPanel } from './trip-capacity-panel';
import { UpcomingTripsPanel } from './upcoming-trips-panel';
import { RecentActivityFeed } from './recent-activity-feed';
import { StaffLeaderboard } from './staff-leaderboard';
import { PendingPaymentsPanel } from './pending-payments-panel';

export function DashboardOverview() {
  const role = useUserRole();
  const today = todayDateOnlyString();

  const stats = useQuery(api.dashboard.getStats, { today });
  const analytics = useQuery(api.dashboard.getAnalytics, { today });
  const whoami = useQuery(api.users.whoami, {});

  // Only an Admin can resolve a Clerk user id to a name (`staffAccounts.listUsers`
  // is Admin-gated), so Staff see the leaderboard replaced by an operational
  // panel instead of one full of "Unknown account" rows.
  const listUsers = useAction(api.staffAccounts.listUsers);
  const [staffNames, setStaffNames] = useState<Record<string, string> | null>(null);

  useEffect(() => {
    if (role !== 'admin') return;
    let cancelled = false;
    listUsers({})
      .then((users) => {
        if (cancelled) return;
        setStaffNames(
          Object.fromEntries(users.map((user) => [user.userId, user.fullName || user.email]))
        );
      })
      .catch(() => {
        // Best-effort — the leaderboard just falls back to "Unknown account".
      });
    return () => {
      cancelled = true;
    };
  }, [role, listUsers]);

  const resolveActorName = (subject: string) => staffNames?.[subject];

  return (
    <div className='flex flex-col gap-4'>
      <div className='grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-5'>
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
          tone='warning'
        />
      </div>

      <div className='grid grid-cols-1 gap-4 lg:grid-cols-3'>
        <div className='lg:col-span-2'>
          <RegistrationTrendChart data={analytics?.registrationTrend} />
        </div>
        <PaymentStatusChart data={analytics?.paymentBreakdown} />
      </div>

      <div className='grid grid-cols-1 gap-4 lg:grid-cols-2'>
        <TripCapacityPanel data={analytics?.tripFillRates} />
        <UpcomingTripsPanel data={analytics?.upcomingTrips} today={today} />
      </div>

      <div className='grid grid-cols-1 gap-4 lg:grid-cols-3'>
        <div className='lg:col-span-2'>
          <RecentActivityFeed
            data={analytics?.recentActivity}
            currentSubject={whoami?.subject}
            resolveActorName={resolveActorName}
          />
        </div>
        {role === 'admin' ? (
          <StaffLeaderboard
            data={analytics?.staffActivity}
            resolveName={(staffId) =>
              staffId === whoami?.subject ? 'You' : resolveActorName(staffId)
            }
          />
        ) : (
          <PendingPaymentsPanel />
        )}
      </div>
    </div>
  );
}
