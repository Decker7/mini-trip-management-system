'use client';

import { useCallback, useEffect, useState } from 'react';
import { useAction } from 'convex/react';
import { toast } from 'sonner';
import { api } from '../../../../convex/_generated/api';
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
import { InviteStaffSheet } from './invite-staff-sheet';

type StaffAccount = {
  userId: string;
  fullName: string;
  email: string;
  role: 'admin' | 'staff' | null;
};

const ROLE_LABEL: Record<'admin' | 'staff', string> = {
  admin: 'Admin',
  staff: 'Staff'
};

export function StaffListing() {
  const listUsers = useAction(api.staffAccounts.listUsers);
  const updateUserRole = useAction(api.staffAccounts.updateUserRole);

  const [users, setUsers] = useState<StaffAccount[] | null>(null);
  const [pendingUserId, setPendingUserId] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    try {
      setUsers(await listUsers({}));
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Couldn't load Users.");
    }
  }, [listUsers]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  async function handleRoleChange(userId: string, role: 'admin' | 'staff') {
    setPendingUserId(userId);
    try {
      await updateUserRole({ userId, role });
      toast.success('Role updated');
      await refresh();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Couldn't update the role.");
    } finally {
      setPendingUserId(null);
    }
  }

  return (
    <div className='space-y-4'>
      <div className='flex justify-end'>
        <InviteStaffSheet onInvited={refresh} />
      </div>

      <div className='rounded-md border'>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead>Email</TableHead>
              <TableHead>Role</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {users === null ? (
              <TableRow>
                <TableCell colSpan={3} className='text-muted-foreground text-center'>
                  <Icons.spinner className='mx-auto h-4 w-4 animate-spin' />
                </TableCell>
              </TableRow>
            ) : users.length === 0 ? (
              <TableRow>
                <TableCell colSpan={3} className='text-muted-foreground text-center'>
                  No Users found.
                </TableCell>
              </TableRow>
            ) : (
              users.map((user) => (
                <TableRow key={user.userId}>
                  <TableCell>{user.fullName || '—'}</TableCell>
                  <TableCell>{user.email}</TableCell>
                  <TableCell>
                    <Select
                      value={user.role ?? undefined}
                      disabled={pendingUserId === user.userId}
                      onValueChange={(value) =>
                        handleRoleChange(user.userId, value as 'admin' | 'staff')
                      }
                    >
                      <SelectTrigger className='w-[140px]'>
                        <SelectValue placeholder='No role assigned' />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value='admin'>{ROLE_LABEL.admin}</SelectItem>
                        <SelectItem value='staff'>{ROLE_LABEL.staff}</SelectItem>
                      </SelectContent>
                    </Select>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
