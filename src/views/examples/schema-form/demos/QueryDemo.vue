<template>
  <QueryForm />
  <div class="form-demo-tools">
    <Button @click="fillPayload">从提交值回填</Button>
    <Button
      @click="
        layout = layout === 'horizontal' ? 'vertical' : 'horizontal';
        api.setState({ layout });
      "
      >切换布局</Button
    >
  </div>
  <output class="form-demo-result" aria-live="polite">{{ result }}</output>
</template>

<script setup lang="ts">
import type { Dayjs } from 'dayjs';

import { Button } from 'antdv-next';
import dayjs from 'dayjs';
import { ref } from 'vue';

import { useSchemaForm } from '@/libs/form';

interface Draft {
  keyword?: string;
  range?: Dayjs[];
  status?: string;
}
interface Query {
  keyword?: string;
  start?: string;
  end?: string;
  status?: string;
}
const result = ref('日期拆分在 codec 边界执行；查询没有配置规则，若添加规则，提交仍会校验。');
const layout = ref<'horizontal' | 'vertical'>('horizontal');
const [QueryForm, api] = useSchemaForm<Draft, string, Record<never, never>, Query>({
  wrapperClass: 'grid-cols-1 md:grid-cols-2',
  layout: 'horizontal',
  commonConfig: { labelWidth: 75 },
  showCollapseButton: true,
  collapsed: true,
  collapsedRows: 1,
  submitButtonOptions: { content: '查询' },
  schema: [
    { fieldName: 'keyword', component: 'Input', label: '关键词' },
    { fieldName: 'range', component: 'RangePicker', label: '日期范围' },
    {
      fieldName: 'status',
      component: 'Select',
      label: '状态',
      componentProps: {
        options: [
          { label: '启用', value: 'active' },
          { label: '停用', value: 'inactive' },
        ],
        allowClear: true,
      },
    },
  ],
  codec: {
    encode: ({ keyword, range, status }) => ({
      keyword,
      status,
      start: range?.[0]?.format('YYYY-MM-DD'),
      end: range?.[1]?.format('YYYY-MM-DD'),
    }),
    decode: ({ keyword, status, start, end }) => ({
      keyword,
      status,
      range: start && end ? [dayjs(start), dayjs(end)] : undefined,
    }),
  },
  handleSubmit: (values) => {
    result.value = JSON.stringify(values, null, 2);
  },
});
async function fillPayload(): Promise<void> {
  await api.setSubmitValues({
    keyword: 'codec',
    status: 'active',
    start: '2026-09-01',
    end: '2026-09-15',
  });
  api.setState({ collapsed: false });
  result.value = JSON.stringify(await api.getValues(), null, 2);
}
</script>
