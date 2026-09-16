import type { ViteDevServer } from 'vite';

import vue from '@vitejs/plugin-vue';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vite';

const root = fileURLToPath(new URL('../../', import.meta.url));
const versions = Object.fromEntries(
  ['vue', 'antdv-next', '@tanstack/vue-form', 'zod', 'zod-defaults'].map((name) => [
    name,
    JSON.parse(
      readFileSync(new URL(`../../node_modules/${name}/package.json`, import.meta.url), 'utf8'),
    ).version,
  ]),
);

function redirectLabEntry(server: Pick<ViteDevServer, 'middlewares'>): void {
  server.middlewares.use((request, response, next) => {
    const url = new URL(request.url ?? '/', 'http://localhost');
    if (url.pathname !== '/' && url.pathname !== '/index.html') {
      next();
      return;
    }
    response.writeHead(302, { Location: `/form-engine-lab.html${url.search}` });
    response.end();
  });
}

// Separate entry: the application build and authenticated routes do not include this lab.
export default defineConfig({
  root,
  appType: 'mpa',
  plugins: [
    vue(),
    {
      name: 'form-engine-lab-entry',
      configureServer: redirectLabEntry,
      configurePreviewServer: redirectLabEntry,
    },
  ],
  resolve: { alias: { '@': fileURLToPath(new URL('../../src', import.meta.url)) } },
  optimizeDeps: { entries: ['form-engine-lab.html'] },
  define: { FORM_LAB_VERSIONS: JSON.stringify(versions) },
  server: { port: 3101, strictPort: true, open: false },
  preview: { port: 3101, strictPort: true },
  build: {
    target: 'chrome100',
    cssTarget: 'chrome100',
    outDir: 'dist/form-engine-lab',
    rollupOptions: { input: fileURLToPath(new URL('../../form-engine-lab.html', import.meta.url)) },
  },
});
