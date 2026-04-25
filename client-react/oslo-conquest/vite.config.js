import { defineConfig } from 'vite';
import { resolve } from 'path';

export default defineConfig({
  root: resolve(__dirname),
  base: '/oslo-conquest/',
  build: {
    outDir: resolve(__dirname, '../../server/public/oslo-conquest'),
    emptyOutDir: true,
  },
});
