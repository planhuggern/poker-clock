import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { resolve } from "path";

export default defineConfig({
  base: "/",
  plugins: [react(), tailwindcss()],
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
        "poker-clock": resolve(__dirname, "index.html"),
        "oslo-conquest": resolve(__dirname, "oslo-conquest/index.html"),
      },
    },
  },
});
