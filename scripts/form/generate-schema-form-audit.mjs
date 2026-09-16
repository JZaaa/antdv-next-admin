import { createHash } from 'node:crypto';
import { readFile, stat, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

import { apiDocs, auditRows } from '../../src/views/examples/schema-form/reference.ts';
import { readReferenceSource } from './reference-source.mjs';
const root = new URL('../../', import.meta.url);
const source = await readReferenceSource(fileURLToPath(root));
const reference = new URL('docs/spec/vben-form-reference.html', root);
const html = await readFile(reference);
const sourceInfo = await stat(reference);
const counts = Object.fromEntries(
  ['已实现', '有意差异', '已测量', '部分排除', '排除'].map((status) => [
    status,
    auditRows.filter((row) => row.modern.status === status).length,
  ]),
);
const report = {
  generatedAt: new Date().toISOString(),
  source: {
    url: 'https://doc.vben.pro/components/common-ui/vben-form.html',
    snapshotModifiedAt: sourceInfo.mtime.toISOString(),
    sha256: createHash('sha256').update(html).digest('hex'),
    ...source,
  },
  entry: 'useSchemaForm',
  method: '仅记录当前统一实现、差异与可执行证据。条数不等于覆盖率。',
  counts,
  scope: { ui: 'antdv-next', excluded: ['废弃 API、类型别名及旧配置协议', '多 UI 适配'] },
  publicApiMembers: Object.keys(apiDocs).length,
  rows: auditRows.map(({ modern, ...row }) => ({ ...row, ...modern })),
};
await writeFile(
  new URL('docs/spec/schema-form-vben-audit.json', root),
  JSON.stringify(report, null, 2) + '\n',
);
const escape = (text) => String(text).replaceAll('|', '\\|').replaceAll('\n', ' ');
const lines = [
  '# SchemaForm 与本地 Vben 逐项核对',
  '',
  '统一入口：useSchemaForm。支持现代 Vben Form 的配置、API、分组/数组、Zod、联动、布局与插槽；废弃项和多 UI 适配排除。',
  '',
  '## 依据与验收边界',
  '',
  `- 本地参考：${source.local}，form-ui ${source.version}，HEAD ${source.head}；工作区${source.dirty ? '有未提交修改' : '干净'}。源码优先于线上文档。`,
  '- 参考版本为生成时读取的仓库状态；能力声明来自 reference.ts，生成报告不等于对该版本重新完成验收。',
  '- [使用指南](../../src/libs/form/README.md) · [验收结果](./schema-form-vben-implementation.md) · [编号能力清单及 Vben 行为](./schema-form-vben-migration-plan.md)。',
  '- 所有 submit 均校验有效规则，失败返回 undefined、不调用业务回调。hide/if/show 停规则、默认保值可提交；折叠和 disabled 仍校验。',
  '- UI 使用 antdv-next，字段手工错误按路径保留；数组采用索引 key。运行时性能数字不代表 DOM 渲染或整个项目迁移后的速度。',
  '',
  '## 当前能力',
  '',
  JSON.stringify(counts) + '。章节与属性有交叉，不换算覆盖率。',
  '',
  '| 编号 | 类别 | Vben 能力 | 当前状态 / 一致性与差异 | 实现位置 | 验证证据 |',
  '| --- | --- | --- | --- | --- | --- |',
  ...report.rows.map(
    (row) =>
      '| ' +
      String(row.id).padStart(3, '0') +
      ' | ' +
      escape(row.category) +
      ' | ' +
      escape(row.name) +
      ' | ' +
      escape(row.status + '：' + row.note) +
      ' | ' +
      escape(row.source) +
      ' | ' +
      escape(row.evidence) +
      ' |',
  ),
  '',
  '## 复验',
  '',
  '执行 type-check、lint、全量单测、生产/Demo 构建和 Chrome 100 兼容检查；构建 lab 与 standalone，运行 --schema、--documentation、--documentation --user、--standalone 浏览器场景。',
  '',
  '页面与报告共用 reference.ts，运行 node scripts/form/generate-schema-form-audit.mjs 更新报告。',
  '',
];
await writeFile(new URL('docs/spec/schema-form-vben-audit.md', root), lines.join('\n'));
console.log(JSON.stringify({ rows: auditRows.length, counts }, null, 2));
