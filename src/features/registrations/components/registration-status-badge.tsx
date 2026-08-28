import { Badge } from '@/components/ui/badge';
import type { Doc } from '../../../../convex/_generated/dataModel';

type RegistrationStatus = Doc<'registrations'>['registrationStatus'];

export function RegistrationStatusBadge({ status }: { status: RegistrationStatus }) {
  const isCancelled = status === 'cancelled';
  return (
    <Badge variant={isCancelled ? 'outline' : 'default'}>
      {isCancelled ? 'Cancelled' : 'Registered'}
    </Badge>
  );
}
