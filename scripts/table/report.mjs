import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { readFile, readdir, writeFile } from 'node:fs/promises';
import { cpus, totalmem, platform, arch } from 'node:os';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../../', import.meta.url));
const docs = join(root, 'docs/spec');
const readJson = async (name) => JSON.parse(await readFile(join(docs, name), 'utf8'));
const names = [
  'production',
  'standalone',
  'standalone-form',
  'reference',
  'example-admin',
  'example-user',
  'performance',
  'performance-controls',
];
const reports = Object.fromEntries(
  await Promise.all(names.map(async (name) => [name, await readJson(`vxe-table-${name}.json`)])),
);
for (const [name, report] of Object.entries(reports)) {
  if (
    !report.results.length ||
    report.results.some((result) => result.status !== 'pass') ||
    report.exceptions.length ||
    report.messages.some((item) => item.type === 'error')
  )
    throw new Error(`Unresolved browser failure: ${name}`);
  if (!report.browser.product.includes('/100.'))
    throw new Error(`Not a Chrome 100 report: ${name}`);
}
const checks = await readJson('vxe-table-project-checks.json');
if (checks.results.length !== 9 || checks.results.some((result) => result.exitCode !== 0))
  throw new Error('Project checks incomplete');
const reference = resolve(process.env.VBEN_SOURCE ?? join(root, '../vue-vben-admin'));
const git = (...args) =>
  execFileSync(
    'git',
    ['-c', `safe.directory=${reference.replaceAll('\\', '/')}`, '-C', reference, ...args],
    { encoding: 'utf8' },
  ).trim();
const sourceNames = [
  'use-vxe-grid.ts',
  'use-vxe-grid.vue',
  'api.ts',
  'types.ts',
  'init.ts',
  'extends.ts',
  'viewed-row/types.ts',
  'viewed-row/use-viewed-row.ts',
];
const sources = await Promise.all(
  sourceNames.map(async (name) => ({
    path: `packages/effects/plugins/src/vxe-table/${name}`,
    sha256: createHash('sha256')
      .update(await readFile(join(reference, 'packages/effects/plugins/src/vxe-table', name)))
      .digest('hex'),
  })),
);
const pkg = JSON.parse(await readFile(join(root, 'package.json'), 'utf8'));
const dependencyNames = [
  'vue',
  'antdv-next',
  'dayjs',
  'vxe-table',
  'vxe-pc-ui',
  '@vxe-ui/core',
  'xe-utils',
];
const hashFile = async (path) =>
  createHash('sha256')
    .update(await readFile(path))
    .digest('hex');
const installed = Object.fromEntries(
  await Promise.all(
    dependencyNames.map(async (name) => [
      name,
      JSON.parse(await readFile(join(root, 'node_modules', name, 'package.json'), 'utf8')).version,
    ]),
  ),
);
if (installed['vxe-table'] !== '4.21.10') throw new Error('Target engine version mismatch');
const artifacts = {};
for (const directory of [
  'dist/table-standalone',
  'dist/table-standalone-form',
  'node_modules/.cache/table-reference',
]) {
  const files = (await readdir(join(root, directory), { recursive: true })).filter((file) =>
    /\.(?:js|css|html)$/.test(file),
  );
  artifacts[directory] = await Promise.all(
    files.map(async (file) => {
      const bytes = await readFile(join(root, directory, file));
      return {
        file,
        bytes: bytes.length,
        sha256: createHash('sha256').update(bytes).digest('hex'),
      };
    }),
  );
}
const baseline = {
  generatedAt: new Date().toISOString(),
  reference: {
    path: reference,
    head: git('rev-parse', 'HEAD'),
    dirty: !!git('status', '--porcelain'),
    originalEngine: { 'vxe-table': '4.21.2', 'vxe-pc-ui': '4.17.18' },
    lockSha256: await hashFile(join(reference, 'pnpm-lock.yaml')),
    sources,
  },
  target: installed,
  dependencySpecifiers: Object.fromEntries(
    dependencyNames.map((name) => [name, pkg.dependencies[name]]),
  ),
  targetLocks: {
    npm: await hashFile(join(root, 'package-lock.json')),
    pnpm: await hashFile(join(root, 'pnpm-lock.yaml')),
  },
  artifacts,
  evidenceHashes: Object.fromEntries(
    await Promise.all(
      names.map(async (name) => [name, await hashFile(join(docs, `vxe-table-${name}.json`))]),
    ),
  ),
  machine: {
    cpu: cpus()[0]?.model,
    logicalCpus: cpus().length,
    memoryGiB: totalmem() / 2 ** 30,
    platform: platform(),
    arch: arch(),
    node: process.version,
  },
};
await writeFile(join(docs, 'vxe-table-baseline.json'), JSON.stringify(baseline, null, 2));
const matrix = [...reports.performance.performance, ...reports['performance-controls'].performance];
const groups = new Map();
for (const sample of matrix) {
  const key = `${sample.scenario ?? 'table'} / ${sample.rows}×${sample.columns} / ${sample.mode}`;
  if (!groups.has(key)) groups.set(key, []);
  groups.get(key).push(sample);
}
if (matrix.length !== 120 || groups.size !== 24) throw new Error('Incomplete performance matrix');
for (const [group, samples] of groups) {
  if (
    samples.length !== 5 ||
    new Set(samples.map((sample) => sample.round)).size !== 5 ||
    samples.some(
      (sample) => !Number.isInteger(sample.round) || sample.round < 0 || sample.round > 4,
    )
  )
    throw new Error(`Incomplete rounds: ${group}`);
  for (const sample of samples) {
    for (const metric of ['mountMs', 'scrollMs', 'replaceMs', 'updateMs', 'inputMs', 'dom']) {
      if (sample[metric] !== undefined && (!Number.isFinite(sample[metric]) || sample[metric] < 0))
        throw new Error(`Invalid ${metric}: ${group}`);
    }
  }
}
const percentile = (values, percent) => {
  const sorted = values.toSorted((a, b) => a - b);
  return Math.round(sorted[Math.max(0, Math.ceil(sorted.length * percent) - 1)] * 100) / 100;
};
const summaries = [...groups].map(([group, samples]) => ({
  group,
  count: samples.length,
  metrics: Object.fromEntries(
    ['mountMs', 'scrollMs', 'replaceMs', 'updateMs', 'inputMs', 'dom']
      .filter((metric) => samples[0][metric] !== undefined)
      .map((metric) => [
        metric,
        {
          median: percentile(
            samples.map((sample) => sample[metric]),
            0.5,
          ),
          p95: percentile(
            samples.map((sample) => sample[metric]),
            0.95,
          ),
        },
      ]),
  ),
}));
await writeFile(
  join(docs, 'vxe-table-performance-summary.json'),
  JSON.stringify(
    {
      baseline,
      config: {
        browser: reports.performance.browser.product,
        mode: 'production',
        rounds: 5,
        order: 'alternating vben/target/native and native/target/vben',
        rowHeight: 40,
        columnWidth: 150,
        height: 400,
        width: 1100,
        keepSource: false,
        virtualX: true,
        virtualY: true,
        fixedFirstColumn: true,
        notes:
          'Controls: 100 rows, keepSource true, identical antdv-next Input; search has six identical Input fields. Includes two animation frames and layout, excludes data generation/network.',
      },
      summaries,
    },
    null,
    2,
  ),
);
const guide = await readFile(join(docs, 'vxe-table-vben-replication-guide.md'), 'utf8');
const sourceRows = [...guide.matchAll(/^\| ((?:W|N|D)-\d+) \| (.+)$/gm)].filter(
  (match) => !match[2].includes('query →'),
);
const mapping = {
  'W-01': [
    'initial-search-default-sort-once',
    'remount-single-initial',
    'keepalive-preserves-instance-draft-and-query-count',
  ],
  'W-02': ['late-response-after-unmount'],
  'W-03': ['no-form-and-autoLoad-false', 'custom-form-slot-does-not-wait-unmounted-form'],
  'W-04': ['columns-stable-peripheral-state'],
  'W-05': ['props-priority-over-state-reactive'],
  'W-06': ['dynamic-columns-and-native-customization'],
  'W-07': ['empty-loading-native-and-explicit-slot-priority'],
  'W-08': ['draft-not-used-and-parameter-precedence', 'failure-resolve-void-and-retry'],
  'W-09': ['query-vs-reload-selection-sort'],
  'W-10': ['hide-retains-form-draft-no-request'],
  'W-11': ['title-cell-header-and-form-action-slots'],
  'W-12': ['props-priority-over-state-reactive'],
  'W-13': ['toolbar-native-only-events-and-search-single-button'],
  'W-14': ['dynamic-form-options-unmount-and-remount'],
  'W-15': ['hide-retains-form-draft-no-request'],
  'W-16': ['hide-retains-form-draft-no-request'],
  'W-17': ['local-empty-array-clears'],
  'W-18': ['initial-search-default-sort-once', 'props-priority-over-state-reactive'],
  'W-19': ['columns-stable-peripheral-state'],
  'W-20': ['props-priority-over-state-reactive'],
  'W-21': ['props-priority-over-state-reactive'],
  'W-22': ['toolbar-native-only-events-and-search-single-button'],
  'W-23': [
    'toolbar-native-only-events-and-search-single-button',
    'hide-retains-form-draft-no-request',
  ],
  'W-24': ['pagination-and-multi-sort-filter-request'],
  'W-25': ['initial-search-default-sort-once'],
  'W-26': ['empty-loading-native-and-explicit-slot-priority'],
  'W-27': ['title-cell-header-and-form-action-slots'],
  'W-28': ['title-cell-header-and-form-action-slots'],
  'W-29': ['title-cell-header-and-form-action-slots'],
  'W-30': ['title-cell-header-and-form-action-slots'],
  'W-31': ['custom-form-slot-does-not-wait-unmounted-form'],
  'W-32': ['setup-replaces-global-watchers'],
  'W-33': ['title-cell-header-and-form-action-slots'],
  'W-34': ['languages-and-theme', 'setup-replaces-global-watchers'],
  'W-35': ['viewed-api-fifo-copy-remove-clear'],
  'W-36': ['viewed-api-fifo-copy-remove-clear'],
  'W-37': ['viewed-external-ref-and-style-compose'],
  'W-38': ['viewed-operation-nested-columns-and-disable'],
  'W-39': ['web-storage-ttl', 'session-storage-restore-isolation', 'indexedDB-namespace'],
  'W-40': ['viewed-operation-nested-columns-and-disable'],
  'N-01': ['local-empty-array-clears', 'manual-query-no-form'],
  'N-02': ['pagination-and-multi-sort-filter-request', 'query-vs-reload-selection-sort'],
  'N-03': ['dynamic-columns-and-native-customization', 'columns-stable-peripheral-state'],
  'N-04': ['query-vs-reload-selection-sort'],
  'N-05': ['tree-transform-expand', 'tree-nested-expand'],
  'N-06': ['virtual-xy-fixed-scroll'],
  'N-07': ['native-edit-validate-cancel'],
  'N-08': ['native-edit-validate-cancel'],
  'N-09': [
    'import-csv-and-print-html',
    'export-all-queryAll',
    'export-import-print-dialog-components',
  ],
  'N-10': ['toolbar-native-only-events-and-search-single-button'],
};
Object.assign(mapping, {
  'W-12': ['classes-separator-global-and-local-config'],
  'W-16': ['classes-separator-global-and-local-config', 'hide-retains-form-draft-no-request'],
  'W-18': ['classes-separator-global-and-local-config', 'props-priority-over-state-reactive'],
  'W-33': ['cell-image-and-link-renderers'],
  'N-03': ['dynamic-columns-and-native-customization', 'checkbox-radio-reserve-and-column-width'],
  'N-04': ['query-vs-reload-selection-sort', 'checkbox-radio-reserve-and-column-width'],
  'N-09': [
    'import-csv-and-print-html',
    'export-all-queryAll',
    'export-import-print-dialog-components',
    'native-export-formats',
  ],
});
const decisions = {
  'D-01': '修正：显式空数组清空。',
  'D-02': '修正：无搜索不创建 Form，formApi 为 undefined。',
  'D-03': '保留：query/reload resolve void 不代表请求成功。',
  'D-04': '保留：loading 中跳过 query/reload；没有最新请求胜出增强。',
  'D-05': '扩展：中英文原生文本与浮层。',
  'D-06': '独立 CSS 和 VXE 主题；不复制参考 Tailwind4/:has/强制自动高度。',
  'D-07': '继承 SchemaForm：所有 submit 校验。',
  'D-08': '修正：过滤所有 Event，包括 MouseEvent。',
  'D-09': '完整 form slot 为外部搜索；不创建/等待默认 Form，formApi 为 undefined。',
  'D-10': '明确排除：persist 字符串旧简写；现代对象全部支持。',
};
const validCases = new Set(reports.production.results.map((result) => result.id));
const audit = sourceRows.map((match) => {
  const id = match[1],
    cells = match[2].split(' | ').map((cell) => cell.trim().replace(/\|$/, ''));
  const cases = mapping[id] ?? [];
  for (const name of cases)
    if (!validCases.has(name)) throw new Error(`Missing evidence ${id}: ${name}`);
  const difference = id.startsWith('D-')
    ? decisions[id]
    : ['W-03', 'W-17', 'W-22', 'W-24', 'W-31', 'W-34'].includes(id)
      ? '边界调整见 README 与 D 项。'
      : '保留现代包装接口；原生行为以4.21.10为准。';
  return {
    id,
    capability: cells[0],
    reference: cells[1],
    status: id.startsWith('D-') ? (id === 'D-10' ? '明确排除' : '有意差异') : '验收通过',
    difference,
    implementation: id.startsWith('D-')
      ? 'src/libs/table/README.md'
      : id === 'W-33'
        ? 'src/adapters/table-renderers.ts'
        : Number(id.slice(2)) >= 35 && id.startsWith('W')
          ? 'src/libs/table/viewed-row/'
          : 'src/libs/table/useVxeGrid.ts; src/libs/table/core/; src/adapters/table-form.ts',
    cases,
    evidence: id.startsWith('D-')
      ? 'README、参考trace与production报告'
      : 'vxe-table-production.json；tests/unit/vxe-table.spec.ts；example-admin/user报告',
    limits: '仅覆盖列出的场景；业务组合仍依所选 VXE 版本。',
  };
});
audit.push({
  id: 'D-11',
  capability: '卸载后回包',
  status: '有意差异',
  difference: 'query/queryAll 在卸载后拒绝过期结果，交给 VXE 原生错误分支，防止销毁DOM访问。',
  cases: ['late-response-after-unmount'],
  implementation: 'src/libs/table/core/proxy.ts',
});
await writeFile(
  join(docs, 'vxe-table-vben-audit.json'),
  JSON.stringify({ baseline, rows: audit }, null, 2),
);
await writeFile(
  join(docs, 'vxe-table-vben-audit.md'),
  `# VXE Table 能力审计\n\n基线：Vben ${baseline.reference.head}（工作区${baseline.reference.dirty ? '有修改' : '干净'}）；目标 VXE 4.21.10 / UI 4.18.9。\n\n每项结论仅指本模块和列出的测试，不代表所有业务组合已验证。包装层差异在 README/下表公开记录。原生能力由真实 VXE 验证，没有占位引擎。\n\n| 编号 | 能力 | 状态 | 实现 | 用例 / 决策 |\n| --- | --- | --- | --- | --- |\n${audit.map((row) => `| ${row.id} | ${row.capability.replaceAll('|', '/')} | ${row.status} | ${row.implementation} | ${row.cases?.join(', ') || row.difference} |`).join('\n')}\n\n测试完整结果见结构化 JSON 与 vxe-table-acceptance.md。CellOperation 是宿主基础按钮扩展，未声称复刻 playground 的完整菜单；XLSX/PDF/公式/透视等插件明确排除。\n`,
);
await writeFile(
  join(docs, 'vxe-table-acceptance.md'),
  `# VXE Table 验收\n\n目标版本 **vxe-table 4.21.10**，中英文，Chrome 100。生成时间 ${baseline.generatedAt}。\n\n## 执行结果\n\n| 检查 | 结果 | 证据 |\n| --- | --- | --- |\n${checks.results.map((item) => `| ${item.command} | exit 0 | ${item.log} |`).join('\n')}\n${names.map((name) => `| Chrome 100 ${name} | ${reports[name].results.length} 项通过，0 异常/错误 | vxe-table-${name}.json |`).join('\n')}\n\n## 范围与差异\n\n入口 src/adapters/table.ts；独立库 src/libs/table；示例 /examples/vxe-table。已有 ProTable 保留。六类代理回调共享原生 VXE 查询所有者，搜索草稿与提交快照分开。40 项包装能力、10 项原生能力及差异决策见 vxe-table-vben-audit.md/json。\n\nTable 单独复制宿主无项目别名/全局组件/Tailwind，构建图拒绝 SchemaForm、TanStack、Zod、router/store；查询、编辑撤销、英语、暗色和 CSS 在 Chrome 100 运行。另一个宿主复制 Table + Form + 桥接，仅改桥接的导入路径，验证初查默认值、无效提交、有效提交、草稿隔离、搜索显隐和卸载；其构建图拒绝原项目 src、router/store 和 Tailwind。浏览器产物截图与 JSON 同名；admin/user 的 narrow 截图为 390px。\n\n源码参考提交与文件 SHA256、工作区状态、实际依赖见 vxe-table-baseline.json。参考包装层直接导入原仓库源码，不用 mock 替代 VXE；构建时将引擎统一到 4.21.10/UI4.18.9。参考本身的 Tailwind 指令与 :has 样式不属于目标生产产物，它们仅在 node_modules/.cache/table-reference 对照产物中。\n\n## 性能方法与结果\n\n原生 VXE / 原始 Vben wrapper / 本库，真实 Grid；同一 Chrome 100、机器和 production 构建。100/1,000/10,000 行 × 10/30 列，每组5轮，交替顺序，逐个挂载/卸载。预先生成数据，排除网络。共同 viewport 1100×400、行高40、列宽150、首列固定、横纵虚拟化；基础组 keepSource=false。控件组100行、keepSource=true，同一 antdv-next Input，搜索为6字段。每次计时包含2帧和布局；不是纯JS耗时，也不是浏览器启动/下载耗时。\n\n共 ${matrix.length} 样本。逐轮数据和中位数/p95 在 vxe-table-performance*.json。5轮的p95接近最慢轮，不能据此承诺普遍提速；未设未经基线测量的倍数门槛。原始参考全局 CSS 在共同对照页面加载，三组共享；未模拟整个 Vben 应用页面或后端。\n\n| 场景 / 规模 / 实现 | 挂载 median / p95 (ms) | DOM median |\n| --- | --- | --- |\n${summaries.map((item) => `| ${item.group} | ${item.metrics.mountMs.median} / ${item.metrics.mountMs.p95} | ${item.metrics.dom.median} |`).join('\n')}\n\n## 已公开边界\n\n- loading 中的新 query/reload 被原生引擎跳过；没有请求调度增强。卸载后过期回包被阻止写销毁实例。\n- 自定义完整 form slot 由调用者管理，不暴露默认 formApi；原生 CSV 使用 CRLF，导入后读 getTableData().fullData。\n- persist 旧字符串简写、XLSX/PDF 等额外插件、公式/透视不在支持范围；CellOperation 只提供宿主按钮/actionCodes，并非完整 playground 菜单。\n- HTML 打印内容/配置面板已验证，实体打印设备和操作系统打印对话框不自动验收。\n- 本次未提交 Git、未发布；本结论不表示原业务页面已经迁移。\n`,
);
console.log(
  `Audit: ${audit.length} rows; ${matrix.length} performance samples; all required report gates passed.`,
);
