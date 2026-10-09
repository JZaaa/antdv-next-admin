<template>
  <ProModal
    :open="open"
    :title="editing ? $t('user.editUser') : $t('user.createUser')"
    width="760px"
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
    <Form :schema="schema" />
  </ProModal>
</template>
<script setup lang="ts">
import type { UserFormValues } from './form';
import type { Role } from '@/types/auth';

import { computed } from 'vue';

import { useSchemaForm } from '@/adapters/form';
import ProModal from '@/components/Pro/ProModal/index.vue';
import { FormCancelledError } from '@/libs/form';
import { $t } from '@/locales';

import { createUserSchema } from './form';

const props = defineProps<{
  open: boolean;
  editing: boolean;
  initialValues: UserFormValues;
  roles: Role[];
  save: (values: UserFormValues) => Promise<void>;
}>();
const emit = defineEmits<{ 'update:open': [open: boolean]; closed: [] }>();
const schema = computed(() => createUserSchema(props.editing, props.roles, props.initialValues));
const [Form, api] = useSchemaForm<UserFormValues>({
  schema: schema.value,
  layout: 'vertical',
  wrapperClass: 'grid-cols-1 md:grid-cols-2',
  showDefaultActions: false,
  scrollToFirstError: true,
  async handleSubmit(values) {
    if (props.open) await props.save(values);
  },
});
const submitting = api.form.useSelector(({ meta }) => meta.submitting);
async function submit(event: MouseEvent): Promise<void> {
  if (!props.open) return;
  try {
    await api.submit(event);
  } catch (error) {
    // 请求错误由请求层提示；取消或卸载中的校验无需弹出错误。
    if (!(error instanceof FormCancelledError)) console.error('Failed to save user:', error);
  }
}
function afterOpenChange(open: boolean): void {
  if (!open) emit('closed');
}
</script>
