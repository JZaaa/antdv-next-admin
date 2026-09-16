<template>
  <section :id="`form-demo-${id}`" class="form-demo-block" :data-demo="id">
    <header>
      <div>
        <h2>{{ title }}</h2>
        <p>{{ description }}</p>
      </div>
      <Button :data-demo-run="id" :aria-expanded="active" @click="active = !active">{{
        active ? '收起示例' : '运行示例'
      }}</Button>
    </header>
    <div class="form-demo-related">
      相关 API：<code>{{ related }}</code>
    </div>
    <div v-if="active" class="form-demo-preview"><component :is="component" /></div>
    <details class="form-demo-source" @toggle="loadSources">
      <summary>查看实际源码 · {{ files.map((file) => file.name).join(' / ') }}</summary>
      <p v-if="sourceError" role="alert">
        {{ sourceError }} <Button size="small" @click="loadSources">重试</Button>
      </p>
      <div v-for="file in sources" :key="file.name" class="form-demo-file">
        <div class="form-demo-file-heading">
          <code>{{ file.name }}</code
          ><Button size="small" @click="copy(file.code)">复制代码</Button>
        </div>
        <pre tabindex="0" :aria-label="`${file.name} 源码`"><code>{{ file.code }}</code></pre>
      </div>
    </details>
    <p v-if="notice" role="status">{{ notice }}</p>
  </section>
</template>
<script setup lang="ts">
import type { Component } from 'vue';

import { Button } from 'antdv-next';
import { ref } from 'vue';
const props = defineProps<{
  id: string;
  title: string;
  description: string;
  related: string;
  component: Component;
  files: readonly { name: string; load: () => Promise<string> }[];
  initiallyOpen?: boolean;
}>();
const active = ref(props.initiallyOpen ?? false);
const sources = ref<{ name: string; code: string }[]>([]);
const sourceError = ref('');
const notice = ref('');
let loading = false;
async function loadSources(): Promise<void> {
  if (sources.value.length || loading) return;
  loading = true;
  sourceError.value = '';
  try {
    sources.value = await Promise.all(
      props.files.map(async (file) => ({ name: file.name, code: await file.load() })),
    );
  } catch (error) {
    sourceError.value = `源码加载失败：${String(error)}`;
  } finally {
    loading = false;
  }
}
async function copy(code: string): Promise<void> {
  try {
    await navigator.clipboard.writeText(code);
    notice.value = '代码已复制';
  } catch {
    notice.value = '无法访问剪贴板，请在代码区选择并复制。';
  }
}
</script>
