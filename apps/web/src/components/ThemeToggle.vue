<script setup lang="ts">
import { useTheme } from '../lib/use-theme';

const { theme } = useTheme();
</script>

<template>
  <div class="theme-toggle">
    <button type="button" :class="{ active: theme === 'light' }" @click="theme = 'light'">☀ Light</button>
    <button type="button" :class="{ active: theme === 'dark' }" @click="theme = 'dark'">🌙 Dark</button>
  </div>
</template>

<style scoped>
.theme-toggle {
  display: inline-flex;
  border-radius: 999px;
  background: var(--surface-2);
  padding: 4px;
  gap: 4px;
}

.theme-toggle button {
  border: none;
  background: none;
  padding: 6px 12px;
  border-radius: 999px;
  font-size: 0.8em;
  color: var(--text-secondary);
  min-height: 32px;
}

.theme-toggle button.active {
  background: var(--surface);
  color: var(--text);
}
</style>
