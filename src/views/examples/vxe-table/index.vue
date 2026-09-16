<template>
  <main class="vxe-documentation">
    <h1>VXE Table</h1>
    <p>v4.21.10 · useVxeGrid · SchemaForm</p>
    <section v-for="demo in demos" :key="demo.id" :data-table-demo="demo.id">
      <header>
        <h2>{{ demo.title }}</h2>
        <Button :data-run="demo.id" @click="toggle(demo.id)">{{
          active.has(demo.id) ? '收起示例' : '运行示例'
        }}</Button>
      </header>
      <component :is="demo.component" v-if="active.has(demo.id)" />
      <details>
        <summary>查看实际源码</summary>
        <pre><code>{{ demo.source }}</code></pre>
      </details>
    </section>
  </main>
</template>
<script setup lang="ts">
import { Button } from 'antdv-next';
import { shallowRef } from 'vue';

import BasicDemo from './demos/BasicDemo.vue';
import EditDemo from './demos/EditDemo.vue';
import SearchDemo from './demos/SearchDemo.vue';
import TreeDemo from './demos/TreeDemo.vue';
import ViewedDemo from './demos/ViewedDemo.vue';
import VirtualDemo from './demos/VirtualDemo.vue';
const sources = import.meta.glob('./demos/*.vue', {
  query: '?raw',
  import: 'default',
  eager: true,
});
const basic = sources['./demos/BasicDemo.vue'];
const search = sources['./demos/SearchDemo.vue'];
const edit = sources['./demos/EditDemo.vue'];
const tree = sources['./demos/TreeDemo.vue'];
const virtual = sources['./demos/VirtualDemo.vue'];
const viewed = sources['./demos/ViewedDemo.vue'];
const demos = [
  { id: 'basic', title: '基础、列定制与插槽', component: BasicDemo, source: basic },
  { id: 'search', title: '远程搜索、分页与 Codec', component: SearchDemo, source: search },
  { id: 'edit', title: '行编辑、校验与保存', component: EditDemo, source: edit },
  { id: 'tree', title: '树形与选择', component: TreeDemo, source: tree },
  { id: 'virtual', title: '虚拟滚动', component: VirtualDemo, source: virtual },
  { id: 'viewed', title: '已读持久化与导入导出', component: ViewedDemo, source: viewed },
];
const active = shallowRef(new Set(['basic']));
function toggle(id: string): void {
  const next = new Set(active.value);
  if (next.has(id)) next.delete(id);
  else next.add(id);
  active.value = next;
}
</script>
<style scoped>
.vxe-documentation {
  padding: 24px;
  max-width: 1500px;
  margin: auto;
}
section {
  margin: 24px 0;
  padding: 16px;
  background: var(--ant-color-bg-container, #fff);
  border: 1px solid var(--ant-color-border, #ddd);
  border-radius: 8px;
}
header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 16px;
}
h1 {
  font-size: 28px;
}
h2 {
  font-size: 18px;
}
summary {
  cursor: pointer;
  padding: 12px 0;
}
pre {
  max-height: 500px;
  overflow: auto;
  padding: 16px;
  background: var(--ant-color-fill-quaternary, #f6f7f9);
  font-size: 12px;
}
@media (max-width: 600px) {
  .vxe-documentation {
    padding: 8px;
  }
  section {
    padding: 8px;
  }
}
</style>
