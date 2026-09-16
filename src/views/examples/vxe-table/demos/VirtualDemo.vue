<template><Grid /></template>
<script setup lang="ts">
import { useVxeGrid } from '@/adapters/table';
const [Grid] = useVxeGrid({
  tableTitle: '10,000 行 × 30 列 / 横纵虚拟滚动',
  gridOptions: {
    height: 460,
    showOverflow: true,
    rowConfig: { keyField: 'id' },
    cellConfig: { height: 40 },
    virtualXConfig: { enabled: true, gt: 0 },
    virtualYConfig: { enabled: true, gt: 0 },
    columns: Array.from({ length: 30 }, (_, i) => ({
      field: i ? `c${i}` : 'id',
      title: `Column ${i}`,
      width: 150,
      fixed: i === 0 ? ('left' as const) : undefined,
    })),
    data: Array.from({ length: 10000 }, (_, i) => ({
      id: i + 1,
      ...Object.fromEntries(
        Array.from({ length: 29 }, (_, j) => [`c${j + 1}`, `${i + 1}:${j + 1}`]),
      ),
    })),
  },
});
</script>
