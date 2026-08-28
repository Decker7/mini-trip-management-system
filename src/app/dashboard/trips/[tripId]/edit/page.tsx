import { EditTripView } from '@/features/trips/components/edit-trip-view';
import type { Id } from '../../../../../../convex/_generated/dataModel';

export const metadata = {
  title: 'Dashboard: Edit Trip'
};

type PageProps = { params: Promise<{ tripId: string }> };

export default async function Page({ params }: PageProps) {
  const { tripId } = await params;
  return <EditTripView tripId={tripId as Id<'trips'>} />;
}
