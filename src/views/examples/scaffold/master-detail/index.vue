<template>
  <div class="page-container">
    <div class="card">
      <h2>{{ $t('examples.scaffold.masterDetail.title') }}</h2>
      <p class="text-secondary mb-lg">{{ $t('examples.scaffold.masterDetail.description') }}</p>

      <Grid :grid-options="gridOptions" :grid-events="gridEvents">
        <template #bodyCell="{ column, row: record }">
          <template v-if="column.field === 'status'">
            <a-tag :color="getStatusColor(record.status)">{{ getStatusText(record.status) }}</a-tag>
          </template>
        </template>
      </Grid>
    </div>

    <a-drawer
      v-model:open="drawerOpen"
      :size="560"
      :title="$t('examples.scaffold.masterDetail.drawerTitle')"
      :destroy-on-hidden="false"
    >
      <template v-if="activeRecord">
        <ProDetail
          :title="`#${activeRecord.id}`"
          :sub-title="$t('examples.scaffold.masterDetail.ticketNumber')"
          :tags="[
            {
              text: getStatusText(activeRecord.status),
              color: getStatusColor(activeRecord.status),
            },
          ]"
          :descriptions="detailColumns"
          :data="activeRecord"
          :description-column="1"
          :tabs="drawerTabs"
          v-model:active-tab="activeTab"
        >
          <template #tab-desc>
            <div class="tab-panel">
              {{ activeRecord.description }}
            </div>
          </template>
          <template #tab-logs>
            <a-timeline>
              <a-timeline-item v-for="log in activeRecord.logs" :key="log.time + log.action">
                <strong>{{ log.action }}</strong>
                <div class="text-secondary">{{ log.operator }} · {{ log.time }}</div>
              </a-timeline-item>
            </a-timeline>
          </template>
        </ProDetail>
      </template>
    </a-drawer>
  </div>
</template>

<script setup lang="ts">
import type { VxeTableGridOptions } from '@/libs/table';
import type { ProDescriptionItem, ProDetailTab } from '@/types/pro';

import { computed, ref } from 'vue';

import { useVxeGrid } from '@/adapters/table';
import ProDetail from '@/components/Pro/ProDetail/index.vue';
import { $t } from '@/locales';

type TicketStatus = 'open' | 'processing' | 'closed';

interface TicketRecord {
  id: string;
  title: string;
  owner: string;
  priority: 'P0' | 'P1' | 'P2';
  status: TicketStatus;
  createdAt: string;
  description: string;
  logs: Array<{
    action: string;
    operator: string;
    time: string;
  }>;
}

const statusTextMap = computed<Record<TicketStatus, string>>(() => ({
  open: $t('examples.scaffold.masterDetail.statusOpen'),
  processing: $t('examples.scaffold.masterDetail.statusProcessing'),
  closed: $t('examples.scaffold.masterDetail.statusClosed'),
}));

const statusColorMap: Record<TicketStatus, string> = {
  open: 'blue',
  processing: 'processing',
  closed: 'default',
};

const listData = ref<TicketRecord[]>(
  Array.from({ length: 18 }, (_, index) => {
    const i = index + 1;

    return {
      id: `T${String(i).padStart(4, '0')}`,
      title: $t('examples.scaffold.masterDetail.ticketTitle', { index: i }),
      owner:
        i % 2 === 0
          ? $t('examples.scaffold.masterDetail.ownerZhang')
          : $t('examples.scaffold.masterDetail.ownerLi'),
      priority: i % 5 === 0 ? 'P0' : i % 2 === 0 ? 'P1' : 'P2',
      status: i % 4 === 0 ? 'closed' : i % 3 === 0 ? 'processing' : 'open',
      createdAt: new Date(Date.now() - i * 3600 * 1000).toLocaleString(),
      description: $t('examples.scaffold.masterDetail.ticketDescription', { index: i }),
      logs: [
        {
          action: $t('examples.scaffold.masterDetail.actionCreate'),
          operator: $t('examples.scaffold.masterDetail.operatorSystem'),
          time: new Date(Date.now() - i * 3600 * 1000).toLocaleString(),
        },
        {
          action: $t('examples.scaffold.masterDetail.actionAssign'),
          operator: $t('examples.scaffold.masterDetail.operatorDispatch'),
          time: new Date(Date.now() - i * 1800 * 1000).toLocaleString(),
        },
      ],
    };
  }),
);

const columns = computed<NonNullable<VxeTableGridOptions<TicketRecord>['columns']>>(() => [
  { title: $t('examples.scaffold.masterDetail.colTicketNumber'), field: 'id', width: 120 },
  {
    title: $t('examples.scaffold.masterDetail.colTitle'),
    field: 'title',
    minWidth: 150,
    showOverflow: true,
  },
  { title: $t('examples.scaffold.masterDetail.colOwner'), field: 'owner', width: 120 },
  { title: $t('examples.scaffold.masterDetail.colPriority'), field: 'priority', width: 100 },
  {
    title: $t('examples.scaffold.masterDetail.colStatus'),
    field: 'status',
    width: 120,
    slots: { default: 'bodyCell' },
  },
  { title: $t('examples.scaffold.masterDetail.colCreatedAt'), field: 'createdAt', width: 190 },
]);

const detailColumns = computed<ProDescriptionItem[]>(() => [
  { label: $t('examples.scaffold.masterDetail.titleLabel'), dataIndex: 'title' },
  { label: $t('examples.scaffold.masterDetail.ownerLabel'), dataIndex: 'owner' },
  { label: $t('examples.scaffold.masterDetail.priorityLabel'), dataIndex: 'priority' },
  { label: $t('examples.scaffold.masterDetail.createdAtLabel'), dataIndex: 'createdAt' },
]);

const drawerTabs = computed<ProDetailTab[]>(() => [
  { key: 'desc', label: $t('examples.scaffold.masterDetail.descTab') },
  { key: 'logs', label: $t('examples.scaffold.masterDetail.logsTab') },
]);

const drawerOpen = ref(false);
const activeTab = ref('desc');
const activeRecord = ref<TicketRecord | null>(null);

function openDetail(record: TicketRecord): void {
  activeRecord.value = record;
  activeTab.value = 'desc';
  drawerOpen.value = true;
}

const getStatusText = (status: unknown) => {
  const key = (status || 'open') as TicketStatus;
  return statusTextMap.value[key] || statusTextMap.value.open;
};

const getStatusColor = (status: unknown) => {
  const key = (status || 'open') as TicketStatus;
  return statusColorMap[key] || statusColorMap.open;
};
const currentPage = ref(1);
const pageSize = ref(8);
const gridEvents = {
  pageChange: ({
    currentPage: page,
    pageSize: size,
  }: {
    currentPage: number;
    pageSize: number;
  }) => {
    currentPage.value = page;
    pageSize.value = size;
  },
  cellClick: ({ row }: { row: TicketRecord }) => openDetail(row),
};
const gridOptions = computed<VxeTableGridOptions<TicketRecord>>(() => ({
  id: 'example-master-detail',
  rowConfig: { keyField: 'id' },
  rowStyle: { cursor: 'pointer' },
  columns: columns.value,
  data: listData.value.slice(
    (currentPage.value - 1) * pageSize.value,
    currentPage.value * pageSize.value,
  ),
  pagerConfig: {
    currentPage: currentPage.value,
    pageSize: pageSize.value,
    total: listData.value.length,
  },
  customConfig: { storage: true },
  toolbarConfig: { refresh: true, refreshOptions: { queryMethod: async () => {} } },
}));
const [Grid] = useVxeGrid<TicketRecord>({ gridOptions: gridOptions.value });
</script>

<style scoped lang="scss">
.mb-lg {
  margin-bottom: var(--spacing-lg);
}

.tab-panel {
  line-height: 1.8;
  color: var(--color-text-secondary);
}
</style>
