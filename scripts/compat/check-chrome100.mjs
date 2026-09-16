import { readdirSync, readFileSync } from 'node:fs';
import { resolve, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { resolveConfig } from 'vite';

import { applyExceptions, checkCss, checkJavaScript, checkVue } from './chrome100-rules.mjs';

const root = fileURLToPath(new URL('../../', import.meta.url));
function files(directory) {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const path = resolve(directory, entry.name);
    return entry.isDirectory() ? files(path) : entry.isFile() ? [path] : [];
  });
}

async function main() {
  const args = process.argv.slice(2);
  if (args.length && (args.length !== 2 || args[0] !== '--dist')) {
    throw new Error('Usage: node scripts/compat/check-chrome100.mjs [--dist dist]');
  }
  for (const mode of ['production', 'demo']) {
    const config = await resolveConfig({ root, mode }, 'build', mode);
    for (const key of ['target', 'cssTarget']) {
      const targets = [config.build[key]].flat();
      if (targets.length !== 1 || targets[0] !== 'chrome100') {
        throw new Error(
          `${mode}: build.${key} must remain chrome100 (received ${JSON.stringify(config.build[key])}).`,
        );
      }
    }
  }
  const browsers = readFileSync(resolve(root, '.browserslistrc'), 'utf8')
    .split('\n')
    .map((line) => line.replace(/#.*/, '').trim())
    .filter(Boolean);
  if (browsers.length !== 1 || !/^chrome\s*>=\s*100$/i.test(browsers[0])) {
    throw new Error('.browserslistrc must retain the reviewed Chrome >= 100 baseline.');
  }
  const tailwind = JSON.parse(
    readFileSync(resolve(root, 'node_modules/tailwindcss/package.json'), 'utf8'),
  );
  if (!tailwind.version.startsWith('3.'))
    throw new Error(
      'Tailwind major version changed: review Chrome 100 compatibility before updating this guard.',
    );

  const sourceIssues = [];
  for (const file of files(resolve(root, 'src'))) {
    if (!/\.(?:vue|[cm]?[jt]sx?)$/.test(file) || file.endsWith('.d.ts')) continue;
    const name = relative(root, file).replaceAll('\\', '/');
    const source = readFileSync(file, 'utf8');
    if (file.endsWith('.vue')) sourceIssues.push(...checkVue(source, name));
    else if (/\.[cm]?[jt]sx?$/.test(file) && !file.endsWith('.d.ts'))
      sourceIssues.push(...checkJavaScript(source, name));
  }
  const exceptions = JSON.parse(
    readFileSync(new URL('./chrome100-exceptions.json', import.meta.url), 'utf8'),
  );
  const issues = applyExceptions(sourceIssues, exceptions.source);
  if (args.length) {
    const cssFiles = files(resolve(root, args[1])).filter((file) => file.endsWith('.css'));
    if (!cssFiles.length)
      throw new Error('No built CSS found. Run the build before checking its output.');
    const cssIssues = cssFiles.flatMap((file) =>
      checkCss(readFileSync(file, 'utf8'), relative(root, file).replaceAll('\\', '/')),
    );
    issues.push(...applyExceptions(cssIssues, exceptions.dist));
  }
  if (issues.length) {
    for (const item of issues)
      console.error(`${item.file}:${item.line} [${item.rule}] ${item.code}`);
    throw new Error(
      `${issues.length} Chrome 100 compatibility issue(s). Use a fallback, or document an exact reviewed exception.`,
    );
  }
  console.log(
    `Chrome 100 checks passed: build targets, Browserslist, Tailwind, source APIs${args.length ? ', built CSS' : ''}.`,
  );
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
