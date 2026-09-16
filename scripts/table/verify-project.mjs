import { spawnSync } from 'node:child_process';
import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../../', import.meta.url));
await mkdir(join(root, 'docs/spec'), { recursive: true });
const results = [];
const checks = [
  ['type-check'],
  ['lint'],
  ['test:unit:run', '--', '--maxWorkers=1'],
  ['build'],
  ['check:compat:dist'],
  ['build:demo'],
  ['check:compat:dist'],
  ['lab:table:build'],
  ['check:table:standalone'],
];
for (const [script, ...args] of checks) {
  const started = Date.now();
  const result = spawnSync(
    process.platform === 'win32' ? 'npm.cmd' : 'npm',
    ['run', script, ...args],
    {
      cwd: root,
      shell: process.platform === 'win32',
      windowsHide: true,
      encoding: 'utf8',
      maxBuffer: 20 * 1024 * 1024,
    },
  );
  const log = `vxe-table-check-${results.length + 1}-${script.replaceAll(':', '-')}.log`;
  await writeFile(join(root, 'docs/spec', log), (result.stdout ?? '') + (result.stderr ?? ''));
  results.push({
    command: `npm run ${script} ${args.join(' ')}`.trim(),
    exitCode: result.status,
    elapsedMs: Date.now() - started,
    log,
  });
  console.log(
    `${result.status === 0 ? 'PASS' : 'FAIL'} ${script} (${Math.round((Date.now() - started) / 1000)}s)`,
  );
  await writeFile(
    join(root, 'docs/spec/vxe-table-project-checks.json'),
    JSON.stringify({ generatedAt: new Date().toISOString(), results }, null, 2),
  );
  if (result.status !== 0) {
    process.exitCode = 1;
    console.error((result.stderr ?? '') + (result.stdout ?? '').slice(-6000));
    break;
  }
}
