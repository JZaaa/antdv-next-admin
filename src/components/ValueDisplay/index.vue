<template>
  <span class="value-display">
    <span v-if="displayText === undefined">{{ emptyText }}</span>
    <Tag v-else-if="type === 'tag'" :color="enumItem?.color">{{ displayText }}</Tag>
    <Badge
      v-else-if="type === 'badge'"
      :status="badgeStatus"
      :color="enumItem?.color"
      :text="displayText"
    />
    <Avatar v-else-if="type === 'avatar'" :src="displayText" :size="options.size ?? 32" />
    <Image v-else-if="type === 'image'" :src="displayText" :width="options.width ?? 80" />
    <a
      v-else-if="type === 'link' && href"
      :href="href"
      target="_blank"
      rel="noopener noreferrer"
      class="value-display-link"
      >{{ displayText }}</a
    >
    <Progress
      v-else-if="type === 'progress'"
      class="value-display-progress"
      :percent="progress"
      :status="options.status ?? (progress >= 100 ? 'success' : 'active')"
      :show-info="options.showInfo"
      :stroke-color="options.strokeColor"
    />
    <span v-else :class="{ 'value-display-money': type === 'money' }">{{ displayText }}</span>
    <button
      v-if="copyable && copyText !== undefined"
      type="button"
      class="value-display-copy"
      :aria-label="$t('common.copy')"
      :title="$t('common.copy')"
      :disabled="copying"
      @click.stop="handleCopy"
    >
      <CopyOutlined />
    </button>
  </span>
</template>

<script setup lang="ts">
import type { ValueDisplayProps } from './types';

import { CopyOutlined } from '@antdv-next/icons';
import { Avatar, Badge, Image, Progress, Tag, message } from 'antdv-next';
import { computed, ref } from 'vue';

import { $t } from '@/locales';
import { copyToClipboard } from '@/utils/helpers';

import {
  formatDisplayValue,
  getEnumItem,
  getLinkHref,
  getNumericValue,
  getRawText,
} from './format';

const props = withDefaults(defineProps<ValueDisplayProps>(), {
  type: 'text',
  options: () => ({}),
  emptyText: '—',
  copyable: false,
  copyMode: 'raw',
});
const emit = defineEmits<{ copy: [text: string]; copyError: [] }>();
const copying = ref(false);
const displayText = computed(() =>
  formatDisplayValue(props.value, props.type, props.options, props.valueEnum),
);
const enumItem = computed(() => getEnumItem(props.value, props.valueEnum));
const href = computed(() => getLinkHref(props.value));
const progress = computed(() => Math.min(100, Math.max(0, getNumericValue(props.value) ?? 0)));
const copyText = computed(() =>
  props.copyMode === 'display' ? displayText.value : getRawText(props.value),
);
const badgeStatus = computed(() => {
  const status = enumItem.value?.status;
  return status === 'success' ||
    status === 'processing' ||
    status === 'default' ||
    status === 'error' ||
    status === 'warning'
    ? status
    : undefined;
});

async function handleCopy(): Promise<void> {
  const text = copyText.value;
  if (text === undefined || copying.value) return;
  copying.value = true;
  let success = false;
  try {
    success = await copyToClipboard(text);
  } catch {
    success = false;
  } finally {
    copying.value = false;
  }
  if (success) {
    message.success($t('common.copySuccess'));
    emit('copy', text);
  } else {
    message.error($t('common.copyFailed'));
    emit('copyError');
  }
}
</script>

<style scoped>
.value-display {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  max-width: 100%;
  vertical-align: middle;
  overflow-wrap: anywhere;
}
.value-display-money {
  font-weight: var(--font-weight-medium, 500);
}
.value-display-link,
.value-display-copy {
  color: var(--color-primary, #1677ff);
}
.value-display-copy {
  flex-shrink: 0;
  padding: 2px;
  border: 0;
  background: transparent;
  font: inherit;
  line-height: 1;
  cursor: pointer;
}
.value-display-copy:disabled {
  cursor: wait;
  opacity: 0.5;
}
.value-display-copy:focus-visible {
  outline: 2px solid currentColor;
  outline-offset: 2px;
}
.value-display-progress {
  min-width: 100px;
}
</style>
