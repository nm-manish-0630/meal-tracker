<script setup lang="ts">
import { computed, ref } from 'vue';
import { useRoute } from 'vue-router';
import MealUpload from '../components/MealUpload.vue';
import ThemeToggle from '../components/ThemeToggle.vue';
import { dateToDateString, todayDateString } from '../lib/format-date';

const route = useRoute();
const clientId = computed(() => route.params.clientId as string);
const lastAddedDate = ref<string | null>(null);

function onUploaded(capturedAt: Date) {
  lastAddedDate.value = dateToDateString(capturedAt);
}

const dayLink = computed(() => `/clients/${clientId.value}/days/${lastAddedDate.value ?? todayDateString()}`);
</script>

<template>
  <main class="upload-view">
    <header class="header">
      <RouterLink :to="`/clients/${clientId}`" class="back-link">‹ Dashboard</RouterLink>
      <ThemeToggle />
    </header>
    <h1>Add a meal photo</h1>

    <MealUpload :client-id="clientId" @uploaded="onUploaded" />

    <RouterLink :to="dayLink" class="view-day-footer">View full day →</RouterLink>
  </main>
</template>

<style scoped>
.upload-view {
  max-width: 390px;
  margin: 0 auto;
  padding: 16px;
}

.header {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.back-link {
  color: var(--text-secondary);
}

h1 {
  font-size: 22px;
  margin-top: 12px;
}

.view-day-footer {
  display: flex;
  align-items: center;
  justify-content: center;
  min-height: 44px;
  margin-top: 24px;
  border: 1px solid var(--border);
  border-radius: 12px;
  color: var(--accent);
  font-weight: 600;
}
</style>
