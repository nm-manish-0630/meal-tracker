import type { MealType } from '@repo/api';

export function detectMealType(capturedAt: Date): MealType {
  const hour = capturedAt.getHours() + capturedAt.getMinutes() / 60;

  if (hour >= 5 && hour < 10) return 'breakfast';
  if (hour >= 11 && hour < 14) return 'lunch';
  if (hour >= 14 && hour < 16) return 'snack';
  if (hour >= 16 && hour < 21) return 'dinner';
  return 'snack';
}
