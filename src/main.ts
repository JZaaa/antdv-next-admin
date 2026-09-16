import { createPinia } from 'pinia';
import { createApp, nextTick } from 'vue';

import App from './App.vue';
import { registerDefaultComponentProps } from './components/Global/defaultComponentProps';
import { setupDirectives } from './directives';
import i18n, { i18nReady } from './locales';
import router from './router';
import { useMenuPreferencesStore } from './stores/menuPreferences';
import { appSessionStorage } from './utils/cache';
import { service } from './utils/request';
// Import global styles
// This entry declares cascade order and imports the Antd reset in its own layer.
import './assets/styles/tailwind.css';
import './assets/styles/variables.css';
import './assets/styles/animations.css';
import './assets/styles/global.css';

function restoreGitHubPagesRedirect() {
  const redirect = appSessionStorage.getItem('redirect');
  if (!redirect) return;

  appSessionStorage.removeItem('redirect');

  const redirectUrl = new URL(redirect);
  if (redirectUrl.origin !== window.location.origin) return;
  const target = `${redirectUrl.pathname}${redirectUrl.search}${redirectUrl.hash}`;
  const current = `${window.location.pathname}${window.location.search}${window.location.hash}`;

  if (target !== current) {
    window.history.replaceState(null, '', target);
  }
}

async function bootstrap() {
  // Router installation starts navigation and translates titles immediately.
  await i18nReady;

  if (import.meta.env.VITE_DEMO_MODE === 'true') {
    const { setupBrowserMock } = await import('./mock/browser');
    setupBrowserMock(service);
  }

  restoreGitHubPagesRedirect();

  const app = createApp(App);
  const pinia = createPinia();

  // Register plugins
  app.use(pinia);
  // Capture and migrate legacy tab favorites before router guards can rewrite tab state.
  useMenuPreferencesStore(pinia);
  app.use(router);
  app.use(i18n);
  registerDefaultComponentProps(app);

  // Register custom directives
  setupDirectives(app);

  // Keep the HTML loading screen visible until the initial route chunk is ready.
  await router.isReady();
  app.mount('#app');
  await nextTick();
  window.dispatchEvent(new Event('app:ready'));
}

void bootstrap().catch((error: unknown) => {
  console.error('Failed to start application:', error);
  window.dispatchEvent(new Event('app:bootstrap-error'));
});
