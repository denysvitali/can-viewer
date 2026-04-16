import { defineConfig, loadEnv } from "vite";

// BASE env var lets GitHub Pages builds pass `/can-viewer/` while
// local dev stays at `/`.
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, ".", "");
  return {
    base: env.BASE ?? "/",
    build: {
      outDir: "dist",
      sourcemap: true,
      target: "es2022",
    },
  };
});
