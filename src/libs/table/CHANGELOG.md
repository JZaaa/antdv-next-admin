# Changelog

## 1.0.0 — 2026-09-16

- 唯一 useVxeGrid，原生 proxy/实例/事件/插槽、独立搜索桥接和已读存储。
- 按用户指定锁定 vxe-table 4.21.10、配套 vxe-pc-ui 4.18.9；参考包装层来自 Vben df014ae。
- 默认搜索复用唯一 SchemaForm；支持四语言、明暗主题与 Chrome 100。
- 明确修正 tableData 空数组、无搜索表单实例、隐式分页器、原生工具栏显示、Event 过滤和卸载后回包；保留 loading 中跳过新查询的原生行为。
- 只支持现代 persist 对象；排除旧简写及额外高级插件。CellOperation 为宿主按钮扩展，完整 playground 菜单协议不属于 Table 核心。
- 升级复制整个目录，同时更新显式依赖。业务渲染器、HTTP 请求和用户存储命名空间保留在 adapters/页面。
- 通过 Chrome 100 的 45 项表格场景、admin/user 各 14 项示例及两种独立复制宿主；项目 252 项单测和构建兼容检查通过。验收范围、61 项能力/差异索引和 120 个性能样本见宿主 docs/spec/vxe-table-acceptance.md。
