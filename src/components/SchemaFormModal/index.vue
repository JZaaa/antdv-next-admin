<template>
  <ProModal
    :open="open"
    :title="title"
    :width="width"
    :confirm-loading="submitting"
    :draggable="false"
    :resizable="false"
    :fullscreenable="false"
    destroy-on-hidden
    :after-open-change="afterOpenChange"
    @update:open="emit('update:open', $event)"
    @cancel="emit('update:open', false)"
    @ok="submit"
  >
    <slot name="before-form" />
    <Form :schema="seededSchema" />
    <slot name="after-form" />
  </ProModal>
</template>
<script setup lang="ts">
import type { FormFieldSchema } from '@/libs/form';

import { computed } from 'vue';

import { useSchemaForm } from '@/adapters/form';
import ProModal from '@/components/Pro/ProModal/index.vue';
import { FormCancelledError } from '@/libs/form';
import { $t } from '@/locales';
const props = withDefaults(
  defineProps<{
    open: boolean;
    title: string;
    width?: string;
    schema: FormFieldSchema[];
    initialValues: Record<string, unknown>;
    save: (values: Record<string, unknown>) => Promise<void>;
  }>(),
  { width: '760px' },
);
const emit = defineEmits<{
  'update:open': [open: boolean];
  closed: [];
  'values-change': [values: Record<string, unknown>];
}>();
// 每次编辑由父级 session key 创建独立实例，初值只作为该会话的重置基线。
const seededSchema = computed(() =>
  props.schema.map((field) => ({
    ...field,
    defaultValue:
      field.fieldName in props.initialValues
        ? props.initialValues[field.fieldName]
        : field.defaultValue,
    componentProps:
      typeof field.componentProps === 'function'
        ? field.componentProps
        : {
            ...([
              'Input',
              'InputPassword',
              'Textarea',
              'InputNumber',
              'Select',
              'TreeSelect',
            ].includes(String(field.component)) && typeof field.label === 'string'
              ? {
                  placeholder: $t(
                    ['Select', 'TreeSelect'].includes(String(field.component))
                      ? 'proForm.selectPlaceholder'
                      : 'proForm.enterPlaceholder',
                    { label: field.label },
                  ),
                }
              : {}),
            ...field.componentProps,
          },
  })),
);
const [Form, api] = useSchemaForm({
  schema: seededSchema.value,
  layout: 'vertical',
  wrapperClass: 'grid-cols-1 md:grid-cols-2',
  showDefaultActions: false,
  scrollToFirstError: true,
  handleValuesChange(values) {
    emit('values-change', { ...props.initialValues, ...values });
  },
  async handleSubmit(values) {
    if (props.open) await props.save({ ...props.initialValues, ...values });
  },
});
const submitting = api.form.useSelector(({ meta }) => meta.submitting);
async function submit(event: MouseEvent): Promise<void> {
  try {
    if (props.open) await api.submit(event);
  } catch (error) {
    if (!(error instanceof FormCancelledError)) console.error('Failed to save form:', error);
  }
}
function afterOpenChange(open: boolean): void {
  if (!open) emit('closed');
}
</script>
