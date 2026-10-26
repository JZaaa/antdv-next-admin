/* eslint-disable no-await-in-loop -- Process files sequentially to bound compression memory usage. */
import type { Plugin } from 'vite';

import { readdir, readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { promisify } from 'node:util';
import { brotliCompress, constants, gzip } from 'node:zlib';

const gzipAsync = promisify(gzip);
const brotliAsync = promisify(brotliCompress);
const COMPRESSIBLE_FILE = /\.(?:html|js|mjs|css|json|svg|txt|xml)$/i;
const MIN_SIZE = 1024;

type Compression = 'gzip' | 'brotli';

function parseCompression(value: string | undefined): Compression[] {
  const setting = value?.trim() ?? '';
  if (!setting || setting === 'false') return [];

  const algorithms = new Set<Compression>();
  for (const algorithm of setting.split(',').map((item) => item.trim())) {
    if (algorithm !== 'gzip' && algorithm !== 'brotli') {
      throw new Error(
        `Invalid VITE_COMPRESS value "${setting}". Use false, gzip, brotli, or gzip,brotli.`,
      );
    }
    algorithms.add(algorithm);
  }
  return [...algorithms];
}

async function compressDirectory(directory: string, algorithms: Compression[]): Promise<void> {
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) {
      await compressDirectory(path, algorithms);
      continue;
    }
    if (!entry.isFile() || !COMPRESSIBLE_FILE.test(entry.name)) continue;

    const source = await readFile(path);
    if (source.length < MIN_SIZE) continue;

    for (const algorithm of algorithms) {
      const compressed =
        algorithm === 'gzip'
          ? await gzipAsync(source, { level: 9 })
          : await brotliAsync(source, {
              params: { [constants.BROTLI_PARAM_QUALITY]: 6 },
            });
      if (compressed.length >= source.length) continue;
      await writeFile(`${path}.${algorithm === 'gzip' ? 'gz' : 'br'}`, compressed);
    }
  }
}

/** 预压缩最终静态产物（含 public 文件），保留原文件供服务器回退。 */
export function compressionPlugin(): Plugin {
  let algorithms: Compression[] = [];

  return {
    name: 'app-compression',
    apply: 'build',
    enforce: 'post',
    configResolved(config) {
      algorithms = parseCompression(config.env.VITE_COMPRESS);
    },
    writeBundle: {
      order: 'post',
      async handler(options) {
        if (!algorithms.length || !options.dir) return;
        await compressDirectory(options.dir, algorithms);
      },
    },
  };
}
