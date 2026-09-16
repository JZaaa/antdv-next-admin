<template>
  <main>
    <h1>Form 验证与对照</h1>
    <p>检查表单异步生命周期、公开 API 与字段订阅。能力缺口与实验执行错误分别记录。</p>
    <label
      >引擎：<select v-model="engine" :disabled="running">
        <option value="native">antdv-next 原生</option>
        <option value="tanstack">TanStack + antdv-next 展示</option>
        <option value="schema">独立 SchemaForm 验收</option>
        <option value="performance">SchemaForm 性能对照</option>
      </select></label
    >
    <p>SchemaForm 是正式组件验收；原生与 TanStack 直接使用组保留历史能力缺口，供实现对照。</p>
    <button :disabled="running" @click="run">{{ running ? '运行中…' : '运行当前套件' }}</button>
    <span role="status">{{ status }}</span>
    <table>
      <thead>
        <tr>
          <th>对照组</th>
          <th>场景</th>
          <th>结果</th>
          <th>通过标准 / 观测目标</th>
        </tr>
      </thead>
      <tbody>
        <tr v-for="result in results" :key="result.id">
          <td>
            {{
              result.id.startsWith('schema-')
                ? '正式 SchemaForm'
                : result.id.startsWith('guarded-')
                  ? '生命周期保护原型'
                  : result.id.startsWith('ts-')
                    ? 'TanStack 直接使用'
                    : 'antdv-next 原生'
            }}
          </td>
          <td>
            <details>
              <summary>{{ result.title }}</summary>
              <pre>{{ JSON.stringify(result.observed, null, 2) }}</pre>
            </details>
          </td>
          <td :class="result.status">{{ labels[result.status] }}</td>
          <td>{{ result.expected }}</td>
        </tr>
      </tbody>
    </table>
    <h2>运行中的测试表单</h2>
    <div ref="host" class="fixture"></div>
    <h2>可复制的完整结果</h2>
    <pre id="lab-report">{{ report ? JSON.stringify(report, null, 2) : '尚未完成' }}</pre>
  </main>
</template>

<script setup lang="ts">
import type { ExperimentReport, ExperimentResult } from './experiments';

import { computed, onMounted, ref, shallowRef } from 'vue';

import { runExperiments } from './experiments';

const host = ref<HTMLElement>();
const requestedEngine = new URLSearchParams(location.search).get('engine');
const engine = ref(
  requestedEngine === 'schema' ||
    requestedEngine === 'tanstack' ||
    requestedEngine === 'performance' ||
    requestedEngine === 'native'
    ? requestedEngine
    : 'schema',
);
const running = ref(false);
const results = ref<ExperimentResult[]>([]);
const report = shallowRef<ExperimentReport>();
const fatalError = ref('');
const labels = { pass: '通过 / 观测确认', gap: '能力缺口', error: '执行错误' };
const status = computed(
  () =>
    fatalError.value ||
    `${results.value.length} 项：${results.value.filter((r) => r.status === 'gap').length} 个能力缺口，${results.value.filter((r) => r.status === 'error').length} 个执行错误`,
);

async function run(): Promise<void> {
  if (running.value || !host.value) return;
  running.value = true;
  results.value = [];
  report.value = undefined;
  fatalError.value = '';
  document.documentElement.dataset.labStatus = 'running';
  try {
    const runEngine =
      engine.value === 'performance'
        ? (await import('./schema-performance')).runSchemaPerformance
        : engine.value === 'schema'
          ? (await import('./schema-experiments')).runSchemaExperiments
          : engine.value === 'tanstack'
            ? (await import('./tanstack-experiments')).runTanStackExperiments
            : runExperiments;
    report.value = await runEngine(host.value, (result) => results.value.push(result));
    document.documentElement.dataset.labStatus = 'complete';
  } catch (error) {
    fatalError.value = error instanceof Error ? error.message : String(error);
    document.documentElement.dataset.labStatus = 'error';
  } finally {
    running.value = false;
  }
}

onMounted(() => {
  if (new URLSearchParams(location.search).get('autorun') === '1') void run();
});
</script>

<style scoped>
main {
  max-width: 1200px;
  margin: 32px auto;
  padding: 0 24px;
  font:
    15px/1.6 system-ui,
    sans-serif;
  color: #18253b;
}
h1 {
  font-size: 28px;
}
button {
  padding: 8px 16px;
  margin: 8px 16px 20px 0;
  cursor: pointer;
}
table {
  width: 100%;
  border-collapse: collapse;
}
th,
td {
  border: 1px solid #ccd4df;
  padding: 10px;
  text-align: left;
  vertical-align: top;
}
th {
  background: #edf2f8;
}
td:nth-child(2) {
  white-space: nowrap;
}
.pass {
  color: #12622d;
}
.gap {
  color: #914000;
}
.error {
  color: #be182b;
}
pre {
  overflow: auto;
  max-height: 480px;
  background: #f5f7fa;
  padding: 12px;
  white-space: pre-wrap;
  overflow-wrap: anywhere;
}
summary {
  cursor: pointer;
}
.fixture {
  max-height: 360px;
  overflow: auto;
}
</style>
