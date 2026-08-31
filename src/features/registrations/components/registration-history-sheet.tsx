'use client';

import { useState } from 'react';
import { useQuery } from 'convex/react';
import { format } from 'date-fns';
import { api } from '../../../../convex/_generated/api';
import type { Id } from '../../../../convex/_generated/dataModel';
import { Button } from '@/components/ui/button';
import { Mask } from '@/components/mask';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger
} from '@/components/ui/sheet';
import { Icons } from '@/components/icons';
import {
  ACTIVITY_LOG_FIELD_LABEL,
  formatActivityLogValue
} from '@/features/registrations/lib/activity-log';

function HistoryBody({ registrationId }: { registrationId: Id<'registrations'> }) {
  const history = useQuery(api.activityLogs.listByRegistration, { registrationId });
  const me = useQuery(api.users.whoami);

  if (history === undefined) {
    return <p className='text-muted-foreground p-4 text-sm'>Loading history...</p>;
  }

  if (history.entries.length === 0) {
    return (
      <p className='text-muted-foreground p-4 text-sm'>
        No changes recorded yet. Payment Status and Registration Status changes will appear here.
      </p>
    );
  }

  return (
    <div className='space-y-4 p-4'>
      {history.truncated && (
        <p className='text-muted-foreground text-xs'>
          Showing only the most recent changes. Older entries are not listed.
        </p>
      )}
      <ol className='space-y-4'>
        {history.entries.map((entry) => (
          <li key={entry._id} className='border-l-2 pl-4'>
            <p className='text-sm font-medium'>{ACTIVITY_LOG_FIELD_LABEL[entry.field]}</p>
            <p className='flex flex-wrap items-center gap-1.5 text-sm'>
              <span className='text-muted-foreground line-through'>
                {formatActivityLogValue(entry.field, entry.oldValue)}
              </span>
              <Icons.arrowRight className='text-muted-foreground h-3.5 w-3.5' />
              <span className='font-medium'>
                {formatActivityLogValue(entry.field, entry.newValue)}
              </span>
            </p>
            <p className='text-muted-foreground mt-1 text-xs'>
              {format(new Date(entry.changedAt), 'd MMM yyyy, HH:mm')} by{' '}
              {/* Until Staff accounts (#12) exist there is no name to resolve a
                  changer's id against, so show the id itself — and "You" when
                  it is the signed-in user, which is the common case. */}
              {me && entry.changedBy === me.subject ? 'you' : <Mask>{entry.changedBy}</Mask>}
            </p>
          </li>
        ))}
      </ol>
    </div>
  );
}

export function RegistrationHistorySheet({
  registrationId,
  participantName
}: {
  registrationId: Id<'registrations'>;
  participantName: string;
}) {
  const [open, setOpen] = useState(false);

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger render={<Button variant='ghost' size='icon' />}>
        <Icons.clock className='h-4 w-4' />
        <span className='sr-only'>View history</span>
      </SheetTrigger>
      <SheetContent className='flex flex-col'>
        <SheetHeader>
          <SheetTitle>Registration history</SheetTitle>
          <SheetDescription>
            Payment Status and Registration Status changes for <Mask>{participantName}</Mask>,
            newest first.
          </SheetDescription>
        </SheetHeader>
        <div className='flex-1 overflow-auto'>
          {/* Mounted only while the sheet is open, so a long roster doesn't
              issue a history subscription per row on page load. */}
          {open && <HistoryBody registrationId={registrationId} />}
        </div>
      </SheetContent>
    </Sheet>
  );
}
