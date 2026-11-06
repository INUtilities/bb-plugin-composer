import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    name: "bb-plugin-composer",
    include: ["composer/**/*.test.{ts,tsx}", "tests/**/*.test.tsx"],
    setupFiles: ["./composer/test-setup.ts"],
    maxWorkers: 2,
  },
});
