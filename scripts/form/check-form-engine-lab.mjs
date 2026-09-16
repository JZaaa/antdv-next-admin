import { spawn } from 'node:child_process';
import { existsSync } from 'node:fs';
import { mkdir, mkdtemp, readFile, realpath, rm, writeFile } from 'node:fs/promises';
import { cpus, totalmem, tmpdir, platform, arch } from 'node:os';
import { dirname, join, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createServer, preview } from 'vite';

import { verifySchemaFormExample } from './schema-form-example-scenario.mjs';

const root = fileURLToPath(new URL('../../', import.meta.url));
const measurement = {
  startedAt: new Date().toISOString(),
  machine: {
    cpu: cpus()[0]?.model ?? 'unknown',
    logicalCpus: cpus().length,
    memoryGiB: totalmem() / 2 ** 30,
    platform: platform(),
    arch: arch(),
    node: process.version,
  },
};
const development = process.argv.includes('--dev');
const standalone = process.argv.includes('--standalone');
const documentation = process.argv.includes('--documentation');
const example = process.argv.includes('--example') || documentation;
const exampleUser = process.argv.includes('--user') ? 'user' : 'admin';
if (standalone && development)
  throw new Error('Standalone verification uses its production build.');
const engine = process.argv.includes('--schema')
  ? 'schema'
  : process.argv.includes('--performance')
    ? 'performance'
    : process.argv.includes('--tanstack')
      ? 'tanstack'
      : 'native';
// Let the OS choose a free port so checks can run alongside the user's lab server.
const serverPort = 0;
const chrome =
  process.env.FORM_LAB_CHROME ??
  [
    'C:/Program Files/Google/Chrome/Application/chrome.exe',
    'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
    '/usr/bin/google-chrome',
    '/usr/bin/chromium',
    '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  ].find(existsSync);
if (!chrome) throw new Error('找不到 Chrome；请设置 FORM_LAB_CHROME 为浏览器可执行文件路径。');
if (
  !development &&
  !existsSync(
    join(
      root,
      example
        ? 'dist/index.html'
        : standalone
          ? 'dist/schema-form-standalone/index.html'
          : 'dist/form-engine-lab/form-engine-lab.html',
    ),
  )
) {
  throw new Error(
    example
      ? '请先运行 npm run build:demo（需要模拟登录接口）。'
      : standalone
        ? '请先运行 npm run check:form:standalone。'
        : '请先运行 npm run lab:form:build。',
  );
}

const configFile = join(root, 'labs/form-engine/vite.config.ts');
// A fresh checkout does not contain the ignored report directory.
await mkdir(join(root, 'docs/spec'), { recursive: true });
const server = development
  ? await createServer({
      configFile: example ? join(root, 'vite.config.ts') : configFile,
      server: { port: serverPort },
    })
  : await preview(
      standalone || example
        ? {
            configFile: false,
            root,
            build: { outDir: example ? 'dist' : 'dist/schema-form-standalone' },
            preview: { port: serverPort },
          }
        : { configFile, preview: { port: serverPort } },
    );
if (development) await server.listen();
const address = server.httpServer.address();
if (!address || typeof address === 'string') throw new Error('实验服务未取得 TCP 端口');
const profile = await mkdtemp(join(tmpdir(), 'antdv-form-lab-'));
const browser = spawn(
  chrome,
  [
    '--headless',
    '--disable-gpu',
    '--disable-extensions',
    '--disable-background-networking',
    '--no-first-run',
    '--no-default-browser-check',
    '--remote-debugging-port=0',
    '--remote-debugging-address=127.0.0.1',
    '--window-size=1440,1100',
    `--user-data-dir=${profile}`,
    'about:blank',
  ],
  { windowsHide: true, stdio: ['ignore', 'ignore', 'pipe'] },
);
let launchError;
browser.on('error', (error) => {
  launchError = error;
});
let stderr = '';
browser.stderr.on('data', (chunk) => {
  stderr = (stderr + chunk).slice(-4000);
});
let socket;
let activeSession;
const pending = new Map();
let nextId = 0;
const browserErrors = [];
const consoleMessages = [];
const pause = (ms) => new Promise((done) => setTimeout(done, ms));

function send(method, params = {}, sessionId) {
  const id = ++nextId;
  return new Promise((resolveCall, reject) => {
    const timer = setTimeout(() => {
      pending.delete(id);
      reject(new Error(`CDP 超时：${method}\n${stderr}`));
    }, 15000);
    pending.set(id, { resolveCall, reject, timer });
    socket.send(JSON.stringify({ id, method, params, sessionId }));
  });
}

try {
  const start = Date.now();
  const portFile = join(profile, 'DevToolsActivePort');
  while (!existsSync(portFile)) {
    if (launchError) throw launchError;
    if (browser.exitCode !== null || Date.now() - start > 20000) {
      throw new Error(`无头 Chrome 启动失败：${stderr}`);
    }
    await pause(100);
  }
  const [port, endpoint] = (await readFile(portFile, 'utf8')).trim().split(/\r?\n/);
  socket = new WebSocket(`ws://127.0.0.1:${port}${endpoint}`);
  socket.addEventListener('message', (event) => {
    const message = JSON.parse(String(event.data));
    if (message.method === 'Runtime.exceptionThrown')
      browserErrors.push(message.params.exceptionDetails);
    if (message.method === 'Runtime.consoleAPICalled') {
      consoleMessages.push({
        type: message.params.type,
        args: message.params.args.map((arg) => arg.value ?? arg.description),
      });
    }
    const callback = pending.get(message.id);
    if (!callback) return;
    clearTimeout(callback.timer);
    pending.delete(message.id);
    if (message.error) callback.reject(new Error(JSON.stringify(message.error)));
    else callback.resolveCall(message.result);
  });
  await new Promise((done, reject) => {
    socket.addEventListener('open', done, { once: true });
    socket.addEventListener('error', reject, { once: true });
  });
  const version = await send('Browser.getVersion');
  const { targetId } = await send('Target.createTarget', { url: 'about:blank' });
  const { sessionId } = await send('Target.attachToTarget', { targetId, flatten: true });
  activeSession = sessionId;
  await send('Runtime.enable', {}, sessionId);
  await send('Page.enable', {}, sessionId);
  await send(
    'Page.navigate',
    {
      url: example
        ? `http://localhost:${address.port}/examples/schema-form`
        : `http://localhost:${address.port}/?autorun=1&engine=${engine}`,
    },
    sessionId,
  );
  const exampleArtifacts = example
    ? await verifySchemaFormExample(send, sessionId, exampleUser, { documentation, development })
    : undefined;
  const started = Date.now();
  let report;
  while (!report) {
    if (Date.now() - started > 90000) throw new Error('实验页未在 90 秒内完成');
    const { result, exceptionDetails } = await send(
      'Runtime.evaluate',
      {
        expression: `JSON.stringify({ status: document.documentElement?.dataset.labStatus, report: document.getElementById('lab-report')?.textContent, text: document.querySelector('[role="status"]')?.textContent })`,
        returnByValue: true,
      },
      sessionId,
    );
    if (exceptionDetails) throw new Error(JSON.stringify(exceptionDetails));
    const state = JSON.parse(result.value);
    if (state.status === 'error') throw new Error(state.text);
    if (state.status === 'complete' && state.report !== '尚未完成')
      report = JSON.parse(state.report);
    else await pause(200);
  }
  const artifactBase = documentation
    ? `schema-form-documentation-${exampleUser}`
    : example
      ? `schema-form-example-${exampleUser}`
      : standalone
        ? 'schema-form-standalone'
        : engine === 'schema'
          ? 'schema-form'
          : engine === 'performance'
            ? 'schema-form-performance'
            : engine === 'tanstack'
              ? 'form-engine-tanstack'
              : 'form-engine-p0';
  const browserSuffix = /\/100\./.test(version.product) ? '-chromium100' : '';
  const artifactName = `${artifactBase}${development ? '-development' : ''}${browserSuffix}`;
  const artifact = join(root, `docs/spec/${artifactName}-results.json`);
  await mkdir(dirname(artifact), { recursive: true });
  await writeFile(
    artifact,
    `${JSON.stringify({ ...report, measurement, browser: version, browserExecutable: chrome, browserErrors, consoleMessages }, null, 2)}\n`,
  );
  const screenshot = await send(
    'Page.captureScreenshot',
    { format: 'png', captureBeyondViewport: false },
    sessionId,
  );
  await writeFile(
    join(root, `docs/spec/${artifactName}.png`),
    Buffer.from(screenshot.data, 'base64'),
  );
  if (exampleArtifacts)
    await writeFile(
      join(root, `docs/spec/${artifactName}-narrow.png`),
      Buffer.from(exampleArtifacts.mobileScreenshot, 'base64'),
    );
  const counts = Object.fromEntries(
    ['pass', 'gap', 'error'].map((status) => [
      status,
      report.results.filter((item) => item.status === status).length,
    ]),
  );
  console.log(JSON.stringify({ browser: version.product, counts, artifact }, null, 2));
  // This is a capability investigation. Gaps are evidence, while execution errors fail the runner.
  if (
    counts.error ||
    browserErrors.length ||
    consoleMessages.some((message) => message.type === 'error')
  )
    process.exitCode = 1;
  if (process.argv.includes('--require-capabilities') && counts.gap) process.exitCode = 1;
  if ((engine === 'schema' || standalone || example) && counts.gap) process.exitCode = 1;
  if (
    documentation &&
    consoleMessages.some(
      (message) =>
        message.type === 'warning' && /addonAfter.*deprecated/.test(message.args.join(' ')),
    )
  )
    process.exitCode = 1;
  if (
    process.argv.includes('--require-guards') &&
    report.results.some((item) => item.id.startsWith('guarded-') && item.status !== 'pass')
  )
    process.exitCode = 1;
} catch (error) {
  const failureBase = join(
    root,
    `docs/spec/form-browser-failure-${documentation ? 'documentation-' + exampleUser : standalone ? 'standalone' : example ? 'example-' + exampleUser : engine}`,
  );
  await mkdir(dirname(failureBase), { recursive: true });
  await writeFile(
    `${failureBase}.json`,
    JSON.stringify(
      {
        measurement,
        browserExecutable: chrome,
        error: String(error),
        stderr,
        browserErrors,
        consoleMessages,
      },
      null,
      2,
    ),
  );
  if (socket?.readyState === WebSocket.OPEN && activeSession) {
    try {
      const screenshot = await send('Page.captureScreenshot', { format: 'png' }, activeSession);
      await writeFile(`${failureBase}.png`, Buffer.from(screenshot.data, 'base64'));
    } catch {
      /* Preserve the original failure if Chrome is no longer responsive. */
    }
  }
  throw error;
} finally {
  if (socket?.readyState === WebSocket.OPEN) {
    try {
      await send('Browser.close');
    } catch {
      /* Process cleanup below also handles a closed CDP session. */
    }
    socket.close();
  }
  for (const item of pending.values()) clearTimeout(item.timer);
  if (browser.exitCode === null) browser.kill();
  if (development) await server.close();
  else await new Promise((done) => server.httpServer.close(done));
  const resolvedProfile = await realpath(profile);
  const resolvedTemp = await realpath(tmpdir());
  if (resolvedProfile.startsWith(`${resolvedTemp}${sep}`) && resolve(profile) === resolvedProfile) {
    try {
      await rm(resolvedProfile, { recursive: true, force: true, maxRetries: 5, retryDelay: 200 });
    } catch {
      console.warn(`浏览器临时目录未释放：${resolvedProfile}`);
    }
  }
}
