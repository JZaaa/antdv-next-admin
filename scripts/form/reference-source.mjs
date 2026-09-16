import { execFileSync } from 'node:child_process';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';

export async function readReferenceSource(projectRoot) {
  const local = resolve(process.env.VBEN_SOURCE || resolve(projectRoot, '../vue-vben-admin'));
  // Trust only this explicitly selected repository for this read; never change global Git config.
  const git = (...args) =>
    execFileSync(
      'git',
      ['-c', `safe.directory=${local.replaceAll('\\', '/')}`, '-C', local, ...args],
      { encoding: 'utf8' },
    ).trim();
  try {
    const pkg = JSON.parse(
      await readFile(resolve(local, 'packages/@core/ui-kit/form-ui/package.json'), 'utf8'),
    );
    if (!pkg.version || pkg.name !== '@vben-core/form-ui')
      throw new Error('Unexpected form-ui package');
    return {
      local,
      head: git('rev-parse', 'HEAD'),
      version: pkg.version,
      dirty: git('status', '--porcelain', '--untracked-files=normal') !== '',
    };
  } catch (error) {
    throw new Error(`无法读取 Vben 源码版本：${local}。请用 VBEN_SOURCE 指定完整源码仓库。`, {
      cause: error,
    });
  }
}
