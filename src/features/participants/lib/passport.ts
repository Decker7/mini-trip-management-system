/** Kept in sync with `MAX_PASSPORT_FILE_BYTES` in `convex/participants.ts`. */
export const MAX_PASSPORT_FILE_SIZE = 10 * 1024 * 1024;

export const PASSPORT_ACCEPT: Record<string, string[]> = {
  'image/*': [],
  'application/pdf': ['.pdf']
};
