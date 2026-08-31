'use client';

import { useQuery_experimental as useQuery } from 'convex/react';
import { api } from '../../../../convex/_generated/api';
import type { Id } from '../../../../convex/_generated/dataModel';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { PH_MASK_CLASS } from '@/lib/posthog-config';
import { cn } from '@/lib/utils';
import { ParticipantPassport } from './participant-passport';

export function ParticipantDetail({ participantId }: { participantId: Id<'participants'> }) {
  // A malformed id in the URL fails the query's own argument validator
  // before it can look anything up — the object form surfaces that as
  // `status: 'error'` instead of throwing during render, so it reaches the
  // same "nothing here" state below as a well-formed id for a Participant
  // that no longer exists, rather than crashing the page.
  const state = useQuery({ query: api.participants.get, args: { participantId } });

  if (state.status === 'pending') {
    return <div className='text-muted-foreground p-6'>Loading Participant...</div>;
  }

  if (state.status === 'error' || state.data === null) {
    return <div className='text-muted-foreground p-6'>This Participant no longer exists.</div>;
  }

  const participant = state.data;

  return (
    <div className='mx-auto w-full max-w-3xl space-y-6'>
      <Card>
        <CardHeader>
          <CardTitle className={cn(PH_MASK_CLASS, 'text-2xl font-bold')}>
            {participant.fullName}
          </CardTitle>
        </CardHeader>
        <CardContent className='grid grid-cols-1 gap-6 md:grid-cols-2'>
          <div>
            <p className='text-muted-foreground text-sm'>IC/Passport Number</p>
            <p className={cn(PH_MASK_CLASS, 'font-medium')}>{participant.icPassportNumber}</p>
          </div>
          <div>
            <p className='text-muted-foreground text-sm'>Email</p>
            <p className={cn(PH_MASK_CLASS, 'font-medium')}>{participant.email}</p>
          </div>
          <div>
            <p className='text-muted-foreground text-sm'>Phone</p>
            <p className={cn(PH_MASK_CLASS, 'font-medium')}>{participant.phone}</p>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className='text-lg font-semibold'>Passport</CardTitle>
        </CardHeader>
        <CardContent>
          <ParticipantPassport
            participantId={participant._id}
            passportUrl={participant.passportUrl}
          />
        </CardContent>
      </Card>
    </div>
  );
}
