<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import { MEAL_TYPES, type MealType } from '@repo/shared/meal-type';
import { getTrainerClientMeals, getTrainerGroupClients, type HistoryMeal, type TrainerClientSummary } from '../lib/api';
import { groupMealsByDate } from '../lib/group-by-date';
import { dateToDateString, formatMonthDay, todayDateString } from '../lib/format-date';
import { useGroupId } from '../lib/use-group-id';
import ThemeToggle from '../components/ThemeToggle.vue';

const groupId = useGroupId();
const clients = ref<TrainerClientSummary[]>([]);
const selectedClientId = ref<string | null>(null);
const clientMeals = ref<HistoryMeal[]>([]);
const loadingClients = ref(false);
const loadingDays = ref(false);
const errorMessage = ref<string | null>(null);

async function loadClients() {
  if (!groupId.value) {
    clients.value = [];
    return;
  }
  loadingClients.value = true;
  errorMessage.value = null;
  try {
    clients.value = await getTrainerGroupClients(groupId.value);
    selectedClientId.value = clients.value[0]?.id ?? null;
  } catch (error) {
    errorMessage.value = error instanceof Error ? error.message : 'Failed to load clients';
  } finally {
    loadingClients.value = false;
  }
}

watch(groupId, loadClients, { immediate: true });

async function loadDays() {
  if (!selectedClientId.value) {
    clientMeals.value = [];
    return;
  }
  loadingDays.value = true;
  errorMessage.value = null;
  try {
    const to = todayDateString();
    const from = dateToDateString(new Date(Date.now() - 13 * 86_400_000));
    clientMeals.value = await getTrainerClientMeals(selectedClientId.value, { from, to });
  } catch (error) {
    errorMessage.value = error instanceof Error ? error.message : 'Failed to load this client';
  } finally {
    loadingDays.value = false;
  }
}

watch(selectedClientId, loadDays, { immediate: true });

const selectedClient = computed(() => clients.value.find((client) => client.id === selectedClientId.value) ?? null);
const days = computed(() => groupMealsByDate(clientMeals.value));
const today = todayDateString();

function photoCount(day: { meals: HistoryMeal[] }, mealType: MealType) {
  return day.meals.find((meal) => meal.mealType === mealType)?.photos.length ?? 0;
}

// Delivery status isn't exposed by the documented trainer-meals endpoint (System Design's
// GET /trainer/clients/{id}/meals only returns meal history) — approximated here from the
// same 7-day catch-up policy (ADR-011) the backend applies, not read from a real delivery row.
function statusNote(date: string) {
  if (date === today) return 'In progress — sends at 8 PM';
  const daysAgo = Math.round((Date.parse(today) - Date.parse(date)) / 86_400_000);
  if (daysAgo <= 7) return 'Caught up in 8 PM digest';
  return 'Delivered';
}
</script>

<template>
  <div class="trainer-dashboard">
    <aside class="sidebar">
      <div v-if="!groupId" class="group-id-setup">
        <label>
          Trainer group ID
          <input v-model="groupId" type="text" placeholder="paste a trainer group id" />
        </label>
      </div>
      <template v-else>
        <div class="identity">
          <div class="avatar">C</div>
          <div>
            <p class="name">Coach Dana</p>
            <p class="client-count">{{ clients.length }} clients</p>
          </div>
        </div>
        <ThemeToggle class="toggle-row" />

        <p v-if="errorMessage" class="error">{{ errorMessage }}</p>
        <p v-if="loadingClients">Loading…</p>

        <div class="client-list">
          <button
            v-for="client in clients"
            :key="client.id"
            type="button"
            class="client-row"
            :class="{ selected: client.id === selectedClientId }"
            @click="selectedClientId = client.id"
          >
            <span class="client-avatar">{{ client.name.charAt(0).toUpperCase() }}</span>
            <span class="client-info">
              <span class="client-name">{{ client.name }}</span>
              <span class="client-status">
                {{ client.lastUploadAt ? `Uploaded ${client.lastUploadAt}` : 'No uploads today' }}
              </span>
            </span>
            <span v-if="client.lastUploadAt" class="unread-dot" />
          </button>
        </div>
      </template>
    </aside>

    <main v-if="groupId" class="main-pane">
      <div v-if="selectedClient" class="client-header">
        <div>
          <h1>{{ selectedClient.name }}</h1>
        </div>
        <div class="digest-chip">Next digest: today at 8:00 PM</div>
      </div>

      <p v-if="loadingDays">Loading…</p>

      <div v-if="selectedClient" class="days-table-scroll">
        <table class="days-table">
          <thead>
            <tr>
              <th>Day</th>
              <th>B</th>
              <th>L</th>
              <th>D</th>
              <th>S</th>
              <th>Status</th>
              <th />
            </tr>
          </thead>
          <tbody>
            <tr v-for="day in days" :key="day.date">
              <td>
                <RouterLink :to="`/clients/${selectedClientId}/days/${day.date}`">{{ formatMonthDay(day.date) }}</RouterLink>
              </td>
              <td v-for="mealType in MEAL_TYPES" :key="mealType">{{ photoCount(day, mealType) || '—' }}</td>
              <td class="status-note">{{ statusNote(day.date) }}</td>
              <td>
                <RouterLink :to="`/clients/${selectedClientId}/days/${day.date}`" class="chevron">›</RouterLink>
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      <p v-if="selectedClient && !loadingDays && days.length === 0" class="empty">No meals logged in the last 14 days.</p>
    </main>
  </div>
</template>

<style scoped>
.trainer-dashboard {
  display: flex;
  min-height: 100vh;
}

.sidebar {
  width: 300px;
  flex-shrink: 0;
  border-right: 1px solid var(--border);
  padding: 16px;
}

.group-id-setup input {
  display: block;
  width: 100%;
  min-height: 44px;
  margin-top: 4px;
}

.identity {
  display: flex;
  align-items: center;
  gap: 8px;
}

.avatar {
  width: 40px;
  height: 40px;
  border-radius: 50%;
  background: var(--accent);
  color: #fff;
  display: flex;
  align-items: center;
  justify-content: center;
  font-family: var(--font-display);
}

.name {
  font-weight: 600;
}

.client-count {
  color: var(--text-secondary);
  font-size: 0.85em;
}

.toggle-row {
  margin: 12px 0;
}

.error {
  color: #b00020;
}

.client-list {
  display: flex;
  flex-direction: column;
  gap: 4px;
  overflow-y: auto;
}

.client-row {
  display: flex;
  align-items: center;
  gap: 8px;
  min-height: 44px;
  padding: 8px;
  border: none;
  background: none;
  border-radius: 12px;
  text-align: left;
}

.client-row.selected {
  background: var(--surface-2);
}

.client-avatar {
  width: 32px;
  height: 32px;
  border-radius: 50%;
  background: var(--surface-2);
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}

.client-info {
  display: flex;
  flex-direction: column;
  flex: 1;
}

.client-status {
  font-size: 0.75em;
  color: var(--text-secondary);
}

.unread-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: var(--accent-2);
  flex-shrink: 0;
}

.main-pane {
  flex: 1;
  padding: 24px;
}

.client-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.client-header h1 {
  font-size: 28px;
}

.digest-chip {
  border: 1px solid var(--border);
  border-radius: 999px;
  padding: 6px 16px;
  font-size: 0.85em;
  color: var(--text-secondary);
}

.days-table-scroll {
  overflow-x: auto;
  margin-top: 24px;
}

.days-table {
  width: 100%;
  min-width: 480px;
  border-collapse: collapse;
}

.days-table th,
.days-table td {
  text-align: left;
  padding: 10px;
  border-bottom: 1px solid var(--border);
}

.status-note {
  color: var(--text-secondary);
  font-size: 0.85em;
}

.chevron {
  color: var(--text-secondary);
}

.empty {
  color: var(--text-secondary);
  margin-top: 24px;
}

@media (max-width: 768px) {
  .trainer-dashboard {
    flex-direction: column;
  }

  .sidebar {
    width: 100%;
    border-right: none;
    border-bottom: 1px solid var(--border);
  }

  .client-list {
    max-height: 240px;
  }

  .main-pane {
    padding: 16px;
  }

  .client-header {
    flex-wrap: wrap;
    gap: 8px;
  }
}
</style>
