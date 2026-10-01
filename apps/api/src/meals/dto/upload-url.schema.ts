import { z } from 'zod';
import { MEAL_TYPES } from '../meal-type';

export const uploadUrlSchema = z.object({
  clientId: z.uuid(),
  mealType: z.enum(MEAL_TYPES),
  capturedAt: z.iso.datetime({ offset: true }),
  contentType: z.string().regex(/^image\//),
});

export type UploadUrlInput = z.infer<typeof uploadUrlSchema>;
