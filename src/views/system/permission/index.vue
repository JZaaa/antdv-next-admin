<template>
  <div class="page-container">
    <Grid
      :grid-options="gridOptions"
      :grid-events="gridEvents"
      :form-options="{ schema: searchFormItems, collapsed: false }"
      :table-title="$t('permission.title')"
    >
      <template #toolbar-tools>
        <a-space :size="8">
          <a-button type="primary" @click="handleCreateRoot">
            <PlusOutlined /> {{ $t('permission.createPermission') }}
          </a-button>
          <a-button @click="expandAllRows">{{ $t('permission.expandAll') }}</a-button>
          <a-button @click="collapseAllRows">{{ $t('permission.collapseAll') }}</a-button>
        </a-space>
      </template>
      <template #bodyCell="{ row, column }">
        <span v-if="column.field === 'name'">{{
          resolveLocalizedText(row.name, getLocale())
        }}</span>
        <component :is="renderIcon(row.icon)" v-else-if="column.field === 'icon' && row.icon" />
        <a-tag
          v-else-if="column.field === 'type'"
          :color="permissionTypeValueEnum[row.type]?.color"
          >{{ permissionTypeValueEnum[row.type]?.text }}</a-tag
        >
        <a-badge
          v-else-if="column.field === 'status'"
          :status="row.status === 'active' ? 'success' : 'default'"
          :text="permissionStatusValueEnum[row.status || 'active']?.text"
        />
        <a-tag
          v-else-if="column.field === 'visible'"
          :color="permissionVisibleValueEnum[String(row.visible)]?.color"
          >{{ permissionVisibleValueEnum[String(row.visible)]?.text }}</a-tag
        >
        <a-space v-else-if="column.field === 'action'" :size="0">
          <a-button type="link" size="small" @click="handleEdit(row)"
            ><EditOutlined />{{ $t('common.edit') }}</a-button
          >
          <a-button type="link" size="small" danger @click="handleDelete(row)"
            ><DeleteOutlined />{{ $t('common.delete') }}</a-button
          >
          <a-button
            v-if="row.type === 'menu'"
            type="link"
            size="small"
            @click="handleCreateChild(row)"
            ><PlusOutlined />{{ $t('permission.addChild') }}</a-button
          > </a-space
        ><span v-else>-</span>
      </template></Grid
    >

    <SchemaFormModal
      v-model:open="modalVisible"
      :title="modalTitle"
      v-if="formSessionKey"
      :key="formSessionKey"
      :schema="formItems"
      :initial-values="formData"
      width="760px"
      :save="handleSubmit"
      @closed="handleFormClosed"
      @values-change="handleFormValuesChange"
    >
      <template #before-form>
        <a-alert v-if="currentParentName" type="info" show-icon style="margin-bottom: 12px">
          <template #message> {{ $t('permission.parentMenu') }}：{{ currentParentName }} </template>
        </a-alert>
      </template>
    </SchemaFormModal>
  </div>
</template>

<script setup lang="ts">
import type { FormFieldSchema, FormSchema } from '@/libs/form';
import type { VxeTableGridOptions } from '@/libs/table';
import type { LocalizedText, Permission } from '@/types/auth';

import { PlusOutlined, EditOutlined, DeleteOutlined } from '@antdv-next/icons';
import { message, Modal } from 'antdv-next';
import { computed, ref, nextTick } from 'vue';
import { z } from 'zod';

import { useVxeGrid } from '@/adapters/table';
import {
  createPermission,
  deletePermission,
  getPermissionList,
  updatePermission,
} from '@/api/permission';
import I18nInput from '@/components/I18nInput/index.vue';
import IconPicker from '@/components/IconPicker/index.vue';
import SchemaFormModal from '@/components/SchemaFormModal/index.vue';
import { useCrudFormSession } from '@/composables/useCrudFormSession';
import { $t, getLocale } from '@/locales';
import { useSettingsStore } from '@/stores/settings';
import { renderIcon } from '@/utils/icon';
import { resolveLocalizedText } from '@/utils/localizedText';

import { flattenPermissions } from './tree';

type PermissionFormValues = {
  name: string | LocalizedText;
  code: string;
  type: Permission['type'];
  description: string;
  parentId?: string;
  path: string;
  component: string;
  icon: string;
  sort: number;
  status: boolean;
  visible: boolean;
};

const viewModules = import.meta.glob('/src/views/**/*.vue');
const componentPathOptions = Object.keys(viewModules)
  .map((filePath) => filePath.replace(/^\/src\/views\//, '').replace(/\.vue$/, ''))
  .sort((firstPath, secondPath) => firstPath.localeCompare(secondPath))
  .map((componentPath) => ({
    label: componentPath,
    value: componentPath,
  }));

const settingsStore = useSettingsStore();
const useI18nName = computed(() => settingsStore.showLanguageSwitch);

const {
  open: modalVisible,
  mode: modalMode,
  record: editingPermission,
  initialValues: formData,
  sessionKey: formSessionKey,
  openCreate: openCreateForm,
  openEdit: openEditForm,
  close: closeFormModal,
  finishClose: finishFormClose,
} = useCrudFormSession<Permission, PermissionFormValues>(createDefaultFormValues);
const editingPermissionId = computed(() => editingPermission.value?.id ?? null);

const menuTree = ref<Permission[]>([]);
const expandedRowKeys = ref<string[]>([]);
const keepExpandAll = ref(true);

const formValues = ref<PermissionFormValues>(createDefaultFormValues());

const permissionTypeOptions = computed(() => [
  { label: $t('permission.menu'), value: 'menu' },
  { label: $t('permission.button'), value: 'button' },
  { label: $t('permission.api'), value: 'api' },
]);

const modalTitle = computed(() => {
  if (modalMode.value === 'edit') {
    return $t('permission.editPermission');
  }
  return formValues.value.parentId
    ? $t('permission.createChildMenu')
    : $t('permission.createPermission');
});

const currentParentName = computed(() => {
  if (!formValues.value.parentId) {
    return '';
  }
  return findPermissionName(menuTree.value, formValues.value.parentId) || '-';
});

const permissionTypeValueEnum = computed<
  Record<string, { text: string; status?: string; color?: string }>
>(() => ({
  menu: { text: $t('permission.menu'), color: 'processing' },
  button: { text: $t('permission.button'), color: 'success' },
  api: { text: $t('permission.api'), color: 'purple' },
}));

const permissionStatusValueEnum = computed<
  Record<string, { text: string; status?: string; color?: string }>
>(() => ({
  active: { text: $t('user.active'), status: 'success' },
  inactive: { text: $t('user.inactive'), status: 'default' },
}));

const permissionVisibleValueEnum = computed<
  Record<string, { text: string; status?: string; color?: string }>
>(() => ({
  true: { text: $t('permission.show'), color: 'blue' },
  false: { text: $t('permission.hide'), color: 'default' },
}));

function createLocalizedName(value = ''): string | LocalizedText {
  if (!useI18nName.value) {
    return value;
  }
  return {
    'zh-CN': value,
    'en-US': value,
  };
}

const searchFormItems = computed<FormSchema[]>(() => [
  {
    fieldName: 'keyword',
    label: $t('common.search'),
    component: 'Input',
    componentProps: {
      allowClear: true,
      placeholder: $t('proForm.enterPlaceholder', { label: $t('common.search') }),
    },
  },
  {
    fieldName: 'type',
    label: $t('permission.type'),
    component: 'Select',
    componentProps: {
      allowClear: true,
      placeholder: $t('proForm.selectPlaceholder', { label: $t('permission.type') }),
      options: permissionTypeOptions.value,
    },
  },
  {
    fieldName: 'status',
    label: $t('common.status'),
    component: 'Select',
    componentProps: {
      allowClear: true,
      placeholder: $t('proForm.selectPlaceholder', { label: $t('common.status') }),
      options: [
        { label: $t('user.active'), value: 'active' },
        { label: $t('user.inactive'), value: 'inactive' },
      ],
    },
  },
]);

const columns = computed<NonNullable<VxeTableGridOptions<Permission>['columns']>>(() => [
  {
    title: $t('permission.name'),
    field: 'name',
    treeNode: true,
    minWidth: 220,
    fixed: 'left',
    slots: { default: 'bodyCell' },
  },
  { title: $t('permission.icon'), field: 'icon', width: 80, slots: { default: 'bodyCell' } },
  { title: $t('permission.code'), field: 'code', width: 220 },
  { title: $t('permission.type'), field: 'type', width: 120, slots: { default: 'bodyCell' } },
  { title: $t('permission.routePath'), field: 'path', width: 170 },
  { title: $t('permission.componentPath'), field: 'component', width: 220 },
  { title: $t('common.status'), field: 'status', width: 120, slots: { default: 'bodyCell' } },
  { title: $t('permission.visible'), field: 'visible', width: 100, slots: { default: 'bodyCell' } },
  { title: $t('permission.sort'), field: 'sort', width: 90 },
  {
    title: $t('common.actions'),
    field: 'action',
    width: 260,
    fixed: 'right',
    slots: { default: 'bodyCell' },
  },
]);

const menuDependency = {
  triggerFields: ['type'],
  resolve: ({ values }: { values: Readonly<Record<string, unknown>> }) => ({
    show: values.type === 'menu',
  }),
};
const formItems = computed<FormFieldSchema[]>(() => [
  {
    fieldName: 'name',
    label: $t('permission.name'),
    component: useI18nName.value ? I18nInput : 'Input',
    modelPropName: 'value',
    rules: z
      .string()
      .or(z.record(z.string(), z.string()))
      .refine(
        (value) => Boolean(resolveLocalizedText(value, getLocale()).trim()),
        $t('permission.nameRequired'),
      ),
    componentProps: { placeholder: $t('permission.name'), modalTitle: $t('permission.name') },
  },
  {
    fieldName: 'code',
    label: $t('permission.code'),
    component: 'Input',
    componentProps: { disabled: Boolean(editingPermissionId.value) },
    rules: z
      .string()
      .min(1, $t('permission.codeRequired'))
      .regex(/^[a-zA-Z0-9_.-]+$/, $t('permission.codePattern')),
  },
  {
    fieldName: 'type',
    label: $t('permission.type'),
    component: 'Select',
    rules: 'required',
    componentProps: { options: permissionTypeOptions.value },
  },
  {
    fieldName: 'status',
    label: $t('common.status'),
    component: 'Switch',
    componentProps: { checkedChildren: $t('user.active'), unCheckedChildren: $t('user.inactive') },
  },
  {
    fieldName: 'path',
    label: $t('permission.routePath'),
    component: 'Input',
    dependencies: menuDependency,
    rules: z.string().trim().min(1, $t('permission.menuRouteRequired')),
  },
  {
    fieldName: 'component',
    label: $t('permission.componentPath'),
    component: 'Select',
    dependencies: menuDependency,
    componentProps: {
      options: componentPathOptions,
      showSearch: true,
      allowClear: true,
      placeholder: $t('permission.componentPathPlaceholder'),
    },
  },
  {
    fieldName: 'icon',
    label: $t('permission.icon'),
    component: IconPicker,
    dependencies: menuDependency,
    componentProps: { placeholder: $t('permission.iconPlaceholder'), onlineLimit: 160 },
  },
  {
    fieldName: 'sort',
    label: $t('permission.sort'),
    component: 'InputNumber',
    dependencies: menuDependency,
    componentProps: { min: 0 },
  },
  {
    fieldName: 'description',
    label: $t('role.description'),
    component: 'Textarea',
    formItemClass: 'col-span-full',
    componentProps: { rows: 3 },
  },
  {
    fieldName: 'visible',
    label: $t('permission.visibleStatus'),
    component: 'Switch',
    formItemClass: 'col-span-full',
    componentProps: {
      checkedChildren: $t('permission.show'),
      unCheckedChildren: $t('permission.hide'),
    },
  },
]);

function createDefaultFormValues(): PermissionFormValues {
  return {
    name: createLocalizedName(),
    code: '',
    type: 'menu',
    description: '',
    parentId: undefined,
    path: '',
    component: '',
    icon: '',
    sort: 0,
    status: true,
    visible: true,
  };
}

function normalizePath(path: string) {
  if (!path) {
    return '';
  }
  return path.startsWith('/') ? path : `/${path}`;
}

function collectPermissionIds(list: Permission[]): string[] {
  const ids: string[] = [];
  list.forEach((item) => {
    ids.push(item.id);
    if (item.children && item.children.length > 0) {
      ids.push(...collectPermissionIds(item.children));
    }
  });
  return ids;
}

function findPermissionName(list: Permission[], id: string): string {
  for (const item of list) {
    if (item.id === id) {
      return resolveLocalizedText(item.name, getLocale());
    }
    if (item.children && item.children.length > 0) {
      const childName = findPermissionName(item.children, id);
      if (childName) {
        return childName;
      }
    }
  }
  return '';
}

const fetchTableData = async (params: Record<string, unknown>) => {
  const keyword = typeof params.keyword === 'string' ? params.keyword.trim() : undefined;
  const response = await getPermissionList({
    keyword: keyword || undefined,
    type: params.type || undefined,
    status: params.status || undefined,
  });

  menuTree.value = response.data;
  const allIds = collectPermissionIds(menuTree.value);

  if (keepExpandAll.value) {
    expandedRowKeys.value = allIds;
  } else {
    expandedRowKeys.value = expandedRowKeys.value.filter((id) => allIds.includes(String(id)));
  }

  return {
    data: response.data,
    total: allIds.length,
    success: true,
  };
};

const refreshTable = () => {
  void gridApi.query();
};

const expandAllRows = () => {
  expandedRowKeys.value = collectPermissionIds(menuTree.value);
  keepExpandAll.value = true;
  void gridApi.grid?.setAllTreeExpand(true);
};

const collapseAllRows = () => {
  expandedRowKeys.value = [];
  keepExpandAll.value = false;
  void gridApi.grid?.setAllTreeExpand(false);
};

const handleCreateRoot = () => {
  const initialValues = createDefaultFormValues();
  formValues.value = initialValues;
  openCreateForm(initialValues);
};

const handleCreateChild = (record: Permission) => {
  const initialValues: PermissionFormValues = {
    ...createDefaultFormValues(),
    parentId: record.id,
    type: 'menu' as const,
  };
  formValues.value = initialValues;
  openCreateForm(initialValues);
};

const handleEdit = (record: Permission) => {
  const initialValues: PermissionFormValues = {
    name: useI18nName.value
      ? typeof record.name === 'string'
        ? createLocalizedName(record.name)
        : record.name
      : resolveLocalizedText(record.name, getLocale()),
    code: record.code,
    type: record.type,
    description: record.description || '',
    parentId: record.parentId,
    path: record.path || '',
    component: record.component || '',
    icon: record.icon || '',
    sort: record.sort ?? 0,
    status: record.status !== 'inactive',
    visible: record.visible !== false,
  };
  formValues.value = initialValues;
  openEditForm(record, initialValues);
};

const handleFormClosed = () => {
  if (modalVisible.value) {
    return;
  }
  finishFormClose();
  formValues.value = createDefaultFormValues();
};

const handleDelete = async (record: Permission) => {
  Modal.confirm({
    title: $t('permission.deletePermission'),
    content: $t('permission.confirmDelete'),
    onOk: async () => {
      await deletePermission(record.id);
      message.success($t('common.success'));
      refreshTable();
    },
  });
};

const handleFormValuesChange = (values: Record<string, unknown>) => {
  formValues.value = {
    ...formValues.value,
    ...values,
  };
};

const handleSubmit = async (rawValues: Record<string, unknown>) => {
  const values = rawValues as PermissionFormValues;
  const session = formSessionKey.value;

  const payload: Partial<Permission> = {
    name: values.name,
    code: values.code?.trim(),
    type: values.type,
    description: values.description?.trim(),
    parentId: values.parentId,
    status: values.status ? 'active' : 'inactive',
    visible: values.visible,
    sort: Number(values.sort ?? 0),
    path: values.type === 'menu' ? normalizePath(values.path?.trim()) : undefined,
    component: values.type === 'menu' ? values.component?.trim() || undefined : undefined,
    icon: values.type === 'menu' ? values.icon?.trim() || undefined : undefined,
    resource:
      values.type === 'menu'
        ? normalizePath(values.path?.trim())
        : values.code?.trim().replace(/\.[^.]+$/, ''),
    action: values.type === 'menu' ? 'view' : values.code?.trim().split('.').pop() || '*',
  };

  if (modalMode.value === 'edit' && editingPermissionId.value) {
    await updatePermission(editingPermissionId.value, payload);
    message.success($t('permission.updateSuccess'));
  } else {
    await createPermission(payload);
    message.success($t('permission.createSuccess'));
  }
  if (session === formSessionKey.value) closeFormModal();
  refreshTable();
};
const gridOptions = computed<VxeTableGridOptions<Permission>>(() => ({
  id: 'system-permission',
  height: 'auto',
  rowConfig: { keyField: 'id' },
  columns: columns.value,
  customConfig: { storage: true },
  treeConfig: {
    transform: true,
    rowField: 'id',
    parentField: 'parentId',
    childrenField: 'children',
    reserve: true,
  },
  virtualYConfig: { enabled: true, gt: 0 },
  // Keep the viewport width stable when expanding crosses the vertical overflow threshold.
  scrollbarConfig: { y: { visible: 'visible' } },
  proxyConfig: {
    ajax: {
      querySuccess: restoreTreeExpansion,
      async query(_params, search: Record<string, unknown>) {
        const result = await fetchTableData(search);
        return { items: flattenPermissions(result.data), total: result.total };
      },
    },
  },
}));
const [Grid, gridApi] = useVxeGrid<Permission>({
  gridOptions: gridOptions.value,
  formOptions: { schema: searchFormItems.value },
});
async function restoreTreeExpansion(): Promise<void> {
  await nextTick();
  const grid = gridApi.grid;
  if (!grid) return;
  const desiredKeys = new Set(expandedRowKeys.value);
  const collapseRows = grid.getTreeExpandRecords().filter((row) => !desiredKeys.has(row.id));
  const expandRows = expandedRowKeys.value
    .map((id) => grid.getRowById(id))
    .filter(
      (row): row is Permission => Boolean(row?.children?.length) && !grid.isTreeExpandByRow(row),
    );
  // Native reserve already restores existing nodes. Only reconcile changed branches,
  // without rendering a fully collapsed intermediate state after every refresh.
  await Promise.all([
    ...(collapseRows.length ? [grid.setTreeExpand(collapseRows, false)] : []),
    ...(expandRows.length ? [grid.setTreeExpand(expandRows, true)] : []),
  ]);
}
const gridEvents = {
  toggleTreeExpand({ row, expanded }: { row: Permission; expanded: boolean }) {
    keepExpandAll.value = false;
    const keys = new Set(expandedRowKeys.value);
    if (expanded) keys.add(row.id);
    else keys.delete(row.id);
    expandedRowKeys.value = [...keys];
  },
};
</script>
