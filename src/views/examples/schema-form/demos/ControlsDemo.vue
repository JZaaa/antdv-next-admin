<template>
  <ControlsForm />
  <output class="form-demo-result" aria-live="polite">{{ result }}</output>
</template>

<script setup lang="ts">
import { ref } from 'vue';

import { useSchemaForm } from '@/libs/form';

const options = [
  { label: '研发', value: 'dev' },
  { label: '运营', value: 'ops' },
];
const result = ref('18 种控件共用一份表单模型；附件仅本地选择。');
const [ControlsForm] = useSchemaForm({
  wrapperClass: 'grid-cols-1 md:grid-cols-3',
  schema: [
    { fieldName: 'input', component: 'Input', label: '输入框' },
    { fieldName: 'password', component: 'InputPassword', label: '密码' },
    { fieldName: 'text', component: 'Textarea', label: '文本域' },
    { fieldName: 'number', component: 'InputNumber', label: '数字', defaultValue: 0 },
    {
      fieldName: 'select',
      component: 'Select',
      label: '下拉选择',
      componentProps: { options, allowClear: true },
    },
    { fieldName: 'checkbox', component: 'Checkbox', label: '复选框' },
    {
      fieldName: 'checkboxes',
      component: 'CheckboxGroup',
      label: '复选组',
      componentProps: { options },
    },
    { fieldName: 'radio', component: 'Radio', label: '单选按钮' },
    { fieldName: 'radios', component: 'RadioGroup', label: '单选组', componentProps: { options } },
    { fieldName: 'switch', component: 'Switch', label: '开关' },
    { fieldName: 'date', component: 'DatePicker', label: '日期' },
    { fieldName: 'range', component: 'RangePicker', label: '日期范围' },
    { fieldName: 'time', component: 'TimePicker', label: '时间' },
    {
      fieldName: 'tree',
      component: 'TreeSelect',
      label: '树选择',
      componentProps: {
        treeData: [{ title: '总部', value: 'root', children: [{ title: '研发', value: 'dev' }] }],
      },
    },
    {
      fieldName: 'cascader',
      component: 'Cascader',
      label: '级联',
      componentProps: {
        options: [{ label: '浙江', value: 'zj', children: [{ label: '杭州', value: 'hz' }] }],
      },
    },
    { fieldName: 'rate', component: 'Rate', label: '评分', defaultValue: 3 },
    { fieldName: 'slider', component: 'Slider', label: '滑块', defaultValue: 25 },
    {
      fieldName: 'files',
      component: 'Upload',
      label: '附件',
      componentProps: { beforeUpload: () => false },
    },
  ],
  handleSubmit: (values) => {
    result.value = JSON.stringify(values, null, 2);
  },
});
</script>
