'use client';

import { useQuery } from 'convex/react';
import { api } from '../../../../convex/_generated/api';
import type { Id } from '../../../../convex/_generated/dataModel';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ParticipantPassport } from './participant-passport';

export function ParticipantDetail({ participantId }: { participantId: Id<'participants'> }) {
  const participant = useQuery(api.participants.get, { participantId });

  if (participant === undefined) {
    return <div className='text-muted-foreground p-6'>Loading Participant...</div>;
  }

  if (participant === null) {
    return <div className='text-muted-foreground p-6'>This Participant no longer exists.</div>;
  }

  return (
    <div className='mx-auto w-full max-w-3xl space-y-6'>
      <Card>
        <CardHeader>
          <CardTitle className='text-2xl font-bold'>{participant.fullName}</CardTitle>
        </CardHeader>
        <CardContent className='grid grid-cols-1 gap-6 md:grid-cols-2'>
          <div>
            <p className='text-muted-foreground text-sm'>IC/Passport Number</p>
            <p className='font-medium'>{participant.icPassportNumber}</p>
          </div>
          <div>
            <p className='text-muted-foreground text-sm'>Email</p>
            <p className='font-medium'>{participant.email}</p>
          </div>
          <div>
            <p className='text-muted-foreground text-sm'>Phone</p>
            <p className='font-medium'>{participant.phone}</p>
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
