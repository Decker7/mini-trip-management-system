import * as z from 'zod';

export const participantSchema = z.object({
  fullName: z.string().min(1, 'Full name is required.'),
  icPassportNumber: z.string().min(1, 'IC/passport number is required.'),
  email: z.string().min(1, 'Email is required.').email('Enter a valid email address.'),
  phone: z.string().min(1, 'Phone is required.')
});

export type ParticipantFormValues = {
  fullName: string;
  icPassportNumber: string;
  email: string;
  phone: string;
};
