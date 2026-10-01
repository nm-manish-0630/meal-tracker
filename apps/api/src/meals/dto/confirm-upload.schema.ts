import { z } from 'zod';

const MAX_PHOTO_SIZE_BYTES = 50 * 1024 * 1024;

export const confirmUploadSchema = z.object({
  mealId: z.uuid(),
  r2ObjectKey: z.string().min(1),
  fileSize: z.number().int().min(1).max(MAX_PHOTO_SIZE_BYTES),
  capturedAt: z.iso.datetime({ offset: true }),
});

export type ConfirmUploadInput = z.infer<typeof confirmUploadSchema>;
