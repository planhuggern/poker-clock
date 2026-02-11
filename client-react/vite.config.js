import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";

// https://vite.dev/config/
function normalizeBasePath(value) {
  if (!value) return "/";
  let base = value.trim();
  if (!base.startsWith("/")) base = `/${base}`;
  if (!base.endsWith("/")) base = `${base}/`;
  return base;
}

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "");
  const base = normalizeBasePath(process.env.VITE_BASE_PATH ?? env.VITE_BASE_PATH);

  return {
    base,
    plugins: [react()],
    server: {
      port: 8081,
      strictPort: true
    }
  };
});