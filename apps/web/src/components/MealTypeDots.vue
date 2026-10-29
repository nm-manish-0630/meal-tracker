<script setup lang="ts">
import { MEAL_TYPES, type MealType } from '@repo/shared/meal-type';
import type { HistoryMeal } from '../lib/api';

const props = defineProps<{ meals: HistoryMeal[]; showLabels?: boolean }>();

function hasPhotos(mealType: MealType) {
  return props.meals.some((meal) => meal.mealType === mealType && meal.photos.length > 0);
}
</script>

<template>
  <div class="meal-dots">
    <div v-for="mealType in MEAL_TYPES" :key="mealType" class="dot-item">
      <span class="dot" :class="{ filled: hasPhotos(mealType) }">
        <span v-if="hasPhotos(mealType)">✓</span>
      </span>
      <span v-if="showLabels" class="label">{{ mealType }}</span>
    </div>
  </div>
</template>

<style scoped>
.meal-dots {
  display: flex;
  gap: 16px;
}

.dot-item {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 4px;
}

.dot {
  width: 28px;
  height: 28px;
  border-radius: 50%;
  border: 2px solid var(--border);
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--text-secondary);
  font-size: 0.8em;
}

.dot.filled {
  background: var(--accent);
  border-color: var(--accent);
  color: #fff;
}

.label {
  font-size: 0.7em;
  color: var(--text-secondary);
  text-transform: capitalize;
}
</style>
