import { z } from 'zod';

export const createTrainerGroupSchema = z.object({
  name: z.string().min(1),
  digestTimezone: z.string().min(1).optional(),
});

export type CreateTrainerGroupInput = z.infer<typeof createTrainerGroupSchema>;
