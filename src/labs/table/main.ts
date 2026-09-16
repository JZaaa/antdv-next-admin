import type { FormApi, SchemaFormProps } from '../../libs/form';
import type { VxeGridApi, TableLocale, TableProps } from '../../libs/table';
import type { VNodeChild } from 'vue';

import { createApp, defineComponent, h, KeepAlive, nextTick, ref, shallowRef } from 'vue';

import { createTableSearch } from '../../adapters/table-form';
import { registerTableRenderers } from '../../adapters/table-renderers';
import { useVxeGrid, setupVxeTable, VxeUI } from '../../libs/table';
import { createViewedRows } from '../../libs/table/viewed-row/viewed';
import { getStorageKey } from '../../utils/cache';

type Row = { id: number; name: string; age: number; parentId?: number; children?: Row[] };
type Values = { name: string };
type FormOptions = SchemaFormProps<string, Record<never, never>, Values>;
const pause = (ms = 30): Promise<void> => new Promise((resolve) => setTimeout(resolve, ms));
const rows: Row[] = Array.from({ length: 100 }, (_, i) => ({
  id: i + 1,
  name: `Row ${i + 1}`,
  age: 20 + (i % 50),
}));
const results: { id: string; status: string; observed: unknown }[] = [];
const trace: object[] = [];
function assert(condition: unknown, detail: string): asserts condition {
  if (!condition) throw new Error(detail);
}
async function test(id: string, run: () => unknown): Promise<void> {
  try {
    results.push({ id, status: 'pass', observed: (await run()) ?? true });
  } catch (error) {
    results.push({ id, status: 'error', observed: String(error) });
  }
}
async function settle(): Promise<void> {
  await nextTick();
  await pause(70);
}
async function probe(
  options: TableProps<Row, FormOptions>,
  slots: Record<string, (scope: Record<string, unknown>) => VNodeChild> = {},
) {
  const host = document.createElement('div');
  document.body.append(host);
  let controller!: VxeGridApi<Row, FormOptions, FormApi<Values>>;
  const instance = createApp(
    defineComponent({
      setup() {
        const [Grid, api] = useVxeGrid<Row, FormOptions, FormApi<Values>>(
          options,
          createTableSearch<Values>,
        );
        controller = api;
        return () => h(Grid, null, slots);
      },
    }),
  );
  instance.mount(host);
  await settle();
  return {
    host,
    api: controller,
    dispose(): void {
      instance.unmount();
      host.remove();
    },
  };
}
let remote!: VxeGridApi<Row, FormOptions, FormApi<Values>>;
let local!: VxeGridApi<Row>;
let lazy!: VxeGridApi<Row>;
let tree!: VxeGridApi<Row>;
let virtual!: VxeGridApi<Row>;
let fail = false;
let delay = 0;
let callCount = 0;
let successCount = 0;
let errorCount = 0;
const show = ref(true);
const locale = ref<TableLocale>('en-US');
const theme = ref<'light' | 'dark'>('light');
const localProps = shallowRef<TableProps<Row>>({});
let operations = 0;
setupVxeTable({
  locale,
  theme,
  configVxeTable(ui) {
    registerTableRenderers(ui);
    ui.setConfig({
      grid: { proxyConfig: { response: { result: 'items', total: 'total', list: 'items' } } },
    });
  },
});
const columns = [
  { type: 'checkbox' as const, width: 45 },
  { field: 'id', title: 'ID', width: 80, sortable: true },
  { field: 'name', title: 'Name', width: 160, editRender: { name: 'AntInput' } },
  { field: 'age', title: 'Age', width: 100, sortable: true, filters: [] },
];
const app = createApp(
  defineComponent({
    setup() {
      const [Remote, remoteApi] = useVxeGrid<Row, FormOptions, FormApi<Values>>(
        {
          tableTitle: 'Remote search',
          formOptions: {
            schema: [
              { fieldName: 'name', component: 'Input', defaultValue: 'initial', rules: 'required' },
            ],
          },
          gridOptions: {
            columns,
            height: 320,
            rowConfig: { keyField: 'id' },
            pagerConfig: { pageSize: 10 },
            toolbarConfig: { refresh: true, search: true },
            sortConfig: { remote: true, defaultSort: { field: 'id', order: 'desc' } },
            proxyConfig: {
              ajax: {
                async query(params, values: Values) {
                  callCount++;
                  trace.push({
                    code: 'code' in params ? params.code : undefined,
                    page: { ...params.page },
                    sort: params.sort,
                    sorts: params.sorts.map((sort) => ({ field: sort.field, order: sort.order })),
                    filters: params.filters.map((filter) => ({
                      field: filter.field,
                      values: filter.values,
                    })),
                    values: { ...values },
                  });
                  await pause(delay);
                  if (fail) throw new Error('Expected service failure');
                  return {
                    items: rows.slice(
                      (params.page.currentPage - 1) * params.page.pageSize,
                      params.page.currentPage * params.page.pageSize,
                    ),
                    total: rows.length,
                  };
                },
                querySuccess() {
                  successCount++;
                },
                queryError() {
                  errorCount++;
                },
                async queryAll() {
                  return { items: rows };
                },
              },
            },
          },
        },
        createTableSearch<Values>,
      );
      remote = remoteApi;
      const [Local, localApi] = useVxeGrid<Row>({
        tableTitle: 'Local editable',
        tableData: rows.slice(0, 8).map((row) => ({ ...row })),
        viewedRowOptions: { actionCodes: ['detail'], persist: { type: 'memory', maxSize: 3 } },
        gridOptions: {
          columns,
          height: 330,
          keepSource: true,
          rowConfig: { keyField: 'id' },
          checkboxConfig: { reserve: true },
          editConfig: { trigger: 'click', mode: 'row' },
          editRules: { name: [{ required: true }] },
          exportConfig: {},
          importConfig: {},
          printConfig: {},
          toolbarConfig: { export: true, import: true, print: true, custom: true },
        },
      });
      local = localApi;
      const [Lazy, lazyApi] = useVxeGrid<Row>({
        gridOptions: {
          columns,
          height: 160,
          proxyConfig: {
            autoLoad: false,
            ajax: {
              async query() {
                return { items: [{ id: 999, name: 'Manual', age: 1 }] };
              },
            },
          },
        },
      });
      lazy = lazyApi;
      const [Tree, treeApi] = useVxeGrid<Row>({
        gridOptions: {
          columns: [{ field: 'name', treeNode: true, title: 'Tree' }],
          height: 190,
          treeConfig: { transform: true, rowField: 'id', parentField: 'parentId' },
          data: [
            { id: 1, name: 'Parent', age: 1 },
            { id: 2, parentId: 1, name: 'Child', age: 2 },
          ],
        },
      });
      tree = treeApi;
      const [Virtual, virtualApi] = useVxeGrid<Row>({
        gridOptions: {
          height: 300,
          showOverflow: true,
          rowConfig: { keyField: 'id' },
          cellConfig: { height: 40 },
          columns: Array.from({ length: 30 }, (_, i) => ({
            field: i === 0 ? 'id' : `c${i}`,
            title: `Column ${i}`,
            width: 150,
            fixed: i === 0 ? ('left' as const) : undefined,
          })),
          data: Array.from({ length: 10000 }, (_, i) => ({
            id: i,
            name: `Virtual ${i}`,
            age: i,
            ...Object.fromEntries(
              Array.from({ length: 29 }, (_, j) => [`c${j + 1}`, `Virtual ${i}:${j + 1}`]),
            ),
          })),
          virtualYConfig: { enabled: true, gt: 0 },
          virtualXConfig: { enabled: true, gt: 0 },
        },
      });
      virtual = virtualApi;
      return () =>
        h('main', { style: 'padding:20px' }, [
          h('h1', 'VXE Table 4.21.10 acceptance'),
          show.value ? h(Remote) : null,
          h(Local, localProps.value),
          h(Lazy),
          h(Tree),
          h(Virtual),
        ]);
    },
  }),
);
app.mount('#app');
async function run(): Promise<void> {
  await settle();
  await pause(500);
  await test('initial-search-default-sort-once', () => {
    assert(callCount === 1, `requests ${callCount}`);
    assert(successCount === 1, 'success callback');
    return trace[0];
  });
  await test('no-form-and-autoLoad-false', () => {
    assert(!local.formApi && !lazy.formApi, 'unexpected form');
    assert(lazy.grid!.getData().length === 0, 'implicit load');
  });
  await test('manual-query-no-form', async () => {
    await lazy.query();
    await settle();
    assert(lazy.grid!.getData()[0]?.id === 999, 'manual load');
  });
  await test('invalid-submit-zero-requests', async () => {
    const before = callCount;
    await remote.formApi!.setValues({ name: '' });
    await remote.formApi!.submit();
    assert(callCount === before, 'invalid request');
  });
  await test('valid-submit-once', async () => {
    const before = callCount;
    await remote.formApi!.setValues({ name: 'submitted' });
    await remote.formApi!.submit();
    assert(callCount === before + 1, 'submit count');
  });
  await test('draft-not-used-and-parameter-precedence', async () => {
    await remote.formApi!.setValues({ name: 'draft' });
    await remote.query({ name: 'custom', extra: 1 });
    const last = trace[trace.length - 1] as { values: Values & { extra: number } };
    assert(last.values.name === 'submitted' && last.values.extra === 1, 'snapshot precedence');
    return last;
  });
  await test('pagination-and-multi-sort-filter-request', async () => {
    const before = callCount;
    const next = document.querySelector<HTMLButtonElement>('.schema-grid .vxe-pager--next-btn');
    assert(next, 'pager missing');
    next.click();
    await settle();
    const pageTrace = trace[trace.length - 1] as { page: { currentPage: number }; values: Values };
    assert(
      callCount === before + 1 &&
        pageTrace.page.currentPage === 2 &&
        pageTrace.values.name === 'submitted',
      'pagination snapshot',
    );
    remote.setGridOptions({
      sortConfig: { remote: true, multiple: true },
      filterConfig: { remote: true },
    });
    await settle();
    await remote.grid!.sort([
      { field: 'id', order: 'asc' },
      { field: 'age', order: 'desc' },
    ]);
    await settle();
    await remote.grid!.setFilter('age', [{ label: '20', value: 20, checked: true }]);
    await remote.query();
    const last = trace[trace.length - 1] as { sorts: unknown[]; filters: { values: number[] }[] };
    assert(
      last.sorts.length === 2 && last.filters[0]?.values[0] === 20,
      `native sort/filter payload ${JSON.stringify(last)}`,
    );
    return last;
  });
  await test('hide-retains-form-draft-no-request', async () => {
    const before = callCount;
    const form = remote.formApi;
    const button = document
      .querySelector<HTMLElement>('.schema-grid .vxe-icon-search')
      ?.closest('button');
    assert(button, 'search toggle missing');
    button.click();
    await settle();
    assert(remote.state.showSearchForm === false, 'search toolbar action did not toggle');
    assert(remote.formApi === form, 'form replaced');
    assert((await form!.getValues()).name === 'draft', 'lost draft');
    assert(callCount === before, 'hide requested');
    remote.toggleSearchForm(true);
  });
  await test('reset-submitOnChange-once', async () => {
    remote.formApi!.setState({ submitOnChange: true });
    const before = callCount;
    await remote.formApi!.resetByButton();
    await pause(400);
    assert(callCount === before + 1, `reset requests ${callCount - before}`);
    assert(remote.formApi!.getLatestSubmissionValues().name === 'initial', 'reset snapshot');
    remote.formApi!.setState({ submitOnChange: false });
  });
  await test('loading-query-is-skipped', async () => {
    delay = 150;
    const before = callCount;
    const first = remote.query();
    await pause(20);
    await remote.reload();
    await first;
    delay = 0;
    assert(callCount === before + 1, 'engine concurrency changed');
  });
  await test('failure-resolve-void-and-retry', async () => {
    fail = true;
    const result = await remote.query();
    fail = false;
    assert(result === undefined && errorCount === 1, 'failure semantics');
    await remote.query();
    assert(remote.grid!.getData().length === 10, 'retry failed');
  });
  await test('query-vs-reload-selection-sort', async () => {
    const grid = remote.grid!;
    await grid.sort('id', 'asc');
    await settle();
    await grid.setCheckboxRow(grid.getData()[0]!, true);
    await remote.query();
    assert(grid.getCheckboxRecords().length === 1, 'query cleared selection');
    await remote.reload();
    await settle();
    assert(
      grid.getCheckboxRecords().length === 0 && grid.getSortColumns().length === 0,
      'reload clearAll',
    );
  });
  await test('columns-stable-peripheral-state', async () => {
    const grid = local.grid!;
    const column = grid.getColumnByField('name');
    local.setLoading(true);
    local.setState({ tableTitle: 'Changed' });
    await settle();
    local.setLoading(false);
    assert(column === grid.getColumnByField('name'), 'columns reloaded');
  });
  await test('local-empty-array-clears', async () => {
    local.setState({ tableData: [] });
    await settle();
    assert(local.grid!.getData().length === 0, 'empty ignored');
    local.setState({ tableData: rows.slice(0, 8).map((row) => ({ ...row })) });
    await settle();
  });
  await test('props-priority-over-state-reactive', async () => {
    localProps.value = { tableTitle: 'Props title', tableData: [rows[20]!] };
    local.setState({ tableTitle: 'State title' });
    await settle();
    assert(
      local.grid!.getData()[0]?.id === 21 && document.body.textContent?.includes('Props title'),
      'props precedence',
    );
    localProps.value = {};
    await settle();
    assert(local.grid!.getData()[0]?.id === 1, 'props removal fallback');
  });
  await test('dynamic-columns-and-native-customization', async () => {
    local.setGridOptions({ columns: [...columns, { field: 'extra', title: 'Dynamic' }] });
    await settle();
    assert(local.grid!.getColumnByField('extra'), 'dynamic column missing');
    await local.grid!.hideColumn('age');
    assert(!local.grid!.getColumns().some((column) => column.field === 'age'), 'hide column');
    await local.grid!.showColumn('age');
    local.setGridOptions({ columns });
    await settle();
  });
  await test('native-edit-validate-cancel', async () => {
    const grid = local.grid!;
    const row = grid.getData()[0]!;
    const original = row.name;
    await grid.setEditRow(row);
    row.name = '';
    assert(await grid.fullValidate(row), 'required validation');
    row.name = 'Edited';
    await grid.revertData(row);
    await grid.clearEdit();
    assert(row.name === original, 'cancel did not restore');
  });
  await test('viewed-api-fifo-copy-remove-clear', () => {
    local.markKeysAsViewed([1, 2, 3, 4]);
    const copy = local.getViewedKeys();
    copy.clear();
    assert(
      local.getViewedKeys().size === 3 && !local.isRowViewed({ id: 1, name: '', age: 0 }),
      'fifo/copy',
    );
    local.removeViewedKeys([2]);
    assert(local.getViewedKeys().size === 2, 'remove');
    local.clearViewedRows();
    assert(!local.getViewedKeys().size, 'clear');
  });
  await test('viewed-operation-nested-columns-and-disable', async () => {
    local.setGridOptions({
      columns: [
        ...columns,
        {
          title: 'Actions',
          children: [
            {
              field: 'operation',
              title: 'Operation',
              cellRender: {
                name: 'CellOperation',
                options: [{ code: 'detail', text: 'Mark viewed' }],
                attrs: {
                  onClick: () => {
                    operations++;
                  },
                },
              },
            },
          ],
        },
      ],
    });
    await settle();
    const button = Array.from(document.querySelectorAll('button')).find(
      (item) => item.textContent === 'Mark viewed',
    );
    assert(button, 'operation missing');
    button.click();
    await settle();
    assert(
      operations === 1 &&
        local.getViewedKeys().size === 1 &&
        document.querySelector('.vxe-row--viewed'),
      'operation duplicate or not marked',
    );
    local.setState({ viewedRowOptions: false });
    await settle();
    assert(!document.querySelector('.vxe-row--viewed'), 'disable style');
    local.setGridOptions({ columns });
  });
  await test('tree-transform-expand', async () => {
    await tree.grid!.setAllTreeExpand(true);
    await settle();
    assert(document.body.textContent!.includes('Child'), 'child absent');
  });
  await test('tree-nested-expand', async () => {
    tree.setGridOptions({
      treeConfig: { transform: false },
      data: [
        {
          id: 11,
          name: 'Nested parent',
          age: 1,
          children: [{ id: 12, name: 'Nested child', age: 1 }],
        },
      ],
    });
    await settle();
    await tree.grid!.setAllTreeExpand(true);
    await settle();
    assert(document.body.textContent!.includes('Nested child'), 'nested child absent');
  });
  await test('virtual-xy-fixed-scroll', async () => {
    await virtual.grid!.scrollTo(2400, 120000);
    await settle();
    const domRows = document.querySelectorAll('.vxe-body--row').length;
    assert(domRows < 500, `DOM rows ${domRows}`);
    const viewport = document.querySelectorAll('main > .schema-grid')[4];
    assert(
      viewport?.textContent?.includes('Virtual 3000:'),
      'virtual scroll did not render the target row',
    );
    return { domRows, rows: virtual.grid!.getData().length };
  });
  await test('export-csv-current-data', async () => {
    const result = await local.grid!.exportData({ type: 'csv', download: false });
    assert(result && 'content' in result, 'export missing content');
    return typeof result.content;
  });
  await test('import-csv-and-print-html', async () => {
    await local.grid!.importByFile(
      new File(['ID,Name,Age\r\n501,Imported,37\r\n'], 'rows.csv', { type: 'text/csv' }),
      { mode: 'covering', message: false },
    );
    await settle();
    assert(
      local.grid!.getTableData().fullData[0]?.name === 'Imported',
      `import content: ${JSON.stringify(local.grid!.getTableData().fullData)}`,
    );
    const result = await local.grid!.getPrintHtml({});
    assert(result.html.includes('Imported'), 'print content');
  });
  await test('export-all-queryAll', async () => {
    const result = await remote.grid!.exportData({ type: 'csv', mode: 'all', download: false });
    assert(result.content.includes('Row 100'), 'full export missing queryAll data');
  });
  await test('export-import-print-dialog-components', async () => {
    await local.grid!.openExport();
    await settle();
    assert(document.querySelector('.vxe-table-export--panel'), 'export panel');
    await local.grid!.closeExport();
    await local.grid!.openImport();
    await settle();
    assert(document.querySelector('.vxe-table-export--select--file'), 'import panel');
    await local.grid!.closeImport();
    await local.grid!.openPrint();
    await settle();
    assert(document.querySelector('.vxe-table-export--panel'), 'print panel');
    await local.grid!.closePrint();
  });
  await test('languages-and-theme', async () => {
    const observed = [];
    for (const language of ['zh-CN', 'en-US'] as const) {
      locale.value = language;
      await nextTick();
      observed.push(VxeUI.getI18n('vxe.table.emptyText'));
    }
    theme.value = 'dark';
    await nextTick();
    assert(document.documentElement.getAttribute('data-vxe-ui-theme') === 'dark', 'theme absent');
    theme.value = 'light';
    return observed;
  });
  await test('web-storage-ttl', async () => {
    const helper = createViewedRows<Row>({
      persist: { type: 'localStorage', key: getStorageKey('table-lab-ttl'), ttl: 50 },
    });
    await helper.ready;
    helper.mark([1]);
    await helper.flush();
    helper.dispose();
    await pause(70);
    const restored = createViewedRows<Row>({
      persist: { type: 'localStorage', key: getStorageKey('table-lab-ttl'), ttl: 50 },
    });
    await restored.ready;
    assert(!restored.keys.value.size, 'ttl');
    restored.clear();
    await restored.flush();
    restored.dispose();
  });
  await test('indexedDB-namespace', async () => {
    const helper = createViewedRows<Row>({
      persist: {
        type: 'indexedDB',
        dbName: getStorageKey('viewed-table-lab-db'),
        key: getStorageKey('lab'),
      },
    });
    await helper.ready;
    helper.mark([2, '2']);
    await helper.flush();
    const restored = createViewedRows<Row>({
      persist: {
        type: 'indexedDB',
        dbName: getStorageKey('viewed-table-lab-db'),
        key: getStorageKey('lab'),
      },
    });
    await restored.ready;
    assert(restored.keys.value.size === 2, 'IDB key types');
    restored.clear();
    await restored.flush();
    helper.dispose();
    restored.dispose();
  });
  await test('session-storage-restore-isolation', async () => {
    const helper = createViewedRows<Row>({
      persist: { type: 'sessionStorage', key: getStorageKey('session-lab') },
    });
    await helper.ready;
    helper.mark([8]);
    await helper.flush();
    const restored = createViewedRows<Row>({
      persist: { type: 'sessionStorage', key: getStorageKey('session-lab') },
    });
    const isolated = createViewedRows<Row>({
      persist: { type: 'sessionStorage', key: getStorageKey('session-other') },
    });
    await Promise.all([restored.ready, isolated.ready]);
    assert(restored.keys.value.has(8) && !isolated.keys.value.size, 'session namespace');
    restored.clear();
    await restored.flush();
    helper.dispose();
    restored.dispose();
    isolated.dispose();
  });
  await test('dynamic-form-options-unmount-and-remount', async () => {
    const before = callCount;
    remote.setState({ formOptions: false });
    await settle();
    const removed = remote.formApi;
    assert(removed === undefined, 'form retained after disable');
    remote.setState({
      formOptions: { schema: [{ fieldName: 'name', component: 'Input', defaultValue: 'new' }] },
    });
    await settle();
    const restored = remote.formApi;
    assert(restored && (await restored.getValues()).name === 'new', 'form recreate');
    assert(callCount === before, 'form switch queried');
  });
  await test('proxy-runtime-replacement-no-double-wrap', async () => {
    let count = 0;
    let observed: unknown;
    lazy.setGridOptions({
      proxyConfig: {
        ajax: {
          async query(_params, values: object) {
            count++;
            observed = values;
            return { items: [{ id: 888, name: 'Replacement', age: 1 }] };
          },
        },
      },
    });
    await settle();
    await lazy.query({ marker: true });
    await settle();
    assert(count === 1 && lazy.grid!.getData()[0]?.id === 888, 'query replacement');
    return observed;
  });
  await test('title-cell-header-and-form-action-slots', async () => {
    let scopeValid = false;
    const item = await probe(
      {
        tableTitle: 'Fallback title',
        formOptions: { schema: [{ fieldName: 'name', component: 'Input', defaultValue: 'slot' }] },
        gridOptions: {
          height: 250,
          columns: [{ field: 'name', slots: { default: 'cell', header: 'header' } }],
          data: [rows[0]!],
        },
      },
      {
        'table-title': () => h('strong', 'Slot title'),
        cell: (scope) => {
          scopeValid = (scope.row as Row).name === 'Row 1';
          return h('span', 'Slot cell');
        },
        header: () => h('span', 'Slot header'),
        'form-name': (scope) => h('span', `Form field ${scope.modelValue}`),
        'form-submit-before': () => h('span', 'Prefixed action'),
        'submit-before': () => h('span', 'Direct action'),
      },
    );
    try {
      const text = item.host.textContent!;
      assert(
        scopeValid &&
          text.includes('Slot title') &&
          text.includes('Slot cell') &&
          text.includes('Slot header') &&
          text.includes('Form field slot') &&
          text.includes('Direct action') &&
          !text.includes('Prefixed action'),
        'slot delegation',
      );
    } finally {
      item.dispose();
    }
  });
  await test('custom-form-slot-does-not-wait-unmounted-form', async () => {
    let count = 0;
    const item = await probe(
      {
        formOptions: { schema: [] },
        gridOptions: {
          height: 200,
          columns,
          proxyConfig: {
            ajax: {
              async query() {
                count++;
                return { items: [] };
              },
            },
          },
        },
      },
      { form: () => h('div', 'External form') },
    );
    try {
      assert(
        count === 1 &&
          item.api.formApi === undefined &&
          item.host.textContent?.includes('External form'),
        'custom form deadlock',
      );
    } finally {
      item.dispose();
    }
  });
  await test('empty-loading-native-and-explicit-slot-priority', async () => {
    const item = await probe(
      { gridOptions: { height: 200, columns, data: [], emptyText: 'Native empty', loading: true } },
      { empty: () => h('div', 'Explicit empty'), loading: () => h('div', 'Explicit loading') },
    );
    try {
      assert(
        item.host.textContent?.includes('Explicit loading') &&
          item.host.textContent?.includes('Explicit empty'),
        'explicit slot priority',
      );
    } finally {
      item.dispose();
    }
    const native = await probe({
      gridOptions: { height: 200, columns, data: [], emptyText: 'Native empty' },
    });
    try {
      assert(native.host.textContent?.includes('Native empty'), 'native empty overwritten');
    } finally {
      native.dispose();
    }
  });
  await test('toolbar-native-only-events-and-search-single-button', async () => {
    let events = 0;
    const item = await probe({
      gridOptions: {
        height: 150,
        columns,
        toolbarConfig: { tools: [{ code: 'lab-action', name: 'Native tool' }] },
      },
      gridEvents: {
        toolbarToolClick() {
          events++;
        },
      },
    });
    try {
      const button = Array.from(item.host.querySelectorAll('button')).find(
        (node) => node.textContent === 'Native tool',
      );
      assert(button, 'native-only toolbar missing');
      button.click();
      await settle();
      assert(events === 1, `user events ${events}`);
    } finally {
      item.dispose();
    }
    const buttons = document.querySelectorAll('.schema-grid .vxe-icon-search');
    assert(buttons.length === 1, `search buttons ${buttons.length}`);
  });
  await test('viewed-external-ref-and-style-compose', async () => {
    const keys = ref([1]);
    const item = await probe({
      viewedRowOptions: {
        viewedKeys: keys,
        rowClassName: 'seen',
        rowStyle: { fontWeight: 'bold' },
      },
      gridOptions: {
        height: 180,
        columns,
        data: rows.slice(0, 3),
        rowClassName: 'original-row',
        rowStyle: { color: 'red' },
      },
    });
    try {
      keys.value = [2];
      await settle();
      assert(
        item.api.getViewedKeys().has(1) && item.api.getViewedKeys().has(2),
        'external ref merge',
      );
      assert(
        item.host.querySelectorAll('.original-row.seen').length === 2,
        'viewed class composition',
      );
    } finally {
      item.dispose();
    }
  });
  await test('late-response-after-unmount', async () => {
    let release!: (value: { items: Row[] }) => void;
    const item = await probe({
      gridOptions: {
        height: 150,
        columns,
        proxyConfig: {
          ajax: {
            query: () =>
              new Promise((resolve) => {
                release = resolve;
              }),
          },
        },
      },
    });
    item.dispose();
    release({ items: [rows[0]!] });
    await settle();
    assert(
      item.api.grid === undefined && item.api.formApi === undefined,
      'late response recreated refs',
    );
  });
  await test('classes-separator-global-and-local-config', async () => {
    VxeUI.setConfig({ grid: { size: 'mini', align: 'right' } });
    const item = await probe({
      class: 'outer-probe',
      gridClass: 'grid-probe',
      formOptions: { schema: [] },
      separator: { backgroundColor: 'rgb(1, 2, 3)' },
      gridOptions: { size: 'small', align: 'left', height: 180, columns, data: rows.slice(0, 1) },
    });
    try {
      assert(item.host.querySelector('.outer-probe .grid-probe.size--small'), 'classes/local size');
      assert(item.host.querySelector('.vxe-body--column.col--left'), 'local alignment');
      const separator = item.host.querySelector<HTMLElement>('.schema-grid__separator');
      assert(separator?.style.backgroundColor === 'rgb(1, 2, 3)', 'separator background');
      item.api.setState({ separator: false });
      await settle();
      assert(!item.host.querySelector('.schema-grid__separator'), 'separator false');
    } finally {
      item.dispose();
      VxeUI.setConfig({ grid: { size: 'small', align: 'left' } });
    }
  });
  await test('cell-image-and-link-renderers', async () => {
    const item = await probe({
      gridOptions: {
        height: 180,
        data: [
          {
            id: 1,
            name: 'data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7',
            age: 1,
          },
        ],
        columns: [
          {
            field: 'name',
            cellRender: { name: 'CellImage', props: { preview: false, width: 16 } },
          },
          { field: 'age', cellRender: { name: 'CellLink', props: { text: 'Read' } } },
        ],
      },
    });
    try {
      assert(
        item.host.querySelector('img')?.getAttribute('src')?.startsWith('data:image/gif'),
        'image src',
      );
      assert(
        Array.from(item.host.querySelectorAll('button')).some(
          (button) => button.textContent === 'Read',
        ),
        'link text',
      );
    } finally {
      item.dispose();
    }
  });
  await test('checkbox-radio-reserve-and-column-width', async () => {
    const item = await probe({
      gridOptions: {
        height: 180,
        rowConfig: { keyField: 'id' },
        checkboxConfig: { reserve: true },
        radioConfig: { reserve: true },
        data: rows.slice(0, 2),
        columns: [
          { type: 'checkbox', width: 45 },
          { type: 'radio', width: 45 },
          { field: 'name', width: 160 },
        ],
      },
    });
    try {
      const grid = item.api.grid!;
      await grid.setCheckboxRow(rows[0]!, true);
      await grid.setRadioRow(rows[0]!);
      await grid.loadData(rows.slice(2, 4));
      assert(
        grid.getCheckboxReserveRecords()[0]?.id === 1 && grid.getRadioReserveRecord()?.id === 1,
        'reserve across pages',
      );
      await grid.setColumnWidth('name', 240);
      assert(grid.getColumnByField('name')?.renderWidth === 240, 'column width');
    } finally {
      item.dispose();
    }
  });
  await test('native-export-formats', async () => {
    for (const type of ['txt', 'html', 'xml'] as const) {
      const result = await local.grid!.exportData({ type, download: false });
      assert(result.content.includes('Imported'), `${type} data`);
    }
  });
  await test('keepalive-preserves-instance-draft-and-query-count', async () => {
    const active = ref(true);
    let calls = 0;
    const [Grid, api] = useVxeGrid<Row, FormOptions, FormApi<Values>>(
      {
        formOptions: {
          schema: [{ fieldName: 'name', component: 'Input', defaultValue: 'cached' }],
        },
        gridOptions: {
          height: 180,
          columns,
          proxyConfig: {
            ajax: {
              query: async () => {
                calls++;
                return { items: rows.slice(0, 2) };
              },
            },
          },
        },
      },
      createTableSearch<Values>,
    );
    const host = document.createElement('div');
    document.body.append(host);
    const instance = createApp({
      render: () =>
        h(KeepAlive, null, { default: () => (active.value ? h(Grid) : h('div', 'inactive')) }),
    });
    instance.mount(host);
    try {
      await settle();
      const grid = api.grid;
      await api.formApi!.setValues({ name: 'draft' });
      active.value = false;
      await settle();
      assert(api.grid === grid && calls === 1, 'deactivation destroyed instance or queried');
      active.value = true;
      await settle();
      assert(api.grid === grid && calls === 1, 'activation remounted or queried');
      assert((await api.formApi!.getValues()).name === 'draft', 'cached draft lost');
      assert(
        host.querySelector('.vxe-table--body-wrapper')?.clientHeight,
        'activated viewport collapsed',
      );
    } finally {
      instance.unmount();
      host.remove();
    }
    assert(api.grid === undefined && api.formApi === undefined, 'cached unmount leaked refs');
  });
  await test('setup-replaces-global-watchers', async () => {
    const first = ref<TableLocale>('zh-CN'),
      second = ref<TableLocale>('en-US');
    setupVxeTable({ locale: first });
    const stop = setupVxeTable({ locale: second });
    first.value = 'en-US';
    await nextTick();
    first.value = 'zh-CN';
    await nextTick();
    assert(VxeUI.getLanguage() === 'en-US', 'old global watcher leaked');
    stop();
    second.value = 'zh-CN';
    await nextTick();
    assert(VxeUI.getLanguage() === 'en-US', 'dispose did not stop');
    setupVxeTable({ locale, theme });
  });
  await test('remount-single-initial', async () => {
    show.value = false;
    await settle();
    assert(!remote.grid && !remote.formApi, 'stale refs');
    const before = callCount;
    show.value = true;
    await settle();
    assert(callCount === before + 1, 'remount count');
  });
  document.querySelector('#lab-report')!.textContent = JSON.stringify({
    version: '4.21.10',
    userAgent: navigator.userAgent,
    results,
    trace,
  });
  document.documentElement.dataset.labStatus = 'complete';
}
void run().catch((error) => {
  document.querySelector('#lab-report')!.textContent = String(error);
  document.documentElement.dataset.labStatus = 'error';
});
