<template>
  <p class="cell-value-hint">{{ $t('examples.cellValue.description') }}</p>
  <Grid :grid-options="gridOptions" :table-title="$t('examples.cellValue.title')">
    <template #toolbar-actions>
      <Button data-cell-value-update @click="updateFirstRow">{{
        $t('examples.cellValue.update')
      }}</Button>
    </template>
  </Grid>
</template>

<script setup lang="ts">
import type { CellValueProps, CellValueRenderOptions, VxeTableGridOptions } from '@/adapters/table';

import { Button } from 'antdv-next';
import { computed, ref } from 'vue';

import { useVxeGrid } from '@/adapters/table';
import { $t } from '@/locales';

interface Row {
  id: number;
  account: { status: 'active' | 'disabled'; amount: number | null };
  enabled: boolean;
  ratio: number;
  createdAt: number | null;
}

const rows = ref<Row[]>([
  { id: 1, account: { status: 'active', amount: 0 }, enabled: false, ratio: 0.25, createdAt: 0 },
  {
    id: 2,
    account: { status: 'disabled', amount: 12345.678 },
    enabled: true,
    ratio: 1,
    createdAt: 1791590400000,
  },
  { id: 3, account: { status: 'active', amount: null }, enabled: false, ratio: 0, createdAt: null },
]);

function cellValue(props: CellValueProps): CellValueRenderOptions<Row> {
  return { name: 'CellValue', props };
}

const gridOptions = computed<VxeTableGridOptions<Row>>(() => ({
  height: 300,
  rowConfig: { keyField: 'id' },
  toolbarConfig: { export: true },
  exportConfig: { types: ['csv'], filename: 'cell-value' },
  data: rows.value,
  columns: [
    { field: 'id', title: 'ID', width: 65 },
    {
      field: 'account.status',
      title: $t('examples.cellValue.status'),
      minWidth: 135,
      cellRender: cellValue({
        type: 'tag',
        valueEnum: {
          active: { text: $t('examples.cellValue.active'), color: 'success' },
          disabled: { text: $t('examples.cellValue.disabled'), color: 'default' },
        },
      }),
    },
    {
      field: 'account.amount',
      title: $t('examples.cellValue.amount'),
      minWidth: 180,
      cellRender: cellValue({ type: 'money', copyable: true, copyMode: 'display' }),
    },
    {
      field: 'enabled',
      title: $t('examples.cellValue.boolean'),
      minWidth: 135,
      cellRender: cellValue({ copyable: true }),
    },
    {
      field: 'ratio',
      title: $t('examples.cellValue.percent'),
      minWidth: 135,
      cellRender: cellValue({ type: 'percent', options: { percentScale: 'fraction' } }),
    },
    {
      field: 'createdAt',
      title: $t('examples.cellValue.date'),
      minWidth: 200,
      cellRender: cellValue({ type: 'dateTime', options: { timeZone: 'UTC' } }),
    },
  ],
}));
const [Grid] = useVxeGrid<Row>({ gridOptions: gridOptions.value });

function updateFirstRow(): void {
  const row = rows.value[0];
  if (!row) return;
  row.account.status = row.account.status === 'active' ? 'disabled' : 'active';
  row.account.amount = row.account.amount === 0 ? 42.5 : 0;
}
</script>

<style scoped>
.cell-value-hint {
  margin-bottom: 12px;
  color: var(--ant-color-text-secondary);
}
</style>
