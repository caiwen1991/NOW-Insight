import { defineConfig } from "vitest/config";
import { fileURLToPath } from "node:url";

// Unit tests target the pure engines in src/lib (no DOM needed → node environment).
// The "@/..." path alias is mirrored here so tests import the same way the app does.
export default defineConfig({
  test: {
    environment: "node",
    include: ["src/**/*.test.ts"],
  },
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
    },
  },
});
