<script setup lang="ts">
import { useTemplateRef } from 'vue';
import MealUpload from './components/MealUpload.vue';
import MealHistory from './components/MealHistory.vue';
import { useClientId } from './lib/use-client-id';

const clientId = useClientId();
const historyRef = useTemplateRef<InstanceType<typeof MealHistory>>('historyRef');
</script>

<template>
  <main>
    <h1>Meal Tracker</h1>

    <label class="client-id">
      Client ID
      <input v-model="clientId" type="text" placeholder="paste a client id" />
    </label>

    <MealUpload :client-id="clientId" @uploaded="historyRef?.reload()" />
    <MealHistory ref="historyRef" :client-id="clientId" />
  </main>
</template>

<style scoped>
.client-id {
  display: block;
  max-width: 480px;
  margin: 0 auto 16px;
  padding: 0 16px;
}

.client-id input {
  display: block;
  width: 100%;
  margin-top: 4px;
}
</style>
