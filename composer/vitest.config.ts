import { defineConfig } from 'vitest/config';
import { fileURLToPath } from 'node:url';
export default defineConfig({
  test: {
    name: 'chat-ui-composer',
    include: ['composer/**/*.test.{ts,tsx}'],
    setupFiles: [fileURLToPath(new URL('./test-setup.ts', import.meta.url))],
    maxWorkers: 2,
  },
});
