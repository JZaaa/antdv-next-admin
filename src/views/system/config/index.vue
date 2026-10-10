<template>
  <div class="page-container">
    <ProSplitLayout :side-width="200">
      <template #side>
        <!-- groups nav -->
        <div class="config-groups-header">
          <h3>{{ $t('config.configGroups') }}</h3>
        </div>
        <a-menu
          v-model:selectedKeys="selectedMenuKeys"
          mode="inline"
          :items="menuItems"
          class="config-groups-menu"
          @click="handleMenuClick"
        />
      </template>

      <template #main>
        <!-- config list -->
        <Grid :grid-options="gridOptions" :table-title="$t(`config.groups.${selectedGroup}`)">
          <template #toolbar-tools>
            <a-button type="primary" @click="handleAdd">
              <PlusOutlined /> {{ $t('config.createConfig') }}
            </a-button>
          </template>
          <template #bodyCell="{ column, row: record }">
            <template v-if="column.field === 'value'">
              <template v-if="record.valueType === 'boolean'">
                <a-tag :color="record.value === 'true' ? 'green' : 'default'">
                  {{ record.value === 'true' ? $t('common.yes') : $t('common.no') }}
                </a-tag>
              </template>
              <template v-else>
                <span class="config-value">{{ record.value }}</span>
              </template>
            </template>
            <template v-if="column.field === 'valueType'">
              <a-tag>{{ $t(`config.valueTypes.${record.valueType}`) || record.valueType }}</a-tag>
            </template>
            <template v-if="column.field === 'builtIn'">
              <a-tag :color="record.builtIn ? 'blue' : 'default'">
                {{
                  record.builtIn
                    ? $t('config.builtInTypes.builtIn')
                    : $t('config.builtInTypes.custom')
                }}
              </a-tag>
            </template>
            <template v-if="column.field === 'action'">
              <a-space :size="4">
                <a-button type="link" size="small" @click="handleEdit(record)">
                  <template #icon><EditOutlined /></template>
                  {{ $t('common.edit') }}
                </a-button>
                <a-button
                  v-if="!record.builtIn"
                  type="link"
                  size="small"
                  danger
                  @click="handleDelete(record)"
                >
                  <template #icon><DeleteOutlined /></template>
                  {{ $t('common.delete') }}
                </a-button>
              </a-space>
            </template>
          </template>
        </Grid>
      </template>
    </ProSplitLayout>

    <!-- add/edit modal -->
    <a-modal v-model:open="modalVisible" :title="modalTitle" @ok="handleSubmit" :width="520">
      <a-form :model="form" :label-col="{ span: 6 }" style="margin-top: 16px">
        <a-form-item :label="$t('config.configName')" required>
          <a-input v-model:value="form.name" :placeholder="$t('config.placeholders.configName')" />
        </a-form-item>
        <a-form-item :label="$t('config.configKey')" required>
          <a-input
            v-model:value="form.key"
            :placeholder="$t('config.placeholders.configKey')"
            :disabled="!!form.id"
          />
        </a-form-item>
        <a-form-item :label="$t('config.configValue')" required>
          <a-switch v-if="form.valueType === 'boolean'" v-model:checked="boolValue" />
          <a-input-number
            v-else-if="form.valueType === 'number'"
            v-model:value="form.value"
            style="width: 100%"
          />
          <a-textarea
            v-else-if="form.valueType === 'json'"
            v-model:value="form.value"
            :rows="4"
            :placeholder="$t('config.placeholders.jsonFormat')"
          />
          <a-input
            v-else
            v-model:value="form.value"
            :placeholder="$t('config.placeholders.configValue')"
          />
        </a-form-item>
        <a-form-item :label="$t('config.valueType')">
          <a-select
            v-model:value="form.valueType"
            :disabled="!!form.id"
            :options="valueTypeOptions"
          />
        </a-form-item>
        <a-form-item :label="$t('config.group')">
          <a-select v-model:value="form.group" allow-clear :options="groupOptions" />
        </a-form-item>
        <a-form-item :label="$t('config.sort')">
          <a-input-number v-model:value="form.sort" :min="0" style="width: 100%" />
        </a-form-item>
        <a-form-item :label="$t('config.description')">
          <a-textarea
            v-model:value="form.description"
            :placeholder="$t('config.placeholders.description')"
            :rows="2"
          />
        </a-form-item>
      </a-form>
    </a-modal>
  </div>
</template>

<script setup lang="ts">
import type { VxeTableGridOptions } from '@/libs/table';
import type { SysConfig } from '@/types/config';
import type { MenuItemType } from 'antdv-next';

import { EditOutlined, DeleteOutlined, PlusOutlined } from '@antdv-next/icons';
import { message, Modal } from 'antdv-next';
import { ref, computed, h, watch } from 'vue';
import { useI18n } from 'vue-i18n';

import { useVxeGrid } from '@/adapters/table';
import { getConfigList, createConfig, updateConfig, deleteConfig } from '@/api/config';
import ProSplitLayout from '@/components/Pro/ProSplitLayout/index.vue';

const { t } = useI18n();

const groups = ref<string[]>(['basic', 'security', 'upload', 'notification']);
const selectedGroup = ref('basic');
const allConfigs = ref<SysConfig[]>([]);
const valueTypeOptions = computed(() =>
  ['string', 'number', 'boolean', 'json'].map((value) => ({
    label: t(`config.valueTypes.${value}`),
    value,
  })),
);
const groupOptions = computed(() =>
  groups.value.map((group) => ({
    label: t(`config.groups.${group}`),
    value: group,
  })),
);
const selectedMenuKeys = computed({
  get: () => [selectedGroup.value],
  set: (keys: string[]) => {
    if (keys.length > 0) selectedGroup.value = keys[0];
  },
});

const getGroupCount = (group: string) => allConfigs.value.filter((c) => c.group === group).length;

const menuItems = computed<MenuItemType[]>(() =>
  groups.value.map((group) => ({
    key: group,
    label: h('div', { class: 'menu-item-label' }, [
      h('span', { class: 'group-name' }, t(`config.groups.${group}`)),
      h('span', { class: 'group-count' }, String(getGroupCount(group))),
    ]),
    title: t(`config.groups.${group}`),
  })),
);

const handleMenuClick = ({ key }: { key: string }) => {
  selectedGroup.value = key;
};

// modal
const modalVisible = ref(false);
const modalTitle = computed(() =>
  form.value.id ? t('config.editConfig') : t('config.createConfig'),
);
const form = ref<Partial<SysConfig>>({
  name: '',
  key: '',
  value: '',
  valueType: 'string',
  group: 'basic',
  sort: 0,
  description: '',
});
const boolValue = computed({
  get: () => form.value.value === 'true',
  set: (v: boolean) => {
    form.value.value = String(v);
  },
});

const columns = computed<NonNullable<VxeTableGridOptions<SysConfig>['columns']>>(() => [
  { title: t('config.configName'), field: 'name', minWidth: 160 },
  { title: t('config.configKey'), field: 'key', width: 200 },
  {
    title: t('config.configValue'),
    field: 'value',
    minWidth: 150,
    showOverflow: true,
    slots: { default: 'bodyCell' },
  },
  { title: t('config.valueType'), field: 'valueType', width: 90, slots: { default: 'bodyCell' } },
  { title: t('config.builtIn'), field: 'builtIn', width: 90, slots: { default: 'bodyCell' } },
  { title: t('config.description'), field: 'description', minWidth: 150, showOverflow: true },
  {
    title: t('common.actions'),
    field: 'action',
    width: 150,
    fixed: 'right',
    slots: { default: 'bodyCell' },
  },
]);

const loadConfigList = async (params: Record<string, unknown>) => {
  let current = Number(params.current || 1);
  // 左侧切换可能发生在请求中；只把最新分组的数据交给表格。
  while (true) {
    const key = selectedGroup.value;
    if (!key) return { data: [], total: 0, success: true };
    // oxlint-disable-next-line no-await-in-loop -- 请求完成后才能判断分组是否切换并串行重试。
    const response = await getConfigList({
      group: key,
      page: current,
      pageSize: Number(params.pageSize || 10),
    });
    if (key !== selectedGroup.value) {
      current = 1;
      continue;
    }
    return { data: response.data.list, total: response.data.total, success: true };
  }
};

// load all configs for group count
const loadAllConfigs = async () => {
  try {
    const response = await getConfigList({ page: 1, pageSize: 100 });
    if (response.code === 200) allConfigs.value = response.data.list;
  } catch (_error: unknown) {}
};

const handleAdd = () => {
  form.value = {
    name: '',
    key: '',
    value: '',
    valueType: 'string',
    group: selectedGroup.value,
    sort: 0,
    description: '',
  };
  modalVisible.value = true;
};

const handleEdit = (record: SysConfig) => {
  form.value = { ...record };
  modalVisible.value = true;
};

const handleDelete = (record: SysConfig) => {
  Modal.confirm({
    title: t('config.confirmDelete'),
    content: t('config.confirmDeleteContent', { name: record.name }),
    onOk: async () => {
      try {
        const response = await deleteConfig(record.id);
        if (response.code === 200) {
          message.success(t('config.deleteSuccess'));
          void gridApi.query();
          loadAllConfigs();
        } else {
          message.error(response.message || t('config.deleteFailed'));
        }
      } catch (_error: unknown) {
        message.error(t('config.deleteFailed'));
      }
    },
  });
};

const handleSubmit = async () => {
  if (!form.value.name || !form.value.key) {
    message.warning(t('config.requiredFields'));
    return;
  }
  try {
    if (form.value.id) {
      const response = await updateConfig(form.value.id, form.value);
      if (response.code === 200) {
        message.success(t('config.updateSuccess'));
        modalVisible.value = false;
        void gridApi.query();
        loadAllConfigs();
      }
    } else {
      const response = await createConfig(form.value);
      if (response.code === 200) {
        message.success(t('config.createSuccess'));
        modalVisible.value = false;
        void gridApi.query();
        loadAllConfigs();
      } else message.error(response.message || t('config.operateFailed'));
    }
  } catch (_error: unknown) {
    message.error(t('config.operateFailed'));
  }
};

loadAllConfigs();
const gridOptions = computed<VxeTableGridOptions<SysConfig>>(() => ({
  id: 'system-config',
  height: 'auto',
  rowConfig: { keyField: 'id' },
  columns: [{ type: 'seq', width: 60 }, ...columns.value],
  pagerConfig: { pageSize: 10 },
  customConfig: { storage: true },
  proxyConfig: {
    ajax: {
      async query({ page }, search: Record<string, unknown>) {
        const result = await loadConfigList({
          ...search,
          current: page.currentPage,
          pageSize: page.pageSize,
        });
        return { items: result.data, total: result.total };
      },
    },
  },
}));
const [Grid, gridApi] = useVxeGrid<SysConfig>({ gridOptions: gridOptions.value });
watch(selectedGroup, () => {
  gridApi.setGridOptions({ pagerConfig: { currentPage: 1 } });
  void gridApi.reload();
});
</script>

<style scoped lang="scss">
@use '@/assets/styles/color' as compat;
.page-container {
  display: flex;
  gap: 16px;
  flex: 1;
  min-height: 0;
}

.config-groups-header {
  padding: 0 16px;
  margin-bottom: 8px;

  h3 {
    margin: 0;
    font-size: 15px;
    font-weight: 600;
    color: var(--color-text-heading);
  }
}

.config-groups-menu {
  flex: 1;
  overflow: auto;
  background: transparent;
  border: none;

  :deep(.ant-menu-item) {
    margin: 4px 8px;
    padding: 10px 12px !important;
    border-radius: 8px;
    height: auto;
    transition: all 0.2s;

    &::before {
      // Remove default selected indicator
      display: none;
    }

    &:hover {
      background: var(--color-fill-quaternary, #fafafa);
    }

    &.ant-menu-item-selected {
      background: compat.fade('color-primary', 0.08);

      .group-name {
        color: var(--color-primary);
        font-weight: 600;
      }
    }
  }

  .menu-item-label {
    display: flex;
    align-items: center;
    justify-content: space-between;
    width: 100%;

    .group-name {
      font-size: 14px;
      flex: 1;
    }

    .group-count {
      font-size: 12px;
      color: var(--color-text-quaternary);
      background: var(--color-fill-quaternary);
      padding: 0 8px;
      border-radius: 10px;
      line-height: 20px;
      margin-left: 8px;
      flex-shrink: 0;
    }
  }
}
</style>
