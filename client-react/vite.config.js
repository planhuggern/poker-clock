import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { dirname, resolve } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  base: "./",
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
    environment: 'node',
    include: ['oslo-conquest/tests/unit/**/*.test.js'],
  },
});
