<script setup lang="ts">
import { ref } from 'vue';

const count = ref(0);
</script>

<template>
  <main>
    <h1>Meal Tracker</h1>
    <button type="button" @click="count++">Count is {{ count }}</button>
  </main>
</template>
