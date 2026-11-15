import { defineConfig } from "tsup";

export default defineConfig({
  entry: {
    main: "desktop/main.ts",
    preload: "desktop/preload.ts"
  },
  format: ["cjs"],
  platform: "node",
  outDir: "dist-desktop",
  clean: true,
  sourcemap: true,
  splitting: false,
  external: ["electron", "better-sqlite3"],
  outExtension: () => ({ js: ".cjs" })
});
