import { createHash } from 'node:crypto';
import { readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { gzipSync } from 'node:zlib';

import { summarizePerformance } from './performance-report.mjs';

const root = fileURLToPath(new URL('../../', import.meta.url));
const reportFile = process.argv[2] ?? 'docs/spec/schema-form-performance-chromium100-results.json';
const reportBytes = await readFile(join(root, reportFile));
const report = JSON.parse(reportBytes);
const { measurement, summary } = summarizePerformance(report);
const manifestFile = 'dist/schema-form-standalone/.vite/manifest.json';
const manifestBytes = await readFile(join(root, manifestFile));
const manifest = JSON.parse(manifestBytes);
const entries = Object.keys(manifest).filter((key) => manifest[key].isEntry);
if (entries.length !== 1) throw new Error('Standalone manifest must contain exactly one entry.');
const entry = entries[0];
const visited = new Set();
function visit(key) {
  if (visited.has(key)) return;
  if (!manifest[key]?.file) throw new Error('Missing manifest dependency: ' + key);
  visited.add(key);
  for (const dependency of manifest[key].imports ?? []) visit(dependency);
}
visit(entry);
const staticFiles = await Promise.all(
  [...visited].map(async (key) => {
    const file = manifest[key].file;
    const bytes = await readFile(join(root, 'dist/schema-form-standalone', file));
    return {
      file,
      sha256: createHash('sha256').update(bytes).digest('hex'),
      bytes: bytes.length,
      gzipBytes: gzipSync(bytes).length,
    };
  }),
);
const output = {
  generatedAt: new Date().toISOString(),
  browser: report.browser,
  measurement,
  sourceReport: {
    file: reportFile,
    generatedAt: report.generatedAt,
    sha256: createHash('sha256').update(reportBytes).digest('hex'),
  },
  aggregation:
    'Median of three round-level measurements; all raw samples are in the performance report.',
  summary,
  standaloneStaticJavaScript: {
    measuredAt: new Date().toISOString(),
    manifest: {
      file: manifestFile,
      sha256: createHash('sha256').update(manifestBytes).digest('hex'),
    },
    files: staticFiles,
    bytes: staticFiles.reduce((sum, file) => sum + file.bytes, 0),
    gzipBytes: staticFiles.reduce((sum, file) => sum + file.gzipBytes, 0),
    scope:
      'Complete standalone app entry dependency closure, including Vue/antdv-next/TanStack and demo bootstrap; not the incremental library cost.',
  },
};
await writeFile(
  join(root, 'docs/spec/schema-form-performance-summary.json'),
  `${JSON.stringify(output, null, 2)}\n`,
);
console.log(JSON.stringify(output, null, 2));
