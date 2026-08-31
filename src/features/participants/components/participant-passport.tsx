'use client';

import { useState } from 'react';
import { useMutation } from 'convex/react';
import Dropzone, { type FileRejection } from 'react-dropzone';
import { toast } from 'sonner';
import { api } from '../../../../convex/_generated/api';
import type { Id } from '../../../../convex/_generated/dataModel';
import { Icons } from '@/components/icons';
import { PH_NO_CAPTURE_CLASS } from '@/lib/posthog-config';
import { cn, formatBytes } from '@/lib/utils';
import { MAX_PASSPORT_FILE_SIZE, PASSPORT_ACCEPT } from '@/features/participants/lib/passport';

export function ParticipantPassport({
  participantId,
  passportUrl
}: {
  participantId: Id<'participants'>;
  passportUrl: string | null;
}) {
  const generateUploadUrl = useMutation(api.participants.generateUploadUrl);
  const setPassport = useMutation(api.participants.setPassport);
  const [isUploading, setIsUploading] = useState(false);

  async function handleDrop(acceptedFiles: File[], rejectedFiles: FileRejection[]) {
    if (rejectedFiles.length > 0) {
      toast.error(`Passport must be an image or PDF under ${formatBytes(MAX_PASSPORT_FILE_SIZE)}.`);
      return;
    }
    const file = acceptedFiles[0];
    if (!file) return;

    setIsUploading(true);
    try {
      const uploadUrl = await generateUploadUrl();
      const response = await fetch(uploadUrl, {
        method: 'POST',
        headers: { 'Content-Type': file.type },
        body: file
      });
      if (!response.ok) {
        throw new Error('The upload failed.');
      }
      const { storageId } = (await response.json()) as { storageId: Id<'_storage'> };
      await setPassport({ participantId, storageId });
      toast.success(passportUrl ? 'Passport replaced' : 'Passport uploaded');
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Couldn't upload the passport.");
    } finally {
      setIsUploading(false);
    }
  }

  return (
    <div className='space-y-3'>
      {passportUrl && (
        <a
          href={passportUrl}
          target='_blank'
          rel='noreferrer'
          className={cn(
            PH_NO_CAPTURE_CLASS,
            'text-primary inline-flex items-center gap-2 text-sm font-medium hover:underline'
          )}
        >
          <Icons.page className='h-4 w-4' />
          View current passport
        </a>
      )}

      <Dropzone
        onDrop={handleDrop}
        accept={PASSPORT_ACCEPT}
        maxSize={MAX_PASSPORT_FILE_SIZE}
        maxFiles={1}
        multiple={false}
        disabled={isUploading}
      >
        {({ getRootProps, getInputProps, isDragActive }) => (
          <div
            {...getRootProps()}
            className={cn(
              'group border-muted-foreground/25 hover:bg-muted/25 relative flex h-28 w-full cursor-pointer flex-col items-center justify-center gap-1 rounded-lg border-2 border-dashed px-5 text-center transition',
              isDragActive && 'border-muted-foreground/50',
              isUploading && 'pointer-events-none opacity-60'
            )}
          >
            <input {...getInputProps()} aria-label='Upload passport' />
            <Icons.upload className='text-muted-foreground h-5 w-5' aria-hidden='true' />
            <p className='text-muted-foreground text-sm'>
              {isUploading
                ? 'Uploading...'
                : passportUrl
                  ? 'Drop a file to replace the passport, or click to select'
                  : 'Drag a passport image or PDF here, or click to select'}
            </p>
          </div>
        )}
      </Dropzone>
    </div>
  );
}
