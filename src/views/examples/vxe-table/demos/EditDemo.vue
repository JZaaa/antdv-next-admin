<template>
  <div class="demo-actions">
    <Switch v-model:checked="fail" /> 模拟保存失败 <span role="status">{{ status }}</span>
  </div>
  <Grid>
    <template #actions="{ row }">
      <Button v-if="editing !== row.id" size="small" @click="edit(row)">编辑</Button>
      <template v-else
        ><Button size="small" :loading="saving" @click="save(row)">保存</Button
        ><Button size="small" @click="cancel(row)">取消</Button></template
      >
    </template>
  </Grid>
</template>
<script setup lang="ts">
import { Button, Switch } from 'antdv-next';
import dayjs from 'dayjs';
import { onBeforeUnmount, ref } from 'vue';

import { useVxeGrid } from '@/adapters/table';
interface Row {
  id: number;
  name: string;
  age: number;
  role: string;
  enabled: boolean;
  date: dayjs.Dayjs;
}
const editing = ref<number>();
const saving = ref(false);
const fail = ref(false);
const status = ref('');
let generation = 0;
const [Grid, api] = useVxeGrid<Row>({
  tableTitle: '行编辑 / 校验 / 保存与撤销',
  gridOptions: {
    height: 340,
    keepSource: true,
    rowConfig: { keyField: 'id' },
    editConfig: { trigger: 'manual', mode: 'row', autoClear: false },
    editRules: { name: [{ required: true, message: '请输入姓名' }] },
    data: Array.from({ length: 5 }, (_, i) => ({
      id: i + 1,
      name: `Member ${i + 1}`,
      age: 25,
      role: 'user',
      enabled: true,
      date: dayjs('2026-09-16'),
    })),
    columns: [
      { field: 'name', title: '姓名', minWidth: 150, editRender: { name: 'AntInput' } },
      {
        field: 'age',
        title: '年龄',
        width: 110,
        editRender: { name: 'AntNumber', props: { min: 0, max: 120 } },
      },
      {
        field: 'role',
        title: '角色',
        width: 150,
        editRender: {
          name: 'AntSelect',
          props: {
            style: { width: '100%' },
            options: [
              { label: '用户', value: 'user' },
              { label: '管理员', value: 'admin' },
            ],
          },
        },
      },
      {
        field: 'date',
        title: '日期',
        width: 180,
        formatter: 'formatDate',
        editRender: { name: 'AntDate' },
      },
      { field: 'enabled', title: '启用', width: 85, editRender: { name: 'AntSwitch' } },
      { title: '操作', width: 150, fixed: 'right', slots: { default: 'actions' } },
    ],
  },
});
async function edit(row: Row): Promise<void> {
  const grid = api.grid;
  if (!grid) return;
  generation++;
  if (editing.value !== undefined) {
    const previous = grid.getData().find((item) => item.id === editing.value);
    if (previous) await grid.revertData(previous);
  }
  editing.value = row.id;
  saving.value = false;
  await grid.setEditRow(row);
}
async function cancel(row: Row): Promise<void> {
  generation++;
  await api.grid?.revertData(row);
  await api.grid?.clearEdit();
  editing.value = undefined;
  saving.value = false;
  status.value = '已恢复原值';
}
async function save(row: Row): Promise<void> {
  const grid = api.grid;
  if (!grid || saving.value) return;
  const current = generation;
  try {
    if (await grid.validate(row)) return;
    saving.value = true;
    const payload = { ...row };
    await new Promise((resolve) => setTimeout(resolve, 350));
    if (current !== generation) return;
    if (fail.value) throw new Error('模拟服务端拒绝保存，可重试或取消');
    Object.assign(row, payload, { name: payload.name.trim() });
    await grid.reloadRow(row);
    await grid.clearEdit();
    editing.value = undefined;
    status.value = '保存成功';
  } catch (error) {
    if (current === generation) status.value = String(error);
  } finally {
    if (current === generation) saving.value = false;
  }
}
onBeforeUnmount(() => {
  generation++;
});
</script>
