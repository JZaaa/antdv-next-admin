<template>
  <RulesForm />
  <output class="form-demo-result" aria-live="polite">{{ result }}</output>
</template>

<script setup lang="ts">
import { ref } from 'vue';

import { useSchemaForm, z } from '@/libs/form';

const emailRules = z.union([z.literal(''), z.email({ error: '请输入有效邮箱' })], {
  error: '请输入有效邮箱',
});
const result = ref('Zod 同步/异步校验：用户名 admin 不可用；确认密码通过联动生成 Zod 规则。');
const [RulesForm] = useSchemaForm({
  wrapperClass: 'grid-cols-1 md:grid-cols-2',
  schema: [
    {
      fieldName: 'username',
      component: 'Input',
      label: '用户名',
      formFieldProps: { asyncDebounceMs: 250 },
      rules: z
        .string()
        .min(3, '至少 3 个字符')
        .refine(async (value) => {
          // Zod refine 不接收表单 AbortSignal；控制器会丢弃过期校验结果。
          await new Promise<void>((resolve) => setTimeout(resolve, 250));
          return value !== 'admin';
        }, '该用户名已被使用'),
    },
    {
      fieldName: 'email',
      component: 'Input',
      label: '可选邮箱',
      formFieldProps: { validateOn: ['blur'] },
      // optional 只接受 undefined；输入框清空后的空字符串需要单独允许。
      rules: emailRules.optional(),
    },
    { fieldName: 'password', component: 'InputPassword', label: '密码', rules: 'required' },
    {
      fieldName: 'confirm',
      component: 'InputPassword',
      label: '确认密码',
      rules: 'required',
      dependencies: {
        triggerFields: ['password'],
        resolve: ({ values }) => ({
          rules: z
            .string()
            .min(1, '请输入确认密码')
            .refine((value) => value === values.password, '两次密码不一致'),
        }),
      },
    },
  ],
  // 示例不回显密码。
  handleSubmit: () => {
    result.value = '校验通过';
  },
});
</script>
