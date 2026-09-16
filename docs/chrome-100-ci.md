# Chrome 100 自动检查

项目最低支持 Chrome 100。CI 在推送或 PR 到 main/master 时检查生产构建和 Demo 构建，Pages 发布流程在上传前检查 Demo 产物。检查失败时任务失败，不继续该任务中的后续构建或上传步骤。

## 本地执行

```bash
pnpm install --frozen-lockfile
pnpm run check:ci
```

已经安装依赖时，也可以用 `npm run check:ci` 执行相同检查。CI 以 `pnpm-lock.yaml` 为准，不在安装后执行 `pnpm add`；Rolldown 的 Linux 原生绑定由锁文件中的平台可选依赖安装。

| 命令 | 内容 |
| --- | --- |
| `npm run check:compat` | 校验生产/Demo 的最终 Vite JS/CSS 目标、Browserslist、安装的 Tailwind 主版本，以及 src 中的 JS/TS、Vue 脚本和模板表达式 |
| `npm run check:compat:dist` | 上述检查，加上已有 dist 中的静态 CSS；需要先构建 |
| `npm run check:ci` | 专项检查 → 类型 → Lint → 全部单元测试 → 生产构建及 CSS 检查 → Demo 构建及 CSS 检查 |

`check:ci` 最后生成的是 Demo 产物，发布真实后端版本时需重新执行 `npm run build` 和 `npm run check:compat:dist`。兼容检查会输出文件、行号、规则和命中的代码；压缩产物的行号通常为 1。

## 检查规则

- 生产和 Demo 最终解析后的 `build.target`、`build.cssTarget` 必须为 `chrome100`；`.browserslistrc` 保持 `Chrome >= 100`；安装的 Tailwind 保持已验证的 3.x 主版本。
- 使用 TypeScript AST 检查部分高风险 API，例如 `toSorted`、`toReversed`、`toSpliced`、新 Set 集合运算、`Object.groupBy`、`Map.groupBy`、`Promise.withResolvers`、`Promise.try`、`Array.fromAsync` 和 `RegExp.escape`。覆盖普通属性、可选链及字符串下标访问，注释和普通说明文本不会作为 API 调用检查。
- 检查应用 JS 中包含 `color-mix()`、`oklch()`、`oklab()`、`light-dark()` 的字符串及模板字符串。
- 检查构建后静态 CSS 中的上述颜色函数、动态视口单位、`:has()`、容器查询及 `@starting-style`。
- 普通 CSS 属性可在同一个规则内先声明兼容值，再声明现代值；回退值不能依赖未核实的 CSS 变量。CSS 自定义属性不适用这种自动放行，避免无效函数文本覆盖兼容值。
- 容器查询只有在 `@supports (container-type: inline-size)` 中，且存在对应的 `@supports not (...)` 媒体查询（相同断点、相同样式）时自动放行。首页使用共享 Sass mixin 保持两套规则一致。

## 已有功能检测或 polyfill 时

检查器采取保守策略，不自动推断任意 JavaScript 分支、polyfill 或 CSS `@supports` 的安全性。优先改为兼容写法；确需保留命中代码时，在 `scripts/compat/chrome100-exceptions.json` 中添加精确例外，并随 PR 说明回退和验证证据：

```json
{
  "source": [
    {
      "file": "src/utils/example.ts",
      "rule": "js-api",
      "code": "items.toSorted",
      "reason": "调用前检测方法是否存在，缺失时复制数组后 sort；对应回退已由单元测试验证。"
    }
  ],
  "dist": []
}
```

这是格式示例，不是当前项目的例外。`file`、`rule`、`code` 必须精确匹配检查输出，`reason` 必填；过期例外也会使检查失败。不支持通配符。构建 CSS 的文件名包含 hash，确需例外时要针对新产物重新审查。

## 边界与维护

表单浏览器、独立复制和性能等专项验收均为手动执行，不接入自动 CI。Build 和 Pages 工作流的单测排除 `**/*form*.spec.ts`；本地 `test:unit:run` 与 `check:ci` 仍包含全部单测。项目整体构建、类型、Lint 和兼容检查保持完整源码检查。命令、构建顺序和报告来源说明见 [脚本指南](../scripts/README.md)。Chrome 100 实测需要指定对应浏览器可执行文件。

这是已列出风险的防回归检查，不是完整的浏览器兼容性证明。它不进行类型推断或数据流分析，API 别名、动态属性名、第三方依赖的运行时代码、浏览器注入的 CSS-in-JS、运行时内联样式等仍需要人工检查。方法名与禁用 API 重名的自定义方法也可能被报告，应审查后精确记录例外。

依赖升级、主题及关键组件变化后，仍需在真实 Chrome 100 上回归登录、权限、主题、表单、弹层、编辑器和图表。现有主题降级、颜色、排序、Tailwind 和图标测试随 CI 一起执行。

工作流失败会报告检查失败，但仓库是否禁止合并取决于 GitHub 分支保护。需要强制门禁时，将 Build 工作流的 `build` 检查设为必需状态检查；本次代码修改不调整远端仓库设置。
