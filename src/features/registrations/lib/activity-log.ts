import type { Doc } from '../../../../convex/_generated/dataModel';
import { PAYMENT_STATUS_LABEL } from './payment-status';

export type ActivityLogField = Doc<'activityLogs'>['field'];

export const ACTIVITY_LOG_FIELD_LABEL: Record<ActivityLogField, string> = {
  paymentStatus: 'Payment Status',
  registrationStatus: 'Registration Status'
};

type RegistrationStatus = Doc<'registrations'>['registrationStatus'];

const REGISTRATION_STATUS_LABEL: Record<RegistrationStatus, string> = {
  registered: 'Registered',
  cancelled: 'Cancelled'
};

/**
 * Turns a stored Activity Log value into the label the rest of the UI uses.
 *
 * Entries store the value as a plain string, so an entry written before a
 * status was renamed or removed can hold something no label covers. Those fall
 * back to the raw stored value: a history is only useful if it keeps showing
 * what actually happened, so an unrecognised value must still be legible
 * rather than blank.
 */
export function formatActivityLogValue(field: ActivityLogField, value: string) {
  const labels: Record<string, string> =
    field === 'paymentStatus' ? PAYMENT_STATUS_LABEL : REGISTRATION_STATUS_LABEL;
  return labels[value] ?? value;
}
