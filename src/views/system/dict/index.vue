<template>
  <div class="page-container">
    <ProSplitLayout :side-width="260">
      <template #side>
        <!-- dict type list -->
        <div class="dict-types-header">
          <h3>{{ t('dict.dictType') }}</h3>
          <a-button type="primary" size="small" @click="handleAddType">
            <template #icon><PlusOutlined /></template>
            {{ t('common.add') }}
          </a-button>
        </div>
        <div class="dict-types-list">
          <div
            v-for="type in dictTypes"
            :key="type.id"
            class="dict-type-item"
            :class="{ active: selectedTypeCode === type.code }"
            @click="handleSelectType(type)"
          >
            <div class="type-info">
              <div class="type-name">{{ type.name }}</div>
              <div class="type-code">{{ type.code }}</div>
            </div>
            <div class="type-actions" @click.stop>
              <a-tooltip :title="t('common.edit')">
                <a-button type="text" size="small" @click="handleEditType(type)">
                  <template #icon><EditOutlined /></template>
                </a-button>
              </a-tooltip>
              <a-tooltip :title="t('common.delete')">
                <a-button type="text" size="small" danger @click="handleDeleteType(type)">
                  <template #icon><DeleteOutlined /></template>
                </a-button>
              </a-tooltip>
            </div>
          </div>
        </div>
      </template>

      <template #main>
        <!-- dict data list -->
        <Grid
          v-show="selectedTypeCode"
          :grid-options="gridOptions"
          :table-title="t('dict.dictDataTitle', { name: selectedTypeName })"
        >
          <template #toolbar-tools>
            <a-button type="primary" @click="handleAdd">
              <PlusOutlined /> {{ t('dict.createData') }}
            </a-button>
          </template>
          <template #bodyCell="{ column, row: record }">
            <template v-if="column.field === 'status'">
              <ProStatus :value="record.status" :status-map="dictStatusMap" />
            </template>
            <template v-if="column.field === 'action'">
              <a-space :size="4">
                <a-button type="link" size="small" @click="handleEdit(record)">
                  <template #icon><EditOutlined /></template>
                  {{ t('common.edit') }}
                </a-button>
                <a-button type="link" size="small" danger @click="handleDelete(record)">
                  <template #icon><DeleteOutlined /></template>
                  {{ t('common.delete') }}
                </a-button>
              </a-space>
            </template>
          </template>
        </Grid>
        <div v-if="!selectedTypeCode" class="dict-data-empty">
          <a-empty :description="t('dict.selectTypeHint')" />
        </div>
      </template>
    </ProSplitLayout>

    <!-- dict type modal -->
    <a-modal v-model:open="typeModalVisible" :title="typeModalTitle" @ok="handleTypeSubmit">
      <a-form :model="typeForm" :label-col="{ span: 6 }">
        <a-form-item :label="t('dict.typeName')" required>
          <a-input v-model:value="typeForm.name" :placeholder="t('dict.typeNamePlaceholder')" />
        </a-form-item>
        <a-form-item :label="t('dict.typeCode')" required>
          <a-input
            v-model:value="typeForm.code"
            :placeholder="t('dict.typeCodePlaceholder')"
            :disabled="!!typeForm.id"
          />
        </a-form-item>
        <a-form-item :label="t('dict.description')">
          <a-textarea
            v-model:value="typeForm.description"
            :placeholder="t('dict.descriptionPlaceholder')"
            :rows="3"
          />
        </a-form-item>
        <a-form-item :label="t('common.status')">
          <a-radio-group v-model:value="typeForm.status">
            <a-radio value="enabled">{{ t('dict.enabled') }}</a-radio>
            <a-radio value="disabled">{{ t('dict.disabled') }}</a-radio>
          </a-radio-group>
        </a-form-item>
      </a-form>
    </a-modal>

    <!-- dict data modal -->
    <a-modal v-model:open="dataModalVisible" :title="dataModalTitle" @ok="handleDataSubmit">
      <a-form :model="dataForm" :label-col="{ span: 6 }">
        <a-form-item :label="t('dict.dictLabel')" required>
          <a-input v-model:value="dataForm.label" :placeholder="t('dict.labelPlaceholder')" />
        </a-form-item>
        <a-form-item :label="t('dict.dictValue')" required>
          <a-input v-model:value="dataForm.value" :placeholder="t('dict.valuePlaceholder')" />
        </a-form-item>
        <a-form-item :label="t('dict.sort')">
          <a-input-number v-model:value="dataForm.sort" :min="0" style="width: 100%" />
        </a-form-item>
        <a-form-item :label="t('common.status')">
          <a-radio-group v-model:value="dataForm.status">
            <a-radio value="enabled">{{ t('dict.enabled') }}</a-radio>
            <a-radio value="disabled">{{ t('dict.disabled') }}</a-radio>
          </a-radio-group>
        </a-form-item>
        <a-form-item :label="t('dict.remark')">
          <a-textarea
            v-model:value="dataForm.remark"
            :placeholder="t('dict.remarkPlaceholder')"
            :rows="3"
          />
        </a-form-item>
      </a-form>
    </a-modal>
  </div>
</template>

<script setup lang="ts">
import type { VxeTableGridOptions } from '@/libs/table';
import type { DictType, DictData } from '@/types/dict';
import type { ProStatusMap } from '@/types/pro';

import { PlusOutlined, EditOutlined, DeleteOutlined } from '@antdv-next/icons';
import { message, Modal } from 'antdv-next';
import { ref, computed, watch } from 'vue';
import { useI18n } from 'vue-i18n';

import { useVxeGrid } from '@/adapters/table';
import {
  getDictTypes,
  createDictType,
  updateDictType,
  deleteDictType,
  getDictDataList,
  createDictData,
  updateDictData,
  deleteDictData,
} from '@/api/dict';
import ProSplitLayout from '@/components/Pro/ProSplitLayout/index.vue';
import ProStatus from '@/components/Pro/ProStatus/index.vue';
import { useDictStore } from '@/stores/dict';

const { t } = useI18n();
const dictStore = useDictStore();

const dictStatusMap = computed<ProStatusMap>(() => ({
  enabled: { text: t('dict.enabled'), color: '#52c41a' },
  disabled: { text: t('dict.disabled'), color: '#bfbfbf' },
}));

// dict type list
const dictTypes = ref<DictType[]>([]);
const selectedTypeCode = ref<string>('');
const selectedTypeName = computed(() => {
  const type = dictTypes.value.find((item) => item.code === selectedTypeCode.value);
  return type?.name || '';
});

// dict type modal
const typeModalVisible = ref(false);
const typeModalTitle = computed(() =>
  typeForm.value.id ? t('dict.editType') : t('dict.createType'),
);
const typeForm = ref<Partial<DictType>>({
  name: '',
  code: '',
  description: '',
  status: 'enabled',
});

// dict data modal
const dataModalVisible = ref(false);
const dataModalTitle = computed(() =>
  dataForm.value.id ? t('dict.editData') : t('dict.createData'),
);
const dataForm = ref<Partial<DictData>>({
  label: '',
  value: '',
  sort: 0,
  status: 'enabled',
  remark: '',
});

// table columns
const columns = computed<NonNullable<VxeTableGridOptions<DictData>['columns']>>(() => [
  { title: t('dict.dictLabel'), field: 'label', minWidth: 150 },
  { title: t('dict.dictValue'), field: 'value', minWidth: 150 },
  { title: t('dict.sort'), field: 'sort', width: 80 },
  { title: t('common.status'), field: 'status', width: 80, slots: { default: 'bodyCell' } },
  { title: t('dict.remark'), field: 'remark', minWidth: 150 },
  {
    title: t('common.actions'),
    field: 'action',
    width: 150,
    fixed: 'right',
    slots: { default: 'bodyCell' },
  },
]);

// load dict type list
const loadDictTypes = async () => {
  try {
    const response = await getDictTypes();
    if (response.code === 200) {
      dictTypes.value = response.data;
      if (dictTypes.value.length > 0 && !selectedTypeCode.value) {
        selectedTypeCode.value = dictTypes.value[0].code;
      }
    }
  } catch (error: unknown) {
    console.error(t('dict.loadTypeFailed'), (error as Error).message);
  }
};

// load dict data list
const loadData = async (params: Record<string, unknown>) => {
  let current = Number(params.current || 1);
  // 左侧切换可能发生在请求中；只把最新分组的数据交给表格。
  while (true) {
    const key = selectedTypeCode.value;
    if (!key) return { data: [], total: 0, success: true };
    // oxlint-disable-next-line no-await-in-loop -- 请求完成后才能判断字典类型是否切换并串行重试。
    const response = await getDictDataList({
      typeCode: key,
      page: current,
      pageSize: Number(params.pageSize || 10),
    });
    if (key !== selectedTypeCode.value) {
      current = 1;
      continue;
    }
    return { data: response.data.list, total: response.data.total, success: true };
  }
};

// select dict type
const handleSelectType = (type: DictType) => {
  selectedTypeCode.value = type.code;
};

// add dict type
const handleAddType = () => {
  typeForm.value = {
    name: '',
    code: '',
    description: '',
    status: 'enabled',
  };
  typeModalVisible.value = true;
};

// edit dict type
const handleEditType = (type: DictType) => {
  typeForm.value = { ...type };
  typeModalVisible.value = true;
};

// delete dict type
const handleDeleteType = (type: DictType) => {
  Modal.confirm({
    title: t('dict.confirmDelete'),
    content: t('dict.confirmDeleteType', { name: type.name }),
    onOk: async () => {
      try {
        const response = await deleteDictType(type.id);
        if (response.code === 200) {
          message.success(t('dict.deleteSuccess'));
          loadDictTypes();
          if (selectedTypeCode.value === type.code) {
            selectedTypeCode.value = '';
          }
        }
      } catch (_error: unknown) {
        message.error(t('dict.deleteFailed'));
      }
    },
  });
};

// submit dict type
const handleTypeSubmit = async () => {
  if (!typeForm.value.name || !typeForm.value.code) {
    message.warning(t('dict.requiredFields'));
    return;
  }

  try {
    if (typeForm.value.id) {
      const response = await updateDictType(typeForm.value.id, typeForm.value);
      if (response.code === 200) {
        message.success(t('dict.updateSuccess'));
        typeModalVisible.value = false;
        loadDictTypes();
      }
    } else {
      const response = await createDictType(typeForm.value);
      if (response.code === 200) {
        message.success(t('dict.createSuccess'));
        typeModalVisible.value = false;
        loadDictTypes();
      }
    }
  } catch (_error: unknown) {
    message.error(t('dict.operateFailed'));
  }
};

// add dict data
const handleAdd = () => {
  dataForm.value = {
    typeCode: selectedTypeCode.value,
    label: '',
    value: '',
    sort: 0,
    status: 'enabled',
    remark: '',
  };
  dataModalVisible.value = true;
};

// edit dict data
const handleEdit = (record: DictData) => {
  dataForm.value = { ...record };
  dataModalVisible.value = true;
};

// delete dict data
const handleDelete = (record: DictData) => {
  Modal.confirm({
    title: t('dict.confirmDelete'),
    content: t('dict.confirmDeleteData', { label: record.label }),
    onOk: async () => {
      try {
        const response = await deleteDictData(record.id);
        if (response.code === 200) {
          message.success(t('dict.deleteSuccess'));
          dictStore.refreshDictData();
          void gridApi.query();
        }
      } catch (_error: unknown) {
        message.error(t('dict.deleteFailed'));
      }
    },
  });
};

// submit dict data
const handleDataSubmit = async () => {
  if (!dataForm.value.label || !dataForm.value.value) {
    message.warning(t('dict.requiredFields'));
    return;
  }

  try {
    if (dataForm.value.id) {
      const response = await updateDictData(dataForm.value.id, dataForm.value);
      if (response.code === 200) {
        message.success(t('dict.updateSuccess'));
        dataModalVisible.value = false;
        dictStore.refreshDictData();
        void gridApi.query();
      }
    } else {
      const response = await createDictData(dataForm.value);
      if (response.code === 200) {
        message.success(t('dict.createSuccess'));
        dataModalVisible.value = false;
        dictStore.refreshDictData();
        void gridApi.query();
      }
    }
  } catch (_error: unknown) {
    message.error(t('dict.operateFailed'));
  }
};

// init
loadDictTypes();
const gridOptions = computed<VxeTableGridOptions<DictData>>(() => ({
  id: 'system-dict',
  height: 'auto',
  rowConfig: { keyField: 'id' },
  columns: [{ type: 'seq', width: 60 }, ...columns.value],
  pagerConfig: { pageSize: 10 },
  customConfig: { storage: true },
  proxyConfig: {
    autoLoad: false,
    ajax: {
      async query({ page }, search: Record<string, unknown>) {
        const result = await loadData({
          ...search,
          current: page.currentPage,
          pageSize: page.pageSize,
        });
        return { items: result.data, total: result.total };
      },
    },
  },
}));
const [Grid, gridApi] = useVxeGrid<DictData>({ gridOptions: gridOptions.value });
watch(selectedTypeCode, () => {
  gridApi.setGridOptions({ pagerConfig: { currentPage: 1 } });
  void gridApi.reload();
});
</script>

<style scoped lang="scss">
@use '@/assets/styles/color' as compat;
// dict types content
.dict-types-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 16px;
  padding-bottom: 12px;
  border-bottom: 1px solid var(--color-border-secondary, #f0f0f0);

  h3 {
    margin: 0;
    font-size: 15px;
    font-weight: 600;
    color: var(--color-text);
  }
}

.dict-types-list {
  flex: 1;
  overflow-y: auto;
  margin: 0 -8px;
  padding: 0 8px;

  &::-webkit-scrollbar {
    width: 4px;
  }
  &::-webkit-scrollbar-thumb {
    background: rgba(0, 0, 0, 0.1);
    border-radius: 4px;
  }
  &::-webkit-scrollbar-track {
    background: transparent;
  }

  .dict-type-item {
    position: relative;
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 12px 12px 12px 16px;
    border-radius: 8px;
    cursor: pointer;
    margin-bottom: 4px;
    border: none;
    transition: all 0.2s ease;
    overflow: hidden;

    &::before {
      content: '';
      position: absolute;
      left: 0;
      top: 50%;
      transform: translateY(-50%);
      width: 3px;
      height: 0;
      background: var(--ant-primary-color);
      border-radius: 0 3px 3px 0;
      transition: height 0.2s ease;
    }

    &:hover {
      background: var(--color-fill-quaternary, #fafafa);

      .type-actions {
        opacity: 1;
        transform: translateX(0);
      }
    }

    &.active {
      background: compat.fade('color-primary', 0.08);

      &::before {
        height: 60%;
      }

      .type-name {
        color: var(--color-primary);
        font-weight: 600;
      }
    }

    .type-info {
      flex: 1;
      min-width: 0;

      .type-name {
        font-size: 14px;
        font-weight: 500;
        margin-bottom: 2px;
        color: var(--color-text);
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
        transition: color 0.2s;
      }

      .type-code {
        font-size: 12px;
        color: var(--color-text-quaternary, #bfbfbf);
        font-family: 'SF Mono', 'Monaco', 'Menlo', monospace;
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
      }
    }

    .type-actions {
      display: flex;
      gap: 2px;
      opacity: 0;
      transform: translateX(8px);
      transition: all 0.2s ease;
      flex-shrink: 0;
    }
  }
}

// dict data content
:deep(.vxe-header--row) {
  background: var(--color-fill-quaternary, #fafafa);
}

.dict-data-empty {
  display: flex;
  align-items: center;
  justify-content: center;
  height: 100%;
}
</style>
