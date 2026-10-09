<template>
  <div class="page-container user-page">
    <Grid :table-title="$t('user.title')" :grid-options="gridOptions" :form-options="searchOptions">
      <template #toolbar-tools>
        <a-space wrap>
          <a-upload
            v-if="can('system.user.create')"
            :show-upload-list="false"
            accept=".csv"
            :before-upload="handleImport"
          >
            <a-button><UploadOutlined /> {{ $t('common.import') }}</a-button>
          </a-upload>
          <a-button @click="handleExport"><DownloadOutlined /> {{ $t('common.export') }}</a-button>
          <a-button v-if="can('system.user.create')" type="primary" @click="handleCreate">
            <PlusOutlined /> {{ $t('user.createUser') }}
          </a-button>
        </a-space>
      </template>
      <template #gender="{ row }">
        <a-tag v-if="row.gender" :color="row.gender === 'male' ? 'blue' : 'magenta'">
          {{ row.gender === 'male' ? $t('user.male') : $t('user.female') }}
        </a-tag>
        <span v-else>-</span>
      </template>
      <template #status="{ row }">
        <a-badge
          :status="row.status === 'active' ? 'success' : 'default'"
          :text="row.status === 'active' ? $t('user.active') : $t('user.inactive')"
        />
      </template>
      <template #actions="{ row }">
        <a-space :size="0">
          <a-button v-if="can('system.user.edit')" type="link" size="small" @click="handleEdit(row)"
            ><EditOutlined /> {{ $t('common.edit') }}</a-button
          >
          <a-button
            v-if="can('system.user.delete')"
            type="link"
            size="small"
            danger
            @click="handleDelete(row)"
            ><DeleteOutlined /> {{ $t('common.delete') }}</a-button
          >
        </a-space>
      </template>
    </Grid>
    <UserFormModal
      v-if="formSessionKey"
      :key="formSessionKey"
      v-model:open="modalVisible"
      :editing="Boolean(editingUserId)"
      :initial-values="formData"
      :roles="roleOptions"
      :save="handleSubmit"
      @closed="finishFormClose"
    />
  </div>
</template>

<script setup lang="ts">
import type { UserFormValues } from './form';
import type { SchemaFormProps } from '@/libs/form';
import type { VxeTableGridOptions } from '@/libs/table';
import type { Role, User } from '@/types/auth';

import {
  PlusOutlined,
  EditOutlined,
  DeleteOutlined,
  UploadOutlined,
  DownloadOutlined,
} from '@antdv-next/icons';
import { message, Modal } from 'antdv-next';
import { computed, onBeforeUnmount, onMounted, ref } from 'vue';

import { useVxeGrid } from '@/adapters/table';
import { getRoleList } from '@/api/role';
import { createUser, deleteUser, getUserList, updateUser } from '@/api/user';
import { useCrudFormSession } from '@/composables/useCrudFormSession';
import { usePermission } from '@/composables/usePermission';
import { $t } from '@/locales';
import { useLayoutStore } from '@/stores/layout';
import { exportToCSV, parseCSV } from '@/utils/export';

import { createDefaultFormValues, toUserFormValues, toUserPayload } from './form';
import UserFormModal from './UserFormModal.vue';

interface UserSearch {
  username?: string;
  email?: string;
  status?: string;
}
type UserRow = User & { roleNames: string };
const { can } = usePermission();
const layoutStore = useLayoutStore();
const {
  open: modalVisible,
  record: editingUser,
  initialValues: formData,
  sessionKey: formSessionKey,
  openCreate: openCreateForm,
  openEdit: openEditForm,
  close: closeFormModal,
  finishClose: finishFormClose,
} = useCrudFormSession<User, UserFormValues>(createDefaultFormValues);
const editingUserId = computed(() => editingUser.value?.id ?? null);
const roleOptions = ref<Role[]>([]);
let alive = true;
onBeforeUnmount(() => {
  alive = false;
});
const searchOptions = computed<SchemaFormProps<string, Record<never, never>, UserSearch>>(() => ({
  submitOnEnter: true,
  showCollapseButton: true,
  collapsed: true,
  commonConfig: { labelWidth: 70 },
  schema: [
    {
      fieldName: 'username',
      label: $t('user.username'),
      component: 'Input',
      defaultValue: '',
      componentProps: {
        allowClear: true,
        placeholder: $t('proForm.enterPlaceholder', { label: $t('user.username') }),
      },
    },
    {
      fieldName: 'email',
      label: $t('user.email'),
      component: 'Input',
      defaultValue: '',
      componentProps: {
        allowClear: true,
        placeholder: $t('proForm.enterPlaceholder', { label: $t('user.email') }),
      },
    },
    {
      fieldName: 'status',
      label: $t('user.status'),
      component: 'Select',
      componentProps: {
        allowClear: true,
        placeholder: $t('proForm.selectPlaceholder', { label: $t('user.status') }),
        options: [
          { label: $t('user.active'), value: 'active' },
          { label: $t('user.inactive'), value: 'inactive' },
        ],
      },
    },
  ],
}));
const gridOptions = computed<VxeTableGridOptions<UserRow>>(() => ({
  id: 'system-user',
  height: 'auto',
  minHeight: 300,
  rowConfig: { keyField: 'id' },
  pagerConfig: { pageSize: 10 },
  customConfig: { storage: true },
  columns: [
    { type: 'seq', width: 60, fixed: layoutStore.isMobile ? undefined : 'left' },
    {
      field: 'username',
      title: $t('user.username'),
      width: 150,
      fixed: layoutStore.isMobile ? undefined : 'left',
    },
    { field: 'realName', title: $t('user.realName'), minWidth: 140 },
    { field: 'email', title: $t('user.email'), minWidth: 220 },
    { field: 'phone', title: $t('user.phone'), width: 150 },
    { field: 'roleNames', title: $t('user.role'), minWidth: 220 },
    { field: 'gender', title: $t('user.gender'), width: 100, slots: { default: 'gender' } },
    { field: 'status', title: $t('user.status'), width: 120, slots: { default: 'status' } },
    { field: 'createdAt', title: $t('common.createTime'), width: 200, formatter: 'formatDateTime' },
    ...(can('system.user.edit') || can('system.user.delete')
      ? [
          {
            field: 'action',
            title: $t('common.actions'),
            width: 180,
            fixed: layoutStore.isMobile ? undefined : ('right' as const),
            slots: { default: 'actions' },
          },
        ]
      : []),
  ],
  proxyConfig: {
    ajax: {
      async query({ page }, search: UserSearch) {
        const response = await getUserList({
          current: page.currentPage,
          pageSize: page.pageSize,
          username: search.username?.trim() || undefined,
          email: search.email?.trim() || undefined,
          status: search.status,
        });
        return {
          items: response.data.list.map((item) => ({
            ...item,
            roleNames: item.roles?.map((role) => role.name).join(', ') || '-',
          })),
          total: response.data.total,
        };
      },
    },
  },
}));
const [Grid, gridApi] = useVxeGrid<UserRow, UserSearch>({
  gridOptions: gridOptions.value,
  formOptions: searchOptions.value,
});
function refreshTable(): void {
  void gridApi.query();
}
function reloadTable(): void {
  void gridApi.reload();
}
function handleCreate(): void {
  if (can('system.user.create')) openCreateForm();
}
function handleEdit(record: User): void {
  if (can('system.user.edit')) openEditForm(record, toUserFormValues(record));
}
function handleDelete(record: User): void {
  if (!can('system.user.delete')) return;
  Modal.confirm({
    title: $t('user.deleteUser'),
    content: $t('user.confirmDelete'),
    async onOk() {
      try {
        await deleteUser(record.id);
        message.success($t('common.success'));
        refreshTable();
      } catch (error) {
        // 请求层提供错误提示；保留确认框以便重试。
        console.error('Failed to delete user:', error);
        throw error;
      }
    },
  });
}
async function handleSubmit(values: UserFormValues): Promise<void> {
  const session = formSessionKey.value;
  const id = editingUserId.value;
  if (!modalVisible.value || !can(id ? 'system.user.edit' : 'system.user.create')) return;
  const payload = toUserPayload(values, roleOptions.value);
  if (id) await updateUser(id, payload);
  else await createUser(payload);
  if (!alive) return;
  message.success($t(id ? 'user.updateSuccess' : 'user.createSuccess'));
  if (id) refreshTable();
  else reloadTable();
  // 旧请求完成时不能关闭后来打开的另一条记录。
  if (session === formSessionKey.value) closeFormModal();
}
onMounted(async () => {
  if (!can('system.user.create') && !can('system.user.edit')) return;
  try {
    const response = await getRoleList({ current: 1, pageSize: 200 });
    if (alive) roleOptions.value = response.data.list;
  } catch (error) {
    console.error('Failed to load user role options:', error);
  }
});

// export user data
const handleExport = async () => {
  try {
    const response = await getUserList({ current: 1, pageSize: 9999 });
    const list = response.data.list;
    exportToCSV(
      [
        { title: $t('user.username'), dataIndex: 'username' },
        { title: $t('user.realName'), dataIndex: 'realName' },
        { title: $t('user.email'), dataIndex: 'email' },
        { title: $t('user.phone'), dataIndex: 'phone' },
        {
          title: $t('user.gender'),
          dataIndex: 'gender',
          render: (v: unknown) => (v === 'male' ? $t('user.male') : $t('user.female')),
        },
        {
          title: $t('user.status'),
          dataIndex: 'status',
          render: (v: unknown) => (v === 'active' ? $t('user.active') : $t('user.inactive')),
        },
        {
          title: $t('user.role'),
          dataIndex: 'roles',
          render: (_: unknown, r: unknown) =>
            (((r as Record<string, unknown>).roles as Array<{ name: string }>) || [])
              .map((role) => role.name)
              .join(', '),
        },
        { title: $t('common.createTime'), dataIndex: 'createdAt' },
      ],
      list,
      `${$t('user.title')}_${new Date().toISOString().slice(0, 10)}`,
    );
    message.success($t('user.exportSuccess'));
  } catch {
    message.error($t('user.exportFailed'));
  }
};

// import user data
const handleImport = async (file: File) => {
  if (!can('system.user.create')) return false;
  try {
    const rows = await parseCSV(file);
    if (rows.length < 2) {
      message.warning($t('user.importEmpty'));
      return false;
    }
    const header = rows[0];
    const usernameIdx = header.findIndex((h) => h.includes('Username') || h.includes('username'));
    const realNameIdx = header.findIndex((h) => h.includes('Name') || h.includes('name'));
    const emailIdx = header.findIndex((h) => h.includes('Email') || h.includes('email'));

    if (usernameIdx === -1 || realNameIdx === -1 || emailIdx === -1) {
      message.error($t('user.importFormatError'));
      return false;
    }

    const importTasks = rows
      .slice(1)
      .filter((row) => row[usernameIdx])
      .map((row) =>
        createUser({
          username: row[usernameIdx],
          realName: row[realNameIdx] || '',
          email: row[emailIdx] || '',
          status: 'active',
        }),
      );
    const results = await Promise.allSettled(importTasks);
    const successCount = results.filter((result) => result.status === 'fulfilled').length;
    message.success($t('user.importSuccess', { count: successCount }));
    refreshTable();
  } catch {
    message.error($t('user.importFailed'));
  }
  return false;
};
</script>
