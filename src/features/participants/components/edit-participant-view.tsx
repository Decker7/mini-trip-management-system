'use client';

import { useUser } from '@clerk/nextjs';
import { useQuery_experimental as useQuery } from 'convex/react';
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
  // A malformed id in the URL fails the query's own argument validator
  // before it can look anything up — the object form surfaces that as
  // `status: 'error'` instead of throwing during render, mirroring
  // `ParticipantDetail`'s handling of the same edge case.
  const state = useQuery({ query: api.participants.get, args: { participantId } });
  // Client-side gate only — a temporary rollout switch, not a security boundary.
  // Convex's own Staff/Admin role checks already govern who can write. Left
  // undefined (not defaulted to false) while unresolved, so the loading state
  // below covers it instead of flashing the "not available yet" fallback.
  const rolloutEnabled = useFeatureFlagEnabled(PARTICIPANT_EDIT_ROLLOUT_FLAG);

  const isReady = isLoaded && state.status !== 'pending' && rolloutEnabled !== undefined;
  // Editing a Participant's record is Admin-only — CONTEXT.md's Staff
  // definition only lists view/search, not edit — matching the server-side
  // `requireAdmin` gate in `participants.update`.
  const isAdmin = role === 'admin';
  const participantMissing =
    state.status === 'error' || (state.status === 'success' && state.data === null);
  const participant = state.status === 'success' ? state.data : null;

  return (
    <PageContainer
      access={!isReady || (isAdmin && rolloutEnabled && !participantMissing)}
      accessFallback={
        <div className='text-muted-foreground text-center text-lg'>
          {participantMissing
            ? 'This Participant no longer exists.'
            : !isAdmin
              ? 'Only Admins can edit Participants.'
              : "Editing Participants isn't available for your account yet."}
        </div>
      }
      isLoading={!isReady}
    >
      {participant && <ParticipantForm initialData={participant} />}
    </PageContainer>
  );
}
