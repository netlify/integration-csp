import { defineWorkspace } from "vitest/config";

// TODO(ndhoule): Consider splitting backend tests out further into endpoints | extension/connector/etc. workspaces
export default defineWorkspace([
  {
    test: {
      root: process.cwd(),
      include: ["src/**/*.test.ts"],
      exclude: ["src/ui/**"],

      name: "backend",
      environment: "node",

      restoreMocks: true,
      setupFiles: ["./vitest.setup.backend.ts"],
    },
  },
  {
    extends: "./vite.config.ts",
    test: {
      root: process.cwd(),
      include: ["src/ui/**/*.test.tsx"],

      name: "ui",
      environment: "happy-dom",
      pool: "vmThreads", // As of Vitest 2, tequired to load `.css` files

      restoreMocks: true,
      setupFiles: ["./vitest.setup.ui.ts"],
    },
  },
]);
