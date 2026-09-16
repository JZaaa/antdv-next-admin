# 开发与验收脚本

这些脚本用于开发检查、浏览器回归、专项对照和报告生成，不进入业务页面的运行代码。现有 npm 命令名保持不变。

## 目录与用途

| 文件 | 用途 | 输入与输出 |
| --- | --- | --- |
| `compat/check-chrome100.mjs` | 兼容检查入口 | 检查最终 Vite 配置、Browserslist、Tailwind 3 和源码；`--dist` 追加静态 CSS 检查 |
| `compat/chrome100-rules.mjs` | JS、Vue、CSS 的具体检查规则 | 被检查入口和单元测试引用，不单独执行 |
| `compat/chrome100-exceptions.json` | 精确兼容例外 | `file + rule + code` 精确匹配，`reason` 必填；未命中的过期例外会失败 |
| `form/check-form-engine-lab.mjs` | 浏览器验收入口 | 启动本地 Vite/preview 和独立无头 Chrome，生成 `docs/spec/*results.json`、截图及失败诊断 |
| `form/schema-form-example-scenario.mjs` | 集成页面场景 | 登录、回填、提交、动态字段、弹窗会话、查询、四语言和窄屏；由浏览器入口调用 |
| `form/schema-form-documentation-scenario.mjs` | 文档页面场景 | 示例交互、展示源码一致性、能力表、字段宽度、开关和校验提示；由浏览器入口调用 |
| `form/check-schema-form-standalone.mjs` | 独立复制构建 | 将 `src/libs/form` 复制到临时目录，生成 `dist/schema-form-standalone` 后清理临时源目录；不执行浏览器验收 |
| `form/compare-vben-form-runtime.mjs` | Vben 行为和 API 性能对照 | 读取本地 Vben，输出 `vben-form-runtime-contract-comparison.json` 和 `vben-form-runtime-comparison.json` |
| `form/reference-source.mjs` | 读取 Vben 来源 | 读取实际仓库路径、HEAD、form-ui 版本和工作区是否有修改；供对照和报告脚本使用 |
| `form/generate-schema-form-audit.mjs` | 生成能力核对文档 | 读取 `reference.ts`、Vben 仓库及 `docs/spec/vben-form-reference.html`，覆盖核对 Markdown 和 JSON |
| `form/summarize-schema-form.mjs` | 汇总性能及静态 JS 体积 | 读取性能 JSON、独立构建 manifest 和 JS，覆盖 `schema-form-performance-summary.json` |
| `form/performance-report.mjs` | 性能报告校验与聚合 | 要求生产模式、四个组合各三轮、每轮 30 个有效原始样本和原测试环境；由汇总脚本及单元测试引用 |

## 环境

- 安装项目依赖，使用 Node.js 22.18+ 或 Node.js 24；报告生成器直接导入 TypeScript，需要 Node 原生类型剥离支持。
- 浏览器入口优先使用 `FORM_LAB_CHROME`。未指定时查找常见 Windows Chrome/Edge、Linux Chrome/Chromium、macOS Chrome 路径。
- 要验收 Chrome 100，必须明确指定对应可执行文件；使用其他 Chrome 版本的结果不能当成 Chrome 100 实测。
- `VBEN_SOURCE` 指定 Vben 源码仓库，默认查找本项目的同级目录 `vue-vben-admin`。运行时对照还需要 Vben 仓库安装所需依赖。
- `docs/spec` 是生成报告目录，部分专项工具需要已有输入快照；它在当前 `.gitignore` 中被忽略，需要分享报告时请单独保存。

PowerShell 示例：

```powershell
$env:FORM_LAB_CHROME = 'E:/chrome-history/chrome-100/chrome.exe'
$env:VBEN_SOURCE = 'D:/www/vue/vue-vben-admin'
```

## 常规检查

```sh
npm run check:compat
npm run type-check
npm run lint
npm run test:unit:run
npm run build
npm run check:compat:dist
```

兼容检查覆盖有限的高风险规则，不自动证明所有依赖、CSS-in-JS 和动态 API 都兼容。当前两条例外是 Zod `z.union` 与新 Set API 同名导致的误报，不提供 polyfill。详细边界见 [Chrome 100 检查说明](../docs/chrome-100-ci.md)。

## 表单浏览器验收

按顺序构建：完整应用构建会清空 `dist`，因此实验页和独立宿主必须在它后面构建。

```sh
npm run build:demo
npm run lab:form:build
npm run check:form:standalone
npm run lab:form:check -- --schema
npm run lab:form:check -- --documentation
npm run lab:form:check -- --documentation --user
npm run lab:form:check -- --standalone
```

- 实际页面使用 Demo 构建提供模拟登录接口；普通 `build` 指向真实后端，直接预览可能无法登录。
- `--example` 只运行集成示例；`--documentation` 还会运行完整文档场景。
- `--dev` 可运行开发服务下的组件或页面场景，不支持独立宿主；性能汇总要求生产构建。
- 默认无场景参数运行原生引擎实验；`--tanstack` 运行 TanStack 实验。它们用于专项研究，`--require-capabilities` 可将能力缺口视为失败，`--require-guards` 要求补偿场景通过。
- SchemaForm、实际页面及独立宿主的缺口、执行错误、浏览器异常、console.error 都使命令失败。

上述表单专项流程均为手动执行，不接入 Build 或 Pages 自动 CI。两个工作流的单元测试也通过 `--exclude '**/*form*.spec.ts'` 排除表单测试，包含 SchemaForm、ProForm、表单会话及报告脚本测试；新增表单测试文件名需包含 `form`。浏览器报告保存实际版本、执行结果和截图，失败时尽量保存错误诊断。项目整体构建、类型、Lint 和 Chrome 100 静态检查仍正常检查完整源码。

## 专项报告

```sh
node scripts/form/compare-vben-form-runtime.mjs
node scripts/form/generate-schema-form-audit.mjs
npm run lab:form:check -- --performance
node scripts/form/summarize-schema-form.mjs
```

汇总器默认读取 `docs/spec/schema-form-performance-chromium100-results.json`。其他浏览器版本可显式传入项目根目录相对路径：

```sh
node scripts/form/summarize-schema-form.mjs docs/spec/schema-form-performance-results.json
```

报告记录规则：

- 能力表来自人工维护的 `reference.ts`。生成器记录生成时实际 Vben 版本和工作区状态，不会自动重新核验每项能力。
- 运行时对照包含 API 行为与 100/300 字段的赋值、快照、重置测量，不包含真实控件、DOM、布局及绘制，不能推导整个项目的加速倍数。
- 浏览器性能报告在测量进程中记录机器、Node、开始时间及浏览器版本；汇总原样保留这些信息，同时记录源报告时间及 SHA-256。
- 缺少来源信息的旧报告、失败场景、缺轮次、重复轮次、缺原始样本或无效耗时都拒绝汇总，需要重新测量。
- 静态 JS 体积是当前独立宿主入口及其静态依赖闭包，包含 Vue、antdv-next、TanStack 和示例启动代码，排除动态加载块及 CSS。它不是表单库增量体积；单独记录体积测量时间、manifest 和文件哈希，不能冒充性能测试时的构建产物。

手动执行 `npm run test:unit:run` 仍运行全部单测（含表单）；现有 `check:ci` 本地命令保持不变。不要手工修改生成报告来替代重新验收。

## VXE Table 专项验收

```sh
npm run check:table:project
npm run lab:table:reference:build
npm run lab:table:check
npm run lab:table:check -- --standalone
npm run lab:table:check -- --standalone-form
npm run lab:table:check -- --example
npm run lab:table:check -- --example --user
npm run lab:table:check -- --reference
npm run lab:table:check -- --performance
npm run lab:table:check -- --performance-controls
npm run check:table:report
```

`check:table:project` 串行执行类型、Lint、全部单测、生产/Demo 构建及兼容检查，最后构建 Table lab 和独立复制宿主。主项目构建会清空 dist，必须先运行；完成后不要在浏览器验收中途重新构建主项目。性能两组应独占运行，避免与构建或其他浏览器检查争用资源。

默认浏览器为 `E:/chrome-history/chrome-100/chrome.exe`，可通过 `TABLE_LAB_CHROME` 指定。参考源码默认相邻 `vue-vben-admin`，可用 `VBEN_SOURCE` 指定。参考构建直接导入真实 Vben wrapper，使用相同目标 VXE 版本，输出在 node_modules/.cache/table-reference。源码原有 Tailwind 指令的警告仅来自参考对照，不属于目标生产 CSS。

报告写入 docs/spec/vxe-table-*，含检查日志、浏览器版本、场景、截图、逐轮性能样本、依赖和源码哈希。汇总要求所有项目检查及 Chrome 100 浏览器报告通过；能力映射为维护的用例索引，不等同于验证任意业务组合。上述专项流程手动执行，不修改现有 CI。
