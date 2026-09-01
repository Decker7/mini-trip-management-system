import { EditParticipantView } from '@/features/participants/components/edit-participant-view';
import type { Id } from '../../../../../../convex/_generated/dataModel';

export const metadata = {
  title: 'Dashboard: Edit Participant'
};

type PageProps = { params: Promise<{ participantId: string }> };

export default async function Page({ params }: PageProps) {
  const { participantId } = await params;
  return <EditParticipantView participantId={participantId as Id<'participants'>} />;
}
