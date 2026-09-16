<template>
  <div class="schema-form-example">
    <Card :title="text.title">
      <p class="example-description">{{ text.description }}</p>
      <AccountForm>
        <template #memo="{ componentProps }"
          ><TextArea v-bind="componentProps" :auto-size="{ minRows: 2, maxRows: 5 }"
        /></template>
      </AccountForm>
      <Space wrap class="example-tools">
        <Button @click="fillAccount">{{ text.fill }}</Button>
        <Button @click="toggleExtra">{{ extra ? text.remove : text.append }}</Button>
        <Button @click="serverError">{{ text.serverError }}</Button>
        <Button @click="openEditor">{{ text.edit }}</Button>
      </Space>
      <pre v-if="accountResult" class="example-result">{{ accountResult }}</pre>
    </Card>
    <Card :title="text.searchTitle">
      <SearchForm />
      <p v-if="searchResult" class="example-result">{{ searchResult }}</p>
    </Card>
    <Modal v-model:open="modalOpen" :title="text.edit" :footer="null" destroy-on-hidden>
      <EditorForm />
    </Modal>
  </div>
</template>

<script setup lang="ts">
import type { FormFieldSchema } from '@/libs/form';
import type { Dayjs } from 'dayjs';

import { Button, Card, Modal, Space, TextArea, message } from 'antdv-next';
import dayjs from 'dayjs';
import { computed, onBeforeUnmount, ref, watch } from 'vue';
import { useI18n } from 'vue-i18n';

import { useSchemaForm } from '@/adapters/form';
import { FormCancelledError, z } from '@/libs/form';

const { locale } = useI18n();
const messages = {
  'zh-CN': {
    title: 'SchemaForm 独立表单',
    description:
      '字段联动、远程选项、异步校验、动态字段与弹窗编辑。用户名 admin 用于演示校验失败，文件仅在本地选择。',
    name: '用户名',
    email: '邮箱',
    enabled: '启用',
    reason: '停用原因',
    role: '角色',
    department: '部门',
    date: '入职日期',
    files: '附件',
    memo: '备注',
    extra: '附加信息',
    fill: '回填数据',
    append: '添加字段',
    remove: '移除字段',
    serverError: '显示服务端字段错误',
    edit: '编辑记录',
    searchTitle: '查询表单与提交转换',
    keyword: '关键词',
    range: '日期范围',
    status: '状态',
    search: '查询',
    saved: '保存成功',
    unavailable: '该用户名已被使用',
    invalidEmail: '请输入有效邮箱',
    serverMessage: '邮箱已存在，请修改后重试',
    chooseRole: '请先选择角色',
    pickDepartment: '请选择部门',
    manager: '管理员',
    member: '成员',
    active: '启用',
    inactive: '停用',
  },
  'en-US': {
    title: 'Independent SchemaForm',
    description:
      'Dependencies, remote options, async validation, dynamic fields and modal editing. Use admin to see a validation error. Files stay local.',
    name: 'Username',
    email: 'Email',
    enabled: 'Enabled',
    reason: 'Reason for disabling',
    role: 'Role',
    department: 'Department',
    date: 'Start date',
    files: 'Attachments',
    memo: 'Notes',
    extra: 'Extra information',
    fill: 'Fill values',
    append: 'Add field',
    remove: 'Remove field',
    serverError: 'Show server field error',
    edit: 'Edit record',
    searchTitle: 'Search form and value conversion',
    keyword: 'Keyword',
    range: 'Date range',
    status: 'Status',
    search: 'Search',
    saved: 'Saved',
    unavailable: 'This username is already taken',
    invalidEmail: 'Enter a valid email',
    serverMessage: 'Email already exists. Please change it.',
    chooseRole: 'Choose a role first',
    pickDepartment: 'Choose a department',
    manager: 'Administrator',
    member: 'Member',
    active: 'Active',
    inactive: 'Inactive',
  },
};
const text = computed(() => messages[locale.value as keyof typeof messages] ?? messages['zh-CN']);
const accountResult = ref('');
const searchResult = ref('');
const extra = ref(false);
const modalOpen = ref(false);
let editSession = 0;
let accountSession = 0;
onBeforeUnmount(() => {
  accountSession++;
  editSession++;
});
watch(modalOpen, () => {
  editSession++;
});
type Account = {
  name?: string;
  email?: string;
  enabled?: boolean;
  reason?: string;
  role?: string;
  department?: string;
  date?: Dayjs;
  files?: unknown[];
  memo?: string;
};
async function wait(ms: number, signal: AbortSignal = new AbortController().signal): Promise<void> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      signal.removeEventListener('abort', abort);
      resolve();
    }, ms);
    function abort(): void {
      clearTimeout(timer);
      reject(new FormCancelledError());
    }
    if (signal.aborted) abort();
    else signal.addEventListener('abort', abort, { once: true });
  });
}
function accountSchema(): FormFieldSchema<string, Record<never, never>, Account>[] {
  return [
    {
      fieldName: 'name',
      component: 'Input',
      label: text.value.name,
      formFieldProps: { asyncDebounceMs: 250 },
      rules: z
        .string()
        .min(1, text.value.name)
        .refine(async (value) => {
          await wait(180);
          return value !== 'admin';
        }, text.value.unavailable),
    },
    {
      fieldName: 'email',
      component: 'Input',
      label: text.value.email,
      rules: z.email({ error: text.value.invalidEmail }),
    },
    {
      fieldName: 'role',
      component: 'Select',
      label: text.value.role,
      rules: 'required',
      componentProps: {
        options: [
          { label: text.value.manager, value: 'admin' },
          { label: text.value.member, value: 'member' },
        ],
      },
    },
    {
      fieldName: 'department',
      component: 'Select',
      label: text.value.department,
      dependencies: {
        triggerFields: ['role'],
        resolve: async ({ values, actions }) => {
          await actions.setFieldValue('department', undefined);
          await wait(220);
          const role = values.role;
          return {
            disabled: !role,
            componentProps: {
              placeholder: role ? text.value.pickDepartment : text.value.chooseRole,
              options: role
                ? ['Operations', 'Engineering', 'Support'].map((name) => ({
                    label: name + ' (' + role + ')',
                    value: role + '-' + name,
                  }))
                : [],
            },
          };
        },
      },
    },
    { fieldName: 'date', component: 'DatePicker', label: text.value.date },
    { fieldName: 'enabled', component: 'Switch', label: text.value.enabled, defaultValue: true },
    {
      fieldName: 'reason',
      component: 'Textarea',
      label: text.value.reason,
      dependencies: {
        triggerFields: ['enabled'],
        resolve: ({ values }) => ({
          if: values.enabled === false,
          required: values.enabled === false,
        }),
      },
    },
    {
      fieldName: 'files',
      component: 'Upload',
      label: text.value.files,
      componentProps: { beforeUpload: () => false, multiple: true },
    },
    {
      fieldName: 'memo',
      component: 'Textarea',
      label: text.value.memo,
      formItemClass: 'col-span-full',
    },
  ];
}
const [AccountForm, accountApi] = useSchemaForm<Account>({
  schema: accountSchema(),
  wrapperClass: 'grid-cols-1 md:grid-cols-2',
  handleSubmit: async (value) => {
    const session = accountSession;
    await wait(250);
    if (session === accountSession) {
      accountResult.value = JSON.stringify(value, null, 2);
      message.success(text.value.saved);
    }
  },
});
type SearchValues = { keyword?: string; status?: string; range?: Dayjs[] };
type SearchPayload = { keyword?: string; status?: string; startDate?: string; endDate?: string };
function searchSchema(): FormFieldSchema<string, Record<never, never>, SearchValues>[] {
  return [
    { fieldName: 'keyword', component: 'Input', label: text.value.keyword },
    {
      fieldName: 'status',
      component: 'Select',
      label: text.value.status,
      componentProps: {
        allowClear: true,
        options: [
          { label: text.value.active, value: 'active' },
          { label: text.value.inactive, value: 'inactive' },
        ],
      },
    },
    { fieldName: 'range', component: 'RangePicker', label: text.value.range },
  ];
}
const [SearchForm, searchApi] = useSchemaForm<
  SearchValues,
  string,
  Record<never, never>,
  SearchPayload
>({
  schema: searchSchema(),
  wrapperClass: 'grid-cols-1 md:grid-cols-3',
  showCollapseButton: true,
  collapsed: true,
  collapsedRows: 1,
  submitButtonOptions: { content: () => text.value.search },
  codec: {
    encode: ({ keyword, status, range }) => ({
      keyword,
      status,
      startDate: range?.[0]?.format('YYYY-MM-DD'),
      endDate: range?.[1]?.format('YYYY-MM-DD'),
    }),
    decode: ({ keyword, status, startDate, endDate }) => ({
      keyword,
      status,
      range: startDate && endDate ? [dayjs(startDate), dayjs(endDate)] : undefined,
    }),
  },
  handleSubmit: (values) => {
    searchResult.value = JSON.stringify(values);
  },
});
const [EditorForm, editorApi] = useSchemaForm<{ name?: string; email?: string }>({
  schema: accountSchema().slice(0, 2),
  handleSubmit: async (value) => {
    const session = editSession;
    await wait(300);
    if (session === editSession) {
      accountResult.value = JSON.stringify(value, null, 2);
      modalOpen.value = false;
      message.success(text.value.saved);
    }
  },
});
async function fillAccount(): Promise<void> {
  accountSession++;
  try {
    await accountApi.reset({
      values: {
        name: 'alice',
        email: 'alice@example.com',
        enabled: true,
        role: 'member',
        date: dayjs('2026-09-15'),
        files: [],
      },
    });
  } catch (error) {
    if (!(error instanceof FormCancelledError)) message.error(text.value.serverMessage);
  }
}
async function toggleExtra(): Promise<void> {
  try {
    if (extra.value) await accountApi.removeSchemaByFields(['extra']);
    else
      accountApi.setState((previous) => ({
        schema: [
          ...(previous.schema ?? []),
          { fieldName: 'extra', component: 'Input', label: text.value.extra },
        ],
      }));
    extra.value = !extra.value;
  } catch (error) {
    if (!(error instanceof FormCancelledError)) message.error(text.value.serverMessage);
  }
}
async function serverError(): Promise<void> {
  await accountApi.setFieldError('email', text.value.serverMessage);
  accountApi.getFieldComponentRef<{ focus: () => void }>('email')?.focus();
}
async function openEditor(): Promise<void> {
  try {
    modalOpen.value = true;
    await editorApi.reset({ values: { name: 'alice', email: 'alice@example.com' } });
  } catch (error) {
    if (!(error instanceof FormCancelledError)) message.error(text.value.serverMessage);
  }
}
watch(locale, async () => {
  try {
    await accountApi.updateSchema(accountSchema());
    if (extra.value)
      await accountApi.updateSchema([{ fieldName: 'extra', label: text.value.extra }]);
    await searchApi.updateSchema(searchSchema());
    searchApi.setState({ submitButtonOptions: { content: () => text.value.search } });
    await editorApi.updateSchema(accountSchema().slice(0, 2));
  } catch (error) {
    if (!(error instanceof FormCancelledError)) message.error(text.value.serverMessage);
  }
});
</script>

<style scoped>
.schema-form-example {
  display: grid;
  gap: 20px;
}
.example-description {
  margin: 0 0 24px;
  color: var(--ant-color-text-secondary);
}
.example-tools {
  margin-top: 20px;
}
.example-result {
  overflow: auto;
  padding: 16px;
  margin: 20px 0 0;
  border-radius: 6px;
  background: var(--ant-color-fill-quaternary);
  white-space: pre-wrap;
  overflow-wrap: anywhere;
}
</style>
