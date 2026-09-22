import swc from 'unplugin-swc';
import { defineConfig } from 'vitest/config';
import { baseTestConfig } from './base.js';

// Force ESM output regardless of the consuming app's package.json "type"
// (apps/api stays CommonJS for its built dist output, but Vitest's module
// graph is native ESM and can't `require()` Vitest itself).
const swcPlugin = swc.vite({
  jsc: {
    parser: {
      syntax: 'typescript',
      decorators: true,
    },
    transform: {
      legacyDecorator: true,
      decoratorMetadata: true,
    },
  },
  module: {
    type: 'es6',
  },
});

export const nestConfig = defineConfig({
  plugins: [swcPlugin],
  test: {
    ...baseTestConfig,
    root: './src',
    environment: 'node',
    include: ['**/*.spec.ts'],
  },
});

export const nestE2eConfig = defineConfig({
  plugins: [swcPlugin],
  test: {
    ...baseTestConfig,
    root: './test',
    environment: 'node',
    include: ['**/*.e2e-spec.ts'],
  },
});
