import { Badge } from '@/components/ui/badge';

export type TripStatus = 'upcoming' | 'ongoing' | 'completed';

const STATUS_LABEL: Record<TripStatus, string> = {
  upcoming: 'Upcoming',
  ongoing: 'Ongoing',
  completed: 'Completed'
};

const STATUS_VARIANT: Record<TripStatus, 'secondary' | 'default' | 'outline'> = {
  upcoming: 'secondary',
  ongoing: 'default',
  completed: 'outline'
};

export function TripStatusBadge({ status }: { status: TripStatus }) {
  return <Badge variant={STATUS_VARIANT[status]}>{STATUS_LABEL[status]}</Badge>;
}
