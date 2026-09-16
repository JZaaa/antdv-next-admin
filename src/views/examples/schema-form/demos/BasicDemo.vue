<template>
  <BasicForm />
  <output class="form-demo-result" aria-live="polite">{{ result }}</output>
</template>

<script setup lang="ts">
import { ref } from 'vue';

import { useSchemaForm } from '@/libs/form';

interface Values {
  name?: string;
  enabled?: boolean;
}
const result = ref('提交后在此显示结果');
const [BasicForm] = useSchemaForm<Values>({
  wrapperClass: 'grid-cols-1 md:grid-cols-2',
  schema: [
    {
      fieldName: 'name',
      component: 'Input',
      label: '名称',
      rules: 'required',
      defaultValue: 'Alice',
      help: '清空后提交可查看必填错误',
    },
    { fieldName: 'enabled', component: 'Switch', label: '启用', defaultValue: true },
  ],
  handleSubmit: (values) => {
    result.value = JSON.stringify(values, null, 2);
  },
});
</script>
