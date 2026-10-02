<script setup lang="ts">
import { computed, ref } from 'vue';
import { MEAL_TYPES, type MealType } from '@repo/shared/meal-type';
import { readExif } from '../lib/exif';
import { detectMealType } from '../lib/meal-type-detect';
import { compressImage } from '../lib/compress-image';
import { createUploadUrl, uploadToR2, confirmUpload } from '../lib/api';
import { fromDatetimeLocalValue, toDatetimeLocalValue } from '../lib/datetime-local';

type Status = 'idle' | 'review' | 'uploading';

interface RecentlyAdded {
  mealType: MealType;
  capturedAt: Date;
}

const props = defineProps<{ clientId: string }>();
const emit = defineEmits<{ uploaded: [] }>();

const status = ref<Status>('idle');
const selectedFile = ref<File | null>(null);
const previewUrl = ref<string | null>(null);
const detectedCapturedAt = ref<Date | null>(null);
const selectedMealType = ref<MealType | null>(null);
const orientation = ref(1);
const errorMessage = ref<string | null>(null);
const recentlyAdded = ref<RecentlyAdded[]>([]);

const capturedAtInput = computed({
  get: () => (detectedCapturedAt.value ? toDatetimeLocalValue(detectedCapturedAt.value) : ''),
  set: (value: string) => {
    if (!value) return;
    const newDate = fromDatetimeLocalValue(value);
    detectedCapturedAt.value = newDate;
    selectedMealType.value = detectMealType(newDate);
  },
});

function resetToIdle() {
  if (previewUrl.value) URL.revokeObjectURL(previewUrl.value);
  status.value = 'idle';
  selectedFile.value = null;
  previewUrl.value = null;
  detectedCapturedAt.value = null;
  selectedMealType.value = null;
  orientation.value = 1;
}

async function onFileSelected(event: Event) {
  const input = event.target as HTMLInputElement;
  const file = input.files?.[0];
  input.value = '';
  if (!file) return;

  errorMessage.value = null;
  const exif = await readExif(file);
  const capturedAt = exif.capturedAt ?? new Date();

  selectedFile.value = file;
  previewUrl.value = URL.createObjectURL(file);
  detectedCapturedAt.value = capturedAt;
  selectedMealType.value = detectMealType(capturedAt);
  orientation.value = exif.orientation;
  status.value = 'review';
}

async function addToLog() {
  if (!props.clientId) {
    errorMessage.value = 'Enter a client ID first';
    return;
  }
  if (!selectedFile.value || !detectedCapturedAt.value || !selectedMealType.value) return;

  status.value = 'uploading';
  errorMessage.value = null;

  try {
    const compressed = await compressImage(selectedFile.value, orientation.value);
    const capturedAtIso = detectedCapturedAt.value.toISOString();

    const { mealId, uploadUrl, r2ObjectKey } = await createUploadUrl({
      clientId: props.clientId,
      mealType: selectedMealType.value,
      capturedAt: capturedAtIso,
      contentType: 'image/jpeg',
    });

    await uploadToR2(uploadUrl, compressed, 'image/jpeg');

    await confirmUpload({
      mealId,
      r2ObjectKey,
      fileSize: compressed.size,
      capturedAt: capturedAtIso,
    });

    recentlyAdded.value.unshift({ mealType: selectedMealType.value, capturedAt: detectedCapturedAt.value });
    resetToIdle();
    emit('uploaded');
  } catch (error) {
    errorMessage.value = error instanceof Error ? error.message : 'Upload failed';
    status.value = 'review';
  }
}
</script>

<template>
  <div class="meal-upload">
    <p v-if="errorMessage" class="error">{{ errorMessage }}</p>

    <div v-if="status === 'idle'" class="idle-target">
      <label>
        <input type="file" accept="image/*" @change="onFileSelected" />
        + Add a photo
      </label>
    </div>

    <div v-else class="review">
      <img v-if="previewUrl" :src="previewUrl" alt="Selected meal photo" class="preview" />
      <label class="captured-at">
        Taken at
        <input v-model="capturedAtInput" type="datetime-local" />
      </label>

      <div class="meal-type-pills">
        <button
          v-for="mealType in MEAL_TYPES"
          :key="mealType"
          type="button"
          :class="{ selected: selectedMealType === mealType }"
          @click="selectedMealType = mealType"
        >
          {{ mealType }}
        </button>
      </div>

      <div class="actions">
        <button type="button" :disabled="status === 'uploading'" @click="resetToIdle">Cancel</button>
        <button type="button" :disabled="status === 'uploading'" @click="addToLog">
          {{ status === 'uploading' ? 'Uploading…' : 'Add to log' }}
        </button>
      </div>
    </div>

    <div v-if="recentlyAdded.length" class="recently-added">
      <h2>Recently added</h2>
      <ul>
        <li v-for="(item, index) in recentlyAdded" :key="index">
          {{ item.mealType }} — {{ item.capturedAt.toLocaleString() }}
        </li>
      </ul>
    </div>
  </div>
</template>

<style scoped>
.meal-upload {
  max-width: 480px;
  margin: 0 auto;
  padding: 16px;
}

.error {
  color: #b00020;
}

.idle-target {
  border: 2px dashed #999;
  border-radius: 12px;
  padding: 32px;
  text-align: center;
}

.idle-target input[type='file'] {
  display: none;
}

.preview {
  width: 100%;
  border-radius: 8px;
}

.captured-at {
  display: block;
  margin: 12px 0;
}

.captured-at input {
  display: block;
  margin-top: 4px;
}

.meal-type-pills {
  display: flex;
  gap: 8px;
  margin: 12px 0;
}

.meal-type-pills button {
  flex: 1;
  padding: 8px;
  border-radius: 999px;
  border: 1px solid #999;
  background: white;
}

.meal-type-pills button.selected {
  background: #0e7c74;
  color: white;
  border-color: #0e7c74;
}

.actions {
  display: flex;
  gap: 8px;
}

.actions button {
  flex: 1;
  padding: 10px;
}

.recently-added {
  margin-top: 24px;
}
</style>
