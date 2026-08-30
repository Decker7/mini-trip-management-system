'use client';

import { useState } from 'react';
import { useMutation, useQuery } from 'convex/react';
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

export function RosterTable({ tripId }: { tripId: Id<'trips'> }) {
  const roster = useQuery(api.registrations.listByTrip, { tripId });
  const setPaymentStatus = useMutation(api.registrations.setPaymentStatus);
  const cancelRegistration = useMutation(api.registrations.cancel);

  const [cancelTarget, setCancelTarget] = useState<{
    id: Id<'registrations'>;
    name: string;
  } | null>(null);
  const [isCancelling, setIsCancelling] = useState(false);

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
                      <SelectItem value='unpaid'>{PAYMENT_STATUS_LABEL.unpaid}</SelectItem>
                      <SelectItem value='paid'>{PAYMENT_STATUS_LABEL.paid}</SelectItem>
                      <SelectItem value='refunded'>{PAYMENT_STATUS_LABEL.refunded}</SelectItem>
                    </SelectContent>
                  </Select>
                </TableCell>
                <TableCell>
                  <RegistrationStatusBadge status={entry.registrationStatus} />
                </TableCell>
                <TableCell className='text-right'>
                  <div className='flex justify-end'>
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
