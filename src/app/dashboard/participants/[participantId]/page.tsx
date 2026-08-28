import PageContainer from '@/components/layout/page-container';
import { ParticipantDetail } from '@/features/participants/components/participant-detail';
import type { Id } from '../../../../../convex/_generated/dataModel';

export const metadata = {
  title: 'Dashboard: Participant Details'
};

type PageProps = { params: Promise<{ participantId: string }> };

export default async function Page({ params }: PageProps) {
  const { participantId } = await params;

  return (
    <PageContainer>
      <ParticipantDetail participantId={participantId as Id<'participants'>} />
    </PageContainer>
  );
}
