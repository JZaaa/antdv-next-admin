import { spawn } from 'node:child_process';
import { existsSync } from 'node:fs';
import { mkdir, mkdtemp, readFile, realpath, rm, writeFile } from 'node:fs/promises';
import { tmpdir, cpus, totalmem, platform, arch } from 'node:os';
import { join, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createServer, preview } from 'vite';

import { verifyExample } from './example-scenario.mjs';

const root = fileURLToPath(new URL('../../', import.meta.url));
const dev = process.argv.includes('--dev');
const standaloneForm = process.argv.includes('--standalone-form');
const standalone = process.argv.includes('--standalone') || standaloneForm;
const reference = process.argv.includes('--reference');
const controls = process.argv.includes('--performance-controls');
const performance = process.argv.includes('--performance') || controls;
const example = process.argv.includes('--example');
const username = process.argv.includes('--user') ? 'user' : 'admin';
const chrome = process.env.TABLE_LAB_CHROME ?? 'E:/chrome-history/chrome-100/chrome.exe';
const pause = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const server = dev
  ? await createServer({ configFile: join(root, 'labs/table/vite.config.ts'), server: { port: 0 } })
  : await preview({
      configFile: false,
      root,
      build: {
        outDir: example
          ? 'dist'
          : reference || performance
            ? 'node_modules/.cache/table-reference'
            : standalone
              ? standaloneForm
                ? 'dist/table-standalone-form'
                : 'dist/table-standalone'
              : 'dist/table-lab',
      },
      preview: { port: 0 },
    });
if (dev) await server.listen();
const port = server.httpServer.address().port;
const profile = await mkdtemp(join(tmpdir(), 'vxe-table-lab-'));
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
    '--window-size=1440,1100',
    `--user-data-dir=${profile}`,
    'about:blank',
  ],
  { windowsHide: true, stdio: ['ignore', 'ignore', 'pipe'] },
);
let stderr = '',
  launchError,
  socket,
  session,
  nextId = 0;
const pending = new Map(),
  exceptions = [],
  messages = [];
browser.stderr.on('data', (data) => {
  stderr = (stderr + data).slice(-6000);
});
browser.on('error', (error) => {
  launchError = error;
});
function send(method, params = {}, sessionId) {
  return new Promise((resolve, reject) => {
    const id = ++nextId;
    const timer = setTimeout(() => {
      pending.delete(id);
      reject(new Error(`CDP timeout ${method}`));
    }, 20000);
    pending.set(id, { resolve, reject, timer });
    socket.send(JSON.stringify({ id, method, params, sessionId }));
  });
}
const artifact = join(
  root,
  `docs/spec/vxe-table-${example ? 'example-' + username : controls ? 'performance-controls' : performance ? 'performance' : reference ? 'reference' : standaloneForm ? 'standalone-form' : standalone ? 'standalone' : dev ? 'development' : 'production'}`,
);
await mkdir(join(root, 'docs/spec'), { recursive: true });
try {
  const start = Date.now();
  while (!existsSync(join(profile, 'DevToolsActivePort'))) {
    if (launchError || browser.exitCode !== null || Date.now() - start > 20000)
      throw new Error(`Chrome launch failed: ${launchError ?? stderr}`);
    await pause(100);
  }
  const [debugPort, endpoint] = (await readFile(join(profile, 'DevToolsActivePort'), 'utf8'))
    .trim()
    .split(/\r?\n/);
  socket = new WebSocket(`ws://127.0.0.1:${debugPort}${endpoint}`);
  socket.addEventListener('message', (event) => {
    const message = JSON.parse(String(event.data));
    if (message.method === 'Runtime.exceptionThrown')
      exceptions.push(message.params.exceptionDetails);
    if (message.method === 'Runtime.consoleAPICalled')
      messages.push({
        type: message.params.type,
        text: message.params.args.map((arg) => arg.value ?? arg.description).join(' '),
      });
    const call = pending.get(message.id);
    if (!call) return;
    clearTimeout(call.timer);
    pending.delete(message.id);
    if (message.error) call.reject(new Error(JSON.stringify(message.error)));
    else call.resolve(message.result);
  });
  await new Promise((resolve, reject) => {
    socket.addEventListener('open', resolve, { once: true });
    socket.addEventListener('error', reject, { once: true });
  });
  const version = await send('Browser.getVersion');
  const { targetId } = await send('Target.createTarget', { url: 'about:blank' });
  session = (await send('Target.attachToTarget', { targetId, flatten: true })).sessionId;
  await send('Runtime.enable', {}, session);
  await send('Page.enable', {}, session);
  await send(
    'Page.navigate',
    {
      url: `http://localhost:${port}/${example ? 'examples/vxe-table' : reference || performance ? `labs/table/reference.html${performance ? '?performance=' + (controls ? 'controls' : '1') : ''}` : standalone ? 'index.html' : 'table-lab.html'}`,
    },
    session,
  );
  let report;
  if (example) {
    const result = await verifyExample(send, session, username);
    report = { results: result.results };
    await writeFile(`${artifact}-narrow.png`, Buffer.from(result.screenshot, 'base64'));
  }
  const began = Date.now();
  while (!report) {
    const { result } = await send(
      'Runtime.evaluate',
      {
        expression: `JSON.stringify({status:document.documentElement.dataset.labStatus,report:document.querySelector('#lab-report')?.textContent})`,
        returnByValue: true,
      },
      session,
    );
    const value = JSON.parse(result.value ?? '{}');
    if (value.status === 'error') throw new Error(value.report);
    if (value.status === 'complete') report = JSON.parse(value.report);
    if (Date.now() - began > 90000)
      throw new Error(`Lab timeout: ${JSON.stringify(messages.slice(-10))}`);
    if (!report) await pause(200);
  }
  await writeFile(
    `${artifact}.json`,
    JSON.stringify(
      {
        ...report,
        measuredAt: new Date().toISOString(),
        machine: {
          cpu: cpus()[0]?.model,
          logicalCpus: cpus().length,
          memoryGiB: totalmem() / 2 ** 30,
          platform: platform(),
          arch: arch(),
          node: process.version,
        },
        browser: version,
        exceptions,
        messages,
      },
      null,
      2,
    ),
  );
  await writeFile(
    `${artifact}.png`,
    Buffer.from((await send('Page.captureScreenshot', { format: 'png' }, session)).data, 'base64'),
  );
  const failures = report.results.filter((result) => result.status !== 'pass');
  console.log(
    JSON.stringify(
      {
        browser: version.product,
        passed: report.results.length - failures.length,
        failures,
        exceptions,
        errors: messages.filter((item) => item.type === 'error'),
        artifact,
      },
      null,
      2,
    ),
  );
  if (failures.length || exceptions.length || messages.some((item) => item.type === 'error'))
    process.exitCode = 1;
} catch (error) {
  await writeFile(
    `${artifact}-failure.json`,
    JSON.stringify({ error: String(error), stderr, exceptions, messages }, null, 2),
  );
  if (socket?.readyState === WebSocket.OPEN && session) {
    try {
      await writeFile(
        `${artifact}-failure.png`,
        Buffer.from(
          (await send('Page.captureScreenshot', { format: 'png' }, session)).data,
          'base64',
        ),
      );
      const { result } = await send(
        'Runtime.evaluate',
        { expression: 'document.body.innerText', returnByValue: true },
        session,
      );
      await writeFile(`${artifact}-failure.txt`, result.value ?? '');
      const elements = await send(
        'Runtime.evaluate',
        {
          expression: `JSON.stringify(Array.from(document.querySelectorAll('[data-table-demo="edit"] input,[data-table-demo="edit"] [class*=select]')).map(e=>({tag:e.tagName,cls:e.className,role:e.getAttribute('role'),parent:e.parentElement.className})))`,
          returnByValue: true,
        },
        session,
      );
      await writeFile(`${artifact}-elements.json`, elements.result.value ?? '[]');
    } catch {}
  }
  throw error;
} finally {
  if (socket?.readyState === WebSocket.OPEN) {
    try {
      await send('Browser.close');
    } catch {}
    socket.close();
  }
  pending.forEach((call) => clearTimeout(call.timer));
  if (browser.exitCode === null) browser.kill();
  if (dev) await server.close();
  else await new Promise((resolve) => server.httpServer.close(resolve));
  const target = await realpath(profile),
    temp = await realpath(tmpdir());
  if (!target.startsWith(`${temp}${sep}`) || !target.includes('vxe-table-lab-'))
    throw new Error('Unexpected cleanup path');
  try {
    await rm(target, { recursive: true, force: true, maxRetries: 5, retryDelay: 200 });
  } catch {
    console.warn(`Browser profile still locked: ${target}`);
  }
}
