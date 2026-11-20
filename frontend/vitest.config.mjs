import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

// Same "@/..." alias as tsconfig.json, so specs can import app code the way the app does.
export default defineConfig({
  resolve: { alias: { "@": fileURLToPath(new URL(".", import.meta.url)) } },
  test: { setupFiles: ["./vitest.setup.ts"] },
});
