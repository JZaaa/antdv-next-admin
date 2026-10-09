<template>
  <div class="page-container">
    <div class="search-layout-demo">
      <a-space wrap :size="12">
        <span class="search-layout-demo-label">
          {{ $t('examples.scaffold.proTableAdvanced.searchColumnsPerRow') }}
        </span>
        <a-segmented v-model:value="searchColumnsPerRow" :options="[2, 3, 4, 5]" />
        <code>formOptions.wrapperClass = {{ searchOptions.wrapperClass }}</code>
      </a-space>
      <span class="search-layout-demo-hint">
        {{ $t('examples.scaffold.proTableAdvanced.searchColumnsPerRowHint') }}
      </span>
    </div>

    <Grid
      :grid-options="gridOptions"
      :grid-events="gridEvents"
      :form-options="searchOptions"
      :table-title="$t('examples.scaffold.proTableAdvanced.title')"
    >
      <template #toolbar-tools>
        <a-space wrap>
          <a-tag color="processing">{{
            $t('examples.scaffold.proTableAdvanced.selectedCount', {
              count: selectedRowKeys.length,
            })
          }}</a-tag>
          <a-button
            :disabled="selectedRowKeys.length === 0"
            @click="handleBatchSetStatus('inactive')"
          >
            {{ $t('examples.scaffold.proTableAdvanced.batchDisable') }}
          </a-button>
          <a-button danger :disabled="selectedRowKeys.length === 0" @click="handleBatchDelete">
            {{ $t('examples.scaffold.proTableAdvanced.batchDelete') }}
          </a-button>
          <a-button type="primary" @click="handleCreate">
            <PlusOutlined /> {{ $t('examples.scaffold.proTableAdvanced.createUser') }}
          </a-button>
          <a-button @click="exportCsv">{{
            $t('examples.scaffold.proTableAdvanced.export')
          }}</a-button>
        </a-space>
      </template>

      <template #bodyCell="{ column, row: record }">
        <template v-if="column.field === 'gender'"
          ><a-tag :color="record.gender === 'male' ? 'blue' : 'pink'">{{
            $t(record.gender === 'male' ? 'user.male' : 'user.female')
          }}</a-tag></template
        >
        <template v-if="column.field === 'action'"
          ><a-space :size="0"
            ><a-button type="link" size="small" @click="handleEdit(record)"
              ><EditOutlined />{{ $t('common.edit') }}</a-button
            ><a-button type="link" size="small" danger @click="handleDelete(record)"
              ><DeleteOutlined />{{ $t('common.delete') }}</a-button
            ></a-space
          ></template
        >
        <template v-if="column.field === 'status'">
          <a-switch
            :checked="record.status === 'active'"
            :loading="switchLoadingId === record.id"
            :checked-children="$t('examples.scaffold.proTableAdvanced.statusActive')"
            :un-checked-children="$t('examples.scaffold.proTableAdvanced.statusInactive')"
            @change="handleStatusSwitchChange(record.id, $event as boolean)"
          />
        </template>
      </template>
    </Grid>

    <SchemaFormModal
      v-model:open="modalVisible"
      :title="
        editingId
          ? $t('examples.scaffold.proTableAdvanced.editUser')
          : $t('examples.scaffold.proTableAdvanced.createUser')
      "
      v-if="formSessionKey"
      :key="formSessionKey"
      :schema="formItems"
      :initial-values="formData"
      width="640px"
      :save="handleSubmit"
      @closed="finishFormClose"
    />
  </div>
</template>

<script setup lang="ts">
import type { FormFieldSchema, FormSchema } from '@/libs/form';
import type { VxeTableGridOptions } from '@/libs/table';

import { EditOutlined, DeleteOutlined, PlusOutlined } from '@antdv-next/icons';
import { message, Modal } from 'antdv-next';
import { computed, ref, watch } from 'vue';
import { z } from 'zod';

import { useVxeGrid } from '@/adapters/table';
import SchemaFormModal from '@/components/SchemaFormModal/index.vue';
import { useCrudFormSession } from '@/composables/useCrudFormSession';
import { $t } from '@/locales';

interface DemoRow {
  id: string;
  username: string;
  realName: string;
  email: string;
  gender: 'male' | 'female';
  status: 'active' | 'inactive';
  createdAt: string;
}

const createMockRows = (): DemoRow[] => {
  return Array.from({ length: 48 }, (_, index) => {
    const i = index + 1;
    const isMale = i % 2 === 0;

    return {
      id: `demo-${i}`,
      username: `user_${String(i).padStart(3, '0')}`,
      realName: isMale ? `张三${i}` : `李四${i}`,
      email: `user_${i}@example.com`,
      gender: isMale ? 'male' : 'female',
      status: i % 3 === 0 ? 'inactive' : 'active',
      createdAt: new Date(Date.now() - i * 86400000).toISOString(),
    };
  });
};

const tableRows = ref<DemoRow[]>(createMockRows());
const selectedRowKeys = ref<string[]>([]);
const switchLoadingId = ref<string | null>(null);

type DemoFormValues = Pick<DemoRow, 'username' | 'realName' | 'email' | 'gender'> & {
  status: boolean;
};

function createDefaultFormValues(): DemoFormValues {
  return {
    username: '',
    realName: '',
    email: '',
    gender: 'male',
    status: true,
  };
}

const {
  open: modalVisible,
  record: editingRecord,
  initialValues: formData,
  sessionKey: formSessionKey,
  openCreate: openCreateForm,
  openEdit: openEditForm,
  close: closeFormModal,
  finishClose: finishFormClose,
} = useCrudFormSession<DemoRow, DemoFormValues>(createDefaultFormValues);
const searchColumnsPerRow = ref(3);
const editingId = computed(() => editingRecord.value?.id ?? null);

const searchFormItems = computed<FormSchema[]>(() => [
  {
    fieldName: 'username',
    label: $t('examples.scaffold.proTableAdvanced.username'),
    component: 'Input',
    componentProps: {
      allowClear: true,
      placeholder: $t('proForm.enterPlaceholder', {
        label: $t('examples.scaffold.proTableAdvanced.username'),
      }),
    },
  },
  {
    fieldName: 'realName',
    label: $t('examples.scaffold.proTableAdvanced.realName'),
    component: 'Input',
    componentProps: {
      allowClear: true,
      placeholder: $t('proForm.enterPlaceholder', {
        label: $t('examples.scaffold.proTableAdvanced.realName'),
      }),
    },
  },
  {
    fieldName: 'email',
    label: $t('examples.scaffold.proTableAdvanced.email'),
    component: 'Input',
    componentProps: {
      allowClear: true,
      placeholder: $t('proForm.enterPlaceholder', {
        label: $t('examples.scaffold.proTableAdvanced.email'),
      }),
    },
  },
  {
    fieldName: 'gender',
    label: $t('examples.scaffold.proTableAdvanced.gender'),
    component: 'Select',
    componentProps: {
      allowClear: true,
      placeholder: $t('proForm.selectPlaceholder', {
        label: $t('examples.scaffold.proTableAdvanced.gender'),
      }),
      options: [
        { label: $t('user.male'), value: 'male' },
        { label: $t('user.female'), value: 'female' },
      ],
    },
  },
  {
    fieldName: 'status',
    label: $t('examples.scaffold.proTableAdvanced.status'),
    component: 'Select',
    componentProps: {
      allowClear: true,
      placeholder: $t('proForm.selectPlaceholder', {
        label: $t('examples.scaffold.proTableAdvanced.status'),
      }),
      options: [
        {
          label: $t('examples.scaffold.proTableAdvanced.statusActive'),
          value: 'active',
        },
        {
          label: $t('examples.scaffold.proTableAdvanced.statusInactive'),
          value: 'inactive',
        },
      ],
    },
  },
]);

const formItems = computed<FormFieldSchema[]>(() => [
  {
    fieldName: 'username',
    label: $t('examples.scaffold.proTableAdvanced.username'),
    component: 'Input',
    rules: z.string().min(3, $t('user.usernameLength')).max(20, $t('user.usernameLength')),
    componentProps: {
      disabled: Boolean(editingId.value),
    },
  },
  {
    fieldName: 'realName',
    label: $t('examples.scaffold.proTableAdvanced.realName'),
    component: 'Input',
    rules: 'required',
    componentProps: {},
  },
  {
    fieldName: 'email',
    label: $t('examples.scaffold.proTableAdvanced.email'),
    component: 'Input',
    rules: z.email($t('validation.email')),
    componentProps: {},
  },
  {
    fieldName: 'gender',
    label: $t('examples.scaffold.proTableAdvanced.gender'),
    component: 'Select',
    componentProps: {
      options: [
        { label: $t('user.male'), value: 'male' },
        { label: $t('user.female'), value: 'female' },
      ],
    },
  },
  {
    fieldName: 'status',
    label: $t('examples.scaffold.proTableAdvanced.status'),
    component: 'Switch',
    rules: 'required',
    componentProps: {
      checkedChildren: $t('examples.scaffold.proTableAdvanced.statusActive'),
      unCheckedChildren: $t('examples.scaffold.proTableAdvanced.statusInactive'),
    },
  },
]);

const columns = computed<NonNullable<VxeTableGridOptions<DemoRow>['columns']>>(() => [
  { title: $t('examples.scaffold.proTableAdvanced.username'), field: 'username', minWidth: 150 },
  { title: $t('examples.scaffold.proTableAdvanced.realName'), field: 'realName', minWidth: 140 },
  { title: $t('examples.scaffold.proTableAdvanced.email'), field: 'email', minWidth: 220 },
  {
    title: $t('examples.scaffold.proTableAdvanced.gender'),
    field: 'gender',
    width: 120,
    slots: { default: 'bodyCell' },
  },
  {
    title: $t('examples.scaffold.proTableAdvanced.status'),
    field: 'status',
    width: 140,
    slots: { default: 'bodyCell' },
  },
  {
    title: $t('examples.scaffold.proTableAdvanced.createdAt'),
    field: 'createdAt',
    width: 190,
    formatter: 'formatDateTime',
  },
  {
    title: $t('common.actions'),
    field: 'action',
    width: 180,
    fixed: 'right',
    slots: { default: 'bodyCell' },
  },
]);

const requestTableData = async (params: Record<string, unknown>) => {
  const current = Number(params.current || 1);
  const pageSize = Number(params.pageSize || 10);

  let filtered = [...tableRows.value];

  if (params.username) {
    const keyword = String(params.username).toLowerCase();
    filtered = filtered.filter((item) => item.username.toLowerCase().includes(keyword));
  }

  if (params.realName) {
    const keyword = String(params.realName).toLowerCase();
    filtered = filtered.filter((item) => item.realName.toLowerCase().includes(keyword));
  }

  if (params.email) {
    const keyword = String(params.email).toLowerCase();
    filtered = filtered.filter((item) => item.email.toLowerCase().includes(keyword));
  }

  if (params.gender) {
    filtered = filtered.filter((item) => item.gender === params.gender);
  }

  if (params.status) {
    filtered = filtered.filter((item) => item.status === params.status);
  }

  const start = (current - 1) * pageSize;
  const list = filtered.slice(start, start + pageSize);

  return {
    success: true,
    data: list,
    total: filtered.length,
  };
};

const handleStatusChange = (id: string, checked: boolean) => {
  const row = tableRows.value.find((item) => item.id === id);
  if (!row) {
    return;
  }

  row.status = checked ? 'active' : 'inactive';
  message.success(
    $t('examples.scaffold.proTableAdvanced.statusChangeSuccess', {
      status: checked
        ? $t('examples.scaffold.proTableAdvanced.statusActive')
        : $t('examples.scaffold.proTableAdvanced.statusInactive'),
      username: row.username,
    }),
  );
};

const handleStatusSwitchChange = async (id: string, checked: boolean) => {
  switchLoadingId.value = id;
  try {
    await new Promise((resolve) => setTimeout(resolve, 500));
    handleStatusChange(id, checked);
    void gridApi.query();
  } finally {
    switchLoadingId.value = null;
  }
};

const handleCreate = () => {
  openCreateForm();
};

const handleEdit = (record: DemoRow) => {
  const initialValues: DemoFormValues = {
    username: record.username,
    realName: record.realName,
    email: record.email,
    gender: record.gender,
    status: record.status === 'active',
  };
  openEditForm(record, initialValues);
};

const handleSubmit = async (rawValues: Record<string, unknown>) => {
  const values = rawValues as DemoFormValues;

  const statusValue = values.status ? 'active' : 'inactive';

  if (editingId.value) {
    const row = tableRows.value.find((item) => item.id === editingId.value);
    if (row) {
      row.username = values.username.trim();
      row.realName = values.realName.trim();
      row.email = values.email.trim();
      row.gender = values.gender;
      row.status = statusValue;
    }
    message.success($t('examples.scaffold.proTableAdvanced.updateSuccess'));
  } else {
    const newId = `demo-${Date.now()}`;
    tableRows.value.unshift({
      id: newId,
      username: values.username.trim(),
      realName: values.realName.trim(),
      email: values.email.trim(),
      gender: values.gender,
      status: statusValue,
      createdAt: new Date().toISOString(),
    });
    message.success($t('examples.scaffold.proTableAdvanced.createSuccess'));
  }

  closeFormModal();
  if (editingId.value) void gridApi.query();
  else void gridApi.reload();
};

const handleBatchSetStatus = (status: DemoRow['status']) => {
  if (selectedRowKeys.value.length === 0) {
    return;
  }

  const set = new Set(selectedRowKeys.value);
  tableRows.value = tableRows.value.map((item) => {
    if (set.has(item.id)) {
      return {
        ...item,
        status,
      };
    }
    return item;
  });

  message.success(
    $t('examples.scaffold.proTableAdvanced.batchSetStatusSuccess', {
      count: selectedRowKeys.value.length,
    }),
  );
};

const handleBatchDelete = () => {
  if (selectedRowKeys.value.length === 0) {
    return;
  }

  Modal.confirm({
    title: $t('examples.scaffold.proTableAdvanced.batchDeleteTitle'),
    content: $t('examples.scaffold.proTableAdvanced.batchDeleteContent', {
      count: selectedRowKeys.value.length,
    }),
    onOk: () => {
      const set = new Set(selectedRowKeys.value);
      tableRows.value = tableRows.value.filter((item) => !set.has(item.id));
      selectedRowKeys.value = [];
      void gridApi.grid?.clearCheckboxRow();
      void gridApi.grid?.clearCheckboxReserve();
      message.success($t('examples.scaffold.proTableAdvanced.batchDeleteSuccess'));
    },
  });
};

const exportCsv = () => {
  const headers = ['id', 'username', 'realName', 'email', 'gender', 'status', 'createdAt'];
  const rows = tableRows.value.map((item) => [
    item.id,
    item.username,
    item.realName,
    item.email,
    item.gender,
    item.status,
    item.createdAt,
  ]);

  const csv = [headers, ...rows]
    .map((line) => line.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(','))
    .join('\n');

  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `pro-table-advanced-${Date.now()}.csv`;
  link.click();
  URL.revokeObjectURL(url);

  message.success($t('examples.scaffold.proTableAdvanced.exportSuccess'));
};
const gridOptions = computed<VxeTableGridOptions<DemoRow>>(() => ({
  id: 'example-advanced-table',
  height: 'auto',
  rowConfig: { keyField: 'id' },
  columns: [{ type: 'checkbox', width: 50 }, { type: 'seq', width: 60 }, ...columns.value],
  checkboxConfig: { reserve: true },
  pagerConfig: { pageSize: 10 },
  customConfig: { storage: true },
  proxyConfig: {
    ajax: {
      async query({ page }, search: Record<string, unknown>) {
        const result = await requestTableData({
          ...search,
          current: page.currentPage,
          pageSize: page.pageSize,
        });
        return { items: result.data, total: result.total };
      },
    },
  },
}));
const [Grid, gridApi] = useVxeGrid<DemoRow>({
  gridOptions: gridOptions.value,
  formOptions: { schema: searchFormItems.value },
});
const searchOptions = computed(() => ({
  schema: searchFormItems.value,
  collapsed: true,
  showCollapseButton: true,
  commonConfig: { labelWidth: 80 },
  wrapperClass: (
    {
      2: 'grid-cols-1 md:grid-cols-2',
      3: 'grid-cols-1 md:grid-cols-2 lg:grid-cols-3',
      4: 'grid-cols-1 md:grid-cols-2 lg:grid-cols-4',
      5: 'grid-cols-1 md:grid-cols-2 lg:grid-cols-5',
    } as Record<number, string>
  )[searchColumnsPerRow.value],
}));
function syncSelection(): void {
  const rows: DemoRow[] = [
    ...(gridApi.grid?.getCheckboxRecords() || []),
    ...(gridApi.grid?.getCheckboxReserveRecords() || []),
  ];
  selectedRowKeys.value = [
    ...new Set(
      rows.filter((row) => tableRows.value.some((item) => item.id === row.id)).map((row) => row.id),
    ),
  ];
}
const gridEvents = { checkboxChange: syncSelection, checkboxAll: syncSelection };
function handleDelete(row: DemoRow): void {
  Modal.confirm({
    title: $t('examples.scaffold.proTableAdvanced.deleteConfirm'),
    onOk() {
      tableRows.value = tableRows.value.filter((item) => item.id !== row.id);
      selectedRowKeys.value = selectedRowKeys.value.filter((id) => id !== row.id);
      message.success($t('examples.scaffold.proTableAdvanced.deleteSuccess'));
    },
  });
}
watch(tableRows, () => {
  void gridApi.query();
});
</script>

<style scoped>
.search-layout-demo {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: 8px 16px;
  margin-bottom: 16px;
  padding: 12px 16px;
  color: var(--color-text-secondary);
  background: var(--color-bg-container);
  border: 1px solid var(--color-border-secondary);
  border-radius: var(--radius-base);
}

.search-layout-demo-label {
  color: var(--color-text-primary);
  font-weight: 500;
}

.search-layout-demo code {
  padding: 2px 8px;
  color: var(--color-primary);
  background: var(--color-primary-bg);
  border-radius: var(--radius-sm);
}

.search-layout-demo-hint {
  font-size: 12px;
}
</style>
