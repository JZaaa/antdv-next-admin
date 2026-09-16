<template>
  <CustomForm>
    <template #amount="{ componentProps }">
      <SpaceCompact block>
        <InputNumber v-bind="componentProps" :style="{ flex: 1, minWidth: 0 }" />
        <SpaceAddon>元</SpaceAddon>
      </SpaceCompact>
    </template>
    <template #submit-before="{ formApi }">
      <Button type="primary" :loading="formApi.form.meta.submitting" @click="formApi.submit()"
        >保存设置</Button
      >
      <Button @click="formApi.reset()">恢复默认</Button>
      <span>操作区可完全自定义</span>
    </template>
  </CustomForm>
  <output class="form-demo-result" aria-live="polite">{{ result }}</output>
</template>

<script setup lang="ts">
import { Button, InputNumber, SpaceAddon, SpaceCompact } from 'antdv-next';
import { ref } from 'vue';

import { useSchemaForm } from '@/libs/form';

import ColorControl from './ColorControl.vue';

const result = ref('自定义组件使用 color / update:color；金额通过字段插槽添加单位。');
const [CustomForm] = useSchemaForm({
  wrapperClass: 'grid-cols-1 md:grid-cols-2',
  submitButtonOptions: { show: false },
  resetButtonOptions: { show: false },
  schema: [
    {
      fieldName: 'color',
      component: ColorControl,
      modelPropName: 'color',
      label: '颜色',
      defaultValue: '#1677ff',
    },
    {
      fieldName: 'amount',
      component: 'InputNumber',
      label: '金额',
      defaultValue: 100,
    },
  ],
  handleSubmit: (values) => {
    result.value = JSON.stringify(values, null, 2);
  },
});
</script>
