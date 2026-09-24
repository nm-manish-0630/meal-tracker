import vue from '@vitejs/plugin-vue';
import { defineConfig } from 'vitest/config';
import { baseTestConfig } from './base.js';

export const vueConfig = defineConfig({
  plugins: [vue()],
  test: {
    ...baseTestConfig,
    environment: 'jsdom',
    include: ['src/**/*.{test,spec}.ts'],
  },
});
