# VXE 依赖升级验证（2026-10-10）

本次升级四个配套依赖，继续使用精确版本，并同步 `pnpm-lock.yaml` 和 `package-lock.json`。其余 91 个直接依赖的声明及安装版本保持不变。表格公开 API 和业务适配逻辑未改动。

| 依赖 | 升级前 | 升级后 |
| --- | --- | --- |
| `vxe-table` | 4.21.10 | 4.22.3 |
| `vxe-pc-ui` | 4.18.9 | 4.19.3 |
| `@vxe-ui/core` | 4.4.21 | 4.4.28 |
| `xe-utils` | 4.0.13 | 4.1.2 |

配套环境为 Vue 3.5.43、antdv-next 1.6.0、Node.js 24.15.0，以及 Windows 下的 HeadlessChrome 100.0.4896.0。

## 项目检查

`npm run check:table:project` 的九步检查全部通过：

- 类型检查和 Lint。
- 49 个测试文件、335 项单元测试（包含表单测试）。
- 生产构建、Demo 构建及各自的 Chrome 100 源码和 CSS 兼容检查。
- 表格实验页构建、表格独立宿主及表格与表单桥接独立宿主构建。

日志索引：`docs/spec/vxe-table-project-checks.json`；逐项输出：`docs/spec/vxe-table-check-*.log`。

## Chrome 100 回归

| 命令 | 通过场景数 | 报告 |
| --- | --- | --- |
| `npm run lab:table:check` | 46 | `docs/spec/vxe-table-production.json` |
| `npm run lab:table:check -- --standalone` | 1 | `docs/spec/vxe-table-standalone.json` |
| `npm run lab:table:check -- --standalone-form` | 1 | `docs/spec/vxe-table-standalone-form.json` |
| `npm run lab:table:check -- --example` | 14 | `docs/spec/vxe-table-example-admin.json` |
| `npm run lab:table:check -- --example --user` | 14 | `docs/spec/vxe-table-example-user.json` |

合计 76 项场景通过，各报告均无失败、运行时异常或 console.error。覆盖查询与搜索桥接、分页排序、编辑与撤销、已读状态、树形与虚拟滚动、导入导出、主题、语言和双账号示例。桌面截图与 JSON 同名，双账号窄屏截图为 `vxe-table-example-{admin,user}-narrow.png`；已检查示例页和独立宿主截图。

`docs/spec/` 为本地生成目录，受 Git 忽略；需要分享原始日志和截图时应单独保留。当前 `dist/` 为 Demo 主应用及表格实验页、独立宿主产物。

## 验证边界

本次未重跑 Vben 参考包装层和性能基准，也未重新生成完整性能验收汇总。2026-09-16 的性能报告仍对应旧版本，不能作为本次升级的性能结论。验收脚本中的目标版本已同步为 4.22.3 / 4.19.3。

实际打印设备、额外付费插件及未列入场景的业务组合不在本次回归范围内。
