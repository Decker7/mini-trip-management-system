import * as z from 'zod';

export const inviteStaffSchema = z.object({
  emailAddress: z.string().min(1, 'Email is required.').email('Enter a valid email.')
});

export type InviteStaffFormValues = {
  emailAddress: string;
};
