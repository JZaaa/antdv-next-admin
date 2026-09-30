import { existsSync, readFileSync, statSync, mkdirSync, writeFileSync } from 'node:fs';
import { createServer } from 'node:http';
import { createRequire } from 'node:module';
import { resolve, extname, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

import { verifySchemaFormExample } from '../form/schema-form-example-scenario.mjs';
import { verifyExample } from '../table/example-scenario.mjs';

// Playwright is a test-only dependency supplied by the caller, never bundled in the app.
const require = createRequire(
  process.env.PLAYWRIGHT_PACKAGE || new URL('../../package.json', import.meta.url),
);
const { chromium } = require('playwright');
const root = fileURLToPath(new URL('../../', import.meta.url));
const dist = resolve(root, process.env.SYNC_DIST || '.tmp/performance-sync-demo');
const output = resolve(root, 'docs/spec/framework-performance-sync');
const chrome = process.env.SYNC_CHROME || 'C:/Program Files/Google/Chrome/Application/chrome.exe';
mkdirSync(output, { recursive: true });
const mime = {
  '.js': 'text/javascript',
  '.css': 'text/css',
  '.html': 'text/html',
  '.json': 'application/json',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
};
const server = createServer((request, response) => {
  const pathname = decodeURIComponent(new URL(request.url, 'http://localhost').pathname);
  let file = resolve(dist, '.' + pathname);
  if (file !== dist && !file.startsWith(dist + sep)) {
    response.writeHead(403).end();
    return;
  }
  if (!existsSync(file) || statSync(file).isDirectory()) {
    if (extname(pathname)) {
      response.writeHead(404).end();
      return;
    }
    file = resolve(dist, 'index.html');
  }
  response.setHeader('Content-Type', mime[extname(file)] || 'application/octet-stream');
  response.end(readFileSync(file));
});
await new Promise((done) => server.listen(0, '127.0.0.1', done));
const base = `http://127.0.0.1:${server.address().port}`;
const browser = await chromium.launch({ executablePath: chrome, headless: true });
const report = {
  browser: browser.version(),
  dist,
  mode: 'demo-production-normal-auth',
  results: [],
  errors: [],
};
const label = `chrome${browser.version().split('.')[0]}`;
const assert = (condition, message) => {
  if (!condition) throw Error(message);
};
let page;
async function store(id, method, args = []) {
  return page.evaluate(
    ({ id, method, args }) => {
      const pinia = document.querySelector('#app').__vue_app__.config.globalProperties.$pinia;
      const value = pinia._s.get(id);
      if (!value) throw Error(`Missing mounted store ${id}`);
      return value[method](...args);
    },
    { id, method, args },
  );
}
async function navigate(path) {
  await page.evaluate(
    (path) => document.querySelector('#app').__vue_app__.config.globalProperties.$router.push(path),
    path,
  );
}
try {
  for (const username of ['admin', 'user']) {
    for (const kind of ['table', 'form']) {
      const context = await browser.newContext({ viewport: { width: 1440, height: 1100 } });
      page = await context.newPage();
      page.on('pageerror', (error) =>
        report.errors.push({ username, kind, message: error.message }),
      );
      page.on('console', (message) => {
        if (message.type() === 'error')
          report.errors.push({ username, kind, message: message.text() });
      });
      const cdp = await context.newCDPSession(page);
      const send = (method, params = {}) => cdp.send(method, params);
      await page.goto(`${base}/examples/${kind === 'table' ? 'vxe-table' : 'schema-form'}`);
      if (kind === 'table') {
        const result = await verifyExample(send, undefined, username);
        report.results.push(...result.results.map((item) => ({ ...item, username })));
        writeFileSync(
          resolve(output, `${label}-${username}-table-narrow.png`),
          Buffer.from(result.screenshot, 'base64'),
        );
      } else {
        const result = await verifySchemaFormExample(send, undefined, username, {
          documentation: true,
        });
        const data = JSON.parse(await page.locator('#lab-report').textContent());
        report.results.push(...data.results.map((item) => ({ ...item, username })));
        writeFileSync(
          resolve(output, `${label}-${username}-form-narrow.png`),
          Buffer.from(result.mobileScreenshot, 'base64'),
        );
      }
      assert(!report.results.some((item) => item.status !== 'pass'), 'An example scenario failed');
      console.log(`${label} ${username} ${kind} example passed`);
      await context.close();
    }
  }
  const context = await browser.newContext({
    viewport: { width: 1440, height: 1100 },
    colorScheme: 'dark',
  });
  page = await context.newPage();
  page.on('pageerror', (error) => report.errors.push({ kind: 'shell', message: error.message }));
  await page.addInitScript(() => {
    window.__syncAnimations = [];
    const animate = Element.prototype.animate;
    Element.prototype.animate = function (frames, options) {
      window.__syncAnimations.push({ frames, duration: options?.duration });
      return animate.call(this, frames, options);
    };
  });
  await page.goto(`${base}/examples/schema-form`);
  await page.locator('input[autocomplete=username]').fill('admin');
  await page.locator('input[autocomplete=current-password]').fill('123456');
  const handle = await page.locator('.slider-handle').boundingBox();
  const track = await page.locator('.slider-bg').boundingBox();
  await page.mouse.move(handle.x + handle.width / 2, handle.y + handle.height / 2);
  await page.mouse.down();
  await page.mouse.move(track.x + track.width, handle.y + handle.height / 2, { steps: 8 });
  await page.mouse.up();
  await page.locator('.login-form button[type=submit]').click();
  await page.locator('.form-documentation').waitFor();
  assert(
    await page.locator('html').evaluate((el) => el.classList.contains('dark')),
    'System dark preference lost',
  );
  await page.emulateMedia({ colorScheme: 'light' });
  await page.waitForFunction(() => !document.documentElement.classList.contains('dark'));
  report.results.push({ id: 'system-theme-startup-and-live-change', status: 'pass' });
  await page.locator('[data-demo-run=integration]').click();
  await page.locator('.schema-form-example').waitFor();
  await page.evaluate(() => {
    window.__syncElement = document.querySelector('.schema-form-example');
  });
  assert((await page.locator('.global-watermark').count()) === 0, 'Disabled watermark mounted');
  await store('watermark', 'setEnabled', [true]);
  await page.waitForFunction(() =>
    [...document.querySelectorAll('.global-watermark div')].some((el) =>
      getComputedStyle(el).backgroundImage.startsWith('url('),
    ),
  );
  const watermark = await page.locator('.global-watermark').evaluate((el) => ({
    width: el.getBoundingClientRect().width,
    height: el.getBoundingClientRect().height,
    pointer: getComputedStyle(el).pointerEvents,
  }));
  assert(
    watermark.width === 1440 && watermark.height === 1100 && watermark.pointer === 'none',
    'Watermark viewport coverage incorrect',
  );
  await store('watermark', 'setEnabled', [false]);
  assert(
    await page.evaluate(
      () => window.__syncElement === document.querySelector('.schema-form-example'),
    ),
    'Watermark toggle remounted page',
  );
  report.results.push({ id: 'watermark-conditional-viewport-preserves-page', status: 'pass' });
  await store('layout', 'setAiCollabEnabled', [true]);
  await page.locator('.page-workspace-ai').waitFor();
  await page.waitForTimeout(300);
  const width = await page
    .locator('.page-workspace-ai')
    .evaluate((el) => el.getBoundingClientRect().width);
  const resizer = await page.locator('.page-workspace-resizer').boundingBox();
  await page.mouse.move(resizer.x + resizer.width / 2, resizer.y + 60);
  await page.mouse.down();
  await page.mouse.move(resizer.x - 45, resizer.y + 60, { steps: 6 });
  await page.mouse.up();
  const resized = await page
    .locator('.page-workspace-ai')
    .evaluate((el) => el.getBoundingClientRect().width);
  assert(resized > width && resized <= 560, 'AI drag resize failed');
  await page.setViewportSize({ width: 700, height: 850 });
  await page.locator('.page-workspace-ai').waitFor({ state: 'hidden' });
  await page.setViewportSize({ width: 1440, height: 1100 });
  await store('layout', 'setAiCollabEnabled', [false]);
  report.results.push({ id: 'ai-panel-resize-and-mobile', status: 'pass' });
  for (const mode of ['horizontal', 'vertical', 'horizontal']) {
    await store('settings', 'setLayoutMode', [mode]);
    await page.locator(`.admin-layout.${mode}`).waitFor();
    await page.setViewportSize({ width: 920, height: 850 });
    await page.waitForTimeout(350);
    if (mode === 'horizontal')
      assert(
        await page
          .locator('.horizontal-menu-area')
          .evaluate((el) => el.scrollWidth <= el.clientWidth + 2),
        'Horizontal menu overflow',
      );
    await page.setViewportSize({ width: 1440, height: 1100 });
  }
  await page.screenshot({ path: resolve(output, `${label}-horizontal.png`) });
  report.results.push({ id: 'layout-switch-observer-reconnect', status: 'pass' });
  const animations = [
    'none',
    'fade',
    'slide-left',
    'slide-right',
    'slide-up',
    'slide-down',
    'zoom',
    'zoom-big',
  ];
  for (const name of animations) {
    await store('settings', 'setPageAnimation', [name]);
    await page.evaluate(() => {
      window.__syncAnimations = [];
    });
    await navigate('/examples/vxe-table');
    await page.locator('.vxe-documentation').waitFor();
    const observed = await page.evaluate(() =>
      window.__syncAnimations.filter((item) => item.duration === 200),
    );
    assert(
      name === 'none' ? observed.length === 0 : observed.length > 0,
      `Animation ${name} not respected`,
    );
    await navigate('/examples/schema-form');
    await page.locator('.form-documentation').waitFor();
    report.results.push({ id: `page-animation-${name}`, status: 'pass' });
  }
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await store('settings', 'setPageAnimation', ['slide-left']);
  await page.evaluate(() => {
    window.__syncAnimations = [];
  });
  await navigate('/examples/vxe-table');
  await page.locator('.vxe-documentation').waitFor();
  assert(
    await page.evaluate(() => !window.__syncAnimations.some((item) => item.duration === 200)),
    'Reduced motion ignored',
  );
  report.results.push({ id: 'reduced-motion', status: 'pass' });
  await page.evaluate(() => {
    document
      .querySelector('#app')
      .__vue_app__.config.globalProperties.$pinia._s.get('auth').sessionChanged = true;
  });
  await page.getByRole('dialog').waitFor();
  assert(
    (await page.getByRole('dialog').innerText()).includes('刷新'),
    'Session recovery action missing',
  );
  report.results.push({ id: 'session-dialog-lazy-mount', status: 'pass' });
  assert(!report.errors.length, JSON.stringify(report.errors));
  report.success = true;
  console.log(
    JSON.stringify({ browser: report.browser, passed: report.results.length, success: true }),
  );
} catch (error) {
  report.success = false;
  report.failure = String(error);
  if (page && !page.isClosed()) {
    report.body = (await page.locator('body').innerText()).slice(-3000);
    await page.screenshot({ path: resolve(output, `${label}-failure.png`) });
  }
  console.error(error);
  process.exitCode = 1;
} finally {
  writeFileSync(resolve(output, `${label}.json`), JSON.stringify(report, null, 2));
  await browser.close();
  await new Promise((done) => server.close(done));
}
