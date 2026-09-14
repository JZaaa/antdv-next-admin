<template>
  <!-- Dot mode -->
  <span v-if="mode === 'dot'" class="pro-status pro-status-dot" :style="dotStyle">
    <span class="pro-status-dot-indicator" :style="{ background: statusColor }" />
    {{ statusText }}
  </span>

  <!-- Tag mode -->
  <a-tag v-else-if="mode === 'tag'" :color="statusColor">
    {{ statusText }}
  </a-tag>

  <!-- Badge mode -->
  <a-badge v-else :color="statusColor" :text="statusText" />
</template>

<script setup lang="ts">
import type { ProStatusMode, ProStatusMap } from '@/types/pro';

import { computed } from 'vue';

interface Props {
  value: string | number;
  statusMap: ProStatusMap;
  mode?: ProStatusMode;
}

const props = withDefaults(defineProps<Props>(), {
  mode: 'dot',
});

const config = computed(() => props.statusMap[String(props.value)]);
const statusText = computed(() => config.value?.text ?? String(props.value));
const statusColor = computed(() => config.value?.color ?? 'var(--color-text-tertiary)');

const dotStyle = computed(() => {
  const c = statusColor.value;
  return {
    '--pro-status-color': c,
  };
});
</script>

<style scoped lang="scss">
.pro-status-dot {
  position: relative;
  isolation: isolate;
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 2px 10px;
  border-radius: 10px;
  font-size: 12px;
  line-height: 20px;
  color: var(--pro-status-color);
  // A separate background preserves CSS variables, named colors and source alpha.
  &::before {
    content: '';
    position: absolute;
    inset: 0;
    z-index: -1;
    border-radius: inherit;
    background: var(--pro-status-color);
    opacity: 0.1;
    pointer-events: none;
  }

  .pro-status-dot-indicator {
    width: 6px;
    height: 6px;
    border-radius: 50%;
    flex-shrink: 0;
  }
}
</style>
