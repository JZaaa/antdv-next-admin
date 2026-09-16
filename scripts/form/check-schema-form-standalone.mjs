import vue from '@vitejs/plugin-vue';
import { cp, mkdir, mkdtemp, realpath, rm, writeFile } from 'node:fs/promises';
import { join, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { build } from 'vite';

const root = fileURLToPath(new URL('../../', import.meta.url));
const scratchRoot = join(root, 'node_modules', '.cache');
await mkdir(scratchRoot, { recursive: true });
const scratch = await mkdtemp(join(scratchRoot, 'schema-form-standalone-'));
try {
  await cp(join(root, 'src/libs/form'), join(scratch, 'form'), { recursive: true });
  await writeFile(
    join(scratch, 'index.html'),
    '<!doctype html><html><head><meta charset="UTF-8"><title>SchemaForm standalone</title></head><body><div id="app"></div><pre id="lab-report">尚未完成</pre><script type="module" src="/main.ts"></script></body></html>',
  );
  await writeFile(
    join(scratch, 'main.ts'),
    `
import { createApp, defineComponent, h, nextTick } from 'vue';
import { useSchemaForm, enUS, z } from './form';
let api, modernApi;
const app = createApp(defineComponent({ setup() {
  const [Form, formApi] = useSchemaForm({
    schema: [{ fieldName: 'name', component: 'Input', label: 'Name', rules: z.string().min(1, 'Required') },
      { fieldName: 'enabled', component: 'Switch', label: 'Enabled', defaultValue: false }],
    locale: enUS,
  });
  api = formApi;
  const [ModernForm, modern] = useSchemaForm({
    wrapperClass: 'grid-cols-2',
    schema: [{ fieldName: 'name', component: 'Input', label: 'Name', rules: 'required' },
      { type: 'array', fieldName: 'contacts', label: 'Contacts', defaultValue: [], children: [{ fieldName: 'name', component: 'Input', rules: 'required' }] }],
  });
  modernApi = modern;
  return () => h('main', { style: 'max-width:640px;margin:40px auto;padding:24px' }, [h('h1', 'SchemaForm standalone'), h(Form), h('h2', 'SchemaForm arrays'), h(ModernForm)]);
} }));
app.mount('#app');
async function verify() {
  const results = [];
  try {
    const required = !(await api.validate()).valid;
    if (!required) throw new Error('Expected required-field error');
    const input = document.querySelector('input');
    input.value = 'Copied module';
    input.dispatchEvent(new Event('input', { bubbles: true }));
    await nextTick();
    const value = await api.submit();
    if (value.name !== 'Copied module' || value.enabled !== false) throw new Error('Standalone model failed');
    const grid = document.querySelector('.vben-form-grid');
    if (getComputedStyle(grid).display !== 'grid') throw new Error('Bundled styles missing');
    results.push({ id: 'schema-standalone-copy', title: '独立目录复制宿主', expected: '无项目别名、全局组件、Tailwind 或业务依赖', status: 'pass', observed: value });
  } catch (error) {
    results.push({ id: 'schema-standalone-copy', title: '独立目录复制宿主', expected: '公开入口可独立运行', status: 'error', observed: String(error) });
  }
  try {
    if ((await modernApi.validate()).valid) throw new Error('Modern required rule missing');
    await modernApi.setFieldValue('name', 'Vben module');
    modernApi.form.pushFieldValue('contacts', { name: 'Contact' });
    const values = await modernApi.submit();
    if (values.name !== 'Vben module' || values.contacts[0].name !== 'Contact') throw new Error('Modern values failed');
    await nextTick();
    const grid = document.querySelectorAll('.vben-form-grid')[1];
    if (getComputedStyle(grid).gridTemplateColumns.split(' ').length !== 2) throw new Error('Standalone Vben grid classes missing');
    results.push({ id: 'vben-standalone-copy', title: '分组数组独立复制宿主', expected: '命名规则、数组与栅格无需项目依赖', status: 'pass', observed: values });
  } catch (error) {
    results.push({ id: 'vben-standalone-copy', title: '分组数组独立复制宿主', expected: '统一入口可独立运行', status: 'error', observed: String(error) });
  }
  document.querySelector('#lab-report').textContent = JSON.stringify({ generatedAt: new Date().toISOString(), userAgent: navigator.userAgent, mode: 'production', results });
  document.documentElement.dataset.labStatus = 'complete';
}
void verify();
`,
  );
  await build({
    configFile: false,
    root: scratch,
    plugins: [vue()],
    css: { postcss: { plugins: [] } },
    build: {
      outDir: join(root, 'dist/schema-form-standalone'),
      emptyOutDir: true,
      target: 'chrome100',
      cssTarget: 'chrome100',
      manifest: true,
    },
  });
  console.log(
    'Standalone copied module built without project aliases, global registration, Tailwind or adapters.',
  );
} finally {
  const resolvedScratch = await realpath(scratch);
  const resolvedRoot = await realpath(scratchRoot);
  if (!resolvedScratch.startsWith(`${resolvedRoot}${sep}schema-form-standalone-`))
    throw new Error('Unexpected standalone scratch directory');
  await rm(resolvedScratch, { recursive: true, force: true });
}
