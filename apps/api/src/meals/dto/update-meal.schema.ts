import { z } from 'zod';
import { MEAL_TYPES } from '@repo/shared/meal-type';

export const updateMealSchema = z.object({
  mealType: z.enum(MEAL_TYPES),
});

export type UpdateMealInput = z.infer<typeof updateMealSchema>;
