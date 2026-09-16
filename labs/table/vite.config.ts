import vue from '@vitejs/plugin-vue';
import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vite';
export default defineConfig({
  root: fileURLToPath(new URL('../../', import.meta.url)),
  plugins: [vue()],
  resolve: { alias: { '@': fileURLToPath(new URL('../../src', import.meta.url)) } },
  css: { postcss: { plugins: [] } },
  build: {
    target: 'chrome100',
    cssTarget: 'chrome100',
    outDir: 'dist/table-lab',
    rollupOptions: { input: fileURLToPath(new URL('../../table-lab.html', import.meta.url)) },
  },
});
