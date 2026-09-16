<template>
  <DependencyForm />
  <div class="form-demo-tools">
    <Button @click="reload">重新加载城市</Button>
    <Button @click="toggleHide">切换 hide</Button>
  </div>
  <output class="form-demo-result" aria-live="polite">{{ result }}</output>
</template>

<script setup lang="ts">
import { Button } from 'antdv-next';
import { ref } from 'vue';

import { useSchemaForm } from '@/libs/form';

const result = ref('隐藏字段不校验，默认保留值并提交；hide/if 卸载控件，show 仅隐藏。');
const detailHidden = ref(false);
const [DependencyForm, api] = useSchemaForm({
  wrapperClass: 'grid-cols-1 md:grid-cols-2',
  schema: [
    {
      fieldName: 'region',
      component: 'Select',
      label: '地区',
      defaultValue: 'east',
      componentProps: {
        options: [
          { label: '华东', value: 'east' },
          { label: '华南', value: 'south' },
        ],
      },
    },
    {
      fieldName: 'city',
      component: 'Select',
      label: '城市',
      componentProps: { showSearch: true, filterOption: false, allowClear: true },
      dependencies: {
        triggerFields: ['region'],
        resolve: async ({ values, actions }) => {
          await actions.setFieldValue('city', undefined);
          await new Promise<void>((resolve) => setTimeout(resolve, 200));
          const cities = values.region === 'east' ? ['杭州', '上海'] : ['广州', '深圳'];
          return {
            disabled: !values.region,
            componentProps: {
              options: cities.map((city) => ({ label: city, value: city })),
              filterOption: true,
            },
          };
        },
      },
    },
    {
      fieldName: 'mode',
      component: 'Select',
      label: '详情状态',
      defaultValue: 'edit',
      componentProps: {
        options: [
          { label: '显示', value: 'edit' },
          { label: '禁用', value: 'disabled' },
          { label: 'show 隐藏', value: 'show' },
          { label: 'if 卸载', value: 'if' },
        ],
      },
    },
    {
      fieldName: 'detail',
      component: 'Input',
      label: '详情',
      defaultValue: '保留内容',
      dependencies: {
        triggerFields: ['mode'],
        resolve: ({ values }) => ({
          if: values.mode !== 'if',
          show: values.mode !== 'show',
          disabled: values.mode === 'disabled',
          required: values.mode === 'edit',
          componentProps: { placeholder: '填写详情' },
        }),
      },
    },
  ],
  handleSubmit: async (values) => {
    result.value = JSON.stringify({ raw: await api.getRawValues(), submitted: values }, null, 2);
  },
});
async function toggleHide(): Promise<void> {
  try {
    const hide = !detailHidden.value;
    await api.updateSchema([{ fieldName: 'detail', hide }]);
    detailHidden.value = hide;
  } catch (error) {
    result.value = `切换 hide 失败：${String(error)}`;
  }
}
async function reload(): Promise<void> {
  try {
    const region = api.form.getFieldValue('region');
    await api.setFieldValue('region', undefined);
    await api.setFieldValue('region', region);
    result.value = '城市选项已重新加载';
  } catch (error) {
    result.value = `加载失败：${String(error)}`;
  }
}
</script>
