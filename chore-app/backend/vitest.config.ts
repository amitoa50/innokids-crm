import { defineConfig } from "vitest/config"

// Single SQLite test DB — run test files sequentially to avoid write contention.
export default defineConfig({
  test: {
    environment: "node",
    fileParallelism: false,
    globalSetup: ["./test/global-setup.ts"],
    setupFiles: ["./test/setup.ts"],
    include: ["test/**/*.test.ts"],
    testTimeout: 15000
  }
})
