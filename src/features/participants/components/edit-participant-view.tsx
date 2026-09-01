'use client';

import { useUser } from '@clerk/nextjs';
import { useQuery } from 'convex/react';
import { useFeatureFlagEnabled } from 'posthog-js/react';
import PageContainer from '@/components/layout/page-container';
import { useUserRole } from '@/hooks/use-user-role';
import { PARTICIPANT_EDIT_ROLLOUT_FLAG } from '@/lib/feature-flags';
import { api } from '../../../../convex/_generated/api';
import type { Id } from '../../../../convex/_generated/dataModel';
import { ParticipantForm } from './participant-form';

export function EditParticipantView({ participantId }: { participantId: Id<'participants'> }) {
  const { isLoaded } = useUser();
  const role = useUserRole();
  const participant = useQuery(api.participants.get, { participantId });
  // Client-side gate only — a temporary rollout switch, not a security boundary.
  // Convex's own Staff/Admin role checks already govern who can write.
  const rolloutEnabled = useFeatureFlagEnabled(PARTICIPANT_EDIT_ROLLOUT_FLAG, false);

  const isReady = isLoaded && participant !== undefined;
  const isAssigned = role === 'admin' || role === 'staff';

  return (
    <PageContainer
      access={!isReady || (isAssigned && rolloutEnabled && participant !== null)}
      accessFallback={
        <div className='text-muted-foreground text-center text-lg'>
          {participant === null
            ? 'This Participant no longer exists.'
            : !isAssigned
              ? 'Only Admins and Staff can edit Participants.'
              : "Editing Participants isn't available for your account yet."}
        </div>
      }
      isLoading={!isReady}
    >
      {participant && <ParticipantForm initialData={participant} />}
    </PageContainer>
  );
}
