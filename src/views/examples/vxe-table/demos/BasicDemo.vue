<template>
  <Grid>
    <template #toolbar-actions
      ><Button @click="api.setState({ tableData: [] })">清空</Button
      ><Button @click="restore">恢复</Button></template
    >
    <template #name="{ row }"
      ><strong>{{ row.name }}</strong></template
    >
    <template #expand="{ row }">{{ row.name }} · 自定义展开内容</template>
  </Grid>
</template>
<script setup lang="ts">
import { Button } from 'antdv-next';

import { useVxeGrid } from '@/adapters/table';
interface Row {
  id: number;
  name: string;
  age: number;
}
const rows: Row[] = Array.from({ length: 12 }, (_, i) => ({
  id: i + 1,
  name: `Member ${i + 1}`,
  age: 20 + i,
}));
const [Grid, api] = useVxeGrid<Row>({
  tableTitle: '基础表格 / Slots',
  tableTitleHelp: '通过公开配置和原生实例调用 VXE 能力',
  tableData: rows,
  gridOptions: {
    id: 'vxe-basic-example',
    height: 380,
    rowConfig: { keyField: 'id' },
    checkboxConfig: { reserve: true },
    customConfig: { storage: true },
    toolbarConfig: { custom: true },
    columns: [
      { type: 'checkbox', width: 48, fixed: 'left' },
      { type: 'expand', width: 48, slots: { content: 'expand' } },
      {
        field: 'userGroup',
        title: '用户信息',
        children: [
          { field: 'id', title: 'ID', width: 90, sortable: true },
          { field: 'name', title: '姓名', minWidth: 180, slots: { default: 'name' } },
        ],
      },
      {
        field: 'age',
        title: '年龄',
        width: 130,
        sortable: true,
        filters: [{ label: '20', value: 20 }],
      },
    ],
  },
});
function restore(): void {
  api.setState({ tableData: [...rows] });
}
</script>
