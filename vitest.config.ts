import vue from '@vitejs/plugin-vue';
import { fileURLToPath, URL } from 'node:url';
import { defineConfig } from 'vitest/config';

import { localIconAssetsPlugin } from './build/local-icon-assets';

const vuePlugin = vue();
const transformVue =
  typeof vuePlugin.transform === 'function' ? vuePlugin.transform : vuePlugin.transform?.handler;
if (typeof transformVue === 'function') {
  // Node tests use Vue's custom renderer, so SFCs need client render functions, not SSR output.
  vuePlugin.transform = function (code, id, options) {
    return transformVue.call(this, code, id, {
      ...options,
      moduleType: options?.moduleType ?? 'js',
      ssr: false,
    });
  };
}

export default defineConfig({
  plugins: [localIconAssetsPlugin(), vuePlugin],
  test: {
    environment: 'node',
    globals: false,
    include: ['tests/unit/**/*.spec.ts'],
  },
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
});
