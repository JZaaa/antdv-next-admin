<template>
  <Grid />
  <p role="status">请求 {{ requests }} 次 · {{ submitted }}</p>
</template>
<script setup lang="ts">
import { ref } from 'vue';

import { useVxeGrid } from '@/adapters/table';
interface Row {
  id: number;
  name: string;
}
interface Search {
  name: string;
}
interface Payload {
  keyword: string;
}
const requests = ref(0);
const submitted = ref('');
const data = Array.from({ length: 125 }, (_, i) => ({ id: i + 1, name: `Member ${i + 1}` }));
const [Grid] = useVxeGrid<Row, Search, Payload>({
  tableTitle: '远程查询 / SchemaForm / Codec',
  formOptions: {
    schema: [
      {
        fieldName: 'name',
        component: 'Input',
        label: '姓名',
        defaultValue: '',
        componentProps: { allowClear: true },
      },
    ],
    submitOnEnter: true,
    codec: {
      encode: (values) => ({ keyword: values.name.trim() }),
      decode: (values) => ({ name: values.keyword }),
    },
  },
  gridOptions: {
    height: 380,
    rowConfig: { keyField: 'id' },
    pagerConfig: { pageSize: 10 },
    columns: [
      { field: 'id', title: 'ID', width: 100, sortable: true },
      { field: 'name', title: '姓名' },
    ],
    toolbarConfig: { refresh: true, search: true },
    sortConfig: { remote: true },
    proxyConfig: {
      ajax: {
        async query({ page, sort }, search: Payload) {
          requests.value++;
          submitted.value = JSON.stringify(search);
          await new Promise((resolve) => setTimeout(resolve, 180));
          let filtered = data.filter((row) =>
            row.name.toLowerCase().includes(search.keyword.toLowerCase()),
          );
          if (sort?.order === 'desc') filtered = [...filtered].reverse();
          return {
            items: filtered.slice(
              (page.currentPage - 1) * page.pageSize,
              page.currentPage * page.pageSize,
            ),
            total: filtered.length,
          };
        },
      },
    },
  },
});
</script>
