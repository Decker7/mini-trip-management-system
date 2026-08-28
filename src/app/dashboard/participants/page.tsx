import PageContainer from '@/components/layout/page-container';
import { ParticipantListing } from '@/features/participants/components/participant-listing';

export const metadata = {
  title: 'Dashboard: Participants'
};

export default function ParticipantsPage() {
  return (
    <PageContainer
      pageTitle='Participants'
      pageDescription='Search and filter Participants across every Trip.'
    >
      <ParticipantListing />
    </PageContainer>
  );
}
