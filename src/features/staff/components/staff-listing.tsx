'use client';

import { useCallback, useEffect, useState } from 'react';
import { useAction } from 'convex/react';
import { toast } from 'sonner';
import { api } from '../../../../convex/_generated/api';
import { AlertModal } from '@/components/modal/alert-modal';
import { Mask } from '@/components/mask';
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
import { PH_MASK_CLASS } from '@/lib/posthog-config';
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

  // Applied right after a confirmed mutation, independent of `refresh`
  // below: if the listUsers call that follows a successful mutation fails,
  // `refresh` only toasts and leaves `users` untouched, which would
  // otherwise keep showing pre-mutation state — e.g. a just-revoked account
  // still listed as Staff with a Revoke action that's now guaranteed to fail.
  function applyRole(userId: string, role: 'admin' | 'staff' | null) {
    setUsers(
      (current) =>
        current?.map((user) => (user.userId === userId ? { ...user, role } : user)) ?? current
    );
  }

  async function handleRoleChange(userId: string, role: 'admin' | 'staff') {
    setPendingUserId(userId);
    try {
      await updateUserRole({ userId, role });
      toast.success('Role updated');
      applyRole(userId, role);
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
      applyRole(revokeTarget.userId, null);
      setRevokeTarget(null);
      await refresh();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Couldn't revoke access.");
    } finally {
      setIsRevoking(false);
    }
  }

  // Only a Staff account can be revoked (see revokeStaffAccess); a roleless
  // account gets its own section instead of a Staff row with a Revoke button
  // that would be guaranteed to fail. It's still shown here, not hidden, so
  // an Admin can assign it a role via the same dropdown as the other rows.
  const staffUsers = users?.filter((user) => user.role === 'staff') ?? null;
  const adminUsers = users?.filter((user) => user.role === 'admin') ?? null;
  const unassignedUsers = users?.filter((user) => user.role === null) ?? [];

  return (
    <div className='space-y-6'>
      <AlertModal
        isOpen={revokeTarget !== null}
        onClose={() => setRevokeTarget(null)}
        onConfirm={handleConfirmRevoke}
        loading={isRevoking}
        title='Revoke access?'
        description={
          revokeTarget ? (
            <>
              &quot;<Mask>{revokeTarget.fullName || revokeTarget.email}</Mask>&quot; will
              immediately lose access to the system. You can restore it later by assigning them a
              role again.
            </>
          ) : undefined
        }
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

      {unassignedUsers.length > 0 && (
        <section className='space-y-2'>
          <h2 className='text-lg font-semibold'>Unassigned</h2>
          <p className='text-muted-foreground text-sm'>
            These Users have no role yet — assign one to restore their access.
          </p>
          <StaffTable
            users={unassignedUsers}
            pendingUserId={pendingUserId}
            onRoleChange={handleRoleChange}
            emptyLabel='No unassigned Users.'
          />
        </section>
      )}
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
                <TableCell className={PH_MASK_CLASS}>{user.fullName || '—'}</TableCell>
                <TableCell className={PH_MASK_CLASS}>{user.email}</TableCell>
                <TableCell>
                  <Select
                    items={[
                      { value: 'admin', label: ROLE_LABEL.admin },
                      { value: 'staff', label: ROLE_LABEL.staff }
                    ]}
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
