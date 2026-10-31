import { z } from 'zod';

export const trainerMealsQuerySchema = z.object({
  from: z.iso.date().optional(),
  to: z.iso.date().optional(),
});

export type TrainerMealsQueryInput = z.infer<typeof trainerMealsQuerySchema>;
