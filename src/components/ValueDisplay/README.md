# ValueDisplay

项目内通用值展示组件，供详情、弹窗和表格插槽复用。独立于 ProDescriptions 和 VXE；UI 使用 antdv-next，复制提示复用项目国际化及剪贴板工具。VXE 宿主适配层已注册 `CellValue` 渲染器，复用此组件及文本格式化函数；原有 VXE 日期 formatter 的行为保持不变。

```vue
<ValueDisplay :value="amount" type="money" :options="{ symbol: '¥', precision: 2 }" />
<ValueDisplay :value="0.25" type="percent" :options="{ percentScale: 'fraction' }" />
<ValueDisplay :value="status" type="tag" :value-enum="statusOptions" />
<ValueDisplay :value="amount" type="money" copyable copy-mode="display" />
```

从 `@/components/ValueDisplay/index.vue` 导入组件，从同目录 `types.ts` 导入类型。`format.ts` 的 `formatDisplayValue` 是无 UI 的文本格式化入口，返回 `string | undefined`，可用于后续适配；无有效显示值时返回 undefined，由调用者选择占位符。

| 参数        | 默认值与行为                                                                                 |
| ----------- | -------------------------------------------------------------------------------------------- |
| `value`     | 必填；原始数据                                                                               |
| `type`      | `text`；支持 date/dateTime/time/dateRange/money/percent/tag/badge/avatar/image/link/progress |
| `valueEnum` | tag/badge 的文字、颜色及状态映射                                                             |
| `options`   | 具名、带类型的展示选项，详见 `ValueDisplayOptions`；只读取对应类型使用的字段                 |
| `emptyText` | `—`；null/undefined/空白字符串、无效日期和数字均使用占位符；0 和 false 是有效文本            |
| `copyable`  | false；提供支持键盘的复制按钮，适用于所有类型                                                |
| `copyMode`  | `raw`；`display` 复制格式化文本（含单位及枚举文案）                                          |

- 数字接受有限数值和非空数值字符串，不将布尔值当作金额；金额默认 `¥`、两位小数，颜色继承上下文。precision 截断为整数并限制为 0–20，非有限精度回退到 2。
- 百分比默认 `percent`，25 显示 `25.00%`；`fraction` 下 0.25 显示 `25.00%`。progress 固定采用 0–100，越界值截断到边界，不受 percentScale 影响。
- 日期接受 Date、Dayjs、毫秒时间戳（包括 0）和 Dayjs 可解析字符串。默认使用本地时区，不跟随 VXE 设置的 Dayjs 默认时区；可通过 timeZone 指定 UTC 或 IANA 时区。日期字符串沿用 Dayjs 解析规则，不提供业务日期合法性校验。
- time 默认 `HH:mm:ss`，额外支持严格的 `HH:mm`/`HH:mm:ss` 字符串；时间字符串视为墙上时钟时间，不执行时区转换。dateRange 要求两个有效端点，默认以 `~` 连接，可配置 format/rangeSeparator。
- 原值复制中，数值与布尔值转为字符串；Date/Dayjs 转为 ISO 字符串；双元素数组的两端以 `~` 连接。不序列化任意业务对象。复制成功触发 `copy(text)`，失败提示并触发 `copyError`，失败后可重试。
- 链接支持 http/https/mailto/tel 和相对路径，其他协议显示为普通文本。新窗口链接设置 noopener/noreferrer。
- `ProDescriptions` 保留原 columns API，并映射到 ValueDisplay；`types/pro.ts` 暂时重新导出 ValueType，以兼容既有导入。组件和类型从本目录独立导入。

## 在 VXE 中使用

从 `@/adapters/table` 导入 `useVxeGrid` 时自动注册 `CellValue`，列的 `field` 提供值，`cellRender.props` 接收除 `value` 外的组件参数。`account.amount`、`items[0].name` 等嵌套路径沿用 VXE 使用的取值工具。

```ts
import type { CellValueRenderOptions } from '@/adapters/table';

const amountColumn = {
  field: 'account.amount',
  title: '金额',
  cellRender: {
    name: 'CellValue',
    props: { type: 'money', copyable: true, copyMode: 'display' },
    events: {
      copy: ({ row }, text) => console.log(row, text),
    },
  } satisfies CellValueRenderOptions,
};
```

`events.copy(params, text)`、`events.copyError(params)` 遵循 VXE 的上下文优先约定，`params` 包含 `row`、`column`。可用 `CellValueRenderOptions<MyRow>` 指定行类型。

默认导出使用展示文本，例如状态标签导出文案，金额导出带单位的文本，空值使用 `emptyText`。`original: true` 使用 `getRawText` 的原值文本规则，缺失值导出空串；`copyMode` 只影响复制，不影响导出。图片和链接导出地址，进度导出百分比文本。列自身的 `exportMethod` 可覆盖默认规则。展示格式化不改变排序、筛选或编辑所使用的原始行数据。

`CellValue` 仅在项目适配层注册；单独复制 `src/libs/table` 不包含它，需要宿主自行接入。复杂交互继续使用插槽，业务操作和编辑控件沿用现有渲染器。
