<script setup lang="ts">
import { ref, watch } from 'vue';
import { getHistory, type HistoryMeal } from '../lib/api';

const props = defineProps<{ clientId: string }>();

const meals = ref<HistoryMeal[]>([]);
const loading = ref(false);
const errorMessage = ref<string | null>(null);

async function loadHistory() {
  if (!props.clientId) {
    meals.value = [];
    return;
  }
  loading.value = true;
  errorMessage.value = null;
  try {
    meals.value = await getHistory(props.clientId);
  } catch (error) {
    errorMessage.value = error instanceof Error ? error.message : 'Failed to load history';
  } finally {
    loading.value = false;
  }
}

watch(() => props.clientId, loadHistory, { immediate: true });

defineExpose({ reload: loadHistory });
</script>

<template>
  <div class="meal-history">
    <div class="header">
      <h2>Meal history</h2>
      <button type="button" :disabled="loading" @click="loadHistory">
        {{ loading ? 'Loading…' : 'Refresh' }}
      </button>
    </div>

    <p v-if="errorMessage" class="error">{{ errorMessage }}</p>
    <p v-else-if="!loading && meals.length === 0">No meals logged yet.</p>

    <div v-for="meal in meals" :key="meal.id" class="meal">
      <h3>{{ meal.mealDate }} — {{ meal.mealType }}</h3>
      <div class="photos">
        <img
          v-for="photo in meal.photos"
          :key="photo.id"
          :src="photo.downloadUrl"
          :alt="`${meal.mealType} photo`"
          class="photo"
        />
      </div>
    </div>
  </div>
</template>

<style scoped>
.meal-history {
  max-width: 480px;
  margin: 24px auto 0;
  padding: 16px;
}

.header {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.error {
  color: #b00020;
}

.meal {
  margin-top: 16px;
}

.photos {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(100px, 1fr));
  gap: 8px;
  margin-top: 8px;
}

.photo {
  width: 100%;
  aspect-ratio: 1;
  object-fit: cover;
  border-radius: 8px;
}
</style>
