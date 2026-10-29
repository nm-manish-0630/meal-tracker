import type { HistoryMeal } from './api';

export interface DaySummary {
  date: string;
  meals: HistoryMeal[];
  photoCount: number;
}

export function groupMealsByDate(meals: HistoryMeal[]): DaySummary[] {
  const byDate = new Map<string, HistoryMeal[]>();
  for (const meal of meals) {
    const list = byDate.get(meal.mealDate) ?? [];
    list.push(meal);
    byDate.set(meal.mealDate, list);
  }
  return Array.from(byDate.entries())
    .map(([date, dayMeals]) => ({
      date,
      meals: dayMeals,
      photoCount: dayMeals.reduce((sum, meal) => sum + meal.photos.length, 0),
    }))
    .sort((a, b) => (a.date < b.date ? 1 : -1));
}
