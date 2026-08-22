import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    include: ["tests/**/*.test.ts"],
    // Tests run against the real local development database, so files must not
    // race each other over shared fixtures.
    fileParallelism: false,
    testTimeout: 30000,
    hookTimeout: 120000,
  },
});
