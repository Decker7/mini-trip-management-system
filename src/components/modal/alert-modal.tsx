'use client';
import { useEffect, useState } from 'react';
import type { VariantProps } from 'class-variance-authority';
import { Button, buttonVariants } from '@/components/ui/button';
import { Modal } from '@/components/ui/modal';
import { LoadingButton } from '@/components/ui/loading-button';

interface AlertModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  loading: boolean;
  title?: string;
  description?: string;
  confirmLabel?: string;
  confirmVariant?: VariantProps<typeof buttonVariants>['variant'];
}

export function AlertModal({
  isOpen,
  onClose,
  onConfirm,
  loading,
  title = 'Are you sure?',
  description = 'This action cannot be undone.',
  confirmLabel = 'Continue',
  confirmVariant = 'destructive'
}: AlertModalProps) {
  const [isMounted, setIsMounted] = useState(false);

  useEffect(() => {
    setIsMounted(true);
  }, []);

  if (!isMounted) {
    return null;
  }

  // Dismissing (backdrop click, Escape, or Cancel) while a confirm is
  // in flight would hide the dialog without stopping the request, making an
  // action that actually went through look cancelled. Block dismissal until
  // it settles.
  function handleClose() {
    if (loading) return;
    onClose();
  }

  return (
    <Modal title={title} description={description} isOpen={isOpen} onClose={handleClose}>
      <div className='flex w-full items-center justify-end space-x-2 pt-6'>
        <Button variant='outline' onClick={handleClose} disabled={loading}>
          Cancel
        </Button>
        <LoadingButton loading={loading} type='button' variant={confirmVariant} onClick={onConfirm}>
          {confirmLabel}
        </LoadingButton>
      </div>
    </Modal>
  );
}
