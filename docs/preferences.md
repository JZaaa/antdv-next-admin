# 默认配置、个性化与模块开关

配置入口为 `src/settings.ts` 的 `appDefaultSettings`。设计参考 [Vben 偏好设置](https://doc.vben.pro/guide/essentials/settings.html#偏好设置)：代码提供默认值，运行时合并用户偏好，重置回到项目默认值，并按应用命名空间保存。

## 配置层次

| 配置 | 用途 | 用户是否可修改 |
| --- | --- | --- |
| `features` | 模块启用、入口显隐等部署级选项 | 仅代码，面板与缓存都不能覆盖 |
| `preferences` | 主题、布局、动画、标签、语言、AI 分屏等默认值 | 开启个性化时允许用户覆盖 |
| `layout` | 侧栏展开与收起宽度 | 仅代码 |
| `proTable`、`input`、`select`、`datePicker`、`button` | 公共组件默认参数 | 仅代码，组件自身 props 可覆盖 |

运行时按字段合并：**代码默认值 → 当前命名空间内合法的用户修改项 → 代码模块开关约束**。只保存与默认值不同的用户修改项，不把初始化得到的完整配置写回缓存。新增配置和未修改的字段可以直接获得新的代码默认值。

已有版本留下的合法缓存继续视为用户覆盖。若希望所有用户采用一套全新的默认值，应升级缓存版本；仅修改默认值不会抹除同版本中用户已经选择的值。

## 修改默认值

直接修改 `src/settings.ts` 中对应字段，例如：

```ts
preferences: {
  // 其余字段保留
  primaryColor: 'purple',
  customPrimaryColor: '', // 非空合法 HEX 会优先于预设色
  sidebarTheme: 'light',
  layoutMode: 'vertical',
  pageAnimation: 'fade',
  themeMode: 'system', // light / dark / system
  locale: 'zh-CN',
  rememberTabState: true,
  maxTabCount: 15, // 1–50
  aiEntryVisible: false,
  aiCollabEnabled: false,
  aiPanelWidth: 420, // 320–560
},
```

`preferences` 覆盖个性化面板的全部选项，并包含顶部主题切换、语言选择、侧栏折叠和 AI 分屏状态。主题、语言、标签数量上限在初始化时读取同一套默认值与缓存；首屏加载画面通过 Vite 插件注入相同的主题、语言和个性化开关，避免采用另一套硬编码默认值。

`layout.sidebarWidth` / `layout.collapsedWidth` 分别配置侧栏展开、收起宽度。表格和基础组件的默认参数仍在同一个文件中配置。

## 仅在代码中控制的模块

所有开关默认开启：

| `features` 字段 | 关闭后的行为 |
| --- | --- |
| `logo` | 隐藏侧栏、水平顶栏、桌面与移动登录页、关于页以及首屏加载画面的 Logo 图片；保留系统名称与浏览器标签页图标 |
| `personalization` | 隐藏桌面与移动端偏好设置入口和抽屉、主题/语言切换；忽略已有用户偏好，采用代码默认值，不写入新的偏好 |
| `search` | 隐藏全局搜索入口，不响应 Ctrl/Cmd+K，也不挂载搜索弹窗 |
| `notifications` | 隐藏通知入口，不初始化通知模块 |
| `fullscreen` | 隐藏顶部和移动菜单的浏览器全屏入口 |
| `themeSwitch` | 隐藏顶部、移动菜单和登录页的主题切换入口 |
| `languageSwitch` | 隐藏顶部、移动菜单和登录页的语言切换入口，以及面板中对应选项 |
| `aiChat` | 隐藏 AI 入口、偏好选项与分屏面板；旧缓存不能重新启用 |
| `tabs` | 隐藏垂直和水平布局的标签栏，页面路由与 KeepAlive 仍正常工作 |
| `breadcrumb` | 隐藏面包屑 |

例如在 `features` 中设置 `personalization: false`、`aiChat: false`，就能发布使用固定外观且没有 AI 分屏入口的版本。模块开关不会出现在个性化面板中。它们控制前端功能及显示，不替代后端权限。

关闭个性化后，侧栏展开/收起、已启用 AI 模块的打开/关闭/拖拽仍可在当前页面临时操作，但不会写入偏好缓存。重新开启个性化且未升级缓存版本时，将恢复原先保存的用户偏好。

顶部右侧还支持追加、替换内容及自定义用户菜单，详见 [顶部右侧插槽](./layout-slots.md)。

## Logo 资源与显隐

页面 Logo、首屏加载图片和浏览器标签页图标统一使用 `public/logo.png`，更换品牌图片只需替换该文件，无需维护 `src/assets` 中的副本。

在 `src/settings.ts` 中将 `appDefaultSettings.features.logo` 设为 `false` 可隐藏页面 Logo 图片，默认 `true`。该开关不出现在设置面板，也不读取或写入浏览器偏好缓存；系统名称和浏览器标签页图标保持显示。

首屏加载画面由 Vite 插件在 HTML 转换时注入相同开关，通过 CSS 在首次绘制时隐藏图片，避免启动时闪现 Logo。修改后重启开发服务；发布时需重新构建，以保持首屏与应用内配置一致。

## 读取、更新和重置

业务组件继续使用 `useSettingsStore`、`useThemeStore`、`useLayoutStore` 现有方法。它们共享 `usePreferencesStore`，不再分别定义默认值和存储逻辑。

```ts
const preferences = usePreferencesStore();
preferences.update({ pageAnimation: 'fade', maxTabCount: 12 });
console.log(preferences.preferences.layoutMode);
preferences.reset();
```

语言切换使用 `setLocale()`，以加载对应语言包；主题切换使用 `themeStore.setTheme()`，以保留切换动画。重置操作清除本配置体系的用户覆盖，恢复 `src/settings.ts` 默认值，并同步主题、颜色、布局、标签设置及语言。重置不会清除登录信息、标签内容、其他业务缓存或其他项目的数据。

新增可缓存字段时，同时更新 `UserPreferences`、代码默认值、`PREFERENCE_STORAGE_KEYS` 和校验器，并接入消费组件。没有列入白名单的字段不参与缓存合并。枚举、布尔值、HEX 颜色及数值范围都会校验，损坏字段回退默认值。浏览器存储不可用时，配置仍在内存生效。

## 缓存版本

偏好通过 `appLocalStorage` 读写，键格式沿用：

```text
项目标识:Vite模式:package.json版本:VITE_APP_CACHE_VERSION:偏好字段键
```

修改 `.env` 中的 `VITE_APP_CACHE_VERSION` 或升级 `package.json.version` 后，整个应用使用新的缓存空间，偏好、登录等缓存一起失效并按当前代码重新初始化。旧空间保留但不会读取，其他项目缓存不受影响。修改配置后重启开发服务；发布需重新构建，保证 HTML 首屏配置与应用代码一致。

更完整的缓存约定见 [缓存与多项目隔离](./cache-storage.md)。管理菜单里的“系统配置”是服务端业务参数 CRUD 示例，仍通过 `/api/config` 管理，不作为前端模块开关的来源。
