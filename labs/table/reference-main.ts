import { Input } from 'antdv-next';
import { useVbenForm } from 'reference-form';
import { setupVbenVxeTable, useVbenVxeGrid } from 'reference-grid';
import { createApp, defineComponent, h, nextTick } from 'vue';
import { VxeUI } from 'vxe-pc-ui';
import { VxeGrid } from 'vxe-table';

import { createTableSearch } from '../../src/adapters/table-form';
import { registerTableRenderers } from '../../src/adapters/table-renderers';
import { useSchemaForm } from '../../src/libs/form';
import { useVxeGrid, setupVxeTable } from '../../src/libs/table';

setupVxeTable();
registerTableRenderers(VxeUI);

let api;
const trace = [];
const pause = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const app = createApp(
  defineComponent({
    setup() {
      setupVbenVxeTable({
        useVbenForm,
        configVxeTable(ui) {
          ui.setConfig({
            grid: {
              proxyConfig: {
                autoLoad: true,
                response: { result: 'items', total: 'total', list: 'items' },
              },
              formConfig: { enabled: false },
              pagerConfig: { enabled: false },
            },
          });
        },
      });
      const [Grid, controller] = useVbenVxeGrid({
        tableTitle: 'Vben reference',
        gridOptions: {
          height: 360,
          columns: [
            { field: 'id', title: 'ID', sortable: true },
            { field: 'name', title: 'Name' },
          ],
          pagerConfig: { enabled: true, pageSize: 10 },
          rowConfig: { keyField: 'id' },
          sortConfig: { remote: true, defaultSort: { field: 'id', order: 'desc' } },
          proxyConfig: {
            ajax: {
              query: async (params, search) => {
                trace.push({
                  code: params.code,
                  page: { ...params.page },
                  sort: params.sort,
                  search,
                });
                await pause(40);
                return { items: [{ id: 1, name: 'Reference' }], total: 1 };
              },
            },
          },
        },
      });
      api = controller;
      return () => h(Grid);
    },
  }),
);
app.mount('#app');
async function run() {
  const results = [];
  try {
    await nextTick();
    await pause(600);
    if (trace.length !== 1) throw new Error('initial count ' + trace.length);
    const first = api.query({ tag: 'first' });
    await pause(5);
    await api.reload({ tag: 'skipped' });
    await first;
    if (trace.length !== 2) throw new Error('loading query semantics');
    const value = await api.reload();
    if (value !== undefined) throw new Error('wrapper return value');
    results.push({ id: 'vben-real-wrapper-native-proxy-trace', status: 'pass', observed: trace });
  } catch (error) {
    results.push({ id: 'vben-reference', status: 'error', observed: String(error) });
  }
  let performance;
  if (new URLSearchParams(location.search).has('performance')) {
    app.unmount();
    performance =
      new URLSearchParams(location.search).get('performance') === 'controls'
        ? await benchmarkControls()
        : await benchmark();
    results.push({
      id: 'three-engine-production-matrix',
      status: 'pass',
      observed: { samples: performance.length },
    });
  }
  document.querySelector('#lab-report').textContent = JSON.stringify({
    results,
    trace,
    performance,
  });
  document.documentElement.dataset.labStatus = 'complete';
}
void run().catch((error) => {
  document.querySelector('#lab-report').textContent = String(error);
  document.documentElement.dataset.labStatus = 'error';
});

async function paint() {
  await nextTick();
  await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));
}
async function benchmark() {
  const samples = [];
  for (const count of [100, 1000, 10000])
    for (const width of [10, 30])
      for (let round = 0; round < 5; round++) {
        const order = round % 2 ? ['native', 'target', 'vben'] : ['vben', 'target', 'native'];
        for (const mode of order) {
          const data = Array.from({ length: count }, (_, i) => ({
            id: i,
            ...Object.fromEntries(
              Array.from({ length: width - 1 }, (_, j) => ['c' + j, `R${i}C${j}`]),
            ),
          }));
          const config = {
            height: 400,
            width: 1100,
            showOverflow: true,
            rowConfig: { keyField: 'id' },
            cellConfig: { height: 40 },
            keepSource: false,
            pagerConfig: { enabled: false },
            toolbarConfig: { enabled: false },
            proxyConfig: { enabled: false },
            virtualXConfig: { enabled: true, gt: 0 },
            virtualYConfig: { enabled: true, gt: 0 },
            columns: Array.from({ length: width }, (_, i) => ({
              field: i === 0 ? 'id' : 'c' + (i - 1),
              title: 'C' + i,
              width: 150,
              fixed: i === 0 ? 'left' : undefined,
            })),
            data,
          };
          let grid, controller;
          const host = document.createElement('div');
          host.style.cssText = 'width:1140px;min-height:430px';
          document.body.prepend(host);
          const start = performance.now();
          const instance = createApp(
            defineComponent({
              setup() {
                if (mode === 'native')
                  return () =>
                    h(VxeGrid, {
                      ...config,
                      ref: (value) => {
                        grid = value;
                      },
                    });
                const [Grid, api] = (mode === 'vben' ? useVbenVxeGrid : useVxeGrid)({
                  gridOptions: config,
                });
                controller = api;
                return () => h(Grid);
              },
            }),
          );
          instance.mount(host);
          await paint();
          grid = grid ?? controller.grid;
          await grid.recalculate();
          await paint();
          const mountMs = performance.now() - start,
            dom = host.querySelectorAll('*').length;
          const scrollStart = performance.now();
          await grid.scrollTo(2000, Math.max(0, (count - 30) * 40));
          await paint();
          const scrollMs = performance.now() - scrollStart;
          const replaceStart = performance.now();
          await grid.loadData(data.map((row) => ({ ...row })));
          await paint();
          const replaceMs = performance.now() - replaceStart;
          const updateStart = performance.now();
          grid.getData()[0].c0 = 'updated';
          await paint();
          const updateMs = performance.now() - updateStart;
          samples.push({
            mode,
            rows: count,
            columns: width,
            round,
            mountMs,
            scrollMs,
            replaceMs,
            updateMs,
            dom,
          });
          instance.unmount();
          host.remove();
          await nextTick();
        }
      }
  return samples;
}
async function benchmarkControls() {
  const samples = [];
  for (const scenario of ['edit', 'search'])
    for (let round = 0; round < 5; round++)
      for (const mode of round % 2 ? ['native', 'target', 'vben'] : ['vben', 'target', 'native']) {
        const config = {
          height: 400,
          width: 1100,
          showOverflow: true,
          rowConfig: { keyField: 'id' },
          cellConfig: { height: 40 },
          keepSource: true,
          pagerConfig: { enabled: false },
          toolbarConfig: { enabled: false },
          proxyConfig: { enabled: false },
          editConfig: { trigger: 'click', mode: 'cell' },
          columns: [
            { field: 'id', title: 'ID', width: 100 },
            { field: 'name', title: 'Name', width: 250, editRender: { name: 'AntInput' } },
          ],
          data: Array.from({ length: 100 }, (_, i) => ({ id: i, name: 'Row ' + i })),
        };
        const formOptions = {
          showDefaultActions: false,
          showCollapseButton: false,
          compact: false,
          wrapperClass: 'grid-cols-1',
          schema: Array.from({ length: 6 }, (_, i) => ({
            fieldName: 'f' + i,
            component: Input,
            modelPropName: 'value',
            label: 'Field ' + i,
            defaultValue: 'value',
          })),
        };
        let grid, controller, formApi;
        const host = document.createElement('div');
        host.style.width = '1140px';
        document.body.prepend(host);
        const start = performance.now();
        const instance = createApp(
          defineComponent({
            setup() {
              if (mode === 'native') {
                const form = scenario === 'search' ? useSchemaForm(formOptions) : undefined;
                formApi = form?.[1];
                return () =>
                  h('div', [
                    form ? h(form[0]) : null,
                    h(VxeGrid, {
                      ...config,
                      ref: (value) => {
                        grid = value;
                      },
                    }),
                  ]);
              }
              const [Grid, api] =
                mode === 'vben'
                  ? useVbenVxeGrid({
                      gridOptions: config,
                      ...(scenario === 'search' ? { formOptions } : {}),
                    })
                  : useVxeGrid(
                      { gridOptions: config, ...(scenario === 'search' ? { formOptions } : {}) },
                      createTableSearch,
                    );
              controller = api;
              return () => h(Grid);
            },
          }),
        );
        instance.mount(host);
        await paint();
        grid = grid ?? controller.grid;
        formApi = formApi ?? controller?.formApi;
        await grid.recalculate();
        await paint();
        const mountMs = performance.now() - start;
        let inputMs;
        if (scenario === 'edit') {
          await grid.setEditCell(grid.getData()[0], 'name');
          await paint();
          const input = host.querySelector('.vxe-body--row input');
          if (!input) throw new Error('Missing real editor ' + mode);
          const start = performance.now();
          input.value = 'Edited';
          input.dispatchEvent(new Event('input', { bubbles: true }));
          await paint();
          inputMs = performance.now() - start;
          if (grid.getData()[0].name !== 'Edited') throw new Error('Editor model mismatch ' + mode);
          await grid.revertData(grid.getData()[0]);
          await grid.clearEdit();
        } else {
          const input = host.querySelector('input');
          if (!input) throw new Error('Missing search field ' + mode);
          const start = performance.now();
          input.value = 'Search';
          input.dispatchEvent(new Event('input', { bubbles: true }));
          await paint();
          inputMs = performance.now() - start;
          if ((await formApi.getValues()).f0 !== 'Search')
            throw new Error('Search model mismatch ' + mode);
        }
        samples.push({
          mode,
          scenario,
          rows: 100,
          columns: 2,
          fields: scenario === 'search' ? 6 : 0,
          round,
          mountMs,
          inputMs,
          dom: host.querySelectorAll('*').length,
        });
        instance.unmount();
        host.remove();
        await nextTick();
      }
  return samples;
}
