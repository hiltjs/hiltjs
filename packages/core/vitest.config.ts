import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['src/**/*.test.ts'],
    environment: 'node',
    globals: false,
    clearMocks: true,
    restoreMocks: true,
    env: { TZ: 'UTC' },
    coverage: {
      provider: 'v8',
      reporter: ['text', 'lcov'],
      include: ['src/**/*.ts'],
      exclude: ['**/*.test.ts', 'src/index.ts'],
    },
  },
});
