import type { TestUserConfig } from 'vitest/config';

export const baseTestConfig = {
  globals: true,
} as const satisfies TestUserConfig;
