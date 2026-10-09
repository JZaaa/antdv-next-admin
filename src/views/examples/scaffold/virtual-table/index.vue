<template>
  <div class="page-container">
    <div class="card">
      <h2>{{ $t('examples.scaffold.virtualTable.title') }}</h2>
      <p class="text-secondary mb-lg">{{ $t('examples.scaffold.virtualTable.description') }}</p>

      <a-alert
        class="mb-lg"
        type="info"
        show-icon
        :message="$t('examples.scaffold.virtualTable.tipsNativeVirtual')"
      />

      <div class="toolbar">
        <a-space wrap>
          <span class="text-secondary">{{ $t('examples.scaffold.virtualTable.datasetSize') }}</span>
          <a-select v-model:value="datasetSize" :options="datasetOptions" style="width: 140px" />
          <a-button @click="regenerateRows">{{
            $t('examples.scaffold.virtualTable.regenerate')
          }}</a-button>
        </a-space>

        <a-space wrap>
          <a-input
            v-model:value="keyword"
            style="width: 240px"
            :placeholder="$t('examples.scaffold.virtualTable.searchPlaceholder')"
          />
          <a-select v-model:value="statusFilter" :options="statusOptions" style="width: 150px" />
        </a-space>
      </div>

      <a-space wrap class="mb-lg">
        <a-tag color="processing">
          {{ $t('examples.scaffold.virtualTable.totalRows', { count: allRows.length }) }}
        </a-tag>
        <a-tag color="success">
          {{ $t('examples.scaffold.virtualTable.filteredRows', { count: filteredRows.length }) }}
        </a-tag>
        <a-tag>{{ $t('examples.scaffold.virtualTable.renderedRowsTip') }}</a-tag>
      </a-space>

      <Grid :grid-options="gridOptions">
        <template #bodyCell="{ column, row: record }">
          <template v-if="column.field === 'status'">
            <a-tag :color="getStatusColor(record.status)">
              {{ getStatusText(record.status) }}
            </a-tag>
          </template>
        </template>
      </Grid>
    </div>
  </div>
</template>

<script setup lang="ts">
import type { VxeTableGridOptions } from '@/libs/table';

import { message } from 'antdv-next';
import { computed, onMounted, ref, shallowRef, watch } from 'vue';

import { useVxeGrid } from '@/adapters/table';
import { $t } from '@/locales';

type StatusType = 'active' | 'inactive' | 'pending';

interface DemoRow {
  id: string;
  username: string;
  email: string;
  department: string;
  status: StatusType;
  updatedAt: string;
}

const datasetOptions = [5000, 20000, 50000, 100000].map((value) => ({
  value,
  label: value.toLocaleString('en-US'),
}));
const statusOptions = computed(() => [
  { value: 'all', label: $t('examples.scaffold.virtualTable.allStatus') },
  { value: 'active', label: $t('examples.scaffold.virtualTable.statusActive') },
  { value: 'inactive', label: $t('examples.scaffold.virtualTable.statusInactive') },
  { value: 'pending', label: $t('examples.scaffold.virtualTable.statusPending') },
]);
const datasetSize = ref(20000);
const keyword = ref('');
const statusFilter = ref<'all' | StatusType>('all');
const allRows = shallowRef<DemoRow[]>([]);

const columns = computed<NonNullable<VxeTableGridOptions<DemoRow>['columns']>>(() => [
  { title: $t('examples.scaffold.virtualTable.colId'), field: 'id', width: 130 },
  { title: $t('examples.scaffold.virtualTable.colUsername'), field: 'username', minWidth: 180 },
  { title: $t('examples.scaffold.virtualTable.colEmail'), field: 'email', minWidth: 260 },
  { title: $t('examples.scaffold.virtualTable.colDepartment'), field: 'department', width: 180 },
  {
    title: $t('examples.scaffold.virtualTable.colStatus'),
    field: 'status',
    width: 120,
    slots: { default: 'bodyCell' },
  },
  { title: $t('examples.scaffold.virtualTable.colUpdatedAt'), field: 'updatedAt', width: 200 },
]);

const filteredRows = computed(() => {
  let rows = allRows.value;

  const query = keyword.value.trim().toLowerCase();
  if (query) {
    rows = rows.filter(
      (item) =>
        item.username.toLowerCase().includes(query) ||
        item.email.toLowerCase().includes(query) ||
        item.department.toLowerCase().includes(query),
    );
  }

  if (statusFilter.value !== 'all') {
    rows = rows.filter((item) => item.status === statusFilter.value);
  }

  return rows;
});

function createRows(count: number) {
  const statusList: StatusType[] = ['active', 'inactive', 'pending'];
  const departments = ['R&D', 'Operation', 'Finance', 'Support', 'Marketing', 'Sales'];

  return Array.from({ length: count }, (_, index) => {
    const i = index + 1;
    const day = String((i % 28) + 1).padStart(2, '0');
    const month = String((i % 12) + 1).padStart(2, '0');

    return {
      id: `VT-${String(i).padStart(6, '0')}`,
      username: `user_${String(i).padStart(6, '0')}`,
      email: `user_${i}@example.com`,
      department: departments[i % departments.length],
      status: statusList[i % statusList.length],
      updatedAt: `2026-${month}-${day} 10:${String(i % 60).padStart(2, '0')}:00`,
    };
  });
}

function regenerateRows() {
  allRows.value = createRows(datasetSize.value);
  message.success(
    $t('examples.scaffold.virtualTable.regenerateSuccess', { count: datasetSize.value }),
  );
}

function getStatusText(status: StatusType) {
  if (status === 'active') return $t('examples.scaffold.virtualTable.statusActive');
  if (status === 'inactive') return $t('examples.scaffold.virtualTable.statusInactive');
  return $t('examples.scaffold.virtualTable.statusPending');
}

function getStatusColor(status: StatusType) {
  if (status === 'active') return 'success';
  if (status === 'inactive') return 'default';
  return 'processing';
}

onMounted(() => {
  regenerateRows();
});
const gridOptions = computed<VxeTableGridOptions<DemoRow>>(() => ({
  id: 'example-virtual-table',
  rowConfig: { keyField: 'id' },
  columns: columns.value,
  height: 560,
  border: true,
  virtualYConfig: { enabled: true, gt: 50 },
  customConfig: { storage: true },
  toolbarConfig: {
    refresh: true,
    refreshOptions: {
      queryMethod: async () => {
        regenerateRows();
      },
    },
  },
}));
const [Grid, gridApi] = useVxeGrid<DemoRow>({ gridOptions: gridOptions.value });
watch(
  filteredRows,
  (rows) => {
    void gridApi.grid?.loadData(rows);
  },
  { flush: 'post' },
);
</script>

<style scoped lang="scss">
.mb-lg {
  margin-bottom: var(--spacing-lg);
}

.toolbar {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 12px;
  flex-wrap: wrap;
  margin-bottom: var(--spacing-md);
}
</style>
