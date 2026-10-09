<template>
  <div class="page-container">
    <Grid
      :grid-options="gridOptions"
      :form-options="{ schema: searchFormItems, collapsed: true, commonConfig: { labelWidth: 80 } }"
      :table-title="$t('role.title')"
    >
      <template #toolbar-tools>
        <a-button type="primary" @click="handleCreate">
          <PlusOutlined /> {{ $t('role.createRole') }}
        </a-button>
      </template>
      <template #bodyCell="{ row }"
        ><a-space :size="0"
          ><a-button type="link" size="small" @click="handleEdit(row)"
            ><EditOutlined />{{ $t('common.edit') }}</a-button
          ><a-button type="link" size="small" danger @click="handleDelete(row)"
            ><DeleteOutlined />{{ $t('common.delete') }}</a-button
          ></a-space
        ></template
      ></Grid
    >

    <SchemaFormModal
      v-model:open="modalVisible"
      :title="editingRoleId ? $t('role.editRole') : $t('role.createRole')"
      v-if="formSessionKey"
      :key="formSessionKey"
      :schema="formItems"
      :initial-values="formData"
      width="820px"
      :save="handleSubmit"
      @closed="finishFormClose"
    />
  </div>
</template>

<script setup lang="ts">
import type { FormFieldSchema, FormSchema } from '@/libs/form';
import type { VxeTableGridOptions } from '@/libs/table';
import type { Permission, Role } from '@/types/auth';
import type { TreeSelectProps } from 'antdv-next';

import { PlusOutlined, EditOutlined, DeleteOutlined } from '@antdv-next/icons';
import { message, Modal, Tag } from 'antdv-next';
import { computed, h, onMounted, ref } from 'vue';
import { z } from 'zod';

import { useVxeGrid } from '@/adapters/table';
import { getPermissionTree } from '@/api/permission';
import { createRole, deleteRole, getRoleList, updateRole } from '@/api/role';
import SchemaFormModal from '@/components/SchemaFormModal/index.vue';
import { useCrudFormSession } from '@/composables/useCrudFormSession';
import { $t, getLocale } from '@/locales';
import { resolveLocalizedText } from '@/utils/localizedText';

import { getPermissionTypePresentation } from './permissionTypePresentation';

type RoleFormValues = {
  name: string;
  code: string;
  description: string;
  permissionIds: string[];
};

type PermissionOption = {
  title: string;
  value: string;
  children?: PermissionOption[];
};

const {
  open: modalVisible,
  record: editingRole,
  initialValues: formData,
  sessionKey: formSessionKey,
  openCreate: openCreateForm,
  openEdit: openEditForm,
  close: closeFormModal,
  finishClose: finishFormClose,
} = useCrudFormSession<Role, RoleFormValues>(createDefaultFormValues);
const editingRoleId = computed(() => editingRole.value?.id ?? null);
const permissionTree = ref<Permission[]>([]);

const permissionOptions = computed<PermissionOption[]>(() => {
  const buildOptions = (nodes: Permission[]): PermissionOption[] => {
    return nodes.map((node) => ({
      title: `${resolveLocalizedText(node.name, getLocale())} (${node.code})`,
      value: node.id,
      children: node.children && node.children.length > 0 ? buildOptions(node.children) : undefined,
    }));
  };
  return buildOptions(permissionTree.value);
});

const permissionMap = computed(() => {
  const map = new Map<string, Permission>();
  const traverse = (nodes: Permission[]) => {
    nodes.forEach((node) => {
      map.set(node.id, {
        ...node,
        children: node.children ? [...node.children] : undefined,
      });
      if (node.children && node.children.length > 0) {
        traverse(node.children);
      }
    });
  };
  traverse(permissionTree.value);
  return map;
});

const renderPermissionTreeTitle: NonNullable<TreeSelectProps['treeTitleRender']> = (nodeData) => {
  const title = String(nodeData.title ?? '');
  const permission = permissionMap.value.get(String(nodeData.value));
  const presentation = getPermissionTypePresentation(permission?.type);

  if (!presentation) {
    return title;
  }

  return h(
    'span',
    {
      style: {
        alignItems: 'center',
        display: 'inline-flex',
        gap: '8px',
      },
    },
    [
      h('span', title),
      h(
        Tag,
        {
          class: 'permission-type-tag',
          color: presentation.color,
          style: { marginInlineEnd: 0 },
        },
        () => $t(presentation.labelKey),
      ),
    ],
  );
};

const searchFormItems = computed<FormSchema[]>(() => [
  {
    fieldName: 'name',
    label: $t('role.name'),
    component: 'Input',
    componentProps: {
      allowClear: true,
      placeholder: $t('proForm.enterPlaceholder', { label: $t('role.name') }),
    },
  },
  {
    fieldName: 'code',
    label: $t('role.code'),
    component: 'Input',
    componentProps: {
      allowClear: true,
      placeholder: $t('proForm.enterPlaceholder', { label: $t('role.code') }),
    },
  },
]);

const columns = computed<
  NonNullable<VxeTableGridOptions<Role & { permissionCount: number }>['columns']>
>(() => [
  { title: $t('role.name'), field: 'name', minWidth: 200 },
  { title: $t('role.code'), field: 'code', width: 200 },
  { title: $t('role.description'), field: 'description', minWidth: 150 },
  { title: $t('role.permissions'), field: 'permissionCount', width: 120 },
  { title: $t('common.updateTime'), field: 'updatedAt', width: 200, formatter: 'formatDateTime' },
  {
    title: $t('common.actions'),
    field: 'action',
    width: 160,
    fixed: 'right',
    slots: { default: 'bodyCell' },
  },
]);

const formItems = computed<FormFieldSchema[]>(() => [
  {
    fieldName: 'name',
    label: $t('role.name'),
    component: 'Input',
    rules: 'required',
    componentProps: {},
  },
  {
    fieldName: 'code',
    label: $t('role.code'),
    component: 'Input',
    rules: z
      .string()
      .min(1, $t('role.codeRequired'))
      .regex(/^[a-zA-Z0-9_.-]+$/, $t('role.codePattern')),
    componentProps: {
      disabled: Boolean(editingRoleId.value),
    },
  },
  {
    fieldName: 'description',
    label: $t('role.description'),
    component: 'Textarea',
    formItemClass: 'col-span-full',
    componentProps: {
      rows: 3,
    },
  },
  {
    fieldName: 'permissionIds',
    label: $t('role.permissions'),
    component: 'TreeSelect',
    formItemClass: 'col-span-full',
    rules: z.array(z.string()).min(1, $t('role.selectPermissions')),
    componentProps: {
      class: 'permission-role-tree-select',
      treeCheckable: true,
      allowClear: true,
      treeDefaultExpandAll: true,
      showCheckedStrategy: 'SHOW_PARENT',
      maxTagCount: 2,
      treeTitleRender: renderPermissionTreeTitle,
      treeData: permissionOptions.value,
    },
  },
]);

function createDefaultFormValues(): RoleFormValues {
  return {
    name: '',
    code: '',
    description: '',
    permissionIds: [],
  };
}

const fetchPermissionTreeData = async () => {
  const response = await getPermissionTree();
  permissionTree.value = response.data;
};

const fetchTableData = async (params: Record<string, unknown>) => {
  const response = await getRoleList({
    current: Number(params.current || 1),
    pageSize: Number(params.pageSize || 10),
    name: (params.name as string)?.trim() || undefined,
    code: (params.code as string)?.trim() || undefined,
  });

  const list = response.data.list.map((item) => ({
    ...item,
    permissionCount: item.permissions?.length || 0,
  }));

  return {
    data: list,
    total: response.data.total,
    success: true,
  };
};

const refreshTable = () => {
  void gridApi.query();
};

const reloadTable = () => {
  void gridApi.reload();
};

const handleCreate = () => {
  openCreateForm();
};

const handleEdit = (record: Role) => {
  const initialValues: RoleFormValues = {
    name: record.name,
    code: record.code,
    description: record.description || '',
    permissionIds: (record.permissions || []).map((permission) => permission.id),
  };
  openEditForm(record, initialValues);
};

const handleDelete = async (record: Role) => {
  Modal.confirm({
    title: $t('role.deleteRole'),
    content: $t('role.confirmDelete'),
    onOk: async () => {
      await deleteRole(record.id);
      message.success($t('common.success'));
      refreshTable();
    },
  });
};

const handleSubmit = async (rawValues: Record<string, unknown>) => {
  const values = rawValues as RoleFormValues;
  const session = formSessionKey.value;

  const permissionIds: string[] = values.permissionIds || [];

  const selectedPermissions = permissionIds
    .map((id) => permissionMap.value.get(id))
    .filter((permission): permission is Permission => Boolean(permission));

  const payload: Partial<Role> = {
    name: values.name?.trim(),
    code: values.code?.trim(),
    description: values.description?.trim(),
    permissions: selectedPermissions,
  };

  if (editingRoleId.value) {
    await updateRole(editingRoleId.value, payload);
    message.success($t('role.updateSuccess'));
    refreshTable();
  } else {
    await createRole(payload);
    message.success($t('role.createSuccess'));
    reloadTable();
  }
  if (session === formSessionKey.value) closeFormModal();
};

onMounted(async () => {
  try {
    await fetchPermissionTreeData();
  } catch (error) {
    console.error('Failed to load role permissions:', error);
  }
});
const gridOptions = computed<VxeTableGridOptions<Role & { permissionCount: number }>>(() => ({
  id: 'system-role',
  height: 'auto',
  rowConfig: { keyField: 'id' },
  columns: [{ type: 'seq', width: 60 }, ...columns.value],
  pagerConfig: { pageSize: 10 },
  customConfig: { storage: true },
  proxyConfig: {
    ajax: {
      async query({ page }, search: Record<string, unknown>) {
        const result = await fetchTableData({
          ...search,
          current: page.currentPage,
          pageSize: page.pageSize,
        });
        return { items: result.data, total: result.total };
      },
    },
  },
}));
const [Grid, gridApi] = useVxeGrid<Role & { permissionCount: number }>({
  gridOptions: gridOptions.value,
  formOptions: { schema: searchFormItems.value, collapsed: true, commonConfig: { labelWidth: 80 } },
});
</script>

<style>
.permission-role-tree-select .ant-select-selection-item .permission-type-tag {
  display: none;
}
</style>
