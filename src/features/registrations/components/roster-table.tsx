'use client';

import { useState } from 'react';
import { useAction, useMutation, useQuery } from 'convex/react';
import { formatDistanceToNow } from 'date-fns';
import { toast } from 'sonner';
import { api } from '../../../../convex/_generated/api';
import type { Id } from '../../../../convex/_generated/dataModel';
import { getErrorMessage } from '@/lib/errors';
import { AlertModal } from '@/components/modal/alert-modal';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow
} from '@/components/ui/table';
import { Icons } from '@/components/icons';
import {
  PAYMENT_STATUS_LABEL,
  type PaymentStatus
} from '@/features/registrations/lib/payment-status';
import { RegistrationHistorySheet } from './registration-history-sheet';
import { RegistrationStatusBadge } from './registration-status-badge';

export function RosterTable({
  tripId,
  tripPrice
}: {
  tripId: Id<'trips'>;
  tripPrice: number | undefined;
}) {
  const roster = useQuery(api.registrations.listByTrip, { tripId });
  const me = useQuery(api.users.whoami);
  const setPaymentStatus = useMutation(api.registrations.setPaymentStatus);
  const cancelRegistration = useMutation(api.registrations.cancel);
  const sendPaymentLink = useAction(api.paymentLinks.sendPaymentLink);

  const [cancelTarget, setCancelTarget] = useState<{
    id: Id<'registrations'>;
    name: string;
  } | null>(null);
  const [isCancelling, setIsCancelling] = useState(false);

  const [linkTarget, setLinkTarget] = useState<{
    id: Id<'registrations'>;
    email: string;
  } | null>(null);
  const [isSendingLink, setIsSendingLink] = useState(false);

  async function handlePaymentStatusChange(registrationId: Id<'registrations'>, value: string) {
    try {
      await setPaymentStatus({
        registrationId,
        paymentStatus: value as PaymentStatus
      });
      toast.success('Payment status updated');
    } catch (error) {
      toast.error(getErrorMessage(error, "Couldn't update payment status."));
    }
  }

  async function handleConfirmCancel() {
    if (!cancelTarget) return;
    setIsCancelling(true);
    try {
      await cancelRegistration({ registrationId: cancelTarget.id });
      toast.success('Registration cancelled');
      setCancelTarget(null);
    } catch (error) {
      toast.error(getErrorMessage(error, "Couldn't cancel the Registration."));
    } finally {
      setIsCancelling(false);
    }
  }

  async function handleConfirmSendLink() {
    if (!linkTarget) return;
    setIsSendingLink(true);
    try {
      await sendPaymentLink({ registrationId: linkTarget.id });
      toast.success('Payment link sent');
      setLinkTarget(null);
    } catch (error) {
      toast.error(getErrorMessage(error, "Couldn't send the payment link."));
    } finally {
      setIsSendingLink(false);
    }
  }

  return (
    <div className='space-y-2'>
      <AlertModal
        isOpen={!!cancelTarget}
        onClose={() => setCancelTarget(null)}
        onConfirm={handleConfirmCancel}
        loading={isCancelling}
        title='Cancel this registration?'
        description={
          cancelTarget ? `${cancelTarget.name}'s slot on this Trip will be freed up.` : undefined
        }
        confirmLabel='Cancel Registration'
      />

      <AlertModal
        isOpen={!!linkTarget}
        onClose={() => setLinkTarget(null)}
        onConfirm={handleConfirmSendLink}
        loading={isSendingLink}
        title='Send a payment link?'
        description={
          linkTarget
            ? `Send a RM ${tripPrice?.toFixed(2)} payment link to ${linkTarget.email}?`
            : undefined
        }
        confirmLabel='Send Payment Link'
        confirmVariant='default'
      />

      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Name</TableHead>
            <TableHead>IC/Passport</TableHead>
            <TableHead>Email</TableHead>
            <TableHead>Phone</TableHead>
            <TableHead>Payment Status</TableHead>
            <TableHead>Status</TableHead>
            <TableHead className='w-[120px] text-right'>Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {roster === undefined && (
            <TableRow>
              <TableCell colSpan={7} className='text-muted-foreground h-24 text-center'>
                Loading roster...
              </TableCell>
            </TableRow>
          )}
          {roster?.length === 0 && (
            <TableRow>
              <TableCell colSpan={7} className='text-muted-foreground h-24 text-center'>
                No Participants registered yet.
              </TableCell>
            </TableRow>
          )}
          {roster?.map((entry) => {
            const isCancelled = entry.registrationStatus === 'cancelled';
            const canSendPaymentLink =
              !isCancelled && entry.paymentStatus === 'unpaid' && tripPrice !== undefined;
            const isLockedByStripe =
              entry.paymentStatus === 'paid' && entry.paymentConfirmedByStripe;
            return (
              <TableRow key={entry._id}>
                <TableCell className='font-medium'>{entry.fullName}</TableCell>
                <TableCell>{entry.icPassportNumber}</TableCell>
                <TableCell>{entry.email}</TableCell>
                <TableCell>{entry.phone}</TableCell>
                <TableCell>
                  <Select
                    value={entry.paymentStatus}
                    onValueChange={(value) => {
                      if (value) handlePaymentStatusChange(entry._id, value);
                    }}
                  >
                    <SelectTrigger className='w-[120px]'>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value='unpaid' disabled={isLockedByStripe}>
                        {PAYMENT_STATUS_LABEL.unpaid}
                      </SelectItem>
                      <SelectItem value='paid' disabled={isLockedByStripe}>
                        {PAYMENT_STATUS_LABEL.paid}
                      </SelectItem>
                      <SelectItem value='refunded'>{PAYMENT_STATUS_LABEL.refunded}</SelectItem>
                    </SelectContent>
                  </Select>
                  {isLockedByStripe && (
                    <p
                      className='text-muted-foreground mt-1 max-w-[120px] text-xs'
                      title='Confirmed paid via Stripe — only Refunded can be set by hand'
                    >
                      Paid via Stripe
                    </p>
                  )}
                  {entry.paymentLinkSentAt !== undefined && (
                    <p className='text-muted-foreground mt-1 text-xs'>
                      Link sent {formatDistanceToNow(entry.paymentLinkSentAt, { addSuffix: true })}{' '}
                      by{' '}
                      {me && entry.paymentLinkSentBy === me.subject
                        ? 'you'
                        : entry.paymentLinkSentBy}
                    </p>
                  )}
                </TableCell>
                <TableCell>
                  <RegistrationStatusBadge status={entry.registrationStatus} />
                </TableCell>
                <TableCell className='text-right'>
                  <div className='flex justify-end'>
                    {canSendPaymentLink && (
                      <Button
                        variant='ghost'
                        size='icon'
                        onClick={() => setLinkTarget({ id: entry._id, email: entry.email })}
                      >
                        <Icons.creditCard className='h-4 w-4' />
                        <span className='sr-only'>
                          {entry.paymentLinkSentAt !== undefined
                            ? 'Resend Payment Link'
                            : 'Send Payment Link'}
                        </span>
                      </Button>
                    )}
                    <RegistrationHistorySheet
                      registrationId={entry._id}
                      participantName={entry.fullName}
                    />
                    {!isCancelled && (
                      <Button
                        variant='ghost'
                        size='icon'
                        onClick={() => setCancelTarget({ id: entry._id, name: entry.fullName })}
                      >
                        <Icons.close className='h-4 w-4' />
                        <span className='sr-only'>Cancel</span>
                      </Button>
                    )}
                  </div>
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </div>
  );
}
