<template>
  <div class="page-container">
    <div class="card mb-lg">
      <h2>{{ $t('examples.scaffold.stateCache.title') }}</h2>
      <p class="text-secondary">
        {{ $t('examples.scaffold.stateCache.description') }}
      </p>
    </div>

    <div class="card mb-lg">
      <div class="section-title">{{ $t('examples.scaffold.stateCache.piniaSection') }}</div>

      <div class="form-grid">
        <div>
          <label>{{ $t('examples.scaffold.stateCache.keywordLabel') }}</label>
          <a-input
            v-model:value="cacheStore.keyword"
            :placeholder="$t('examples.scaffold.stateCache.keywordPlaceholder')"
          />
        </div>
        <div>
          <label>{{ $t('examples.scaffold.stateCache.counterLabel') }}</label>
          <div class="counter-row">
            <a-button size="small" @click="cacheStore.counter--">-1</a-button>
            <a-input-number v-model:value="cacheStore.counter" :min="-9999" :max="9999" />
            <a-button size="small" @click="cacheStore.counter++">+1</a-button>
          </div>
        </div>
        <div class="full-row">
          <label>{{ $t('examples.scaffold.stateCache.notesLabel') }}</label>
          <a-textarea
            v-model:value="cacheStore.notes"
            :rows="3"
            :placeholder="$t('examples.scaffold.stateCache.notesPlaceholder')"
          />
        </div>
      </div>

      <a-space class="mt-md">
        <a-button @click="cacheStore.reset">{{
          $t('examples.scaffold.stateCache.resetButton')
        }}</a-button>
        <a-button @click="pinCurrentTab">{{
          $t('examples.scaffold.stateCache.pinTabButton')
        }}</a-button>
      </a-space>

      <div class="persist-tip">
        {{ $t('examples.scaffold.stateCache.lastPersistTime') }}{{ cacheStore.updatedAt }}
      </div>
    </div>

    <div class="card">
      <div class="section-title">{{ $t('examples.scaffold.stateCache.keepAliveSection') }}</div>
      <a-radio-group v-model:value="activePanel" button-style="solid" class="mb-md">
        <a-radio-button value="panelA">{{
          $t('examples.scaffold.stateCache.panelA')
        }}</a-radio-button>
        <a-radio-button value="panelB">{{
          $t('examples.scaffold.stateCache.panelB')
        }}</a-radio-button>
      </a-radio-group>

      <keep-alive>
        <CachePanel :key="activePanel" :panel="activePanel" />
      </keep-alive>
    </div>
  </div>
</template>

<script setup lang="ts">
import { message } from 'antdv-next';
import { ref } from 'vue';
import { useRoute } from 'vue-router';

import { $t } from '@/locales';
import { useDemoStateCacheStore } from '@/stores/demoStateCache';
import { useTabsStore } from '@/stores/tabs';
import CachePanel from './CachePanel.vue';

const cacheStore = useDemoStateCacheStore();
const tabsStore = useTabsStore();
const route = useRoute();

const activePanel = ref<'panelA' | 'panelB'>('panelA');

const pinCurrentTab = () => {
  tabsStore.togglePinTab(route.path);
  message.success($t('examples.scaffold.stateCache.pinTabSuccess'));
};
</script>

<style scoped lang="scss">
.mb-lg {
  margin-bottom: var(--spacing-lg);
}

.mb-md {
  margin-bottom: var(--spacing-md);
}

.mt-md {
  margin-top: var(--spacing-md);
}

.section-title {
  font-weight: var(--font-weight-semibold);
  margin-bottom: 12px;
}

.form-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 12px;

  label {
    display: inline-block;
    margin-bottom: 6px;
    color: var(--color-text-secondary);
    font-size: 12px;
  }
}

.full-row {
  grid-column: 1 / -1;
}

.counter-row {
  display: flex;
  align-items: center;
  gap: 8px;
}

.persist-tip {
  margin-top: 10px;
  color: var(--color-text-tertiary);
  font-size: 12px;
}

@media (max-width: 900px) {
  .form-grid {
    grid-template-columns: 1fr;
  }
}
</style>
