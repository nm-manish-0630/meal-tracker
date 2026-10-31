<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import { useRoute } from 'vue-router';
import { useClientId } from '../lib/use-client-id';
import { getClientSummary, getHistory, type HistoryMeal } from '../lib/api';
import { groupMealsByDate } from '../lib/group-by-date';
import { formatMonthDay, todayDateString } from '../lib/format-date';
import ThemeToggle from '../components/ThemeToggle.vue';
import MealTypeDots from '../components/MealTypeDots.vue';

const route = useRoute();
const clientId = useClientId();
if (typeof route.params.clientId === 'string' && route.params.clientId !== clientId.value) {
  clientId.value = route.params.clientId;
}

// A local draft so typing a client id doesn't commit it (and swap the view away from
// the input) character by character — only the explicit submit commits it.
const clientIdDraft = ref('');
function submitClientId() {
  const trimmed = clientIdDraft.value.trim();
  if (trimmed) clientId.value = trimmed;
}

const clientName = ref<string | null>(null);
const meals = ref<HistoryMeal[]>([]);
const loading = ref(false);
const errorMessage = ref<string | null>(null);

async function load() {
  if (!clientId.value) {
    meals.value = [];
    return;
  }
  loading.value = true;
  errorMessage.value = null;
  try {
    const [summary, history] = await Promise.all([getClientSummary(clientId.value), getHistory(clientId.value)]);
    clientName.value = summary.name;
    meals.value = history;
  } catch (error) {
    errorMessage.value = error instanceof Error ? error.message : 'Failed to load dashboard';
  } finally {
    loading.value = false;
  }
}

watch(clientId, load, { immediate: true });

const today = todayDateString();
const days = computed(() => groupMealsByDate(meals.value));
const todayMeals = computed(() => days.value.find((day) => day.date === today)?.meals ?? []);
const recentDays = computed(() => days.value.filter((day) => day.date !== today).slice(0, 5));

// Streak/compliance have no documented backend calc (UI_SPEC §1 says as much) —
// approximated here from real logged days rather than left hardcoded.
const streak = computed(() => {
  let count = 0;
  const cursor = new Date();
  for (;;) {
    const hasLog = days.value.some((day) => day.date === formatCursor(cursor));
    if (!hasLog) break;
    count += 1;
    cursor.setDate(cursor.getDate() - 1);
  }
  return count;
});

function formatCursor(date: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

const compliance = computed(() => {
  const cursor = new Date();
  let logged = 0;
  for (let i = 0; i < 7; i++) {
    if (days.value.some((day) => day.date === formatCursor(cursor))) logged += 1;
    cursor.setDate(cursor.getDate() - 1);
  }
  return Math.round((logged / 7) * 100);
});

const avatarInitial = computed(() => (clientName.value ?? clientId.value).trim().charAt(0).toUpperCase() || '?');
</script>

<template>
  <main class="dashboard">
    <div v-if="!clientId" class="client-id-setup">
      <ThemeToggle class="toggle-row" />
      <h1>Meal Tracker</h1>
      <p class="subtitle">Enter your client ID to see your meals.</p>
      <form @submit.prevent="submitClientId">
        <label>
          Client ID
          <input v-model="clientIdDraft" type="text" placeholder="paste a client id" />
        </label>
        <button type="submit" :disabled="!clientIdDraft.trim()">Continue</button>
      </form>
    </div>

    <template v-else>
      <header class="header">
        <div class="greeting-row">
          <div>
            <h1>Hi {{ clientName ?? clientId }}</h1>
            <p class="subtitle">Let's log today's meals</p>
          </div>
          <button type="button" class="avatar" title="Switch client ID" @click="clientId = ''">
            {{ avatarInitial }}
          </button>
        </div>
        <ThemeToggle class="toggle-row" />
      </header>

      <p v-if="errorMessage" class="error">{{ errorMessage }}</p>

      <div class="stat-pair">
        <div class="stat-card">
          <p class="stat-number">{{ streak }} days</p>
          <p class="stat-label">Logging streak</p>
        </div>
        <div class="stat-card">
          <p class="stat-number">{{ compliance }}%</p>
          <p class="stat-label">Meals logged</p>
        </div>
      </div>

      <RouterLink :to="`/clients/${clientId}/days/${today}`" class="today-card">
        <div class="today-card-header">
          <span>Today · {{ formatMonthDay(today) }}</span>
          <span class="view-day">View day →</span>
        </div>
        <MealTypeDots :meals="todayMeals" show-labels />
      </RouterLink>

      <RouterLink :to="`/clients/${clientId}/upload`" class="primary-cta">+ Add a photo</RouterLink>

      <section class="recent-days">
        <div class="recent-days-header">
          <h2>Recent days</h2>
          <RouterLink :to="`/clients/${clientId}/history`">View full history →</RouterLink>
        </div>
        <p v-if="loading">Loading…</p>
        <RouterLink v-for="day in recentDays" :key="day.date" :to="`/clients/${clientId}/days/${day.date}`" class="day-row">
          <span>{{ formatMonthDay(day.date) }}</span>
          <span class="summary">{{ day.photoCount }} photo{{ day.photoCount === 1 ? '' : 's' }} logged</span>
          <span class="chevron">›</span>
        </RouterLink>
        <p v-if="!loading && recentDays.length === 0" class="empty">No earlier days logged yet.</p>
      </section>
    </template>
  </main>
</template>

<style scoped>
.dashboard {
  max-width: 390px;
  margin: 0 auto;
  padding: 16px;
}

.client-id-setup {
  padding-top: 48px;
  text-align: center;
}

.client-id-setup .toggle-row {
  display: flex;
  justify-content: flex-end;
  margin-bottom: 24px;
}

.client-id-setup h1 {
  font-size: 24px;
}

.client-id-setup form {
  margin-top: 24px;
  text-align: left;
}

.client-id-setup label {
  display: block;
}

.client-id-setup input {
  display: block;
  width: 100%;
  min-height: 44px;
  margin-top: 4px;
  padding: 0 12px;
  border: 1px solid var(--border);
  border-radius: 12px;
  background: var(--surface);
  color: var(--text);
}

.client-id-setup button[type='submit'] {
  display: block;
  width: 100%;
  min-height: 44px;
  margin-top: 16px;
  background: var(--accent);
  color: #fff;
  border: none;
  border-radius: 12px;
  font-weight: 600;
}

.client-id-setup button[type='submit']:disabled {
  opacity: 0.6;
  cursor: default;
}

.greeting-row {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
}

.header h1 {
  font-size: 24px;
}

.subtitle {
  color: var(--text-secondary);
  margin-top: 4px;
}

.avatar {
  width: 44px;
  height: 44px;
  border-radius: 50%;
  background: var(--accent);
  color: #fff;
  border: none;
  font-family: var(--font-display);
  font-weight: 600;
}

.toggle-row {
  display: flex;
  justify-content: flex-end;
  margin-top: 8px;
}

.error {
  color: #b00020;
}

.stat-pair {
  display: flex;
  gap: 12px;
  margin-top: 20px;
}

.stat-card {
  flex: 1;
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: 16px;
  padding: 12px;
  text-align: center;
}

.stat-number {
  font-family: var(--font-display);
  font-size: 22px;
}

.stat-label {
  color: var(--text-secondary);
  font-size: 0.8em;
  margin-top: 4px;
}

.today-card {
  display: block;
  margin-top: 16px;
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: 16px;
  padding: 16px;
}

.today-card-header {
  display: flex;
  justify-content: space-between;
  margin-bottom: 12px;
}

.view-day {
  color: var(--accent);
}

.primary-cta {
  display: flex;
  align-items: center;
  justify-content: center;
  min-height: 44px;
  margin-top: 16px;
  background: var(--accent);
  color: #fff;
  border-radius: 12px;
  font-weight: 600;
}

.recent-days {
  margin-top: 24px;
}

.recent-days-header {
  display: flex;
  justify-content: space-between;
  align-items: baseline;
}

.recent-days-header a {
  color: var(--accent);
  font-size: 0.85em;
}

.day-row {
  display: flex;
  align-items: center;
  gap: 8px;
  min-height: 44px;
  padding: 8px 0;
  border-bottom: 1px solid var(--border);
}

.day-row .summary {
  color: var(--text-secondary);
  flex: 1;
  font-size: 0.85em;
}

.chevron {
  color: var(--text-secondary);
}

.empty {
  color: var(--text-secondary);
}
</style>
