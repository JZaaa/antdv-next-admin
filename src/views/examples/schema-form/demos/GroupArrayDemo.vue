<template>
  <div>
    <p>分组、动态数组、命名规则、Zod、联动与字段名插槽。</p>
    <GroupArrayForm>
      <template #name="{ componentField }">
        <Input
          :value="componentField.modelValue"
          placeholder="这个控件来自字段名插槽"
          @update:value="componentField.onChange"
          @blur="componentField.onBlur"
        />
      </template>
      <template #submit-before>
        <Button @click="readSnapshot">读取快照</Button>
      </template>
    </GroupArrayForm>
    <pre aria-live="polite">{{ result || '提交或读取快照后显示结果' }}</pre>
  </div>
</template>

<script setup lang="ts">
import { Button, Input, message } from 'antdv-next';
import { ref } from 'vue';

import { useSchemaForm, z } from '@/adapters/form';

interface Values {
  name: string;
  advanced: boolean;
  details?: string;
  retained: string;
  contacts: { name: string; email: string }[];
}
const result = ref('');
const [GroupArrayForm, api] = useSchemaForm<Values>({
  wrapperClass: 'grid-cols-1 md:grid-cols-2',
  commonConfig: { labelWidth: 100 },
  submitButtonOptions: { content: '提交' },
  schema: [
    {
      type: 'group',
      name: 'account',
      title: '账户信息',
      children: [
        {
          fieldName: 'name',
          component: 'Input',
          label: '姓名',
          defaultValue: '',
          rules: 'required',
        },
        { fieldName: 'advanced', component: 'Switch', label: '高级设置', defaultValue: false },
        {
          fieldName: 'details',
          component: 'Input',
          label: '备注',
          rules: 'required',
          dependencies: {
            triggerFields: ['advanced'],
            resolve: ({ values }) => ({
              if: values.advanced,
              help: values.advanced ? '开启后参与校验；关闭后保留已有值。' : undefined,
            }),
          },
        },
        {
          fieldName: 'retained',
          component: 'Input',
          hide: true,
          defaultValue: '隐藏字段仍保留在提交值中',
          rules: 'required',
        },
      ],
    },
    {
      type: 'array',
      fieldName: 'contacts',
      label: '联系人',
      formItemClass: 'col-span-full',
      defaultValue: [],
      arrayProps: { max: 5, createRow: () => ({ name: '', email: '' }) },
      children: [
        { fieldName: 'name', component: 'Input', label: '联系人', rules: 'required' },
        {
          fieldName: 'email',
          component: 'Input',
          label: '邮箱',
          rules: z.email({ error: '请输入有效邮箱' }).or(z.literal('')).optional(),
        },
      ],
    },
  ],
  handleSubmit(values, rawValues) {
    result.value = JSON.stringify({ values, rawValues }, null, 2);
  },
});
async function readSnapshot(): Promise<void> {
  try {
    result.value = JSON.stringify(await api.getValueSnapshot(), null, 2);
  } catch (error) {
    message.error(error instanceof Error ? error.message : '读取表单失败');
  }
}
</script>
