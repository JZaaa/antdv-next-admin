<template>
  <Grid
    ><template #toolbar-actions
      ><Button @click="api.grid?.setAllTreeExpand(true)">展开全部</Button
      ><Button @click="api.grid?.setAllTreeExpand(false)">收起全部</Button></template
    ></Grid
  >
</template>
<script setup lang="ts">
import { Button } from 'antdv-next';

import { useVxeGrid } from '@/adapters/table';
const [Grid, api] = useVxeGrid({
  tableTitle: '树形 / 固定列 / 选择',
  gridOptions: {
    height: 350,
    rowConfig: { keyField: 'id' },
    treeConfig: { transform: true, rowField: 'id', parentField: 'parentId' },
    checkboxConfig: { reserve: true },
    columns: [
      { type: 'checkbox', width: 50, fixed: 'left' },
      { field: 'name', title: '部门', treeNode: true, minWidth: 300 },
      { field: 'id', title: 'ID', width: 100 },
    ],
    data: [
      { id: 1, parentId: null, name: '总部' },
      { id: 2, parentId: 1, name: '研发' },
      { id: 3, parentId: 2, name: '前端' },
      { id: 4, parentId: 1, name: '产品' },
    ],
  },
});
</script>
