import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { dirname, resolve } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));

const shared = resolve(__dirname, "shared");

export default defineConfig({
  base: "./",
  resolve: {
    alias: { "@shared": shared },
  },
  plugins: [
    react(),
    tailwindcss(),
  ],
  server: {
    port: 8081,
    strictPort: true,
    watch: {
      usePolling: true,
    },
  },
  build: {
    outDir: resolve(__dirname, "../server/public"),
    emptyOutDir: false,
    rollupOptions: {
      input: {
        "portal": resolve(__dirname, "index.html"),
        "poker-clock": resolve(__dirname, "poker-clock/index.html"),
        "oslo-conquest": resolve(__dirname, "oslo-conquest/index.html"),
        "trading": resolve(__dirname, "trading/index.html"),
      },
    },
  },
  test: {
    globals: true,
    environment: 'node',
    include: [
      'oslo-conquest/tests/unit/**/*.test.{js,ts}',
      'poker-clock/tests/**/*.test.{js,ts,tsx}',
    ],
    setupFiles: ['./poker-clock/tests/setup.ts'],
  },
});
