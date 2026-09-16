import vue from '@vitejs/plugin-vue';
import { cp, mkdir, mkdtemp, readFile, realpath, rm, writeFile } from 'node:fs/promises';
import { join, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { build } from 'vite';
const root = fileURLToPath(new URL('../../', import.meta.url));
const cache = join(root, 'node_modules/.cache');
await mkdir(cache, { recursive: true });
const scratch = await mkdtemp(join(cache, 'vxe-standalone-'));
try {
  await cp(join(root, 'src/libs/table'), join(scratch, 'table'), { recursive: true });
  await writeFile(
    join(scratch, 'index.html'),
    '<!doctype html><html><head><meta charset="utf-8"><title>Copied VXE module</title></head><body><div id="app"></div><pre id="lab-report"></pre><script type="module" src="/main.ts"></script></body></html>',
  );
  await writeFile(
    join(scratch, 'main.ts'),
    `
import { createApp, defineComponent, h, nextTick } from 'vue';
import { useVxeGrid, setupVxeTable } from './table';
let api;
setupVxeTable({ locale: 'ja-JP', theme: 'dark' });
createApp(defineComponent({setup() {
  const [Grid, controller] = useVxeGrid({tableTitle: '独立コピー', gridOptions: {
    height: 320, keepSource: true, rowConfig: { keyField: 'id' },
    columns: [{field:'id',title:'ID'}, {field:'name',title:'Name',editRender:{name:'input'}}],
    editConfig: {trigger:'click',mode:'cell'},
    proxyConfig: {ajax: {query: async () => [{id:1,name:'Copied'}]}}
  }});
  api = controller; return () => h(Grid);
}})).mount('#app');
async function run() {
  const results = [];
  try {
    await nextTick(); await new Promise(resolve => setTimeout(resolve, 400));
    if (api.formApi !== undefined || api.grid.getData()[0]?.name !== 'Copied') throw new Error('No-form proxy failed');
    const row = api.grid.getData()[0]; await api.grid.setEditCell(row,'name'); row.name='Edit'; await api.grid.revertData(row); await api.grid.clearEdit();
    if (row.name !== 'Copied') throw new Error('Native edit rollback');
    if (document.documentElement.getAttribute('data-vxe-ui-theme') !== 'dark') throw new Error('Theme missing');
    if (getComputedStyle(document.querySelector('.schema-grid')).paddingTop !== '12px') throw new Error('Module CSS missing');
    results.push({id:'table-only-copy-query-edit-theme-language-css',status:'pass'});
  } catch(error) {results.push({id:'table-only-copy',status:'error',observed:String(error)});}
  document.querySelector('#lab-report').textContent=JSON.stringify({results,userAgent:navigator.userAgent});document.documentElement.dataset.labStatus='complete';
} void run();
`,
  );
  const forbidden = /(?:tanstack|zod|libs\/form|stores\/|router\/|locales\/|tailwind)/;
  await build({
    configFile: false,
    root: scratch,
    plugins: [
      vue(),
      {
        name: 'table-standalone-dependency-boundary',
        generateBundle() {
          for (const id of this.getModuleIds())
            if (forbidden.test(id.replaceAll('\\', '/')))
              throw new Error(`Forbidden standalone module: ${id}`);
        },
      },
    ],
    css: { postcss: { plugins: [] } },
    build: {
      target: 'chrome100',
      cssTarget: 'chrome100',
      outDir: join(root, 'dist/table-standalone'),
      emptyOutDir: true,
    },
  });
  await mkdir(join(root, 'docs/spec'), { recursive: true });
  await writeFile(
    join(root, 'docs/spec/vxe-table-standalone-build.json'),
    JSON.stringify(
      {
        status: 'pass',
        copiedDirectory: 'src/libs/table',
        noAlias: true,
        forbiddenGraphCheck: String(forbidden),
        dependencies: JSON.parse(
          await readFile(join(root, 'src/libs/table/compatibility.json'), 'utf8'),
        ).dependencies,
      },
      null,
      2,
    ),
  );
  // A second host copies both libraries and rewires only the host bridge imports.
  await cp(join(root, 'src/libs/form'), join(scratch, 'form'), { recursive: true });
  await writeFile(
    join(scratch, 'bridge.ts'),
    (await readFile(join(root, 'src/adapters/table-form.ts'), 'utf8'))
      .replaceAll('@/libs/form', './form')
      .replaceAll('@/libs/table', './table'),
  );
  await writeFile(
    join(scratch, 'main.ts'),
    `
import { createApp, h, nextTick } from 'vue';
import { useVxeGrid, setupVxeTable } from './table';
import { createTableSearch } from './bridge';
let api;
const calls=[];
setupVxeTable({locale:'en-US'});
const app=createApp({setup(){
  const [Grid, controller]=useVxeGrid({formOptions:{schema:[{fieldName:'name',component:'Input',defaultValue:'Copied',rules:'required'}]},gridOptions:{height:320,columns:[{field:'name',title:'Name'}],proxyConfig:{ajax:{query:async (_params,values)=>{calls.push({...values});return [{id:1,name:values.name}];}}}}},createTableSearch);
  api=controller; return ()=>h(Grid);
}});
app.mount('#app');
async function run(){
  const results=[];
  const settle=async()=>{await nextTick();await new Promise(resolve=>setTimeout(resolve,200));};
  try{
    await settle();
    if(calls.length!==1||calls[0].name!=='Copied')throw new Error('Initial defaults/count');
    await api.formApi.setValues({name:''});await api.formApi.submit();
    if(calls.length!==1)throw new Error('Invalid search requested');
    await api.formApi.setValues({name:'Submitted'});await api.formApi.submit();await settle();
    if(calls.length!==2||api.grid.getTableData().fullData[0].name!=='Submitted')throw new Error('Submit bridge');
    await api.formApi.setValues({name:'Draft'});await api.query();
    if(calls.at(-1).name!=='Submitted')throw new Error('Draft leaked');
    api.toggleSearchForm(false);await settle();api.toggleSearchForm(true);await settle();
    if((await api.formApi.getValues()).name!=='Draft')throw new Error('Hidden draft lost');
    if(getComputedStyle(document.querySelector('.vben-form-grid')).display!=='grid')throw new Error('Form CSS missing');
    app.unmount();if(api.grid||api.formApi)throw new Error('Unmount refs');
    results.push({id:'table-form-host-bridge-copy',status:'pass',observed:{calls}});
  }catch(error){results.push({id:'table-form-host-bridge-copy',status:'error',observed:String(error)});}
  document.querySelector('#lab-report').textContent=JSON.stringify({results});document.documentElement.dataset.labStatus='complete';
}void run();
`,
  );
  await build({
    configFile: false,
    root: scratch,
    plugins: [
      vue(),
      {
        name: 'copied-table-form-boundary',
        generateBundle() {
          for (const id of this.getModuleIds()) {
            const normalized = id.replaceAll('\\', '/');
            if (
              normalized.startsWith(join(root, 'src').replaceAll('\\', '/') + '/') ||
              /\/stores\/|\/router\/|tailwind/.test(normalized)
            )
              throw new Error(`Host dependency leaked: ${id}`);
          }
        },
      },
    ],
    css: { postcss: { plugins: [] } },
    build: {
      target: 'chrome100',
      cssTarget: 'chrome100',
      outDir: join(root, 'dist/table-standalone-form'),
      emptyOutDir: true,
    },
  });
} finally {
  const path = await realpath(scratch),
    parent = await realpath(cache);
  if (!path.startsWith(`${parent}${sep}vxe-standalone-`))
    throw new Error('Unexpected cleanup directory');
  await rm(path, { recursive: true, force: true });
}
