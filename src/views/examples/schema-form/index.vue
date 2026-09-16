<template>
  <article class="form-documentation">
    <header class="form-doc-intro">
      <p class="form-doc-eyebrow">COMPONENTS / FORM</p>
      <h1>SchemaForm 表单</h1>
      <p>面向 antdv-next 的声明式表单。选择示例、操作表单，并展开源码查看对应实现。</p>
      <div class="form-doc-badges">
        <Tag color="blue">antdv-next</Tag><Tag color="green">Chrome 100 已验收</Tag
        ><Tag>独立目录 src/libs/form</Tag>
      </div>
      <Alert
        type="info"
        show-icon
        message="与 Vben 的关系"
        description="所有表单统一使用 useSchemaForm，配置与核心行为对齐 Vben，支持 Zod、分组、数组、联动和插槽。废弃项和多 UI 适配不支持。"
      />
      <p>
        <a
          href="https://doc.vben.pro/components/common-ui/vben-form.html"
          target="_blank"
          rel="noopener noreferrer"
          >Vben Form 原文档 ↗</a
        >
        · 对照日期：2026-09-15 · 下列源码使用本项目 API
      </p>
    </header>
    <nav class="form-doc-nav" aria-label="表单文档目录">
      <button v-for="demo in demos" :key="demo.id" @click="go(`form-demo-${demo.id}`)">
        {{ demo.title }}
      </button>
      <button @click="go('form-api')">API 参考</button
      ><button @click="go('form-vben-audit')">Vben 功能对照</button>
    </nav>
    <DemoBlock
      v-for="demo in demos"
      :key="demo.id"
      v-bind="demo"
      :initially-open="demo.id === 'basic'"
    />
    <section id="form-api" class="form-doc-section">
      <h2>API 参考</h2>
      <p>
        <code>const [Form, api] = useSchemaForm&lt;T, C, P, S&gt;(options)</code>。在 setup
        中创建，一份 API 同时挂载一个 Form。以下签名为阅读简写，完整导出类型见本节末尾。
      </p>
      <p>
        validate 返回 { valid, errors }；submit 校验失败返回 undefined。数据 API 等待挂载，使用
        await 读取结果；业务异常和已取消会话通过 Promise 拒绝。
      </p>
      <div class="form-doc-table-wrap">
        <table>
          <caption>
            FormApi · 业务公开成员
          </caption>
          <thead>
            <tr>
              <th>方法 / 状态</th>
              <th>签名</th>
              <th>说明</th>
              <th>实际示例</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="(row, name) in apiDocs" :key="name">
              <td>
                <code>{{ name }}</code>
              </td>
              <td>
                <code>{{ row.signature }}</code>
              </td>
              <td>{{ row.note }}</td>
              <td>
                <button class="form-doc-link" @click="go(`form-demo-${row.demo}`, true)">
                  运行示例
                </button>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
      <div v-for="group in configGroups" :key="group.title" class="form-doc-table-wrap">
        <table>
          <caption>
            {{
              group.title
            }}
          </caption>
          <thead>
            <tr>
              <th>属性</th>
              <th>类型</th>
              <th>默认值</th>
              <th>说明</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="row in group.rows" :key="row[0]">
              <td>
                <code>{{ row[0] }}</code>
              </td>
              <td>
                <code>{{ row[1] }}</code>
              </td>
              <td>{{ row[2] }}</td>
              <td>{{ row[3] }}</td>
            </tr>
          </tbody>
        </table>
      </div>
      <h3>Slots 与扩展</h3>
      <p>
        字段直接使用同名插槽，例如 #amount，接收
        componentField、componentProps、field、modelValue、formApi 等。四个操作区插槽为
        submit-before、reset-before、expand-before、expand-after。
      </p>
      <p>
        rules 使用 Zod 或命名规则；dependencies.resolve 接收 { values, actions, controller, schema
        }，返回 if/show/disabled/required/componentProps/rules 等状态。依赖字段必须声明在
        triggerFields 中。
      </p>
      <details @toggle="loadTypes">
        <summary>完整 TypeScript 定义（直接读取 src/libs/form/types.ts）</summary>
        <pre class="form-doc-types" tabindex="0"><code>{{ typesSource }}</code></pre>
      </details>
    </section>
    <section id="form-vben-audit" class="form-doc-section">
      <h2>Vben 功能对照</h2>
      <p>
        以下展示 useSchemaForm 的当前实现。已实现、有意差异、已测量和排除项分别标注；废弃项和多 UI
        适配不纳入支持范围，分项数量不代表功能覆盖率。
      </p>
      <p>
        已核对线上章节、FormApi、Props、Schema、联动、规则和
        Slots，并以正式组件测试与本页示例验证已有行为。未运行 Vben
        全套测试，不把推测当作两库运行时等价结论。
      </p>
      <div class="form-doc-filters">
        <label
          >搜索 API
          <Input v-model:value="query" placeholder="如 group、rules、submitOnChange" allow-clear
        /></label>
        <label>结果 <Select v-model:value="status" :options="statusOptions" /></label>
        <span role="status">{{ filteredRows.length }} / {{ auditRows.length }} 个对照条目</span>
      </div>
      <div class="form-doc-table-wrap">
        <table>
          <caption>
            Vben → useSchemaForm 当前能力对照
          </caption>
          <thead>
            <tr>
              <th>位置</th>
              <th>Vben 功能 / API</th>
              <th>当前状态</th>
              <th>useSchemaForm 当前实现</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="row in filteredRows" :key="`${row.category}/${row.name}`">
              <td>{{ row.category }}</td>
              <td>
                <code>{{ row.name }}</code>
              </td>
              <td>
                <Tag :color="statusColor(row.modern.status)">{{ row.modern.status }}</Tag>
              </td>
              <td>{{ row.modern.note }}</td>
            </tr>
            <tr v-if="!filteredRows.length">
              <td colspan="4">没有匹配条目</td>
            </tr>
          </tbody>
        </table>
      </div>
    </section>
  </article>
</template>
<script setup lang="ts">
import type { ModernAudit } from './modern-audit';

import { Alert, Input, Select, Tag } from 'antdv-next';
import { computed, ref } from 'vue';

import { demos } from './catalog';
import DemoBlock from './DemoBlock.vue';
import { apiDocs, auditRows, fieldRows, optionRows, uiRows } from './reference';
import './documentation.css';
const configGroups = [
  { title: 'useSchemaForm(options)', rows: optionRows },
  { title: 'FormSchema / schema', rows: fieldRows },
  { title: 'FormCommonConfig / commonConfig', rows: uiRows },
];
const query = ref('');
const typesSource = ref('');
async function loadTypes(): Promise<void> {
  if (typesSource.value) return;
  try {
    typesSource.value = (await import('@/libs/form/types.ts?raw')).default;
  } catch (error) {
    typesSource.value = `类型源码加载失败：${String(error)}`;
  }
}
const status = ref('全部');
const statusOptions = ['全部', '已实现', '有意差异', '已测量', '部分排除', '排除'].map((value) => ({
  label: value,
  value,
}));
const filteredRows = computed(() =>
  auditRows.filter(
    (row) =>
      (status.value === '全部' || row.modern.status === status.value) &&
      `${row.category} ${row.name} ${row.modern.note}`
        .toLowerCase()
        .includes(query.value.trim().toLowerCase()),
  ),
);
function statusColor(value: ModernAudit['status']): string {
  return { 已实现: 'green', 有意差异: 'gold', 已测量: 'blue', 部分排除: 'orange', 排除: 'default' }[
    value
  ];
}
function go(id: string, activate = false): void {
  const section = document.getElementById(id);
  if (activate) {
    const button = section?.querySelector<HTMLButtonElement>('[data-demo-run]');
    if (button?.getAttribute('aria-expanded') === 'false') button.click();
  }
  section?.scrollIntoView({ behavior: 'smooth', block: 'start' });
}
</script>
