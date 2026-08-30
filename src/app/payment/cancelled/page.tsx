import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Payment not completed'
};

export default function PaymentCancelledPage() {
  return (
    <div className='flex min-h-screen items-center justify-center p-6'>
      <div className='max-w-md space-y-2 text-center'>
        <h1 className='text-2xl font-semibold'>Payment not completed</h1>
        <p className='text-muted-foreground'>
          Your payment was not completed. If this was a mistake, ask the Staff member or Admin who
          registered you to resend your payment link.
        </p>
      </div>
    </div>
  );
}
