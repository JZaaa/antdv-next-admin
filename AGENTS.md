# Antdv Next Admin 开发指南

本文面向在本仓库中工作的开发者和智能体。修改前先了解相关模块的实现，沿用已有封装和约定；涉及命令、配置或依赖版本时，以 `package.json` 和实际配置文件为准。

## 项目概况

这是基于 Vue 3、TypeScript、Vite 和 `antdv-next` 的后台管理脚手架，使用 Pinia 管理状态、Vue Router 管理路由，提供 RBAC 权限、主题切换、中文和英文国际化，以及开发和演示用的模拟接口。样式基于 Tailwind CSS 3.4，编辑器包括 CodeMirror 6 等。

组件库从 `antdv-next` 导入，图标使用项目已有的图标封装或 `@antdv-next/icons`。新增功能前先检查现有组件、组合式函数和工具函数，避免重复实现。

## 目录与职责

| 目录或文件 | 职责 |
| --- | --- |
| `src/api/` | 按业务领域组织接口调用 |
| `src/assets/styles/` | 全局样式、主题变量和动画 |
| `src/components/` | 布局及可复用业务组件 |
| `src/composables/` | 组合式函数，例如权限、全屏和水印逻辑 |
| `src/directives/` | Vue 自定义指令，包括权限指令 |
| `src/stores/` | Pinia 状态，按认证、权限、主题、页签等领域划分 |
| `src/router/` | 路由定义、导航守卫和动态路由处理 |
| `src/locales/` | `zh-CN`、`en-US` 翻译和国际化初始化 |
| `src/types/`、`src/constants/` | 共享类型和常量 |
| `src/utils/` | 请求、缓存、存储、国际化等工具 |
| `src/views/` | 按路由组织的页面 |
| `src/libs/form/`、`src/libs/table/` | 表单和表格库，修改前阅读各自的 README |
| `src/adapters/` | 项目适配层 |
| `src/settings.ts` | 应用默认设置，包括认证配置 |
| `mock/data/`、`mock/handlers/` | 开发环境模拟数据及接口处理器 |
| `src/mock/` | 静态演示所需的浏览器端模拟接口 |
| `tests/unit/` | 已接入 Vitest 的单元测试 |
| `tests/e2e/` | Playwright 测试模板，尚未安装对应依赖 |
| `build/`、`scripts/`、`labs/` | 构建支持、检查脚本和专项实验入口 |
| `docs/` | 设计说明、配置说明和验收文档 |

## 开发与检查命令

CI 使用 `pnpm-lock.yaml` 安装依赖，本地需要复现 CI 时运行 `pnpm install --frozen-lockfile`。已有依赖时，可直接使用下面的 `npm run` 命令。调整依赖时遵循仓库锁文件约定，避免无关的锁文件变化。

| 命令 | 用途 |
| --- | --- |
| `npm run dev` | 启动开发服务，默认地址为 `http://localhost:3000` |
| `npm run type-check` | 使用 vue-tsc 检查应用，再使用 tsc 检查 Node 与构建配置；不自动修复 |
| `npm run lint` | 使用 Oxlint 检查 `src/` 和 `mock/` |
| `npm run lint:fix` | 自动修复可修复的 Lint 问题 |
| `npm run format` | 使用 Oxfmt 格式化 `src/` 和 `mock/` |
| `npm run format:check` | 检查上述目录的格式 |
| `npm run test:unit` | 以监听模式运行单元测试 |
| `npm run test:unit:run` | 运行一次全部单元测试 |
| `npm run build` | 生产构建，输出到 `dist/`，不包含类型检查 |
| `npm run build:check` | 类型检查通过后执行生产构建 |
| `npm run build:demo` | 静态演示构建，启用浏览器端模拟接口 |
| `npm run build:demo:check` | 类型检查通过后执行演示构建 |
| `npm run preview` | 预览已有构建产物 |
| `npm run check:compat` | 检查 Chrome 100 构建配置及部分高风险源码用法 |
| `npm run check:compat:dist` | 在兼容检查基础上检查 `dist/` 中的 CSS，需先构建 |
| `npm run check:ci` | 依次执行兼容、类型、Lint、全部单测、生产及 Demo 构建，并检查两次构建的 CSS |

`check:ci` 最后留下的是 Demo 产物。部署真实后端版本前，应重新执行 `npm run build` 和 `npm run check:compat:dist`。

表单、表格的实验页、独立复制验证、浏览器回归和性能报告使用专项脚本，执行顺序及环境要求见 `scripts/README.md`。完整应用构建会清空 `dist/`，应先构建主项目，再生成实验页和独立宿主，避免覆盖待验收产物。

## 编码约定

### 格式与导入

以 `.editorconfig` 和 `.oxfmtrc.json` 为准：UTF-8、LF 换行、2 个空格缩进、文件末尾保留换行；使用单引号、分号和尾随逗号，格式化行宽为 100。不要为局部修改顺带格式化无关文件。

导入由 Oxfmt 排序，分组之间保留空行，顺序为：类型导入、Node 内置及第三方值导入、项目内部导入、相对路径导入。项目内部路径优先使用 `@/`，它对应 `src/`。

```ts
import type { User } from '@/types/auth';

import { message } from 'antdv-next';
import { computed, ref } from 'vue';

import { getUserInfo } from '@/api/auth';
import { useAuthStore } from '@/stores/auth';
```

### TypeScript 与命名

- 保持严格类型检查；应用和构建侧配置分别在 `tsconfig.app.json`、`tsconfig.node.json`。
- 公共函数和组合式函数显式声明返回类型；共享类型放在 `src/types/`，模块专用类型靠近使用位置。
- 禁止用 `as any`、`@ts-ignore` 或 `@ts-expect-error` 绕过类型问题，应修复数据契约或类型收窄逻辑。
- 可复用组件文件使用 PascalCase，例如 `NotificationPanel.vue`；页面按路由建目录，入口使用 `index.vue`。
- 组合式函数使用 `useXxx.ts`；store 按领域命名，例如 `auth.ts`、`theme.ts`。
- 类型和接口使用 PascalCase，函数使用 camelCase，常量使用 SCREAMING_SNAKE_CASE。

### Vue 与状态管理

组件使用组合式 API 和 `<script setup lang="ts">`，通常按模板、脚本、样式组织。Props 和 Emits 声明类型，Props 默认值使用 `withDefaults`；局部样式使用 `scoped`，全局主题样式放到统一样式层。

脚本按导入、Props/Emits、状态和派生值、方法等组织，方法优先使用函数声明。Pinia 仅使用 Setup Store：`ref` 保存状态、`computed` 表达派生值、函数承载操作；每个 store 负责一个业务领域。

新增界面文案需同时考虑 `src/locales/zh-CN.ts` 和 `src/locales/en-US.ts`。涉及主题的样式沿用项目变量，检查明暗主题下的显示效果。

### 接口与错误处理

接口调用放在 `src/api/`，复用 `src/utils/request.ts` 的请求及拦截器处理。异步操作应妥善处理失败：在负责该操作的边界使用 try/catch，提供有意义的错误信息，并恢复加载等界面状态。

用户提示使用 `antdv-next` 的 `message.error()` 或 `notification.error()`；先确认请求层是否已提示，避免同一次失败重复弹出消息。不要吞掉错误或把失败当成成功继续执行。

## 认证、权限与路由

权限判断复用 `usePermission()` 和权限指令，不在页面中另写一套角色或权限规则。

```vue
<!-- 单个权限 -->
<a-button v-permission="'user.create'">创建</a-button>

<!-- 满足任意一个权限即可 -->
<a-button v-permission="['user.edit', 'user.delete']">操作</a-button>

<!-- 必须同时具备全部权限 -->
<a-button v-permission.all="['user.edit', 'user.approve']">审批</a-button>
```

脚本中使用 `can('user.create')` 判断单项权限，`canAny([...])` 判断任意权限，`canAll([...])` 判断全部权限，`hasRole('admin')` 判断角色；这些方法均来自 `usePermission()`。

修改认证或权限时，应一起检查 `src/stores/auth.ts`、`src/stores/permission.ts` 和 `src/router/guards.ts` 的配合，关注登录恢复、动态路由生成与清理、账号切换及无权限跳转。页签和 KeepAlive 缓存由 `tabs` store 管理，修改路由或页面组件名称时需检查缓存是否仍匹配。

认证协议配置及后端对接要求见 `docs/auth-configuration.md`。会话持久化沿用现有缓存封装，避免破坏“记住登录”、存储命名空间和多标签页会话处理。

模拟账号 `admin/123456` 具有完整权限，`user/123456` 具有有限权限。涉及认证或 RBAC 的修改，必须分别验证两个账号的登录、路由访问和操作权限。

## 运行环境与模拟接口

| 环境 | 配置与行为 |
| --- | --- |
| 开发 | `.env.development` 启用 `VITE_USE_MOCK=true`，API 前缀为 `/api`，由 `vite-plugin-mock-dev-server` 提供模拟接口 |
| 生产 | `.env.production` 关闭模拟接口，部署前将示例 API 地址替换为真实后端地址 |
| Demo | `.env.demo` 同时启用 `VITE_USE_MOCK` 和 `VITE_DEMO_MODE`，通过浏览器端模拟接口支持静态托管 |

开发模拟接口在 `mock/handlers/*.mock.ts` 定义，样例数据在 `mock/data/*.data.ts`，统一使用 `/api` 前缀。修改接口契约时，如需保留静态演示能力，应同步检查 `src/mock/` 的实现。

不要提交密钥或其他敏感信息。本地环境差异可放在已被 Git 忽略的 `.env.local`；`VITE_` 前缀变量会进入前端构建，不能用来保存秘密。

## Chrome 100 兼容要求

最低支持 Chrome 100。修改 JavaScript API、CSS、依赖和构建配置时都必须遵守这一基线，不能只凭最新浏览器表现或 TypeScript 编译通过判断兼容性。

- 保持 Vite 的 `build.target` 和 `build.cssTarget` 为 `chrome100`，Browserslist 与此一致，Tailwind 保持已验证的 3.x。
- 新 API 或 CSS 特性不受 Chrome 100 支持时，改用兼容写法，或提供经过验证的降级方案、polyfill。
- 执行 `npm run check:compat`；构建后执行 `npm run check:compat:dist`。
- 确需例外时，在 `scripts/compat/chrome100-exceptions.json` 中精确记录命中代码、原因及降级依据，并清理过期例外。
- 自动检查不能覆盖所有依赖运行时代码、动态 API 和 CSS-in-JS。依赖升级、主题或关键组件变化后，仍需在真实 Chrome 100 上回归。

规则范围、例外格式和检查限制详见 `docs/chrome-100-ci.md`。

## 测试与交付

Vitest 已安装并配置，`tests/unit/**/*.spec.ts` 是可运行测试，不是待接入模板。运行环境为 `node`，`globals: false`，测试必须显式从 `vitest` 导入 `describe`、`it`、`expect` 等 API，不能默认存在浏览器 DOM。

`tests/e2e/` 中的 Playwright 用例仍是模板，项目尚未安装 Playwright，不能把这些文件当作已执行的端到端验证。表单、表格已有独立浏览器检查入口，按 `scripts/README.md` 使用。

根据修改范围选择验证：逻辑修复应覆盖相关回归场景，UI 修改需检查实际交互并保留截图或 GIF，纯文档修改检查内容准确性和差异即可。不要用只复述实现的测试代替行为验证。

**创建提交或 PR 前，必须通过：**

```bash
npm run type-check
npm run lint
npm run build
```

代码行为变化还应运行相关单测；兼容性检查按上一节执行；认证或 RBAC 修改必须完成双账号人工验证。需要完整本地检查时运行 `npm run check:ci`。注意当前 Build 和 Pages 工作流排除了 `**/*form*.spec.ts`，本地 `test:unit:run` 和 `check:ci` 仍运行全部单测；修改表单时不要仅凭远端 CI 通过判断测试已覆盖。

提交信息采用 Conventional Commits：

```text
feat(auth): 添加登录方式
fix(permission): 修复路由权限过滤
refactor(layout): 提取侧边栏菜单逻辑
docs(agents): 更新中文开发指南
```

允许的类型包括 `feat`、`fix`、`refactor`、`docs`、`style`、`test`、`chore` 和 `perf`。保持改动聚焦，避免夹带无关重构或覆盖工作区已有修改。交付说明应写清修改内容、验证结果以及尚未验证的部分。
