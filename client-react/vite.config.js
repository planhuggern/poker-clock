import { defineConfig } from "vite";
import preact from "@preact/preset-vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { resolve } from "path";

const osloConquestJsx = /oslo-conquest[\\/].*\.jsx$/;

export default defineConfig({
  base: "/",
  plugins: [
    react({ exclude: osloConquestJsx }),
    ...preact({
      include: osloConquestJsx,
      reactAliasesEnabled: false,
    }),
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
        "poker-clock": resolve(__dirname, "index.html"),
        "oslo-conquest": resolve(__dirname, "oslo-conquest/index.html"),
      },
    },
  },
  test: {
    environment: 'node',
    include: ['oslo-conquest/__tests__/**/*.test.js'],
  },
});
