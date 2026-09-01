'use client';

import { useRouter } from 'next/navigation';
import { useMutation } from 'convex/react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { FieldGroup } from '@/components/ui/field';
import { useAppForm } from '@/lib/form';
import {
  participantSchema,
  type ParticipantFormValues
} from '@/features/participants/schemas/participant';
import { api } from '../../../../convex/_generated/api';
import type { Id } from '../../../../convex/_generated/dataModel';

export type ParticipantInitialData = {
  _id: Id<'participants'>;
  fullName: string;
  icPassportNumber: string;
  email: string;
  phone: string;
};

export function ParticipantForm({ initialData }: { initialData: ParticipantInitialData }) {
  const router = useRouter();
  const updateParticipant = useMutation(api.participants.update);

  const form = useAppForm({
    defaultValues: {
      fullName: initialData.fullName,
      icPassportNumber: initialData.icPassportNumber,
      email: initialData.email,
      phone: initialData.phone
    } as ParticipantFormValues,
    validators: {
      onSubmit: participantSchema
    },
    onSubmit: async ({ value }) => {
      try {
        await updateParticipant({ participantId: initialData._id, ...value });
        toast.success('Participant updated');
        router.push(`/dashboard/participants/${initialData._id}`);
      } catch (error) {
        toast.error(
          error instanceof Error ? error.message : "Couldn't save the participant. Try again."
        );
      }
    }
  });

  return (
    <Card className='mx-auto w-full max-w-3xl'>
      <CardHeader>
        <CardTitle className='text-left text-2xl font-bold'>Edit Participant</CardTitle>
      </CardHeader>
      <CardContent>
        <form
          className='space-y-8'
          onSubmit={(e) => {
            e.preventDefault();
            e.stopPropagation();
            form.handleSubmit();
          }}
        >
          <FieldGroup>
            <div className='grid grid-cols-1 gap-6 md:grid-cols-2'>
              <form.AppField
                name='fullName'
                children={(field) => (
                  <field.TextField label='Full Name' required placeholder='Enter full name' />
                )}
              />
              <form.AppField
                name='icPassportNumber'
                children={(field) => (
                  <field.TextField
                    label='IC/Passport Number'
                    required
                    placeholder='Enter IC/passport number'
                  />
                )}
              />
              <form.AppField
                name='email'
                children={(field) => (
                  <field.TextField label='Email' required type='email' placeholder='Enter email' />
                )}
              />
              <form.AppField
                name='phone'
                children={(field) => (
                  <field.TextField label='Phone' required placeholder='Enter phone number' />
                )}
              />
            </div>
          </FieldGroup>

          <div className='flex justify-end gap-2'>
            <Button type='button' variant='outline' onClick={() => router.back()}>
              Cancel
            </Button>
            <form.AppForm>
              <form.SubmitButton>Update Participant</form.SubmitButton>
            </form.AppForm>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
