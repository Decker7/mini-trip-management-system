import PageContainer from '@/components/layout/page-container';
import { TripAddButton } from '@/features/trips/components/trip-add-button';
import { TripListing } from '@/features/trips/components/trip-listing';

export const metadata = {
  title: 'Dashboard: Trips'
};

export default function TripsPage() {
  return (
    <PageContainer
      pageTitle='Trips'
      pageDescription='Create, browse, and search Trips.'
      pageHeaderAction={<TripAddButton />}
    >
      <TripListing />
    </PageContainer>
  );
}
