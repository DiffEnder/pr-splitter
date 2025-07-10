import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    environment: 'node',
    testTimeout: 30000,
    server: {
      deps: {
        // Don't bundle dependencies in tests to avoid Sharp loading issues
        external: ['@xenova/transformers', 'sharp'],
      },
    },
  },
})
