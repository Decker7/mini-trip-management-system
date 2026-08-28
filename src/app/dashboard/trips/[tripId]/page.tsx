import PageContainer from '@/components/layout/page-container';
import { TripDetail } from '@/features/trips/components/trip-detail';
import type { Id } from '../../../../../convex/_generated/dataModel';

export const metadata = {
  title: 'Dashboard: Trip Details'
};

type PageProps = { params: Promise<{ tripId: string }> };

export default async function Page({ params }: PageProps) {
  const { tripId } = await params;

  return (
    <PageContainer>
      <TripDetail tripId={tripId as Id<'trips'>} />
    </PageContainer>
  );
}
