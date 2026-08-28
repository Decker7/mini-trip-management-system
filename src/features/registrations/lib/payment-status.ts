import type { Doc } from '../../../../convex/_generated/dataModel';

export type PaymentStatus = Doc<'registrations'>['paymentStatus'];

export const PAYMENT_STATUS_LABEL: Record<PaymentStatus, string> = {
  unpaid: 'Unpaid',
  paid: 'Paid',
  refunded: 'Refunded'
};

export const PAYMENT_STATUSES: PaymentStatus[] = ['unpaid', 'paid', 'refunded'];
