'use client';

import { useCallback, useEffect, useState } from 'react';
import { useAction } from 'convex/react';
import { toast } from 'sonner';
import { api } from '../../../../convex/_generated/api';
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
  const revokeStaffAccess = useAction(api.staffAccounts.revokeStaffAccess);

  const [users, setUsers] = useState<StaffAccount[] | null>(null);
  const [pendingUserId, setPendingUserId] = useState<string | null>(null);
  const [revokeTarget, setRevokeTarget] = useState<StaffAccount | null>(null);
  const [isRevoking, setIsRevoking] = useState(false);

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

  async function handleConfirmRevoke() {
    if (!revokeTarget) return;
    setIsRevoking(true);
    try {
      await revokeStaffAccess({ userId: revokeTarget.userId });
      toast.success('Access revoked');
      setRevokeTarget(null);
      await refresh();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Couldn't revoke access.");
    } finally {
      setIsRevoking(false);
    }
  }

  const staffUsers = users?.filter((user) => user.role !== 'admin') ?? null;
  const adminUsers = users?.filter((user) => user.role === 'admin') ?? null;

  return (
    <div className='space-y-6'>
      <AlertModal
        isOpen={revokeTarget !== null}
        onClose={() => setRevokeTarget(null)}
        onConfirm={handleConfirmRevoke}
        loading={isRevoking}
        title='Revoke access?'
        description={`"${revokeTarget?.fullName || revokeTarget?.email}" will immediately lose access to the system. You can re-invite them later to restore it.`}
        confirmLabel='Revoke access'
      />

      <div className='flex justify-end'>
        <InviteStaffSheet onInvited={refresh} />
      </div>

      <section className='space-y-2'>
        <h2 className='text-lg font-semibold'>Staff</h2>
        <StaffTable
          users={staffUsers}
          pendingUserId={pendingUserId}
          onRoleChange={handleRoleChange}
          onRevoke={setRevokeTarget}
          emptyLabel='No Staff found.'
        />
      </section>

      <section className='space-y-2'>
        <h2 className='text-lg font-semibold'>Admins</h2>
        <StaffTable
          users={adminUsers}
          pendingUserId={pendingUserId}
          onRoleChange={handleRoleChange}
          emptyLabel='No Admins found.'
        />
      </section>
    </div>
  );
}

function StaffTable({
  users,
  pendingUserId,
  onRoleChange,
  onRevoke,
  emptyLabel
}: {
  users: StaffAccount[] | null;
  pendingUserId: string | null;
  onRoleChange: (userId: string, role: 'admin' | 'staff') => void;
  onRevoke?: (user: StaffAccount) => void;
  emptyLabel: string;
}) {
  const columnCount = onRevoke ? 4 : 3;

  return (
    <div className='rounded-md border'>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Name</TableHead>
            <TableHead>Email</TableHead>
            <TableHead>Role</TableHead>
            {onRevoke && <TableHead className='w-[1%]' />}
          </TableRow>
        </TableHeader>
        <TableBody>
          {users === null ? (
            <TableRow>
              <TableCell colSpan={columnCount} className='text-muted-foreground text-center'>
                <Icons.spinner className='mx-auto h-4 w-4 animate-spin' />
              </TableCell>
            </TableRow>
          ) : users.length === 0 ? (
            <TableRow>
              <TableCell colSpan={columnCount} className='text-muted-foreground text-center'>
                {emptyLabel}
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
                    onValueChange={(value) => onRoleChange(user.userId, value as 'admin' | 'staff')}
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
                {onRevoke && (
                  <TableCell>
                    <Button
                      variant='ghost'
                      size='sm'
                      disabled={pendingUserId === user.userId}
                      onClick={() => onRevoke(user)}
                    >
                      <Icons.trash className='mr-2 h-4 w-4' /> Revoke
                    </Button>
                  </TableCell>
                )}
              </TableRow>
            ))
          )}
        </TableBody>
      </Table>
    </div>
  );
}
