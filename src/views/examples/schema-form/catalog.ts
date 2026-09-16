import { defineAsyncComponent } from 'vue';

export const demos = [
  {
    id: 'groups',
    title: '分组与数组',
    description: '动态联系人、分组、显隐联动与字段名插槽。',
    related: 'type: group / array · arrayProps · dependencies',
    component: defineAsyncComponent(() => import('./demos/GroupArrayDemo.vue')),
    files: [
      {
        name: 'GroupArrayDemo.vue',
        load: () => import('./demos/GroupArrayDemo.vue?raw').then((module) => module.default),
      },
    ],
  },
  {
    id: 'basic',
    title: '基础用法',
    description: '声明字段、初值和提交回调。清空名称后提交，观察必填错误。',
    related: 'schema · defaultValue · rules · handleSubmit',
    component: defineAsyncComponent(() => import('./demos/BasicDemo.vue')),
    files: [
      {
        name: 'BasicDemo.vue',
        load: () => import('./demos/BasicDemo.vue?raw').then((module) => module.default),
      },
    ],
  },
  {
    id: 'controls',
    title: '常用控件',
    description: '18 种内置控件及其模型绑定。日期、树选择和上传按需加载。',
    related: 'component · componentProps · defaultValue',
    component: defineAsyncComponent(() => import('./demos/ControlsDemo.vue')),
    files: [
      {
        name: 'ControlsDemo.vue',
        load: () => import('./demos/ControlsDemo.vue?raw').then((module) => module.default),
      },
    ],
  },
  {
    id: 'query',
    title: '查询与编解码',
    description: '展开/折叠查询条件，将日期数组转换成 start/end，并从提交值回填。',
    related: 'codec · setSubmitValues · setState · collapsed',
    component: defineAsyncComponent(() => import('./demos/QueryDemo.vue')),
    files: [
      {
        name: 'QueryDemo.vue',
        load: () => import('./demos/QueryDemo.vue?raw').then((module) => module.default),
      },
    ],
  },
  {
    id: 'rules',
    title: '表单校验',
    description: '必填、可选邮箱、异步用户名检查、跨字段规则。使用 Zod 4 与命名规则。',
    related: 'rules · formFieldProps · dependencies',
    component: defineAsyncComponent(() => import('./demos/RulesDemo.vue')),
    files: [
      {
        name: 'RulesDemo.vue',
        load: () => import('./demos/RulesDemo.vue?raw').then((module) => module.default),
      },
    ],
  },
  {
    id: 'dependencies',
    title: '联动与远程选项',
    description: '地区/城市级联；切换 if/show/disabled，比较原始值和提交值。',
    related: 'dependencies.resolve · 异步 resolve · triggerFields',
    component: defineAsyncComponent(() => import('./demos/DependenciesDemo.vue')),
    files: [
      {
        name: 'DependenciesDemo.vue',
        load: () => import('./demos/DependenciesDemo.vue?raw').then((module) => module.default),
      },
    ],
  },
  {
    id: 'slots',
    title: '自定义组件与插槽',
    description: '自定义颜色组件和模型属性；字段插槽添加单位，操作插槽自定义按钮。',
    related: 'modelPropName · 字段名插槽 · submit-before',
    component: defineAsyncComponent(() => import('./demos/SlotsDemo.vue')),
    files: [
      {
        name: 'SlotsDemo.vue',
        load: () => import('./demos/SlotsDemo.vue?raw').then((module) => module.default),
      },
      {
        name: 'ColorControl.vue',
        load: () => import('./demos/ColorControl.vue?raw').then((module) => module.default),
      },
    ],
  },
  {
    id: 'api',
    title: '表单操作',
    description: '回填、快照、校验、服务端错误、增删字段、更新配置、重置基线和聚焦。',
    related: 'getValues · setValues · validate · updateSchema · reset',
    component: defineAsyncComponent(() => import('./demos/ApiDemo.vue')),
    files: [
      {
        name: 'ApiDemo.vue',
        load: () => import('./demos/ApiDemo.vue?raw').then((module) => module.default),
      },
    ],
  },
  {
    id: 'integration',
    title: '业务综合示例',
    description: '账号编辑、动态字段、远程部门、附件与 Modal 保存/重开。使用项目中英文适配器。',
    related: 'useSchemaForm · handleSubmit · locale',
    component: defineAsyncComponent(() => import('./demos/IntegrationDemo.vue')),
    files: [
      {
        name: 'IntegrationDemo.vue',
        load: () => import('./demos/IntegrationDemo.vue?raw').then((module) => module.default),
      },
      {
        name: 'adapters/form.ts',
        load: () => import('@/adapters/form.ts?raw').then((module) => module.default),
      },
    ],
  },
];
