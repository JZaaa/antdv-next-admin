import vue from '@vitejs/plugin-vue';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vite';
const root = fileURLToPath(new URL('../../', import.meta.url));
const reference = process.env.VBEN_SOURCE ?? resolve(root, '../vue-vben-admin');
export default defineConfig({
  root,
  plugins: [vue()],
  css: { postcss: { plugins: [] } },
  resolve: {
    alias: [
      { find: '@', replacement: resolve(root, 'src') },
      {
        find: 'reference-grid',
        replacement: resolve(reference, 'packages/effects/plugins/src/vxe-table/index.ts'),
      },
      {
        find: 'reference-form',
        replacement: resolve(reference, 'packages/@core/ui-kit/form-ui/src/index.ts'),
      },
      {
        find: /^vue$/,
        replacement: resolve(root, 'node_modules/vue/dist/vue.runtime.esm-bundler.js'),
      },
      { find: 'vxe-table', replacement: resolve(root, 'node_modules/vxe-table') },
      { find: 'vxe-pc-ui', replacement: resolve(root, 'node_modules/vxe-pc-ui') },
      { find: '@vxe-ui/core', replacement: resolve(root, 'node_modules/@vxe-ui/core') },
    ],
    dedupe: ['vue', 'vxe-table', 'vxe-pc-ui', '@vxe-ui/core'],
  },
  build: {
    target: 'chrome100',
    cssTarget: 'chrome100',
    outDir: 'node_modules/.cache/table-reference',
    emptyOutDir: true,
    rollupOptions: { input: resolve(root, 'labs/table/reference.html') },
  },
});
