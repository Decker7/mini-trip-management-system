import * as z from 'zod';

export const participantSchema = z.object({
  fullName: z.string().trim().min(1, 'Full name is required.'),
  icPassportNumber: z.string().trim().min(1, 'IC/passport number is required.'),
  email: z
    .string()
    .trim()
    .min(1, 'Email is required.')
    .pipe(z.email('Enter a valid email address.')),
  phone: z.string().trim().min(1, 'Phone is required.')
});

export type ParticipantFormValues = z.infer<typeof participantSchema>;
