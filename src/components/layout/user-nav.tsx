'use client';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger
} from '@/components/ui/dropdown-menu';
import { UserAvatarProfile } from '@/components/user-avatar-profile';
import { PH_MASK_CLASS } from '@/lib/posthog-config';
import { cn } from '@/lib/utils';
import { SignOutButton, useUser } from '@clerk/nextjs';
import { useRouter } from 'next/navigation';
export function UserNav() {
  const { user } = useUser();
  const router = useRouter();
  if (user) {
    return (
      <DropdownMenu>
        <DropdownMenuTrigger
          render={<Button variant='ghost' className='relative h-8 w-8 rounded-full' />}
        >
          <UserAvatarProfile user={user} />
        </DropdownMenuTrigger>
        <DropdownMenuContent className='w-56' align='end' sideOffset={10}>
          <DropdownMenuGroup>
            <DropdownMenuLabel className='font-normal'>
              <div className='flex flex-col space-y-1'>
                <p className={cn(PH_MASK_CLASS, 'text-sm leading-none font-medium')}>
                  {user.fullName}
                </p>
                <p className={cn(PH_MASK_CLASS, 'text-muted-foreground text-xs leading-none')}>
                  {user.emailAddresses[0].emailAddress}
                </p>
              </div>
            </DropdownMenuLabel>
          </DropdownMenuGroup>
          <DropdownMenuSeparator />
          <DropdownMenuGroup>
            <DropdownMenuItem onClick={() => router.push('/dashboard/profile')}>
              Profile
            </DropdownMenuItem>
            <DropdownMenuItem>Billing</DropdownMenuItem>
            <DropdownMenuItem>Settings</DropdownMenuItem>
            <DropdownMenuItem>New Team</DropdownMenuItem>
          </DropdownMenuGroup>
          <DropdownMenuSeparator />
          <DropdownMenuGroup>
            <DropdownMenuItem>
              <SignOutButton redirectUrl='/auth/sign-in' />
            </DropdownMenuItem>
          </DropdownMenuGroup>
        </DropdownMenuContent>
      </DropdownMenu>
    );
  }
}
