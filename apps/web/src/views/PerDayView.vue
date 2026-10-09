<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import { useRoute } from 'vue-router';
import { MEAL_TYPES, type MealType } from '@repo/shared/meal-type';
import {
  getHistory,
  updateMealType,
  deleteMeal,
  deletePhoto,
  createUploadUrl,
  uploadToR2,
  confirmUpload,
  type HistoryMeal,
} from '../lib/api';

const route = useRoute();

const meals = ref<HistoryMeal[]>([]);
const loading = ref(false);
const errorMessage = ref<string | null>(null);
const changingTypeFor = ref<string | null>(null);
const addPhotoInputs = ref<Record<string, HTMLInputElement | null>>({});

function clientId() {
  return route.params.clientId as string;
}

function date() {
  return route.params.date as string;
}

async function load() {
  loading.value = true;
  errorMessage.value = null;
  try {
    const result = await getHistory(clientId(), { from: date(), to: date() });
    meals.value = result.filter((meal) => meal.photos.length > 0);
  } catch (error) {
    errorMessage.value = error instanceof Error ? error.message : 'Failed to load this day';
  } finally {
    loading.value = false;
  }
}

watch([() => route.params.clientId, () => route.params.date], load, { immediate: true });

async function changeType(meal: HistoryMeal, mealType: MealType) {
  if (mealType === meal.mealType) {
    changingTypeFor.value = null;
    return;
  }
  errorMessage.value = null;
  try {
    await updateMealType(meal.id, mealType);
    changingTypeFor.value = null;
    await load();
  } catch (error) {
    errorMessage.value = error instanceof Error ? error.message : 'Failed to change meal type';
  }
}

async function removeMeal(meal: HistoryMeal) {
  errorMessage.value = null;
  try {
    await deleteMeal(meal.id);
    await load();
  } catch (error) {
    errorMessage.value = error instanceof Error ? error.message : 'Failed to delete meal';
  }
}

async function removePhoto(photoId: string) {
  errorMessage.value = null;
  try {
    await deletePhoto(photoId);
    await load();
  } catch (error) {
    errorMessage.value = error instanceof Error ? error.message : 'Failed to delete photo';
  }
}

function triggerAddPhoto(mealType: MealType) {
  addPhotoInputs.value[mealType]?.click();
}

async function onAddPhoto(event: Event, meal: HistoryMeal) {
  const input = event.target as HTMLInputElement;
  const file = input.files?.[0];
  input.value = '';
  if (!file) return;

  errorMessage.value = null;
  try {
    const capturedAt = `${meal.mealDate}T12:00:00.000Z`;
    const { mealId, uploadUrl, r2ObjectKey } = await createUploadUrl({
      clientId: clientId(),
      mealType: meal.mealType,
      capturedAt,
      contentType: file.type || 'image/jpeg',
    });
    await uploadToR2(uploadUrl, file, file.type || 'image/jpeg');
    await confirmUpload({ mealId, r2ObjectKey, fileSize: file.size, capturedAt });
    await load();
  } catch (error) {
    errorMessage.value = error instanceof Error ? error.message : 'Failed to add photo';
  }
}

const currentUrl = computed(() => window.location.href);

function copyLink() {
  navigator.clipboard?.writeText(currentUrl.value).catch(() => {});
}
</script>

<template>
  <main class="per-day">
    <header>
      <h1>{{ date() }}</h1>
      <p class="subtitle">Every meal photo logged this day, in one shareable page</p>
      <div class="share-row">
        <code>{{ currentUrl }}</code>
        <button type="button" @click="copyLink">Share</button>
      </div>
    </header>

    <p v-if="errorMessage" class="error">{{ errorMessage }}</p>
    <p v-if="loading">Loading…</p>

    <nav v-if="meals.length" class="meal-nav">
      <a v-for="meal in meals" :key="meal.id" :href="`#${meal.mealType}`">
        {{ meal.mealType }} · {{ meal.photos.length }} photo{{ meal.photos.length === 1 ? '' : 's' }}
      </a>
    </nav>

    <p v-if="!loading && meals.length === 0" class="empty">
      Every meal for this day has been removed from this page.
    </p>

    <section v-for="meal in meals" :id="meal.mealType" :key="meal.id" class="meal-section">
      <h2>{{ meal.mealType }} <span class="count">· {{ meal.photos.length }} photos</span></h2>

      <div class="section-actions">
        <button type="button" @click="triggerAddPhoto(meal.mealType)">Add photo</button>
        <input
          :ref="(el) => (addPhotoInputs[meal.mealType] = el as HTMLInputElement | null)"
          type="file"
          accept="image/*"
          class="hidden-file-input"
          @change="onAddPhoto($event, meal)"
        />
        <button type="button" @click="changingTypeFor = changingTypeFor === meal.id ? null : meal.id">
          Change type
        </button>
        <button type="button" class="delete" @click="removeMeal(meal)">Delete meal</button>
      </div>

      <div v-if="changingTypeFor === meal.id" class="meal-type-pills">
        <button
          v-for="mealType in MEAL_TYPES"
          :key="mealType"
          type="button"
          :class="{ selected: meal.mealType === mealType }"
          @click="changeType(meal, mealType)"
        >
          {{ mealType }}
        </button>
      </div>

      <div class="photos">
        <div v-for="photo in meal.photos" :key="photo.id" class="photo-card">
          <img :src="photo.downloadUrl" :alt="`${meal.mealType} photo`" />
          <p class="captured-at">{{ new Date(photo.capturedAt).toLocaleTimeString() }}</p>
          <button type="button" class="remove" @click="removePhoto(photo.id)">Remove</button>
        </div>
      </div>
    </section>

    <footer v-if="meals.length" class="footer-note">
      Anyone with this link sees this exact page — and can add, edit, or delete here too. There's no separate
      client or trainer view of this page.
    </footer>
  </main>
</template>

<style scoped>
.per-day {
  max-width: 720px;
  margin: 0 auto;
  padding: 16px;
}

.subtitle {
  color: #56685f;
  margin-top: 4px;
}

.share-row {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-top: 8px;
}

.share-row code {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  flex: 1;
  font-size: 0.85em;
}

.error {
  color: #b00020;
}

.empty {
  text-align: center;
  color: #56685f;
  margin-top: 48px;
}

.meal-nav {
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
  margin: 16px 0;
}

.meal-nav a {
  padding: 6px 12px;
  border-radius: 999px;
  border: 1px solid #999;
  text-decoration: none;
  color: inherit;
}

.meal-section {
  margin-top: 32px;
  border-top: 1px solid #ddd;
  padding-top: 16px;
}

.count {
  color: #56685f;
  font-weight: normal;
  font-size: 0.7em;
}

.section-actions {
  display: flex;
  gap: 8px;
  margin: 8px 0;
}

.section-actions .delete {
  color: #b00020;
}

.hidden-file-input {
  display: none;
}

.meal-type-pills {
  display: flex;
  gap: 8px;
  margin: 8px 0;
}

.meal-type-pills button {
  padding: 6px 12px;
  border-radius: 999px;
  border: 1px solid #999;
  background: white;
}

.meal-type-pills button.selected {
  background: #0e7c74;
  color: white;
  border-color: #0e7c74;
}

.photos {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(120px, 1fr));
  gap: 12px;
  margin-top: 12px;
}

.photo-card img {
  width: 100%;
  aspect-ratio: 1;
  object-fit: cover;
  border-radius: 8px;
}

.captured-at {
  font-size: 0.8em;
  color: #56685f;
  margin: 4px 0;
}

.remove {
  font-size: 0.8em;
  background: none;
  border: none;
  color: #b00020;
  text-decoration: underline;
  cursor: pointer;
  padding: 0;
}

.footer-note {
  margin-top: 32px;
  padding-top: 16px;
  border-top: 1px solid #ddd;
  color: #56685f;
  font-size: 0.85em;
}
</style>
