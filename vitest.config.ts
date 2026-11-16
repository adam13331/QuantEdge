import { defineConfig } from "vitest/config";

// Pure-function tests for app/lib. No DOM, no database, no network: the point is
// that the maths behind every figure on screen can be checked in a second.
export default defineConfig({
  test: {
    environment: "node",
    include: ["app/lib/**/*.test.ts"],
  },
});
