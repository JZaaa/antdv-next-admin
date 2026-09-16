# Changelog

## 2.0.0

- 统一 useSchemaForm、SchemaFormProps 与 setupSchemaForm；所有能力共用 core 实现。
- 数据 API 使用 Promise，校验返回 { valid, errors }，规则使用 Zod 或命名规则。
- 同步迁移宿主示例、文档、组件验收和独立复制夹具。
