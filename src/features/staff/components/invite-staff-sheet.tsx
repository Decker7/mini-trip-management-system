'use client';

import { useState } from 'react';
import { useAction } from 'convex/react';
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
import { inviteStaffSchema, type InviteStaffFormValues } from '../schemas/invite-staff';
import { api } from '../../../../convex/_generated/api';

export function InviteStaffSheet({ onInvited }: { onInvited: () => void }) {
  const [open, setOpen] = useState(false);
  const inviteStaff = useAction(api.staffAccounts.inviteStaff);

  const form = useAppForm({
    defaultValues: { emailAddress: '' } as InviteStaffFormValues,
    validators: {
      onSubmit: inviteStaffSchema
    },
    onSubmit: async ({ value }) => {
      try {
        await inviteStaff(value);
        toast.success('Invitation sent');
        setOpen(false);
        form.reset();
        onInvited();
      } catch (error) {
        toast.error(error instanceof Error ? error.message : "Couldn't send the invitation.");
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
        <Icons.add className='mr-2 h-4 w-4' /> Invite Staff
      </SheetTrigger>
      <SheetContent className='flex flex-col'>
        <SheetHeader>
          <SheetTitle>Invite Staff</SheetTitle>
          <SheetDescription>
            Send a Clerk invitation. The new account is assigned the Staff role.
          </SheetDescription>
        </SheetHeader>

        <div className='flex-1 overflow-auto'>
          <form
            id='invite-staff-form'
            className='space-y-4 p-4'
            onSubmit={(e) => {
              e.preventDefault();
              e.stopPropagation();
              form.handleSubmit();
            }}
          >
            <FieldGroup>
              <form.AppField
                name='emailAddress'
                children={(field) => (
                  <field.TextField label='Email' required type='email' placeholder='Enter email' />
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
            <form.SubmitButton form='invite-staff-form'>Send Invitation</form.SubmitButton>
          </form.AppForm>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}
