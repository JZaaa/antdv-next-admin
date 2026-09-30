# 公共框架性能优化落地说明

本次将独立验证项目 `eam-next-antdv` 中已保留的公共优化同步到 `antdv-next-admin`。日期：2026-09-24。

目的：减少所有接入页面共同承担的启动、布局、表格和表单更新成本，并改善点击后的反馈。此次同步不代表原框架已完成低性能电脑验收，也不等同于正式系统全部页面已经达标。

## 同步范围与边界

- 保留原项目认证、权限、动态菜单、路由、环境配置及依赖版本。
- 不引入测试超级管理员、EAM 固定数据、性能测试路由或供应商/位置类型业务页面。
- 不修改 VXE 原生方法，不安装 `reset-guards`，不修改 `node_modules` 中的组件源码。
- 不修改 Pro Table / Pro Form，不统一表格高度、不减少分页数据、不关闭整行高亮。
- 保留页面动画选择、KeepAlive、主题、水印、可选 AI 面板、表格原生 reload 与校验等公共能力。

## 具体优化

### 1. 公共布局按功能测量

文件：`src/components/Layout/AdminLayout.vue`。

AI 面板未激活时，不创建工作区尺寸观察器；激活后直接使用 `ResizeObserverEntry.contentRect.width`，避免收到尺寸通知后再次读取 DOM 布局。垂直布局不调度横向菜单宽度计算；横向/垂直切换后，菜单观察器重新绑定实际 DOM。

水印关闭时不挂载其组件，避免创建画布和观察器。开启时使用独立固定覆盖层，保持覆盖视口和不拦截点击，切换水印不重建业务页面。水印仍属于界面显示功能。

### 2. 页面过渡减少串行等待

文件：`src/composables/usePageTransition.ts`、`AdminLayout.vue`。

使用 Web Animations API 对进入页执行 200ms 的 opacity/transform 动画，取消 `mode="out-in"` 等待旧页退出的阶段以及 Vue CSS 动画检测。保留配置项、缓存页面和 `prefers-reduced-motion`；快速切换或卸载时取消当前动画。

视觉时序有调整：旧页不再先播放退出动画再显示新页；进入动画仍保留。设置为 none 或系统要求减少动态效果时直接完成。不是将所有动画关闭来获取性能结果。

### 3. 启动偏好提前、全局控件按需创建

文件：`src/App.vue`、`src/components/Global/defaultComponentProps.ts`。

主题、主色、灰色模式和水印在 `onBeforeMount` 初始化，使子控件首次渲染就使用正确偏好，减少挂载后第二轮更新。共享会话监听与身份检查保留原挂载时序；会话变化弹窗仅在需要时挂载，保留刷新恢复入口。

全局选择器、日期和日期范围默认属性包装使用异步组件加载，仍透传原有属性、事件和插槽。异步加载减少非必要的首屏负担，不会消除首次使用控件的成本。

### 4. 公共 Table 合并重复布局与 loading 更新

文件：`src/libs/table/useVxeGrid.ts`、`src/libs/table/types.ts`、`src/adapters/table.ts`。

- 删除封装层 `onActivated` 中重复的 `recalculate`，由 VXE 自己处理首次布局和缓存激活。
- 在项目适配器中默认按 100ms 合并容器尺寸变化，尺寸真实变化后调用公开 `recalculate(true)`。同时观察外层容器和 VXE 表格自身，分别记录尺寸，保留内部左右插槽改变表格可用宽度时的重算。保留窗口事件和必要重算。
- 项目适配器默认将代理请求 loading 延迟 120ms 显示，减少短请求反复挂载 loading；忙碌状态和请求流程继续由 VXE 处理。
- 延迟 loading 独立作为展示属性传入，避免仅指示器变化就重新生成 pager/proxy/toolbar 配置。
- 调用者显式设置的 loading 和 `proxyConfig.showLoading: false` 继续按配置处理。

参数放在 `useVxeGrid` 第一层，和 `gridOptions` 同级：

```ts
const [Grid, gridApi] = useVxeGrid({
  resizeDelayMs: 100,
  loadingDelayMs: 120,
  gridOptions: {
    // 按页面容器布局决定高度，不要求 600px。
    columns,
  },
});
```

将 `resizeDelayMs: 0` 设为原生观察方式，将 `loadingDelayMs: 0` 设为立即显示 loading。直接使用 `src/libs/table` 的核心入口时默认仍是 0；上述默认值来自项目适配器。调用者设置 `autoResize: false` 时不创建替代尺寸观察器。

### 5. 表格公共控件加载与操作单元格边界

文件：`src/libs/table/core/init.ts`、`src/libs/table/core/vxe-optional.ts`、`src/libs/table/core/vxe-subpaths.d.ts`、`src/adapters/table-renderers.ts`。

VXE UI 从具体模块引入基础组件与控制器，其他组件通过完整名称注册表按需加载；保留主题、弹层、打印和图片预览相关控制器。ES 子路径缺少声明，通过 `vxe-subpaths.d.ts` 重导出上游公开类型，不使用空声明或 any 掩盖错误。依赖锁定为当前版本，升级时需要复查导出路径、注册表与功能。

操作按钮使用稳定的 Vue 组件边界，继续使用 Ant Button 和原配置、动态属性、回调；日期编辑器按需加载。不带入验证项目新增的 EAM 状态/标签渲染器，也未采用收益不稳定的 `v-memo` 实验。

补齐按需注册表中的 `VxeCheckboxButton`（按钮式复选）与 `VxeRadioButton`（按钮式单选），保持从完整入口切换为子路径加载后的控件可用性；二者仍在首次使用时加载，复用已有公开类型声明，不新增依赖。

### 6. SchemaForm 避免无关字段更新和重复测量

文件：`src/libs/form/core/api.ts`、`render.ts`、`runtime.ts`、`controls.ts`。

- schema/commonConfig 引用未变时，不重建字段注册表；按钮、语言和布局配置继续由渲染层消费。
- 字段使用稳定的布局、语言和 schema 投影，按钮配置变化不再让所有输入框重新更新。
- 表单默认值在首个子控件渲染前准备，保留 ready/mount 生命周期；初始化 attach 保证幂等。
- 固定宽度标签和纵向布局跳过文本宽度测量；自动标签宽度仍保留测量。
- 折叠先批量读取位置，再写入折叠样式，避免逐字段交替读写布局。
- 布局监听采用多个独立 getter，实际输入变化才调度测量，避免仅因返回一个新数组而触发。
- 非必需的评分、滑块、自动完成、提及和 OTP 等控件按需加载。

业务应通过公开 API 更新 schema/commonConfig，保持不变配置的引用稳定。实际字段、依赖、校验或布局变化仍应正常更新，不能为了性能跳过必要更新。

### 7. 提交/重置反馈与查询一致性

文件：`src/libs/form/internal/feedback-paint.ts`、`core/api.ts`、`core/render.ts`、`src/adapters/table-form.ts`。

用户点击提交或回车时先设置 submitting，再让出绘制机会，随后校验和提交；程序调用和自动防抖提交保持原调度方式。重置按钮增加忙碌反馈与重复点击保护。隐藏文档不等待绘制，前台提供超时兜底；提交和重置的绘制等待均由 API 检查生命周期代次，关闭或重新挂载表单后取消旧操作，避免旧重置等待下一次挂载并清除新数据。无事件的程序化 `resetByButton()` 不增加绘制等待。

表格搜索重置在恢复自动提交配置后执行一次 reload。暂停值通知期间仍更新比较基线，修复“重置后再次输入相同查询条件不再查询”的问题。

反馈更早不等于查询完成更快，两个指标必须分别观察。

## 高度与虚拟滚动

此次没有把表格高度固定为 600px。该高度仅是原独立项目的对比条件；本项目公共配置仍是 `minHeight: 180`，各页面继续决定自己的高度与虚拟滚动策略。

需要填满剩余空间时，应让父容器具有明确的可用高度，再使用 VXE 支持的自适应高度方案；同时验证窗口缩放、搜索区折叠、侧栏变化和缓存激活。不能将固定高度测试的性能数据直接当作自适应高度的验收结果。

## 性能证据与未采用方案

以下为来源项目的实验室结果，非本次原框架重新测得：

- 30 个真实 Ant Input，仅更新按钮配置时，输入框更新次数由每轮 30 次降为 0 次；不代表首次挂载等比例提速。
- 手动提交的下一次绘制机会中位数约 356ms → 62ms，查询完成中位数约 1.87s → 1.92s。这是反馈改善，不是查询吞吐提升。
- 原生 VXE 与公共封装同配置、整行高亮开启时，勾选中位数约 315ms / 325ms。说明该场景封装额外成本较小，不证明所有表格成本均来自 VXE。
- VXE 空状态清理补丁、cssVar、自定义 loading 动画、公共分包合并、操作单元格 v-memo 均未同步。前者超出不修改 VXE 行为的边界，其余没有稳定净收益。

来源项目采用生产 build、100 条本地数据、20 条分页、动画开启、Chrome 154、1×/6× CPU 降速。冷操作只有 3 轮；下一次绘制机会不等于 INP，内容就绪不等于 LCP；CPU 降速不模拟低内存和老旧 GPU。

来源最终结果仍有未达标项：6× CPU 下首次供应商页 3.488s、手动查询 1.933s、重置查询 1.337s。不能据此声明“换框架即可解决客户电脑卡顿”。

## 本项目验证记录

本次没有重跑原框架优化前后性能计时，完成的是代码移植、静态检查与功能回归。检查日志、文件指纹、浏览器结果和截图保存在 `docs/spec/framework-performance-sync/`。

| 检查                            | 结果                                                                       |
| ------------------------------- | -------------------------------------------------------------------------- |
| 同步前应用类型检查              | 通过                                                                       |
| 同步后应用与构建配置类型检查    | 通过；首次缺少 VXE 子路径声明，补齐上游类型重导出后复查通过                |
| lint                            | 通过，仍有既有警告                                                         |
| 正式 production build           | 通过，输出仍为 `dist`                                                      |
| 独立 Demo production build      | 通过，输出 `.tmp/performance-sync-demo`；用于正常登录回归，不覆盖正式 dist |
| Chrome 100 源码和产物兼容检查   | 通过                                                                       |
| 同步前全量单测                  | 46 个套件通过、4 个套件失败；285 项通过、5 项失败                          |
| 同步后全量单测                  | 46 个套件通过、4 个套件失败；288 项通过、5 项失败；新增 3 项回归通过       |
| Chrome 154.0.8037.58 浏览器回归 | 82 项通过，未捕获运行错误                                                  |
| Chrome 100.0.4896.0 浏览器回归  | 82 项通过，未捕获运行错误                                                  |

全量单测未通过：`layout-header-slots`、`login-navigation` 的既有 Windows `file:///logo.png` 导入错误；`auth-dependency-integration` 的 3 项持久化断言失败；`redirect-locale` 的 2 项翻译键断言失败。同步前后的失败项一致，本次没有修改认证、路由或这些失败测试来凑绿。

两版本浏览器均通过原项目 admin/user 正常登录后的表格及表单示例。覆盖编辑、日期/选择器弹层、树形/虚拟滚动、搜索、主题和窄屏，以及分组数组、依赖、校验、公开 API 等现有示例场景。布局回归覆盖系统深色启动/实时变化、水印覆盖与切换不重建页面、AI 拖拽/窄屏、横向和垂直菜单观察器重绑、8 种动画配置、减少动态效果和会话恢复弹窗。检查并非全量业务穷尽验证，也没有新增特定性能测试页面。

浏览器测试使用项目既有 Demo mock 登录接口与原认证/权限代码；不跳过权限，不接触真实后端。测试脚本为 `scripts/performance/check-framework-sync.mjs`，仅供开发验证，未被应用入口引用。截图已抽查横向布局和窄屏示例。

复现浏览器回归：先安装或提供测试专用 Playwright，使用项目本地 Chrome。若 Playwright 安装在其他工具目录，可将 `PLAYWRIGHT_PACKAGE` 指向该安装的 `playwright/package.json`，不需要改生产依赖。

```powershell
node node_modules/vite/bin/vite.js build --mode demo --outDir .tmp/performance-sync-demo
$env:SYNC_CHROME='C:/Program Files/Google/Chrome/Application/chrome.exe'
node scripts/performance/check-framework-sync.mjs
$env:SYNC_CHROME='E:/chrome-history/chrome-100/chrome.exe'
node scripts/performance/check-framework-sync.mjs
```

原框架的认证、路由、配置、依赖锁和 Vite 配置同步前后 SHA-256 已核对一致；具体文件清单见 `docs/spec/framework-performance-sync/sync-audit.json`。未同步测试账号绕过、固定数据、600px 业务页面配置、VXE 补丁或无效实验。

## 审查后的回归修复

审查中复现并修复了两处行为回归：原替代观察器只观察外层容器，遗漏内部左右插槽改变表格自身宽度；重置的绘制等待未检查生命周期，关闭后旧重置可能在下次挂载继续执行。

新增 `scripts/performance/check-framework-regressions.mjs`，使用独立生产构建的测试页面验证上述场景，不注册应用路由、不使用登录账号、不访问后端，也不依赖 Playwright。覆盖内部尺寸变化、`autoResize: false`、宽度恢复、快慢重新挂载、重置防连击和正常重置，共 7 项。Chrome 154.0.8037.58 和 Chrome 100.0.4896.0 均通过；报告位于 `docs/spec/framework-performance-sync/regressions-*.json`。

```powershell
node scripts/performance/check-framework-regressions.mjs
$env:SYNC_CHROME='E:/chrome-history/chrome-100/chrome.exe'
node scripts/performance/check-framework-regressions.mjs --skip-build
```

修复后类型检查、lint（仍有既有警告）、正式生产构建及 Chrome 100 源码/产物兼容检查通过。新增 3 项表单单测通过；全量单测为 46 个套件通过、4 个套件失败，291 项通过、5 项失败，失败项与前述记录相同。本轮验证确认功能修复，不是性能基准复测。

## 后续接入与复测

1. 执行类型检查、lint、相关单测、生产 build 和 Chrome 100 源码/产物兼容检查。
2. 使用原项目正常登录、权限和菜单，验证表格编辑、筛选、翻页、原生 reload、树形/固定列、慢请求和失败请求，以及表单依赖、动态 schema、校验、重置和关闭取消。
3. 验证 8 种动画与减少动态效果、横向/垂直布局、缓存标签、水印、主题初始化与可选 AI 面板。
4. 性能采样使用生产产物，串行运行，构建和功能测试不并行；记录浏览器、机器、CPU 降速、数据量、分页和高度。分别记录首次访问、缓存访问、反馈与内容完成时间。
5. 最终在客户最低配置电脑及实际浏览器上验收。若公共优化后仍超标，评估 VXE 官方版本或替代组件，不能直接跳过原生必要重算。
