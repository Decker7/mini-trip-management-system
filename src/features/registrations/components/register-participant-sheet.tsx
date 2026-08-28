'use client';

import { useState } from 'react';
import { useMutation } from 'convex/react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { FieldGroup } from '@/components/ui/field';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
  SheetTrigger
} from '@/components/ui/sheet';
import { Icons } from '@/components/icons';
import { useAppForm } from '@/lib/form';
import {
  registrationSchema,
  type RegistrationFormValues
} from '@/features/registrations/schemas/registration';
import { api } from '../../../../convex/_generated/api';
import type { Id } from '../../../../convex/_generated/dataModel';

export function RegisterParticipantSheet({ tripId }: { tripId: Id<'trips'> }) {
  const [open, setOpen] = useState(false);
  const register = useMutation(api.registrations.register);

  const form = useAppForm({
    defaultValues: {
      fullName: '',
      icPassportNumber: '',
      email: '',
      phone: ''
    } as RegistrationFormValues,
    validators: {
      onSubmit: registrationSchema
    },
    onSubmit: async ({ value }) => {
      try {
        await register({ tripId, ...value });
        toast.success('Participant registered');
        setOpen(false);
        form.reset();
      } catch (error) {
        toast.error(error instanceof Error ? error.message : "Couldn't register the Participant.");
      }
    }
  });

  return (
    <Sheet
      open={open}
      onOpenChange={(nextOpen) => {
        setOpen(nextOpen);
        if (!nextOpen) form.reset();
      }}
    >
      <SheetTrigger render={<Button size='sm' />}>
        <Icons.add className='mr-2 h-4 w-4' /> Register Participant
      </SheetTrigger>
      <SheetContent className='flex flex-col'>
        <SheetHeader>
          <SheetTitle>Register Participant</SheetTitle>
          <SheetDescription>Add a Participant to this Trip's roster.</SheetDescription>
        </SheetHeader>

        <div className='flex-1 overflow-auto'>
          <form
            id='register-participant-form'
            className='space-y-4 p-4'
            onSubmit={(e) => {
              e.preventDefault();
              e.stopPropagation();
              form.handleSubmit();
            }}
          >
            <FieldGroup>
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
                    placeholder='Enter IC or passport number'
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
            </FieldGroup>
          </form>
        </div>

        <SheetFooter>
          <Button type='button' variant='outline' onClick={() => setOpen(false)}>
            Cancel
          </Button>
          <form.AppForm>
            <form.SubmitButton form='register-participant-form'>Register</form.SubmitButton>
          </form.AppForm>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}
