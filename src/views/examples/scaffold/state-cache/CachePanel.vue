<template>
  <div class="cache-panel">
    <template v-if="panel === 'panelA'">
      <div class="panel-title">{{ $t('examples.scaffold.stateCache.panelADesc') }}</div>
      <a-input
        v-model:value="localValue"
        :placeholder="$t('examples.scaffold.stateCache.panelAInputPlaceholder')"
      />
      <a-space>
        <a-button size="small" @click="localCount--">-</a-button>
        <span>{{ $t('examples.scaffold.stateCache.localCountLabel') }}{{ localCount }}</span>
        <a-button size="small" @click="localCount++">+</a-button>
      </a-space>
    </template>
    <template v-else>
      <div class="panel-title">{{ $t('examples.scaffold.stateCache.panelBDesc') }}</div>
      <a-switch v-model:checked="checked" checked-children="ON" un-checked-children="OFF" />
      <a-textarea
        v-model:value="text"
        :rows="3"
        :placeholder="$t('examples.scaffold.stateCache.panelBTextPlaceholder')"
      />
    </template>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue';

defineProps<{ panel: 'panelA' | 'panelB' }>();

const localValue = ref('');
const localCount = ref(0);
const checked = ref(false);
const text = ref('');
</script>

<style scoped lang="scss">
.cache-panel {
  border: 1px solid var(--color-border-secondary);
  border-radius: 8px;
  padding: 12px;
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.panel-title {
  font-weight: var(--font-weight-medium);
}
</style>
