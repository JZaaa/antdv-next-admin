<template>
  <div class="page-container">
    <div class="log-container">
      <a-tabs v-model:activeKey="activeTab" @change="handleTabChange">
        <a-tab-pane key="operation" :tab="t('log.operationLog')">
          <OperationGrid
            :grid-options="operationGridOptions"
            :form-options="{
              schema: operationSearchFormItems,
              collapsed: true,
              commonConfig: { labelWidth: 80 },
            }"
            :table-title="t('log.operationLog')"
          >
            <template #toolbar-tools>
              <a-button danger @click="handleClearOperationLog">
                <DeleteOutlined /> {{ t('log.clearLog') }}
              </a-button>
            </template>
            <template #bodyCell="{ column, row: record }">
              <template v-if="column.field === 'action'">
                <a-tag :color="actionColorMap[record.action] || 'default'">
                  {{ t(`log.actionTypes.${record.action}`) || record.action }}
                </a-tag>
              </template>
              <template v-if="column.field === 'status'">
                <ProStatus :value="record.status" :status-map="logStatusMap" />
              </template>
              <template v-if="column.field === 'duration'">
                <span
                  :style="{
                    color:
                      record.duration > 300
                        ? '#ff4d4f'
                        : record.duration > 100
                          ? '#faad14'
                          : '#52c41a',
                  }"
                >
                  {{ record.duration }}ms
                </span>
              </template>
            </template>
          </OperationGrid>
        </a-tab-pane>

        <a-tab-pane key="login" :tab="t('log.loginLog')">
          <LoginGrid
            :grid-options="loginGridOptions"
            :form-options="{
              schema: loginSearchFormItems,
              collapsed: true,
              commonConfig: { labelWidth: 80 },
            }"
            :table-title="t('log.loginLog')"
          >
            <template #toolbar-tools>
              <a-button danger @click="handleClearLoginLog">
                <DeleteOutlined /> {{ t('log.clearLog') }}
              </a-button>
            </template>
            <template #bodyCell="{ column, row: record }">
              <template v-if="column.field === 'status'">
                <ProStatus :value="record.status" :status-map="logStatusMap" />
              </template>
            </template>
          </LoginGrid>
        </a-tab-pane>
      </a-tabs>
    </div>
  </div>
</template>

<script setup lang="ts">
import type { FormSchema } from '@/libs/form';
import type { VxeTableGridOptions } from '@/libs/table';
import type { OperationLog, LoginLog } from '@/types/log';
import type { ProStatusMap } from '@/types/pro';

import { DeleteOutlined } from '@antdv-next/icons';
import { message, Modal } from 'antdv-next';
import { ref, computed } from 'vue';
import { useI18n } from 'vue-i18n';

import { useVxeGrid } from '@/adapters/table';
import { getOperationLogList, getLoginLogList, clearOperationLog, clearLoginLog } from '@/api/log';
import ProStatus from '@/components/Pro/ProStatus/index.vue';

const { t } = useI18n();

const logStatusMap = computed<ProStatusMap>(() => ({
  success: { text: t('log.success'), color: '#52c41a' },
  fail: { text: t('log.fail'), color: '#ff4d4f' },
}));

const activeTab = ref('operation');

const actionColorMap: Record<string, string> = {
  login: 'blue',
  logout: 'default',
  create: 'green',
  update: 'orange',
  delete: 'red',
  export: 'purple',
  import: 'cyan',
  other: 'default',
};

// operation log search form items
const operationSearchFormItems = computed<FormSchema[]>(() => [
  {
    fieldName: 'username',
    label: t('log.operationUser'),
    component: 'Input',
    componentProps: {
      allowClear: true,
      placeholder: t('proForm.enterPlaceholder', { label: t('log.operationUser') }),
    },
  },
  {
    fieldName: 'module',
    label: t('log.operationModule'),
    component: 'Select',
    componentProps: {
      allowClear: true,
      placeholder: t('proForm.selectPlaceholder', { label: t('log.operationModule') }),
      options: [
        { label: t('log.modules.userManagement'), value: 'userManagement' },
        { label: t('log.modules.roleManagement'), value: 'roleManagement' },
        { label: t('log.modules.menuManagement'), value: 'menuManagement' },
        { label: t('log.modules.dictionary'), value: 'dictionary' },
        { label: t('log.modules.systemLogin'), value: 'systemLogin' },
        { label: t('log.modules.profile'), value: 'profile' },
        { label: t('log.modules.dashboard'), value: 'dashboard' },
      ],
    },
  },
  {
    fieldName: 'action',
    label: t('log.operationType'),
    component: 'Select',
    componentProps: {
      allowClear: true,
      placeholder: t('proForm.selectPlaceholder', { label: t('log.operationType') }),
      options: [
        { label: t('log.actionTypes.login'), value: 'login' },
        { label: t('log.actionTypes.logout'), value: 'logout' },
        { label: t('log.actionTypes.create'), value: 'create' },
        { label: t('log.actionTypes.update'), value: 'update' },
        { label: t('log.actionTypes.delete'), value: 'delete' },
        { label: t('log.actionTypes.export'), value: 'export' },
      ],
    },
  },
  {
    fieldName: 'status',
    label: t('common.status'),
    component: 'Select',
    componentProps: {
      allowClear: true,
      placeholder: t('proForm.selectPlaceholder', { label: t('common.status') }),
      options: [
        { label: t('log.success'), value: 'success' },
        { label: t('log.fail'), value: 'fail' },
      ],
    },
  },
]);

// operation log columns
const operationColumns = computed<NonNullable<VxeTableGridOptions<OperationLog>['columns']>>(() => [
  { title: t('log.operationUser'), field: 'username', minWidth: 100 },
  { title: t('log.operationModule'), field: 'module', width: 110 },
  { title: t('log.operationType'), field: 'action', width: 90, slots: { default: 'bodyCell' } },
  { title: t('log.operationDescription'), field: 'description', minWidth: 150, showOverflow: true },
  { title: t('log.requestMethod'), field: 'method', width: 90 },
  { title: t('log.ipAddress'), field: 'ip', width: 130 },
  { title: t('common.status'), field: 'status', width: 80, slots: { default: 'bodyCell' } },
  { title: t('log.duration'), field: 'duration', width: 80, slots: { default: 'bodyCell' } },
  { title: t('log.operationTime'), field: 'createTime', width: 170 },
]);

// login log search form items
const loginSearchFormItems = computed<FormSchema[]>(() => [
  {
    fieldName: 'username',
    label: t('log.username'),
    component: 'Input',
    componentProps: {
      allowClear: true,
      placeholder: t('proForm.enterPlaceholder', { label: t('log.username') }),
    },
  },
  {
    fieldName: 'ip',
    label: t('log.ipAddress'),
    component: 'Input',
    componentProps: {
      allowClear: true,
      placeholder: t('proForm.enterPlaceholder', { label: t('log.ipAddress') }),
    },
  },
  {
    fieldName: 'status',
    label: t('common.status'),
    component: 'Select',
    componentProps: {
      allowClear: true,
      placeholder: t('proForm.selectPlaceholder', { label: t('common.status') }),
      options: [
        { label: t('log.success'), value: 'success' },
        { label: t('log.fail'), value: 'fail' },
      ],
    },
  },
]);

// login log columns
const loginColumns = computed<NonNullable<VxeTableGridOptions<LoginLog>['columns']>>(() => [
  { title: t('log.username'), field: 'username', minWidth: 120 },
  { title: t('log.ipAddress'), field: 'ip', width: 140 },
  { title: t('log.browser'), field: 'browser', width: 130 },
  { title: t('log.os'), field: 'os', width: 130 },
  { title: t('common.status'), field: 'status', width: 80, slots: { default: 'bodyCell' } },
  { title: t('log.message'), field: 'message', minWidth: 150, showOverflow: true },
  { title: t('log.loginTime'), field: 'createTime', width: 170 },
]);

const handleTabChange = () => {};

const loadOperationLogs = async (params: Record<string, unknown>) => {
  try {
    const response = await getOperationLogList({
      username: params.username as string,
      module: params.module as string,
      action: params.action as string,
      status: params.status as string,
      page: params.current as number,
      pageSize: params.pageSize as number,
    });
    if (response.code === 200) {
      return {
        data: response.data.list,
        total: response.data.total,
        success: true,
      };
    }
  } catch (error: unknown) {
    console.error(t('log.loadOperationLogFailed'), (error as Error).message);
    throw error;
  }
  throw new Error(t('common.error'));
};

const loadLoginLogs = async (params: Record<string, unknown>) => {
  try {
    const response = await getLoginLogList({
      username: params.username as string,
      ip: params.ip as string,
      status: params.status as string,
      page: params.current as number,
      pageSize: params.pageSize as number,
    });
    if (response.code === 200) {
      return {
        data: response.data.list,
        total: response.data.total,
        success: true,
      };
    }
  } catch (error: unknown) {
    console.error(t('log.loadLoginLogFailed'), (error as Error).message);
    throw error;
  }
  return { data: [], total: 0, success: false };
};

const handleClearOperationLog = () => {
  Modal.confirm({
    title: t('log.confirmClear'),
    content: t('log.confirmClearOperation'),
    okType: 'danger',
    onOk: async () => {
      try {
        const response = await clearOperationLog();
        if (response.code === 200) {
          message.success(t('log.clearSuccess'));
          void operationGridApi.reload();
        }
      } catch (_error: unknown) {
        message.error(t('log.clearFailed'));
      }
    },
  });
};

const handleClearLoginLog = () => {
  Modal.confirm({
    title: t('log.confirmClear'),
    content: t('log.confirmClearLogin'),
    okType: 'danger',
    onOk: async () => {
      try {
        const response = await clearLoginLog();
        if (response.code === 200) {
          message.success(t('log.clearSuccess'));
          void loginGridApi.reload();
        }
      } catch (_error: unknown) {
        message.error(t('log.clearFailed'));
      }
    },
  });
};
const operationGridOptions = computed<VxeTableGridOptions<OperationLog>>(() => ({
  id: 'system-operation-log',
  height: 'auto',
  rowConfig: { keyField: 'id' },
  columns: [{ type: 'seq', width: 60 }, ...operationColumns.value],
  pagerConfig: { pageSize: 10 },
  customConfig: { storage: true },
  proxyConfig: {
    ajax: {
      async query({ page }, search: Record<string, unknown>) {
        const result = await loadOperationLogs({
          ...search,
          current: page.currentPage,
          pageSize: page.pageSize,
        });
        return { items: result.data, total: result.total };
      },
    },
  },
}));
const [OperationGrid, operationGridApi] = useVxeGrid<OperationLog>({
  gridOptions: operationGridOptions.value,
  formOptions: {
    schema: operationSearchFormItems.value,
    collapsed: true,
    commonConfig: { labelWidth: 80 },
  },
});
const loginGridOptions = computed<VxeTableGridOptions<LoginLog>>(() => ({
  id: 'system-login-log',
  height: 'auto',
  rowConfig: { keyField: 'id' },
  columns: [{ type: 'seq', width: 60 }, ...loginColumns.value],
  pagerConfig: { pageSize: 10 },
  customConfig: { storage: true },
  proxyConfig: {
    ajax: {
      async query({ page }, search: Record<string, unknown>) {
        const result = await loadLoginLogs({
          ...search,
          current: page.currentPage,
          pageSize: page.pageSize,
        });
        return { items: result.data, total: result.total };
      },
    },
  },
}));
const [LoginGrid, loginGridApi] = useVxeGrid<LoginLog>({
  gridOptions: loginGridOptions.value,
  formOptions: {
    schema: loginSearchFormItems.value,
    collapsed: true,
    commonConfig: { labelWidth: 80 },
  },
});
</script>

<style scoped lang="scss">
.log-container {
  background: var(--color-bg-container);
  border-radius: 8px;
  padding: 16px 20px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.04);
  flex: 1;
  min-height: 0;
  display: flex;
  flex-direction: column;

  :deep(.ant-tabs) {
    flex: 1;
    min-height: 0;
    display: flex;
    flex-direction: column;
  }

  :deep(.ant-tabs-body-holder) {
    flex: 1;
    min-height: 0;
  }

  :deep(.ant-tabs-content) {
    height: 100%;
  }

  :deep(.ant-tabs-body) {
    height: 100%;
  }

  :deep(.ant-tabs-nav) {
    margin-bottom: 8px;
  }

  :deep(.vxe-header--row) {
    background: var(--color-fill-quaternary);
  }
}
</style>
