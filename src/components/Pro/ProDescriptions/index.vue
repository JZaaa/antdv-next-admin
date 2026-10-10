<template>
  <a-descriptions
    :column="column"
    :bordered="bordered"
    :size="size"
    :title="title"
    :layout="layout"
  >
    <a-descriptions-item
      v-for="item in columns"
      :key="item.dataIndex"
      :label="item.label"
      :span="item.span"
    >
      <template v-if="item.render">
        <component :is="item.render(getValue(item), data)" />
      </template>
      <template v-else>
        <ValueDisplay
          :value="getValue(item)"
          :type="item.valueType"
          :value-enum="item.valueEnum"
          :copyable="item.copyable"
          :options="item.valueTypeProps"
        />
      </template>
    </a-descriptions-item>
  </a-descriptions>
</template>

<script setup lang="ts">
import type { ProDescriptionItem } from '@/types/pro';

import ValueDisplay from '@/components/ValueDisplay/index.vue';

interface Props {
  columns: ProDescriptionItem[];
  data: Record<string, unknown>;
  column?: number;
  bordered?: boolean;
  size?: 'default' | 'middle' | 'small';
  title?: string;
  layout?: 'horizontal' | 'vertical';
}

const props = withDefaults(defineProps<Props>(), {
  column: 2,
  bordered: false,
  size: 'default',
  layout: 'horizontal',
});

const getValue = (item: ProDescriptionItem) => {
  const keys = item.dataIndex.split('.');
  let val: unknown = props.data;
  for (const key of keys) {
    if (val == null) return undefined;
    val = (val as Record<string, unknown>)[key];
  }
  return val;
};
</script>
