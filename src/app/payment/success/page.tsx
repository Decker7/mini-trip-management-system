import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Payment received'
};

export default function PaymentSuccessPage() {
  return (
    <div className='flex min-h-screen items-center justify-center p-6'>
      <div className='max-w-md space-y-2 text-center'>
        <h1 className='text-2xl font-semibold'>Payment received</h1>
        <p className='text-muted-foreground'>
          Thank you — your payment has gone through. You can close this page now.
        </p>
      </div>
    </div>
  );
}
