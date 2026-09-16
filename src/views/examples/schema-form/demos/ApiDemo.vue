<template>
  <ApiForm />
  <div class="form-demo-tools">
    <Button v-for="action in actions" :key="action" @click="run(action)">{{ action }}</Button>
  </div>
  <output class="form-demo-result" aria-live="polite">{{ result }}</output>
</template>

<script setup lang="ts">
import { Button } from 'antdv-next';
import { ref } from 'vue';

import { useSchemaForm } from '@/libs/form';

const result = ref('点击按钮执行对应 API。验证失败会显示字段错误及结构化结果。');
let extra = false;
const actions = [
  '读取快照',
  '回填',
  '设置单字段',
  '单字段校验',
  '清除校验',
  '服务端错误',
  '更新标签',
  '增删字段',
  '切换禁用',
  '聚焦名称',
  '建立重置基线',
  '重置',
  'API 提交',
] as const;
type Action = (typeof actions)[number];
const [ApiForm, api] = useSchemaForm({
  wrapperClass: 'grid-cols-1 md:grid-cols-2',
  schema: [
    { fieldName: 'name', component: 'Input', label: '名称', rules: 'required' },
    { fieldName: 'profile.email', component: 'Input', label: '邮箱' },
  ],
  handleSubmit: (values) => {
    result.value = JSON.stringify(values, null, 2);
  },
});
async function run(action: Action): Promise<void> {
  try {
    switch (action) {
      case '读取快照':
        result.value = JSON.stringify(
          {
            raw: await api.getRawValues(),
            submitted: await api.getValues(),
            name: api.form.getFieldValue('name'),
            status: api.form.getFieldError('name') ?? null,
          },
          null,
          2,
        );
        return;
      case '回填':
        await api.setValues(
          { name: 'API Alice', profile: { email: 'alice@example.com' } },
          true,
          false,
        );
        break;
      case '单字段校验':
        result.value = JSON.stringify(await api.validateField('name'));
        return;
      case '设置单字段':
        await api.setFieldValue('name', '单字段值', false);
        break;
      case '清除校验':
        await api.clearValidation(['name']);
        break;
      case '服务端错误':
        await api.setFieldError('name', '名称已存在');
        break;
      case '更新标签':
        await api.updateSchema([{ fieldName: 'name', label: '更新后的名称' }]);
        break;
      case '增删字段':
        if (extra) await api.removeSchemaByFields(['extra']);
        else
          api.setState((previous) => ({
            schema: [
              ...(previous.schema ?? []),
              { fieldName: 'extra', component: 'Input', label: '附加字段' },
            ],
          }));
        extra = !extra;
        break;
      case '切换禁用':
        api.setState({ commonConfig: { disabled: !api.state.commonConfig?.disabled } });
        break;
      case '聚焦名称':
        api.getFieldComponentRef<{ focus: () => void }>('name')?.focus();
        break;
      case '建立重置基线':
        await api.reset({ values: { name: '新基线' } });
        break;
      case '重置':
        await api.reset();
        break;
      case 'API 提交':
        await api.submit();
        return;
    }
    result.value = `${action}完成\n${JSON.stringify(await api.getRawValues(), null, 2)}`;
  } catch (error) {
    result.value = String(error);
  }
}
</script>
