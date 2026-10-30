import { z } from 'zod';

export const updateTrainerGroupSchema = z.object({
  name: z.string().min(1).optional(),
  digestTimezone: z.string().min(1).optional(),
});

export type UpdateTrainerGroupInput = z.infer<typeof updateTrainerGroupSchema>;
