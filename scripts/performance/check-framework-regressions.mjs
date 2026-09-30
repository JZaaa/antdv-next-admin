import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { mkdir, mkdtemp, realpath, rm, writeFile } from 'node:fs/promises';
import { resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { build, preview } from 'vite';

// Standalone production fixture; no app routes, credentials or Playwright dependency.
const root = fileURLToPath(new URL('../../', import.meta.url));
const fixture = resolve(root, 'scripts/performance/fixtures/regressions');
const work = resolve(root, '.tmp/framework-regressions');
const output = resolve(root, 'docs/spec/framework-performance-sync');
const chrome = process.env.SYNC_CHROME || 'C:/Program Files/Google/Chrome/Application/chrome.exe';
const pause = (ms) => new Promise((done) => setTimeout(done, ms));
await mkdir(work, { recursive: true });
await mkdir(output, { recursive: true });
if (!process.argv.includes('--skip-build')) {
  await build({
    configFile: false,
    root: fixture,
    logLevel: 'error',
    build: {
      target: 'chrome100',
      cssTarget: 'chrome100',
      outDir: resolve(work, 'dist'),
      emptyOutDir: true,
    },
  });
}
const server = await preview({
  configFile: false,
  root: fixture,
  logLevel: 'error',
  build: { outDir: resolve(work, 'dist') },
  preview: { host: '127.0.0.1', port: 0 },
});
const profile = await mkdtemp(resolve(work, 'profile-'));
const browser = spawn(
  chrome,
  [
    '--headless',
    '--disable-gpu',
    '--no-first-run',
    '--no-default-browser-check',
    '--disable-background-networking',
    '--remote-debugging-port=0',
    '--remote-debugging-address=127.0.0.1',
    '--window-size=1440,900',
    `--user-data-dir=${profile}`,
    'about:blank',
  ],
  { windowsHide: true, stdio: ['ignore', 'ignore', 'pipe'] },
);
let stderr = '',
  launchError,
  socket,
  nextId = 0;
const pending = new Map();
const errors = [];
browser.stderr.on('data', (data) => {
  stderr = (stderr + data).slice(-6000);
});
browser.on('error', (error) => {
  launchError = error;
});
const browserExited = new Promise((done) => browser.once('exit', done));
function send(method, params = {}, sessionId) {
  return new Promise((resolveRequest, reject) => {
    const id = ++nextId;
    const timer = setTimeout(() => {
      pending.delete(id);
      reject(new Error(`CDP timeout: ${method}`));
    }, 20000);
    pending.set(id, { resolve: resolveRequest, reject, timer });
    socket.send(JSON.stringify({ id, method, params, sessionId }));
  });
}
try {
  for (let attempt = 0; attempt < 100 && !stderr.includes('DevTools listening on'); attempt++) {
    if (launchError) throw launchError;
    if (browser.exitCode !== null) throw new Error(stderr);
    await pause(100);
  }
  const endpoint = stderr.match(/DevTools listening on (ws:\/\/[^\s]+)/)?.[1];
  assert(endpoint, stderr || 'Chrome did not expose a debugging endpoint');
  socket = new WebSocket(endpoint);
  await new Promise((done, reject) => {
    socket.addEventListener('open', done, { once: true });
    socket.addEventListener('error', reject, { once: true });
  });
  socket.addEventListener('message', (event) => {
    const message = JSON.parse(event.data);
    const task = pending.get(message.id);
    if (task) {
      pending.delete(message.id);
      clearTimeout(task.timer);
      if (message.error) task.reject(new Error(JSON.stringify(message.error)));
      else task.resolve(message.result);
    }
    if (message.method === 'Runtime.exceptionThrown') errors.push(message.params.exceptionDetails);
  });
  const version = await send('Browser.getVersion');
  const label = version.product.replace(/[^a-z0-9.-]/gi, '-');
  const { targetId } = await send('Target.createTarget', { url: 'about:blank' });
  const { sessionId } = await send('Target.attachToTarget', { targetId, flatten: true });
  await send('Runtime.enable', {}, sessionId);
  await send(
    'Page.navigate',
    { url: `http://127.0.0.1:${server.httpServer.address().port}/` },
    sessionId,
  );
  let ready = false;
  for (let attempt = 0; attempt < 100; attempt++) {
    const result = await send(
      'Runtime.evaluate',
      { expression: 'typeof window.runRegressions', returnByValue: true },
      sessionId,
    );
    if (result.result.value === 'function') {
      ready = true;
      break;
    }
    await pause(100);
  }
  assert(ready, `Fixture failed to mount: ${JSON.stringify(errors)}`);
  const result = await send(
    'Runtime.evaluate',
    {
      expression: 'window.runRegressions()',
      awaitPromise: true,
      returnByValue: true,
    },
    sessionId,
  );
  const report = { browser: version.product, ...result, errors };
  await writeFile(resolve(output, `regressions-${label}.json`), JSON.stringify(report, null, 2));
  assert(!result.exceptionDetails, JSON.stringify(result.exceptionDetails));
  assert.equal(errors.length, 0, JSON.stringify(errors));
  assert.equal(result.result.value?.success, true);
  console.log(JSON.stringify({ browser: version.product, ...result.result.value }, null, 2));
} finally {
  socket?.close();
  pending.forEach((task) => clearTimeout(task.timer));
  browser.kill();
  await Promise.race([browserExited, pause(3000)]);
  await server.close();
  const actualWork = await realpath(work);
  const actualProfile = await realpath(profile);
  assert(
    actualProfile.startsWith(actualWork + sep),
    'Refusing to clean a profile outside the test directory',
  );
  await rm(actualProfile, { recursive: true, force: true, maxRetries: 5, retryDelay: 200 });
}
