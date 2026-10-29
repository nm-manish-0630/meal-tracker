<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import { useRoute } from 'vue-router';
import { getHistory, type HistoryMeal } from '../lib/api';
import { groupMealsByDate } from '../lib/group-by-date';
import { formatDayNumber, formatMonthYearLabel, formatWeekdayAbbrev } from '../lib/format-date';
import ThemeToggle from '../components/ThemeToggle.vue';
import MealTypeDots from '../components/MealTypeDots.vue';

const route = useRoute();
const clientId = computed(() => route.params.clientId as string);

const meals = ref<HistoryMeal[]>([]);
const loading = ref(false);
const errorMessage = ref<string | null>(null);

async function load() {
  loading.value = true;
  errorMessage.value = null;
  try {
    meals.value = await getHistory(clientId.value);
  } catch (error) {
    errorMessage.value = error instanceof Error ? error.message : 'Failed to load history';
  } finally {
    loading.value = false;
  }
}

watch(clientId, load, { immediate: true });

const days = computed(() => groupMealsByDate(meals.value));

const months = computed(() => {
  const byMonth = new Map<string, typeof days.value>();
  for (const day of days.value) {
    const key = day.date.slice(0, 7);
    const list = byMonth.get(key) ?? [];
    list.push(day);
    byMonth.set(key, list);
  }
  return Array.from(byMonth.entries())
    .sort((a, b) => (a[0] < b[0] ? 1 : -1))
    // monthDays is never empty — each entry was just built from at least one pushed day
    .map(([key, monthDays]) => ({ key, label: formatMonthYearLabel(monthDays[0]!.date), days: monthDays }));
});
</script>

<template>
  <main class="history">
    <header class="header">
      <div class="header-top">
        <RouterLink :to="`/clients/${clientId}`" class="back-link">‹ Dashboard</RouterLink>
        <ThemeToggle />
      </div>
      <h1>Meal history</h1>
      <p class="subtitle">Every day, since your first upload.</p>
    </header>

    <p v-if="errorMessage" class="error">{{ errorMessage }}</p>
    <p v-if="loading">Loading…</p>

    <section v-for="month in months" :key="month.key" class="month">
      <h2 class="month-label">{{ month.label }}</h2>
      <RouterLink v-for="day in month.days" :key="day.date" :to="`/clients/${clientId}/days/${day.date}`" class="day-row">
        <div class="day-date">
          <span class="day-number">{{ formatDayNumber(day.date) }}</span>
          <span class="weekday">{{ formatWeekdayAbbrev(day.date) }}</span>
        </div>
        <MealTypeDots :meals="day.meals" />
        <span class="summary">
          {{ day.photoCount }} photo{{ day.photoCount === 1 ? '' : 's' }} ·
          {{ day.meals.length }} of 4 meals
        </span>
        <span class="chevron">›</span>
      </RouterLink>
    </section>

    <p v-if="!loading && days.length === 0" class="empty">No days logged yet.</p>

    <footer v-if="days.length" class="footer-count">{{ days.length }} days logged.</footer>
  </main>
</template>

<style scoped>
.history {
  max-width: 390px;
  margin: 0 auto;
  padding: 16px;
}

.header-top {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.back-link {
  color: var(--text-secondary);
}

.header h1 {
  font-size: 24px;
  margin-top: 12px;
}

.subtitle {
  color: var(--text-secondary);
  margin-top: 4px;
}

.error {
  color: #b00020;
}

.month {
  margin-top: 24px;
}

.month-label {
  font-family: var(--font-body);
  font-size: 0.75em;
  letter-spacing: 0.05em;
  color: var(--text-secondary);
  font-weight: 600;
}

.day-row {
  display: flex;
  align-items: center;
  gap: 12px;
  min-height: 44px;
  padding: 10px 0;
  border-bottom: 1px solid var(--border);
}

.day-date {
  display: flex;
  flex-direction: column;
  align-items: center;
  width: 36px;
}

.day-number {
  font-family: var(--font-display);
  font-size: 18px;
}

.weekday {
  font-size: 0.7em;
  color: var(--text-secondary);
}

.summary {
  flex: 1;
  color: var(--text-secondary);
  font-size: 0.8em;
}

.chevron {
  color: var(--text-secondary);
}

.empty {
  color: var(--text-secondary);
  margin-top: 24px;
}

.footer-count {
  margin-top: 24px;
  color: var(--text-secondary);
  text-align: center;
}
</style>
