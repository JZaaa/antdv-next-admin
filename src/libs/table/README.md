# VXE Table

一个 `useVxeGrid`、一个原生 VXE 查询所有者。面向 antdv-next，参考 Vben `df014ae70924b2af011de26d08082d7ebed787df` 的现代封装；按项目要求使用 **vxe-table 4.21.10**，参考仓库原安装版本为 4.21.2。

## 本项目使用

业务从 `@/adapters/table` 导入，自动接入 SchemaForm、中英文和主题。原有 ProTable 独立保留。

```vue
<template><Grid /></template>
<script setup lang="ts">
import { useVxeGrid } from '@/adapters/table';
interface Row {
  id: number;
  name: string;
}
interface Search {
  name: string;
}
const [Grid, api] = useVxeGrid<Row, Search>({
  tableTitle: '用户',
  formOptions: {
    schema: [{ fieldName: 'name', component: 'Input', label: '姓名', defaultValue: '' }],
  },
  gridOptions: {
    height: 400,
    columns: [
      { field: 'id', title: 'ID' },
      { field: 'name', title: '姓名' },
    ],
    rowConfig: { keyField: 'id' },
    pagerConfig: { pageSize: 20 },
    toolbarConfig: { refresh: true, search: true },
    proxyConfig: {
      ajax: {
        async query({ page }, search: Search) {
          // 业务 HTTP 客户端由宿主提供。返回结构可用 proxyConfig.response 改写。
          return { items: [{ id: page.currentPage, name: search.name }], total: 1 };
        },
      },
    },
  },
});
// api.grid 在挂载后可用；query/reload 都返回 Promise<void>。
</script>
```

示例路由 `/examples/vxe-table` 包含基础/列定制/插槽、远程查询/codec、五类编辑控件、保存失败重试/取消、树形、横纵虚拟滚动、已读持久化和导入导出。页面源码直接来自对应 `.vue` 文件。

## 独立复制与升级

复制整个 `src/libs/table` 目录，从复制后的 `table/index.ts` 导入。安装显式依赖：

```sh
npm install vue@3.5.42 antdv-next@1.5.4 dayjs@1.11.23 vxe-table@4.21.10 vxe-pc-ui@4.18.9 @vxe-ui/core@4.4.21 xe-utils@4.0.13
```

使用 Vue SFC/CSS 构建工具；需 Sass 编译 VXE 主题变量样式，例如 `npm install -D sass`。JS/CSS target 均设为 `chrome100`。不需要项目别名、Tailwind、全局组件、router、Pinia、HTTP 客户端或 Form 引擎。库自身导入组件与必要样式。

```ts
import { setupVxeTable, useVxeGrid } from './table';
const dispose = setupVxeTable({ locale: 'en-US', theme: 'dark' });
const [Grid, api] = useVxeGrid({
  gridOptions: {
    height: 300,
    columns: [{ field: 'id', title: 'ID' }],
    data: [{ id: 1 }],
  },
});
// 宿主应用卸载/HMR 时调用 dispose。重复 setup 会移除上一组全局监听。
```

`locale`、`theme` 接受值或 Ref。支持 zh-CN/en-US，包括 VXE 原生浮层。库无业务主题 store；宿主在适配器维护全局同步。一次覆盖升级以整个目录为单位，保留目录外的 adapter/业务代码，核对 compatibility.json、CHANGELOG，并重跑消费项目验收。

## API 和状态

| 接口                              | 行为                                                                                                                     |
| --------------------------------- | ------------------------------------------------------------------------------------------------------------------------ |
| `[Grid, api]`                     | 每次 hook 独立；同一 API 同时只挂载一个 Grid                                                                             |
| `grid`                            | 原生实例，挂载前/卸载后为 undefined                                                                                      |
| `formApi`                         | 宿主桥接的完整 Form API；无搜索/自定义完整 form slot 时为 undefined                                                      |
| `state/store/useStore(selector?)` | 同步状态、订阅仓库和只读计算选择器                                                                                       |
| `setState(object/updater)`        | 配置对象递归合并，数组替换并保留引用，null/undefined 回退旧值                                                            |
| `setGridOptions(options)`         | 更新原生配置，不深克隆 rows 或 columns                                                                                   |
| `setLoading(boolean)`             | 原生外部 loading；最终 loading 为外部 loading 或代理 loading                                                             |
| `query(params?)`                  | 原生 `commitProxy('query')`，保留当前页/排序/选择；错误记录后 resolve void                                               |
| `reload(params?)`                 | 原生 `commitProxy('reload')`，回首页并执行原生 clearAll，包括排序/选择等状态                                             |
| `toggleSearchForm(show?)`         | 返回显隐布尔值；只隐藏面板，保留草稿/提交条件，不请求                                                                    |
| 六个已读方法                      | clearViewedRows/getViewedKeys/isRowViewed/markKeysAsViewed/markRowAsViewed/removeViewedKeys；getViewedKeys 返回 Set 副本 |

`await query/reload()` resolve **不表示业务请求成功**。通过原生 querySuccess/queryError 获得业务结果。VXE 4.21.10 在 loading 中跳过新的 query/reload；没有排队、取消网络或最新请求胜出承诺。卸载后尚未返回的 query/queryAll 会进入 VXE 的失败处理分支，阻止对销毁实例写数据和调用已卸载的业务回调。

配置优先级：显式组件 attrs/props 按 wrapper 属性覆盖 API state；gridOptions 再覆盖 VXE 全局配置。slot 优先于标题/默认 empty/loading。初始 hook options 不做任意深 watch；动态更新使用组件绑定或 `setState`。`tableData: []` 会清空，undefined 表示不提供覆盖。`data`/tableData 与远程 proxy 不应同时作为权威数据源。

无分页配置时不显示分页器；声明 `pagerConfig` 后默认 pageSize=20、pageSizes=[10,20,30,50,100,200]，窄屏用精简布局。原生 formConfig 禁用，用 formOptions 或完整 form slot。只有原生工具按钮也可显示工具栏。列定制持久化需要表格 id 及稳定字段名，分组列也需要 field。

## 搜索桥接

Table 不导入 Form。`useVxeGrid(options, factory)` 第二参数可注入 `TableSearchFactory<F,A>`。工厂返回 component/api/getLatest/initialize/update/dispose。工厂仅在实际默认搜索区挂载时调用，隐藏不会重建；`formOptions: false` 卸载，再传对象重建。

`src/adapters/table-form.ts` 是公开组合示例：调用 SchemaForm 的公开 API；Table 中不创建第二个搜索快照。SchemaForm 的 `getLatestSubmissionValues` 是唯一已提交条件。分页、刷新、排序不会采用未提交草稿。提交必须通过校验；codec 输出用于查询。默认重置暂停 submitOnChange，等待 reset 和新快照后只 reload 一次。

用户显式 handleSubmit/handleReset 覆盖表格默认回调，按参考优先级处理，不自动链式追加请求。此时由回调自行决定查询。六种代理回调 query/querySuccess/queryError/queryAll/queryAllSuccess/queryAllError 都注入 `{...customValues,...latestSubmittedValues}`，过滤 Event 对象并保留其余参数和 this。

完整 `form` slot 替换默认表单时不会创建未挂载的 SchemaForm。该 slot 的调用方自行管理搜索状态，可通过 `api.reload(customValues)` 提交；原生首查不等待它。不宣称默认 formApi 对自定义 slot 可用。

## 插槽、格式化器和编辑

- `table-title`、`toolbar-actions`、`toolbar-tools`，工具栏 scope 透传。
- 其余原生单元格、表头、展开、编辑、empty/loading slots 透传。
- `form-*` 去掉前缀交给表单；操作区 reset-before/submit-before/expand-before/expand-after 使用不带前缀入口，同名带前缀 slot 让位。
- `formatDate` / `formatDateTime` 使用 Dayjs 默认时区；空值返回空串，非法值记录错误并返回原字符串。
- 宿主渲染器 CellImage/CellLink 对应 web-antdv-next；CellOperation 提供按钮/actionCodes 桥接。它是本项目宿主扩展，不包含 Vben playground 的整套下拉菜单、删除确认及图标协议。
- 宿主 AntInput/AntNumber/AntSelect/AntDate/AntSwitch 编辑器只在编辑时创建，使用 update 事件写值；Select/DatePicker 的 body 浮层不会被当成外部点击而关闭编辑。

`clearEdit` 只结束编辑。撤销用 keepSource + revertData；保存失败保留草稿，成功后 reloadRow 更新原始快照。示例用会话序号阻止取消后的旧保存回填。原生引擎可能直接修改传入行对象，要求不可变数据的业务自行提供可编辑副本。

## 已读持久化

boolean 或对象启用，keyField 默认 rowConfig.keyField 或 id。只接受现代 persist 对象：memory/localStorage/sessionStorage/indexedDB/custom。业务 key 应包含用户标识，模块不读取登录信息。viewedKeys 支持数组/Ref，增量合并；回调 rowClassName/rowStyle 与原行样式组合。CellOperation 的 actionCodes 递归覆盖分组子列，原业务回调一次。

默认 maxSize=100，正数 FIFO；0 表示不限。Web Storage TTL 对整份快照生效；IndexedDB 对每个标记保留原始过期时间，原子更新命名空间。memory 无跨实例恢复；custom 的 TTL 由调用者存储适配器负责。TTL 是存储恢复规则，不在已挂载内存集合里启动逐行计时器。keyField/persist 固定于实例首次启用，改变它们应重建实例。慢恢复与 mark/remove/clear 合并、写入串行，失败记录错误而不使表格失效。

## 原生导入导出边界

基础包支持 CSV/TXT/HTML/XML 及 HTML 打印内容。当前页和全量导出不同：全量需要 ajax.queryAll。XLSX/PDF 等插件格式、公式、透视及高级剪贴板不作为基础包能力承诺。

原生 CSV 使用 CRLF 换行，推荐消费 VXE 自身导出文件。传入 data 时 getData 可能返回输入数组；导入和原生 loadData 后读取 `getTableData().fullData`。实际打印对话框和打印设备由浏览器/操作系统控制。

## 验证

宿主 `scripts/table` 包含真实 Chrome 100 合约、独立复制、admin/user 示例及三组性能对照。环境和结果记录在 `docs/spec/vxe-table-acceptance.md` 与能力审计表中；源码可透传不自动意味着任意业务组合都已验证。
