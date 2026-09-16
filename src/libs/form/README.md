# SchemaForm

本库统一使用 useSchemaForm，以本地 Vben form-ui 5.8.0（df014ae70924b2af011de26d08082d7ebed787df）现代接口为契约。每个表单只有一个 TanStack 引擎和一套渲染、校验、联动实现。

只支持 antdv-next。废弃 API/类型、旧格式化配置、旧联动多回调及多 UI globalShareState 不支持。组件注册、模型映射及命名规则属于单 UI 正常扩展，已提供。

## 安装和复制升级

将整个 `form` 目录复制到消费项目，例如 `src/libs/form`。模块内部只有相对导入和以下 npm 依赖：

```sh
npm install vue@3.5.42 antdv-next@1.5.4 dayjs@1.11.23 @tanstack/vue-form@1.33.5 @tanstack/store@0.11.1 zod@4.4.3 zod-defaults@0.2.3
```

这些是本版测试版本，宿主已有 Vue、antdv-next、Dayjs 时复用同一安装。使用支持 Vue SFC、CSS 和动态 import 的构建器；Chrome 100 项目将 JS/CSS target 设为 `chrome100`。不需要 Tailwind、Pinia、路由、请求库、项目 i18n 或全局组件注册。样式由公开入口的组件自行导入。宿主可以用 antdv-next ConfigProvider 设置主题、控件语言和全局配置。

业务默认配置、自定义上传、权限、请求和翻译放在目录外的 adapters。升级时备份旧目录，将本目录作为完整单元替换，核对 CHANGELOG/compatibility.json 并运行消费项目测试。不要在本目录保存业务改动，也不要复制本项目的 labs 或旧 Pro 组件。单独复制 Table 时不需要本目录。

## 基础用法

```vue
<template>
  <Form />
</template>
<script setup lang="ts">
import { useSchemaForm, z } from '@/libs/form';

type Values = { name: string; email: string; enabled: boolean };
const [Form, api] = useSchemaForm<Values>({
  wrapperClass: 'grid-cols-1 md:grid-cols-2',
  commonConfig: { labelWidth: 100 },
  schema: [
    { fieldName: 'name', component: 'Input', label: '姓名', rules: 'required' },
    { fieldName: 'enabled', component: 'Switch', defaultValue: true },
    {
      fieldName: 'email',
      component: 'Input',
      label: '邮箱',
      rules: z.email('邮箱格式不正确'),
      dependencies: {
        triggerFields: ['enabled'],
        resolve: ({ values }) => ({ show: values.enabled }),
      },
    },
  ],
  handleSubmit: async (values, rawValues) => {
    // 调用宿主 API；values 是 codec 输出，rawValues 是同次原始快照。
    console.log(values, rawValues);
  },
});
// 可以在挂载前发起操作，Promise 在表单挂载后继续。
void api.setValues({ name: 'Alice', email: '' });
</script>
```

业务示例见 [GroupArrayDemo.vue](../../views/examples/schema-form/demos/GroupArrayDemo.vue)，页面 /examples/schema-form 的“分组与数组”可运行。完整导出类型见 [types.ts](./types.ts)。需要推导控件 props 时可提供组件名/PropsMap 泛型；组件、表单值与 codec 输出类型分别声明。

## API 与默认行为

| 调用                                                          | 契约                                                                                       |
| ------------------------------------------------------------- | ------------------------------------------------------------------------------------------ |
| getValues / getRawValues / getValueSnapshot                   | Promise 等待挂载，分别取提交值、原始快照、同一次 rawValues + values                        |
| formatValues(rawValues)                                       | 同步编码指定值；不修改传入对象                                                             |
| setFieldValue(name,value,shouldValidate=false)                | 写字段，第三参数是 boolean；默认不验                                                       |
| setValues(values,filterFields=true,shouldValidate=false)      | 默认过滤未知 schema 字段，对象深补丁、数组替换；false 时顶层分支直接赋值                   |
| setSubmitValues(values,filterFields,shouldValidate)           | 经 codec.decode 回填；没有 codec 时抛错                                                    |
| validate / validateField(name)                                | Promise 返回 {valid,errors}；普通规则失败不抛，执行异常和取消仍拒绝                        |
| submit / validateAndSubmit                                    | 都验证，失败返回 undefined；成功等待 handleSubmit(values,rawValues) 并返回提交值           |
| clearValidation / setFieldError / isFieldValid                | 清规则/手工错误；设置手工错误；仅读错误判断有效性                                          |
| reset({values}, {force,keepDefaultValues})                    | 默认与基线合并；force 整体替换；keepDefaultValues 保留旧基线                               |
| updateSchema / removeSchemaByFields                           | 更新配置（含组/数组子项）；按字段名移除并将移除值设 undefined                              |
| setState / getState / store / useStore                        | 对象或函数更新完整配置；同步读取、公开 Store 和选择器                                      |
| getFieldComponentRef / getFocusedField                        | 获取控件引用或当前焦点字段                                                                 |
| getLatestSubmissionValues / setLatestSubmissionValues / merge | 最近提交快照；多表单 validate + 取值合并                                                   |
| form                                                          | FormContextApi：values/errors/meta、字段读写、数组增删、校验、fieldComponent、响应式选择器 |

setState/updateSchema 采用参考的配置合并：数组替换，null/undefined 回退旧配置；字段数据写入时 null/undefined 则是实际覆盖值。setValues 的 Promise 与参考一样不等待内部可选异步校验完成；业务需要校验结果时应显式 await validate()。

默认 layout=horizontal、submitOnEnter=false、submitOnChange=false、scrollToFirstError=false、collapsed=false、collapsedRows=1、showDefaultActions=true。submitOnChange 用 changeDebouncedTime（默认 300ms）防抖。handleValuesChange 接收只读值视图、变化字段和惰性格式化函数。

重置按钮先读取重置前的提交值；有 handleReset 时由回调完全接管，没有时执行 reset。直接 api.reset 不触发 handleReset。

## 校验与显隐

| 状态                         | 控件               | 字段规则               | 值                 |
| ---------------------------- | ------------------ | ---------------------- | ------------------ |
| hide:true                    | 卸载               | 停用                   | 保留，可赋值和提交 |
| dependencies 返回 if:false   | 卸载               | 停用                   | 保留，可赋值和提交 |
| dependencies 返回 show:false | CSS 隐藏，保留实例 | 停用                   | 保留，可赋值和提交 |
| 查询折叠 / 分组折叠          | 折叠               | 仍验证，分组错误可展开 | 保留               |
| disabled                     | 禁止控件操作       | 仍验证                 | 保留               |

手工 setFieldError 的错误与规则分开保存：程序赋值、隐藏、移除字段/数组行不自动清除，按字段路径保留，与本地参考一致。UI 修改该字段、clearValidation 或 reset 清除。服务端报错后隐藏字段不会自动使整表有效。

规则可为 Zod、注册名称或 null；内置 required 和 selectRequired。required 检查空串/空数组/null/undefined；selectRequired 仅检查 null/undefined。Zod 使用 safeParseAsync，取首条 issue，不把 parsed 输出写回值。必填判定按 isOptional，必填时拆包装、pipe 取输入；因此 transform/coerce 输出转换应放 codec。异步规则取消后旧结果不覆盖新状态。

用户明确要求的行为优先：所有 submit 均验证有效规则，修正本地 Vben 直接 submit 的无效提交路径。保留 IME 组合态保护及重复在途提交合并。

## 联动、分组、数组和插槽

现代 dependencies 必须提供非空 triggerFields 和 resolve({values,actions,controller,schema})。actions 是表单上下文，controller 是完整 FormApi；可返回 if/show/disabled/required/rules/componentProps/help/renderComponentContent。rules:null 停静态规则，未返回 rules 继续静态规则；忽略旧异步结果，已过期且未返回的联动不阻塞新提交。

分组使用 type:'group'、children、name/title/extra、collapsible/defaultCollapsed、hide 及 class。数组使用 type:'array'、fieldName、children、arrayProps，或 component:'VbenFormFieldArray' 配 componentProps.schema；支持 min/max/createRow、增删、行上下文。行路径为 rows[0].name，子 triggerFields 支持 $row./$root.。与本地参考一样使用索引 key，没有独立稳定业务行 ID 或移动 API。

字段以 fieldName 自动匹配具名 slot，提供 field/componentField/componentProps/modelValue/name/disabled/isInValid/values/formApi。控件可用 v-bind="componentProps"；label/help/description/suffix 和 renderComponentContent 支持渲染内容。操作区提供 default（含 shapes）、reset-before、submit-before、expand-before、expand-after。

## 项目入口与语言

项目业务统一从 `@/adapters/form` 导入 `useSchemaForm`，自动跟随当前语言；它直接调用同一核心，参数、泛型和返回值完全相同。独立复制时从 `libs/form` 导入同名函数。`locale` 配置操作按钮及内置必填提示，Zod 自定义错误文案由规则提供。

## 单 UI 注册与独立复制

```ts
import { setupSchemaForm } from '@/libs/form';
setupSchemaForm({
  components: { MyControl }, // 宿主导入的 Vue 组件
  config: {
    baseModelPropName: 'value',
    modelPropNameMap: { MyControl: 'checked' },
    changeEventFallback: true,
    emptyStateValue: undefined,
  },
  rules: { approved: (value) => value === true || '请确认' },
});
```

复制整个 src/libs/form。目录不依赖业务、router/store/i18n；每表单一个 TanStack 引擎，不使用第二套 FormItem 校验。样式自动导入，常见响应式 grid 类有独立 CSS；任意宿主 utility 类仍需宿主构建生成。界面采用 antdv-next 外观，并通过 ConfigProvider 继承主题/控件语言。

性能对照与完整验收放在宿主 docs/spec/schema-form-vben-implementation.md。runtime 对照不含 DOM/控件/布局/绘制，不能据单个更快指标保证整个旧项目迁移后更快。
