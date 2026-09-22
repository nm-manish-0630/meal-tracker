import type { TestUserConfig } from 'vitest/config';

export const baseTestConfig = {
  coverage: {
    provider: 'v8',
    reportsDirectory: 'coverage',
  },
  globals: true,
} as const satisfies TestUserConfig;
