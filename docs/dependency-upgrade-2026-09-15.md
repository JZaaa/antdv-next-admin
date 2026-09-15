# 2026-09-15 依赖升级记录

本次升级 56 个直接依赖。下表比较升级前后的实际安装版本，不将 package.json 的版本下限误认为原安装版本。package-lock.json 和 pnpm-lock.yaml 已同步，CodeMirror 与 Tiptap 的核心依赖已去重。

## 升级列表

| 依赖 | 升级前 | 升级后 |
| --- | --- | --- |
| `@antdv-next/icons` | 1.0.8 | 1.1.2 |
| `@codemirror/autocomplete` | 6.20.1 | 6.20.3 |
| `@codemirror/commands` | 6.10.3 | 6.11.0 |
| `@codemirror/lang-html` | 6.4.11 | 6.4.12 |
| `@codemirror/lang-markdown` | 6.5.0 | 6.5.2 |
| `@codemirror/language` | 6.12.3 | 6.12.4 |
| `@codemirror/lint` | 6.9.5 | 6.9.7 |
| `@codemirror/search` | 6.6.0 | 6.7.2 |
| `@codemirror/state` | 6.6.0 | 6.7.4 |
| `@codemirror/view` | 6.41.1 | 6.43.11 |
| `@iconify/vue` | 5.0.0 | 5.0.1 |
| `@milkdown/core` | 7.20.0 | 7.22.1 |
| `@milkdown/ctx` | 7.20.0 | 7.22.1 |
| `@milkdown/plugin-block` | 7.20.0 | 7.22.1 |
| `@milkdown/plugin-clipboard` | 7.20.0 | 7.22.1 |
| `@milkdown/plugin-history` | 7.20.0 | 7.22.1 |
| `@milkdown/plugin-listener` | 7.20.0 | 7.22.1 |
| `@milkdown/plugin-prism` | 7.20.0 | 7.22.1 |
| `@milkdown/plugin-slash` | 7.20.0 | 7.22.1 |
| `@milkdown/plugin-tooltip` | 7.20.0 | 7.22.1 |
| `@milkdown/plugin-upload` | 7.20.0 | 7.22.1 |
| `@milkdown/preset-commonmark` | 7.20.0 | 7.22.1 |
| `@milkdown/preset-gfm` | 7.20.0 | 7.22.1 |
| `@milkdown/theme-nord` | 7.20.0 | 7.22.1 |
| `@milkdown/transformer` | 7.20.0 | 7.22.1 |
| `@milkdown/vue` | 7.20.0 | 7.22.1 |
| `@tiptap/extension-image` | 3.22.5 | 3.31.3 |
| `@tiptap/extension-link` | 3.22.5 | 3.31.3 |
| `@tiptap/extension-placeholder` | 3.22.5 | 3.31.3 |
| `@tiptap/starter-kit` | 3.22.5 | 3.31.3 |
| `@tiptap/vue-3` | 3.22.5 | 3.31.3 |
| `@uiw/codemirror-theme-dracula` | 4.25.9 | 4.25.11 |
| `@uiw/codemirror-theme-github` | 4.25.9 | 4.25.11 |
| `@uiw/codemirror-theme-material` | 4.25.9 | 4.25.11 |
| `@uiw/codemirror-theme-monokai` | 4.25.9 | 4.25.11 |
| `@uiw/codemirror-theme-nord` | 4.25.9 | 4.25.11 |
| `@uiw/codemirror-theme-solarized` | 4.25.9 | 4.25.11 |
| `@uiw/codemirror-theme-tokyo-night` | 4.25.9 | 4.25.11 |
| `@uiw/codemirror-themes` | 4.25.9 | 4.25.11 |
| `axios` | 1.15.2 | 1.18.1 |
| `dayjs` | 1.11.20 | 1.11.23 |
| `echarts` | 6.0.0 | 6.1.0 |
| `pinyin-pro` | 3.28.0 | 3.29.4 |
| `vue-echarts` | 8.0.1 | 8.3.0 |
| `vue-i18n` | 11.3.0 | 11.4.10 |
| `vue-router` | 5.0.6 | 5.3.1 |
| `@antdv-next/auto-import-resolver` | 1.1.0 | 1.2.0 |
| `@faker-js/faker` | 10.4.0 | 10.6.0 |
| `@vitejs/plugin-vue` | 6.0.5 | 6.0.9 |
| `oxlint` | 1.62.0 | 1.83.0 |
| `sass` | 1.98.0 | 1.104.1 |
| `unplugin-auto-import` | 21.0.0 | 21.1.0 |
| `vite` | 8.0.10 | 8.3.0 |
| `vite-plugin-mock-dev-server` | 2.1.1 | 2.4.2 |
| `vitest` | 4.1.8 | 4.1.11 |
| `vue-tsc` | 3.2.7 | 3.3.11 |

## 保留与适配

- Axios 升至 1.18.1，使用 ~1.18.1 限制在 1.18.x。1.19 起的响应类型定义与现有泛型请求封装不兼容，1.19/1.20 留待单独适配。
- 保留 Pinia 3.0.4、TypeScript 6.0.3、oxfmt 0.43.0、PostCSS 8.5.12、Tailwind CSS 3.4.19 和 vuedraggable 4.1.0。Vitest 保持 4.x，未升级至 5.x。
- Vue 3.5.42 与 antdv-next 1.5.4 保持原版本。
- 编辑器将 lineNumbers/foldGutter 导入改为 createLineNumbers/createFoldGutter 别名，修复新版 Oxlint 的同名检查错误；组件属性和行为不变。
- Sass 新版将部分 RGB 小数输出为百分比。颜色测试的解析器增加百分比支持，颜色数值及透明度断言不变。百分比 RGB 兼容 Chrome 100。

## Chrome 100 验证

- 保持 Vite build.target 和 build.cssTarget 为 chrome100，Browserslist 为 Chrome >= 100，Tailwind 保持 3.4.19。
- 未修改兼容检查规则或添加兼容性例外。
- npm run check:ci 通过：源码与配置兼容检查、类型检查、Lint、35 个测试文件共 149 项测试、生产构建及 CSS 检查、Demo 构建及 CSS 检查。
- 额外扫描 Demo 产物的 322 个 JavaScript 文件：与升级前现有 dist 的扫描相比，21 处命中仍属于原有 Vue 数组方法封装、自定义 union/intersection 方法以及 antdv-next 按钮 color-mix 字符串，没有新增命中。该有限规则扫描不等同于完整浏览器兼容证明。
- vue-router 的 View Transition 调用有能力检测，Chrome 100 会走既有导航逻辑。
- pnpm 10 的 frozen-lockfile 校验通过；npm 锁文件的所有直接依赖版本与本地安装版本一致。
- Lint 仍报告 10 个非阻断警告；Vite 提示未来主版本的原生配置加载要求，当前构建成功。

浏览器连接因 Codex auth token is unavailable 不可用，未完成真实 Chrome 100 的登录、权限、主题、编辑器和图表页面回归。自动检查已通过，但不能据此宣称真实 Chrome 100 回归已完成。

check:ci 最终保留的是 Demo 构建产物。
