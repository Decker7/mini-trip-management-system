import * as z from 'zod';

export const tripSchema = z
  .object({
    name: z.string().min(1, 'Trip name is required.'),
    destination: z.string().min(1, 'Destination is required.'),
    startDate: z.date({ message: 'Start date is required.' }),
    endDate: z.date({ message: 'End date is required.' }),
    capacity: z
      .number({ message: 'Capacity is required.' })
      .int('Capacity must be a whole number.')
      .positive('Capacity must be greater than zero.'),
    description: z.string()
  })
  .refine((values) => values.endDate >= values.startDate, {
    message: 'End date cannot be before start date.',
    path: ['endDate']
  });

export type TripFormValues = {
  name: string;
  destination: string;
  startDate: Date | undefined;
  endDate: Date | undefined;
  capacity: number | undefined;
  description: string;
};
