/* eslint-disable no-await-in-loop -- Keep fixture traversal, verification and cleanup sequential. */
import { randomBytes } from 'node:crypto';
import { mkdtemp, mkdir, readFile, readdir, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { brotliDecompressSync, gunzipSync } from 'node:zlib';
import { build } from 'vite';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { compressionPlugin } from '../../build/compression';

const fixturePrefix = join(tmpdir(), 'antdv-compression-test-');
const fixtures: string[] = [];
const text = 'Compression fixture: 中文静态资源与 public 文件。\n'.repeat(100);

async function createFixture(setting?: string): Promise<string> {
  const root = await mkdtemp(fixturePrefix);
  fixtures.push(root);
  await mkdir(join(root, 'public'));
  await writeFile(
    join(root, 'index.html'),
    `<html><body>${'<p>Static content</p>'.repeat(100)}<script type="module" src="/main.js"></script></body></html>`,
  );
  await writeFile(join(root, 'main.js'), `window.fixture = ${JSON.stringify(text)};`);
  await writeFile(join(root, 'public', 'content.txt'), text);
  await writeFile(join(root, 'public', 'small.txt'), 'small');
  await writeFile(join(root, 'public', 'image.png'), text);
  await writeFile(join(root, 'public', 'noise.txt'), randomBytes(4096));
  await writeFile(
    join(root, 'public', 'icon.svg'),
    `<svg>${'<path d="M0 0h10v10z"/>'.repeat(100)}</svg>`,
  );
  if (setting !== undefined) await writeFile(join(root, '.env'), `VITE_COMPRESS=${setting}\n`);
  return root;
}

async function buildFixture(root: string): Promise<void> {
  await build({
    root,
    configFile: false,
    logLevel: 'silent',
    plugins: [compressionPlugin()],
    build: { target: 'chrome100', reportCompressedSize: false },
  });
}

async function listFiles(directory: string): Promise<string[]> {
  const files: string[] = [];
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) files.push(...(await listFiles(path)));
    else files.push(path);
  }
  return files;
}

beforeEach(() => {
  // Vitest loads the repository .env into process.env, which otherwise overrides fixture files.
  vi.stubEnv('VITE_COMPRESS', undefined);
});

afterEach(async () => {
  vi.unstubAllEnvs();
  for (const fixture of fixtures.splice(0)) {
    const absolute = resolve(fixture);
    if (!absolute.startsWith(resolve(fixturePrefix))) throw new Error('Unexpected fixture path');
    await rm(absolute, { recursive: true, force: true });
  }
});

describe('build precompression', () => {
  it.each([undefined, '', 'false'])(
    'leaves only original files when disabled (%s)',
    async (value) => {
      const root = await createFixture(value);
      await buildFixture(root);
      const files = await listFiles(join(root, 'dist'));
      expect(files.some((file) => /\.(gz|br)$/.test(file))).toBe(false);
      expect(await readFile(join(root, 'dist', 'content.txt'), 'utf8')).toBe(text);
    },
  );

  it.each([
    { setting: 'gzip', extensions: ['gz'] },
    { setting: 'brotli', extensions: ['br'] },
    { setting: 'gzip,brotli', extensions: ['gz', 'br'] },
    { setting: 'gzip, gzip, brotli', extensions: ['gz', 'br'] },
  ])(
    'emits lossless sidecars for $setting and retains originals',
    async ({ setting, extensions }) => {
      const root = await createFixture(setting);
      await buildFixture(root);
      const directory = join(root, 'dist');
      const files = await listFiles(directory);
      const originals = files.filter((file) => /(?:\.js|\.html|\.svg|content\.txt)$/.test(file));
      expect(originals.some((file) => file.endsWith('.js'))).toBe(true);
      expect(await readFile(join(directory, 'content.txt'), 'utf8')).toBe(text);
      for (const original of originals) {
        const source = await readFile(original);
        for (const extension of ['gz', 'br']) {
          if (!extensions.includes(extension)) {
            expect(files).not.toContain(`${original}.${extension}`);
            continue;
          }
          const compressed = await readFile(`${original}.${extension}`);
          const restored =
            extension === 'gz' ? gunzipSync(compressed) : brotliDecompressSync(compressed);
          expect(restored.equals(source)).toBe(true);
          expect(compressed.length).toBeLessThan(source.length);
        }
      }
      expect(
        files.some((file) => /(?:small\.txt|image\.png|noise\.txt)\.(gz|br)$/.test(file)),
      ).toBe(false);
      expect(files.some((file) => /\.(gz|br)\.(gz|br)$/.test(file))).toBe(false);
    },
  );

  it('rejects an unsupported algorithm instead of silently skipping compression', async () => {
    const root = await createFixture('gzip,zip');
    await expect(buildFixture(root)).rejects.toThrow('Invalid VITE_COMPRESS');
  });
});
