'use client';

import Link from 'next/link';
import { buttonVariants } from '@/components/ui/button';
import { Icons } from '@/components/icons';
import { useUserRole } from '@/hooks/use-user-role';
import { cn } from '@/lib/utils';

export function TripAddButton() {
  const isAdmin = useUserRole() === 'admin';

  if (!isAdmin) return null;

  return (
    <Link href='/dashboard/trips/new' className={cn(buttonVariants(), 'text-xs md:text-sm')}>
      <Icons.add className='mr-2 h-4 w-4' /> Add Trip
    </Link>
  );
}
