<template>
  <Grid
    ><template #toolbar-actions
      ><Button @click="api.clearViewedRows()">清空已读</Button></template
    ></Grid
  >
</template>
<script setup lang="ts">
import { Button } from 'antdv-next';

import { useVxeGrid } from '@/adapters/table';
import { useAuthStore } from '@/stores/auth';
const auth = useAuthStore();
const [Grid, api] = useVxeGrid({
  tableTitle: '已读 / 持久化 / 导入导出与打印',
  viewedRowOptions: {
    actionCodes: ['detail'],
    persist: {
      type: 'localStorage',
      key: `vxe-example:${auth.user?.id ?? 'anonymous'}`,
      maxSize: 100,
      ttl: 86400000,
    },
  },
  gridOptions: {
    height: 350,
    rowConfig: { keyField: 'id' },
    toolbarConfig: { export: true, import: true, print: true },
    exportConfig: { types: ['csv', 'html', 'xml', 'txt'] },
    importConfig: { types: ['csv', 'html', 'xml', 'txt'] },
    printConfig: {},
    data: Array.from({ length: 20 }, (_, i) => ({ id: i + 1, name: `Record ${i + 1}` })),
    columns: [
      { field: 'id', title: 'ID', width: 90 },
      { field: 'name', title: '名称' },
      {
        title: '操作',
        width: 120,
        cellRender: {
          name: 'CellOperation',
          options: [{ code: 'detail', text: '标记已读' }],
          attrs: { onClick: () => {} },
        },
      },
    ],
  },
});
</script>
