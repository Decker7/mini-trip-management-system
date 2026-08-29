import PageContainer from '@/components/layout/page-container';
import { DashboardOverview } from '@/features/dashboard/components/dashboard-overview';

export const metadata = {
  title: 'Dashboard: Overview'
};

export default function OverviewPage() {
  return (
    <PageContainer
      pageTitle='Overview'
      pageDescription='Trips, Participants, and Registrations at a glance.'
    >
      <DashboardOverview />
    </PageContainer>
  );
}
