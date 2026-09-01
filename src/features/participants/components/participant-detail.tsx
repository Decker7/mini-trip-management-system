'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useMutation, useQuery_experimental as useQuery } from 'convex/react';
import { ConvexError } from 'convex/values';
import { useFeatureFlagEnabled } from 'posthog-js/react';
import { toast } from 'sonner';
import { api } from '../../../../convex/_generated/api';
import type { Id } from '../../../../convex/_generated/dataModel';
import { AlertModal } from '@/components/modal/alert-modal';
import { Button, buttonVariants } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Icons } from '@/components/icons';
import { Mask } from '@/components/mask';
import { useUserRole } from '@/hooks/use-user-role';
import { PARTICIPANT_EDIT_ROLLOUT_FLAG } from '@/lib/feature-flags';
import { PH_MASK_CLASS } from '@/lib/posthog-config';
import { cn } from '@/lib/utils';
import { ParticipantPassport } from './participant-passport';

export function ParticipantDetail({ participantId }: { participantId: Id<'participants'> }) {
  const router = useRouter();
  const role = useUserRole();
  const isAssigned = role === 'admin' || role === 'staff';
  const editRolloutEnabled = useFeatureFlagEnabled(PARTICIPANT_EDIT_ROLLOUT_FLAG, false);

  const removeParticipant = useMutation(api.participants.remove);
  const [isDeleteOpen, setIsDeleteOpen] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  async function handleConfirmDelete() {
    setIsDeleting(true);
    try {
      await removeParticipant({ participantId });
      toast.success('Participant deleted');
      router.push('/dashboard/participants');
    } catch (error) {
      toast.error(
        error instanceof ConvexError ? error.message : "Couldn't delete the Participant."
      );
      setIsDeleting(false);
    }
  }

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
        <AlertModal
          isOpen={isDeleteOpen}
          onClose={() => setIsDeleteOpen(false)}
          onConfirm={handleConfirmDelete}
          loading={isDeleting}
          title='Delete this Participant?'
          description={
            <>
              &quot;<Mask>{participant.fullName}</Mask>&quot; will be permanently removed, along
              with all of their Registrations.
            </>
          }
        />

        <CardHeader className='flex flex-row items-start justify-between gap-4'>
          <CardTitle className={cn(PH_MASK_CLASS, 'text-2xl font-bold')}>
            {participant.fullName}
          </CardTitle>
          {isAssigned && (
            <div className='flex shrink-0 gap-2'>
              {editRolloutEnabled && (
                <Link
                  href={`/dashboard/participants/${participant._id}/edit`}
                  className={cn(buttonVariants({ variant: 'outline', size: 'sm' }))}
                >
                  <Icons.edit className='mr-2 h-4 w-4' /> Edit
                </Link>
              )}
              <Button variant='destructive' size='sm' onClick={() => setIsDeleteOpen(true)}>
                <Icons.trash className='mr-2 h-4 w-4' /> Delete
              </Button>
            </div>
          )}
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
