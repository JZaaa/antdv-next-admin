import type { Plugin } from 'vite';

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import pkg from '../package.json' with { type: 'json' };
import { appDefaultSettings } from '../src/settings.ts';
import { createStorageNamespace } from '../src/utils/storageNamespace.ts';

const PLACEHOLDER = '%APP_STORAGE_NAMESPACE%';

export function storageNamespacePlugin(): Plugin {
  let namespace = '';
  let fallbackHtml = '';
  function transform(html: string): string {
    // The value is inserted into an HTML attribute, never JavaScript source.
    function escapeAttribute(value: string): string {
      return value
        .replaceAll('&', '&amp;')
        .replaceAll('"', '&quot;')
        .replaceAll('<', '&lt;')
        .replaceAll('>', '&gt;');
    }
    return html.replaceAll(PLACEHOLDER, escapeAttribute(namespace)).replaceAll(
      '%APP_PREFERENCE_DEFAULTS%',
      escapeAttribute(
        JSON.stringify({
          personalization: appDefaultSettings.features.personalization,
          locale: appDefaultSettings.preferences.locale,
          theme: appDefaultSettings.preferences.themeMode,
        }),
      ),
    );
  }
  return {
    name: 'app-storage-namespace',
    configResolved(config) {
      namespace = createStorageNamespace({
        project: config.env.VITE_APP_NAMESPACE || pkg.name,
        mode: config.mode,
        appVersion: pkg.version,
        cacheVersion: config.env.VITE_APP_CACHE_VERSION || '1',
      });
      fallbackHtml = readFileSync(resolve(config.publicDir, '404.html'), 'utf8');
    },
    transformIndexHtml: { order: 'pre', handler: transform },
    configureServer(server) {
      server.middlewares.use((request, response, next) => {
        if (request.url?.split('?')[0] !== '/404.html') return next();
        response.setHeader('Content-Type', 'text/html; charset=utf-8');
        response.end(transform(fallbackHtml));
      });
    },
    generateBundle() {
      // Public HTML bypasses Vite's HTML transforms; emit the same resolved namespace.
      this.emitFile({ type: 'asset', fileName: '404.html', source: transform(fallbackHtml) });
    },
  };
}
