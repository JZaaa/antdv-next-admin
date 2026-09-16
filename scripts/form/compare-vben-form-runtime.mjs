import { readFile, writeFile } from 'node:fs/promises';
// Compares the actual local Vben source with the modern API using registered fields.
// No DOM/layout/paint is measured here; Chrome UI checks live in the separate lab.
import { createRequire } from 'node:module';
import { resolve } from 'node:path';
import { isDeepStrictEqual } from 'node:util';
import { createServer } from 'vite';

import { readReferenceSource } from './reference-source.mjs';

const root = resolve(import.meta.dirname, '../..');
const referenceSource = await readReferenceSource(root);
const reference = referenceSource.local;
const require = createRequire(resolve(root, 'package.json'));
const server = await createServer({
  configFile: false,
  root: reference,
  cacheDir: resolve(root, 'node_modules/.vite-vben-runtime-compare'),
  server: { middlewareMode: true },
  optimizeDeps: { noDiscovery: true },
  resolve: {
    conditions: ['development'],
    alias: [
      { find: /^vue$/, replacement: require.resolve('vue/dist/vue.runtime.esm-bundler.js') },
      { find: /^zod$/, replacement: resolve(root, 'node_modules/zod/index.js') },
      {
        find: /^@tanstack\/vue-form$/,
        replacement: resolve(root, 'node_modules/@tanstack/vue-form/dist/esm/index.js'),
      },
      {
        find: /^@tanstack\/vue-store$/,
        replacement: resolve(root, 'node_modules/@tanstack/vue-store/dist/esm/index.js'),
      },
      {
        find: /^@tanstack\/store$/,
        replacement: resolve(root, 'node_modules/@tanstack/store/dist/esm/index.js'),
      },
    ],
  },
  ssr: { noExternal: [/^@vben-core\//, '@tanstack/vue-form', '@tanstack/vue-store'] },
});
try {
  const vue = await server.ssrLoadModule('vue');
  const refApi = await server.ssrLoadModule('/packages/@core/ui-kit/form-ui/src/form-api.ts');
  const refRuntime = await server.ssrLoadModule(
    '/packages/@core/ui-kit/form-ui/src/form-runtime.ts',
  );
  const current = await server.ssrLoadModule(
    `/@fs/${resolve(root, 'src/libs/form/core/api.ts').replaceAll('\\', '/')}`,
  );
  const renderer = vue.createRenderer({
    createElement: () => ({ children: [], parent: null }),
    createText: () => ({ parent: null }),
    createComment: () => ({ parent: null }),
    insert(node, parent) {
      node.parent = parent;
      parent.children?.push(node);
    },
    remove(node) {
      if (node.parent?.children)
        node.parent.children = node.parent.children.filter((entry) => entry !== node);
    },
    setText() {},
    setElementText() {},
    patchProp() {},
    parentNode: (node) => node.parent,
    nextSibling: () => null,
  });
  function createReference(schema) {
    const api = new refApi.FormApi({ schema });
    const app = renderer.createApp({
      setup() {
        const form = refRuntime.useFormRuntime(
          Object.fromEntries(schema.map((field) => [field.fieldName, field.defaultValue])),
        );
        api.mount(form);
        return () =>
          vue.h(
            'div',
            {},
            schema.map((field) =>
              vue.h(form.fieldComponent, { name: field.fieldName }, { default: () => null }),
            ),
          );
      },
    });
    app.mount({ children: [], parent: null });
    return {
      api,
      dispose: () => {
        app.unmount();
        api.unmount();
      },
    };
  }
  function createCurrent(schema) {
    const api = new current.FormApi({ schema });
    api.mount();
    return { api, dispose: api.dispose };
  }
  const contracts = [];
  const contractSchema = [
    { fieldName: 'profile', component: 'Input', defaultValue: { name: 'A', city: 'X' } },
    { fieldName: 'rows', component: 'Input', defaultValue: [{ name: 'row' }] },
    { fieldName: 'note', component: 'Input', defaultValue: '' },
  ];
  async function exercise(create) {
    const { api, dispose } = create(contractSchema);
    const snapshots = [];
    async function capture(name) {
      await vue.nextTick();
      snapshots.push({
        name,
        snapshot: await api.getValueSnapshot(),
        errors: { ...api.form.errors },
      });
    }
    try {
      await capture('initial');
      await api.setValues({ profile: { name: 'B' }, unknown: 5 });
      await capture('filtered deep patch');
      await api.setValues({ profile: { city: 'Y' }, unknown: 5 }, false);
      await capture('unfiltered branch replacement');
      await api.setFieldValue('profile.name', 'C');
      await capture('nested setter');
      await api.setFieldError('note', 'server');
      await api.setFieldValue('note', 'changed');
      await capture('manual error survives assignment');
      await api.clearValidation();
      await capture('clear validation');
      await api.reset({ values: { profile: { name: 'baseline' } } });
      await capture('partial reset');
      await api.setValues({ note: 'dirty' });
      await api.reset();
      await capture('reset new baseline');
      await api.reset({ values: { note: 'temporary' } }, { force: true, keepDefaultValues: true });
      await capture('force and keep defaults');
      await api.reset();
      await capture('retained baseline');
      await api.removeSchemaByFields(['note']);
      await capture('removed schema value');
      return snapshots;
    } finally {
      dispose();
    }
  }
  const expected = await exercise(createReference);
  const actual = await exercise(createCurrent);
  for (let index = 0; index < expected.length; index++) {
    const pass = isDeepStrictEqual(expected[index], actual[index]);
    contracts.push({
      name: expected[index].name,
      status: pass ? 'pass' : 'error',
      expected: expected[index],
      actual: actual[index],
    });
  }
  await writeFile(
    resolve(root, 'docs/spec/vben-form-runtime-contract-comparison.json'),
    JSON.stringify({ generatedAt: new Date().toISOString(), contracts }, null, 2) + '\n',
  );
  if (contracts.some((result) => result.status !== 'pass'))
    throw new Error(
      'Runtime contract comparison failed; inspect vben-form-runtime-contract-comparison.json',
    );
  const results = [];
  for (const count of [100, 300]) {
    const schema = Array.from({ length: count }, (_, index) => ({
      fieldName: `field${index}`,
      component: 'Input',
      defaultValue: `Value ${index}`,
    }));
    for (const [name, create] of [
      ['vben', createReference],
      ['current', createCurrent],
    ]) {
      const { api, dispose } = create(schema);
      try {
        await vue.nextTick();
        if (Object.keys(await api.getRawValues()).length !== count)
          throw new Error('Field registration mismatch');
        for (const operation of ['setFieldValue', 'setValues', 'getValueSnapshot', 'reset']) {
          const samples = [];
          for (let index = 0; index < 35; index++) {
            const start = performance.now();
            if (operation === 'setFieldValue')
              await api.setFieldValue('field50', `Sample ${index}`);
            if (operation === 'setValues')
              await api.setValues(
                Object.fromEntries(schema.map((field) => [field.fieldName, `Batch ${index}`])),
              );
            if (operation === 'getValueSnapshot') await api.getValueSnapshot();
            if (operation === 'reset') await api.reset();
            await vue.nextTick();
            if (index >= 5) samples.push(performance.now() - start);
          }
          samples.sort((a, b) => a - b);
          results.push({
            implementation: name,
            fields: count,
            operation,
            samples: samples.length,
            medianMs: samples[Math.floor(samples.length / 2)],
            p95Ms: samples[Math.floor(samples.length * 0.95)],
          });
        }
      } finally {
        dispose();
      }
    }
  }
  const report = {
    generatedAt: new Date().toISOString(),
    reference,
    referenceCommit: referenceSource.head,
    referenceSource,
    node: process.version,
    currentPackage: JSON.parse(await readFile(resolve(root, 'package.json'), 'utf8')).dependencies,
    method:
      'Actual reference API/runtime source; equal registered field count, data, warmup and operations; no controls, DOM, layout or paint. Timings do not establish end-to-end application performance.',
    contracts: contracts.map(({ name, status }) => ({ name, status })),
    results,
  };
  await writeFile(
    resolve(root, 'docs/spec/vben-form-runtime-comparison.json'),
    `${JSON.stringify(report, null, 2)}\n`,
  );
  console.log(JSON.stringify({ referenceCommit: report.referenceCommit, results }, null, 2));
} finally {
  await server.close();
}
