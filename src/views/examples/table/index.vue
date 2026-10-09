<template>
  <div class="page-container">
    <Grid
      :grid-options="gridOptions"
      :form-options="{ schema: searchFormItems, collapsed: true, commonConfig: { labelWidth: 80 } }"
      :table-title="$t('exampleTable.userList')"
    >
      <template #toolbar-tools>
        <a-button type="primary" @click="handleCreate">
          <PlusOutlined /> {{ $t('exampleTable.createUser') }}
        </a-button>
      </template>

      <template #bodyCell="{ column, row: record }">
        <template v-if="column.field === 'action'"
          ><a-space :size="0"
            ><a-button type="link" size="small" @click="handleEdit(record)"
              ><EditOutlined />{{ $t('common.edit') }}</a-button
            ><a-button type="link" size="small" danger @click="confirmDelete(record)"
              ><DeleteOutlined />{{ $t('common.delete') }}</a-button
            ></a-space
          ></template
        >
        <template v-if="column.field === 'email'"
          ><a-typography-text :copyable="{ text: record.email }">{{
            record.email
          }}</a-typography-text></template
        >
        <template v-if="column.field === 'status'">
          <a-switch
            :checked="record.status === 'active'"
            @change="handleStatusChange(record, $event as boolean)"
          >
            <template #checkedChildren>{{ $t('user.active') }}</template>
            <template #unCheckedChildren>{{ $t('user.inactive') }}</template>
          </a-switch>
        </template>
        <template v-else-if="column.field === 'gender'">
          <a-tag :color="genderValueEnum[record.gender || 'male']?.color">
            {{ genderValueEnum[record.gender || 'male']?.text || record.gender }}
          </a-tag>
        </template>
      </template>
      <template #usernameFilter="{ column, $panel }"
        ><a-input
          v-model:value="column.filters[0].data"
          :placeholder="$t('proForm.enterPlaceholder', { label: $t('user.username') })"
          @input="
            (event: Event) => {
              const value = (event.target as HTMLInputElement).value;
              column.filters[0].data = value;
              $panel.changeOption(event, Boolean(value), column.filters[0]);
            }
          " /></template
    ></Grid>

    <!-- Create/Edit Modal -->
    <SchemaFormModal
      v-model:open="modalVisible"
      :title="editingId ? $t('exampleTable.editUser') : $t('exampleTable.createUser')"
      v-if="formSessionKey"
      :key="formSessionKey"
      :schema="formItems"
      :initial-values="formData"
      width="600px"
      :save="handleSubmit"
      @closed="finishFormClose"
    />
  </div>
</template>

<script setup lang="ts">
import type { FormFieldSchema, FormSchema } from '@/libs/form';
import type { VxeTableGridOptions } from '@/libs/table';
import type { User } from '@/types/auth';

import { PlusOutlined, EditOutlined, DeleteOutlined } from '@antdv-next/icons';
import { message, Modal } from 'antdv-next';
import { computed } from 'vue';
import { z } from 'zod';

import { useVxeGrid } from '@/adapters/table';
import { getUserList, createUser, updateUser, deleteUser } from '@/api/user';
import SchemaFormModal from '@/components/SchemaFormModal/index.vue';
import { useCrudFormSession } from '@/composables/useCrudFormSession';
import { $t } from '@/locales';

type TableFormValues = {
  username: string;
  email: string;
  realName: string;
  phone: string;
  gender: 'male' | 'female';
  status: boolean;
  bio: string;
};

const createDefaultFormValues = (): TableFormValues => ({
  username: '',
  email: '',
  realName: '',
  phone: '',
  gender: 'male',
  status: true,
  bio: '',
});

const {
  open: modalVisible,
  record: editingRecord,
  initialValues: formData,
  sessionKey: formSessionKey,
  openCreate: openCreateForm,
  openEdit: openEditForm,
  close: closeFormModal,
  finishClose: finishFormClose,
} = useCrudFormSession<User, TableFormValues>(createDefaultFormValues);
const editingId = computed(() => editingRecord.value?.id ?? null);

const genderOptions = computed(() => [
  { label: $t('user.male'), value: 'male' },
  { label: $t('user.female'), value: 'female' },
]);

const genderValueEnum = computed<Record<string, { text: string; color?: string }>>(() => ({
  male: { text: $t('user.male'), color: 'blue' },
  female: { text: $t('user.female'), color: 'pink' },
}));

// Search form items configuration
const searchFormItems = computed<FormSchema[]>(() => [
  {
    fieldName: 'email',
    label: $t('user.email'),
    component: 'Input',
    componentProps: {
      allowClear: true,
      placeholder: $t('proForm.enterPlaceholder', { label: $t('user.email') }),
    },
  },
  {
    fieldName: 'realName',
    label: $t('user.realName'),
    component: 'Input',
    componentProps: {
      allowClear: true,
      placeholder: $t('proForm.enterPlaceholder', { label: $t('user.realName') }),
    },
  },
  {
    fieldName: 'gender',
    label: $t('user.gender'),
    component: 'Select',
    componentProps: {
      allowClear: true,
      placeholder: $t('proForm.selectPlaceholder', { label: $t('user.gender') }),
      options: genderOptions.value,
    },
  },
  {
    fieldName: 'createdAt',
    label: $t('common.createTime'),
    component: 'RangePicker',
    componentProps: {
      allowClear: true,
      valueFormat: 'YYYY-MM-DD',
    },
  },
]);

// Table columns configuration
const columns = computed<NonNullable<VxeTableGridOptions<User>['columns']>>(() => [
  {
    title: $t('user.username'),
    field: 'username',
    filters: [{ data: '', value: 'keyword' }],
    slots: { filter: 'usernameFilter' },
    minWidth: 150,
    fixed: 'left',
  },
  { title: $t('user.email'), field: 'email', minWidth: 150, slots: { default: 'bodyCell' } },
  { title: $t('user.realName'), field: 'realName', minWidth: 150 },
  { title: $t('user.phone'), field: 'phone', minWidth: 150 },
  {
    title: $t('user.gender'),
    field: 'gender',
    filters: genderOptions.value,
    minWidth: 150,
    slots: { default: 'bodyCell' },
  },
  {
    title: $t('common.status'),
    field: 'status',
    filterMultiple: false,
    filters: [
      { label: $t('user.active'), value: 'active' },
      { label: $t('user.inactive'), value: 'inactive' },
    ],
    width: 150,
    slots: { default: 'bodyCell' },
  },
  {
    title: $t('common.createTime'),
    field: 'createdAt',
    sortable: true,
    minWidth: 150,
    formatter: 'formatDateTime',
  },
  {
    title: $t('common.actions'),
    field: 'action',
    width: 200,
    fixed: 'right',
    slots: { default: 'bodyCell' },
  },
]);

// Form items configuration
const formItems = computed<FormFieldSchema[]>(() => [
  {
    fieldName: 'username',
    label: $t('user.username'),
    component: 'Input',
    rules: z
      .string()
      .min(3, $t('user.usernameLength'))
      .max(20, $t('user.usernameLength'))
      .regex(/^[a-zA-Z0-9_]+$/, $t('validation.usernamePattern')),
    componentProps: {},
  },
  {
    fieldName: 'email',
    label: $t('user.email'),
    component: 'Input',
    rules: z.email($t('validation.email')),
    componentProps: {},
  },
  {
    fieldName: 'realName',
    label: $t('user.realName'),
    component: 'Input',
    rules: 'required',
    componentProps: {},
  },
  {
    fieldName: 'phone',
    label: $t('user.phone'),
    component: 'Input',
    rules: z
      .string()
      .regex(/^(?:1[3-9]\d{9})?$/, $t('validation.phone'))
      .optional(),
    componentProps: {},
  },
  {
    fieldName: 'gender',
    label: $t('user.gender'),
    component: 'Select',
    rules: 'required',
    componentProps: { options: genderOptions.value },
  },
  {
    fieldName: 'status',
    label: $t('common.status'),
    component: 'Switch',
    defaultValue: true,
    rules: 'required',
    componentProps: {
      checkedChildren: $t('user.active'),
      unCheckedChildren: $t('user.inactive'),
    },
  },
  {
    fieldName: 'bio',
    label: $t('user.bio'),
    component: 'Textarea',
    formItemClass: 'col-span-full',
    componentProps: {
      rows: 4,
      maxLength: 200,
      showCount: true,
    },
  },
]);

// Methods

const handleCreate = () => {
  openCreateForm();
};

const handleEdit = (record: User) => {
  openEditForm(record, {
    username: record.username,
    email: record.email,
    realName: record.realName,
    phone: record.phone,
    gender: record.gender || 'male',
    status: record.status === 'active',
    bio: record.bio || '',
  });
};

const handleDelete = async (record: User) => {
  await deleteUser(record.id);
  message.success($t('exampleTable.deleteSuccess'));
  void gridApi.query();
};

const handleSubmit = async (rawValues: Record<string, unknown>) => {
  const values = rawValues as TableFormValues;
  const session = formSessionKey.value;
  const payload: Partial<User> = {
    ...values,
    status: values.status ? 'active' : 'inactive',
  };

  try {
    if (editingId.value) {
      await updateUser(editingId.value, payload);
      message.success($t('exampleTable.updateSuccess'));
    } else {
      await createUser(payload);
      message.success($t('exampleTable.createSuccess'));
    }
    if (session === formSessionKey.value) closeFormModal();
    if (editingId.value) void gridApi.query();
    else void gridApi.reload();
  } catch (error: unknown) {
    message.error((error as Error).message || $t('common.error'));
  }
};

const handleStatusChange = async (record: User, checked: boolean) => {
  try {
    const newStatus = checked ? 'active' : 'inactive';
    await updateUser(record.id, { ...record, status: newStatus });
    record.status = newStatus;
    message.success($t('exampleTable.updateSuccess'));
  } catch (error: unknown) {
    message.error((error as Error).message || $t('common.error'));
  }
};
function confirmDelete(row: User): void {
  Modal.confirm({ title: $t('user.confirmDelete'), onOk: () => handleDelete(row) });
}
const gridOptions = computed<VxeTableGridOptions<User>>(() => ({
  id: 'example-user-table',
  height: 'auto',
  rowConfig: { keyField: 'id' },
  columns: [{ type: 'seq', width: 60 }, ...columns.value],
  pagerConfig: { pageSize: 10 },
  customConfig: { storage: true },
  sortConfig: { remote: true },
  filterConfig: { remote: true },
  proxyConfig: {
    sort: true,
    filter: true,
    ajax: {
      async query({ page, sort, filters }, search: Record<string, unknown>) {
        const headerFilters: Record<string, unknown> = {};
        for (const filter of filters) {
          headerFilters[filter.field] =
            filter.field === 'username' ? filter.datas[0] : filter.values.join(',');
        }
        const response = await getUserList({
          ...search,
          ...headerFilters,
          current: page.currentPage,
          pageSize: page.pageSize,
          sorter:
            sort.field && sort.order
              ? { field: sort.field, order: sort.order === 'asc' ? 'ascend' : 'descend' }
              : undefined,
        });
        return { items: response.data.list, total: response.data.total };
      },
    },
  },
}));
const [Grid, gridApi] = useVxeGrid<User>({
  gridOptions: gridOptions.value,
  formOptions: { schema: searchFormItems.value, collapsed: true, commonConfig: { labelWidth: 80 } },
});
</script>
