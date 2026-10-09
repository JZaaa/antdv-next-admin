<template>
  <div class="page-container">
    <Grid
      :grid-options="gridOptions"
      :table-title="t('file.title')"
      :form-options="{ schema: searchFormItems, collapsed: true, commonConfig: { labelWidth: 80 } }"
    >
      <template #bodyCell="{ column, row: record }">
        <template v-if="column.field === 'originalName'">
          <div class="file-name">
            <span class="file-icon" :style="{ color: getExtColor(record.ext) }">
              <FileImageOutlined v-if="isImage(record.ext)" />
              <VideoCameraOutlined v-else-if="isVideo(record.ext)" />
              <FilePdfOutlined v-else-if="record.ext === 'pdf'" />
              <FileExcelOutlined v-else-if="['xlsx', 'xls'].includes(record.ext)" />
              <FileWordOutlined v-else-if="['docx', 'doc'].includes(record.ext)" />
              <FilePptOutlined v-else-if="['pptx', 'ppt'].includes(record.ext)" />
              <FileZipOutlined v-else-if="['zip', 'rar', '7z'].includes(record.ext)" />
              <FileTextOutlined v-else />
            </span>
            <span>{{ record.originalName }}</span>
          </div>
        </template>
        <template v-if="column.field === 'size'">
          {{ formatSize(record.size) }}
        </template>
        <template v-if="column.field === 'storage'">
          <a-tag :color="storageColor[record.storage]">{{
            t(`file.storageType.${record.storage}`)
          }}</a-tag>
        </template>
        <template v-if="column.field === 'action'">
          <a-space :size="4">
            <a-button type="link" size="small" danger @click="handleDelete(record)">
              <template #icon><DeleteOutlined /></template>
              {{ t('file.delete') }}
            </a-button>
          </a-space>
        </template>
      </template>
    </Grid>
  </div>
</template>

<script setup lang="ts">
import type { FormSchema } from '@/libs/form';
import type { VxeTableGridOptions } from '@/libs/table';
import type { SysFile } from '@/types/file';

import {
  DeleteOutlined,
  FileImageOutlined,
  VideoCameraOutlined,
  FilePdfOutlined,
  FileExcelOutlined,
  FileWordOutlined,
  FilePptOutlined,
  FileZipOutlined,
  FileTextOutlined,
} from '@antdv-next/icons';
import { message, Modal } from 'antdv-next';
import { computed } from 'vue';
import { useI18n } from 'vue-i18n';

import { useVxeGrid } from '@/adapters/table';
import { getFileList, deleteFile } from '@/api/file';

const { t } = useI18n();

const storageColor: Record<string, string> = {
  local: 'default',
  oss: 'blue',
  cos: 'green',
};

const isImage = (ext: string) => ['jpg', 'jpeg', 'png', 'gif', 'svg', 'webp'].includes(ext);
const isVideo = (ext: string) => ['mp4', 'avi', 'mov', 'wmv'].includes(ext);

const getExtColor = (ext: string) => {
  const colors: Record<string, string> = {
    jpg: '#f5222d',
    jpeg: '#f5222d',
    png: '#fa541c',
    gif: '#fa8c16',
    svg: '#a0d911',
    pdf: '#cf1322',
    docx: '#1677ff',
    doc: '#1677ff',
    xlsx: '#52c41a',
    xls: '#52c41a',
    pptx: '#fa541c',
    ppt: '#fa541c',
    zip: '#faad14',
    rar: '#faad14',
    mp4: '#722ed1',
    txt: '#8c8c8c',
  };
  return colors[ext] || '#8c8c8c';
};

const formatSize = (bytes: number) => {
  if (bytes < 1024) return bytes + ' B';
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
  if (bytes < 1024 * 1024 * 1024) return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
  return (bytes / (1024 * 1024 * 1024)).toFixed(2) + ' GB';
};

const searchFormItems = computed<FormSchema[]>(() => [
  {
    fieldName: 'originalName',
    label: t('file.fileName'),
    component: 'Input',
    componentProps: {
      allowClear: true,
      placeholder: t('proForm.enterPlaceholder', { label: t('file.fileName') }),
    },
  },
  {
    fieldName: 'ext',
    label: t('file.ext'),
    component: 'Select',
    componentProps: {
      allowClear: true,
      placeholder: t('proForm.selectPlaceholder', { label: t('file.ext') }),
      options: [
        { label: t('file.extType.imageJpg'), value: 'jpg' },
        { label: t('file.extType.imagePng'), value: 'png' },
        { label: t('file.extType.pdf'), value: 'pdf' },
        { label: t('file.extType.word'), value: 'docx' },
        { label: t('file.extType.excel'), value: 'xlsx' },
        { label: t('file.extType.zip'), value: 'zip' },
        { label: t('file.extType.video'), value: 'mp4' },
        { label: t('file.extType.text'), value: 'txt' },
        { label: t('file.extType.ppt'), value: 'pptx' },
        { label: t('file.extType.svg'), value: 'svg' },
      ],
    },
  },
  {
    fieldName: 'storage',
    label: t('file.storage'),
    component: 'Select',
    componentProps: {
      allowClear: true,
      placeholder: t('proForm.selectPlaceholder', { label: t('file.storage') }),
      options: [
        { label: t('file.storageType.local'), value: 'local' },
        { label: t('file.storageType.oss'), value: 'oss' },
        { label: t('file.storageType.cos'), value: 'cos' },
      ],
    },
  },
]);

const columns = computed<NonNullable<VxeTableGridOptions<SysFile>['columns']>>(() => [
  {
    title: t('file.fileName'),
    field: 'originalName',
    minWidth: 150,
    showOverflow: true,
    slots: { default: 'bodyCell' },
  },
  { title: t('file.ext'), field: 'ext', width: 90 },
  { title: t('file.size'), field: 'size', width: 120, slots: { default: 'bodyCell' } },
  { title: t('file.storage'), field: 'storage', width: 100, slots: { default: 'bodyCell' } },
  { title: t('file.uploader'), field: 'uploader', width: 100 },
  { title: t('file.uploadTime'), field: 'createTime', width: 180 },
  {
    title: t('file.action'),
    field: 'action',
    width: 100,
    fixed: 'right',
    slots: { default: 'bodyCell' },
  },
]);

const loadFileList = async (params: Record<string, unknown>) => {
  try {
    const response = await getFileList({
      name: params.originalName as string,
      ext: params.ext as string,
      storage: params.storage as string,
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
    console.error(t('file.loadFailed'), (error as Error).message);
    throw error;
  }
  throw new Error(t('common.error'));
};

const handleDelete = (record: SysFile) => {
  Modal.confirm({
    title: t('file.confirmDelete'),
    content: t('file.confirmDeleteContent', { name: record.originalName }),
    onOk: async () => {
      try {
        const response = await deleteFile(record.id);
        if (response.code === 200) {
          message.success(t('file.deleteSuccess'));
          void gridApi.query();
        } else {
          message.error(response.message || t('file.deleteFailed'));
        }
      } catch (_error: unknown) {
        message.error(t('file.deleteFailed'));
      }
    },
  });
};
const gridOptions = computed<VxeTableGridOptions<SysFile>>(() => ({
  id: 'system-file',
  height: 'auto',
  rowConfig: { keyField: 'id' },
  columns: [{ type: 'seq', width: 60 }, ...columns.value],
  pagerConfig: { pageSize: 10 },
  customConfig: { storage: true },
  proxyConfig: {
    ajax: {
      async query({ page }, search: Record<string, unknown>) {
        const result = await loadFileList({
          ...search,
          current: page.currentPage,
          pageSize: page.pageSize,
        });
        return { items: result.data, total: result.total };
      },
    },
  },
}));
const [Grid, gridApi] = useVxeGrid<SysFile>({
  gridOptions: gridOptions.value,
  formOptions: { schema: searchFormItems.value, collapsed: true, commonConfig: { labelWidth: 80 } },
});
</script>

<style scoped lang="scss">
.file-name {
  display: flex;
  align-items: center;
  gap: 8px;

  .file-icon {
    font-size: 18px;
    flex-shrink: 0;
  }
}
</style>
