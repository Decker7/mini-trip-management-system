'use client';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { FieldGroup } from '@/components/ui/field';
import { useAppForm } from '@/lib/form';
import { tripSchema, type TripFormValues } from '@/features/trips/schemas/trip';
import { fromDateOnlyString, toDateOnlyString } from '@/features/trips/lib/date';
import { useMutation } from 'convex/react';
import { api } from '../../../../convex/_generated/api';
import type { Id } from '../../../../convex/_generated/dataModel';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';

export type TripInitialData = {
  _id: Id<'trips'>;
  name: string;
  destination: string;
  startDate: string;
  endDate: string;
  capacity: number;
  description?: string;
};

export function TripForm({
  initialData,
  pageTitle
}: {
  initialData: TripInitialData | null;
  pageTitle: string;
}) {
  const router = useRouter();
  const isEdit = !!initialData;

  const createTrip = useMutation(api.trips.create);
  const updateTrip = useMutation(api.trips.update);

  const form = useAppForm({
    defaultValues: {
      name: initialData?.name ?? '',
      destination: initialData?.destination ?? '',
      startDate: initialData ? fromDateOnlyString(initialData.startDate) : undefined,
      endDate: initialData ? fromDateOnlyString(initialData.endDate) : undefined,
      capacity: initialData?.capacity,
      description: initialData?.description ?? ''
    } as TripFormValues,
    validators: {
      onSubmit: tripSchema
    },
    onSubmit: async ({ value }) => {
      const payload = {
        name: value.name,
        destination: value.destination,
        startDate: toDateOnlyString(value.startDate!),
        endDate: toDateOnlyString(value.endDate!),
        capacity: value.capacity!,
        description: value.description || undefined
      };

      try {
        if (isEdit) {
          await updateTrip({ tripId: initialData._id, ...payload });
          toast.success('Trip updated');
        } else {
          await createTrip(payload);
          toast.success('Trip created');
        }
        router.push('/dashboard/trips');
      } catch (error) {
        toast.error(error instanceof Error ? error.message : "Couldn't save the trip. Try again.");
      }
    }
  });

  return (
    <Card className='mx-auto w-full max-w-3xl'>
      <CardHeader>
        <CardTitle className='text-left text-2xl font-bold'>{pageTitle}</CardTitle>
      </CardHeader>
      <CardContent>
        <form
          className='space-y-8'
          onSubmit={(e) => {
            e.preventDefault();
            e.stopPropagation();
            form.handleSubmit();
          }}
        >
          <FieldGroup>
            <div className='grid grid-cols-1 gap-6 md:grid-cols-2'>
              <form.AppField
                name='name'
                children={(field) => (
                  <field.TextField label='Trip Name' required placeholder='Enter trip name' />
                )}
              />
              <form.AppField
                name='destination'
                children={(field) => (
                  <field.TextField label='Destination' required placeholder='Enter destination' />
                )}
              />
              <form.AppField
                name='startDate'
                children={(field) => <field.DatePickerField label='Start Date' required />}
              />
              <form.AppField
                name='endDate'
                children={(field) => <field.DatePickerField label='End Date' required />}
              />
              <form.AppField
                name='capacity'
                children={(field) => (
                  <field.TextField
                    label='Capacity'
                    required
                    type='number'
                    min={1}
                    placeholder='Enter capacity'
                  />
                )}
              />
            </div>

            <form.AppField
              name='description'
              children={(field) => (
                <field.TextareaField
                  label='Description'
                  placeholder='Enter trip description'
                  rows={4}
                />
              )}
            />
          </FieldGroup>

          <div className='flex justify-end gap-2'>
            <Button type='button' variant='outline' onClick={() => router.back()}>
              Cancel
            </Button>
            <form.AppForm>
              <form.SubmitButton>{isEdit ? 'Update Trip' : 'Add Trip'}</form.SubmitButton>
            </form.AppForm>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
