import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    // The PostgreSQL integration suites rebuild the same dedicated test schema.
    // Keep files sequential so one suite cannot drop another suite's fixtures.
    fileParallelism: false,
  },
});
