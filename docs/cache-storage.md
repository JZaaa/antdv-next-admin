# 缓存与多项目隔离

设计参考 [Vben 缓存文档](https://doc.vben.pro/guide/essentials/cache.html)：统一入口负责命名空间、过期管理及限定范围的清理，底层存储负责读写。本项目保留同步 Web Storage 接口，确保路由守卫、语言及首屏主题能同步初始化。

前端默认配置、用户偏好合并及代码模块开关见 [默认配置与个性化](./preferences.md)。

## 当前存储方式

| 数据 | 存储位置 | 生命周期 |
| --- | --- | --- |
| Token、用户信息、主题、语言、布局、水印 | localStorage | 关闭浏览器后保留，同版本恢复 |
| 标签列表、数量上限、收藏、菜单历史、示例草稿 | localStorage | 同上；标签记录不包含组件实例 |
| GitHub Pages 路由跳转信息 | sessionStorage | 当前浏览器标签内临时使用 |
| KeepAlive 页面实例、Pinia 运行状态 | 内存 | 刷新后重新创建，不写入浏览器持久存储 |
| 表格已读记录 | 可选 localStorage / sessionStorage / IndexedDB / 自定义驱动 | 由业务配置 TTL、用户标识及存储方式 |

## 命名空间与升级

`.env` 中配置：

```dotenv
VITE_APP_NAMESPACE=antdv-next-admin
VITE_APP_CACHE_VERSION=1
```

实际键格式为 `项目标识:Vite模式:package.json版本:缓存结构版本:业务键`，例如：

```text
antdv-next-admin:production:1.0.0:1:access_token
antdv-next-admin:production:1.0.0:1:app-tabs-state
```

- 同域部署多个项目时，分别设置不同的 `VITE_APP_NAMESPACE`；不要依赖端口以外的 URL 路径自动隔离。
- `development`、`production`、`demo` 自动分开；命名空间各段经过 URL 编码，防止分隔符混淆。
- 应用版本直接取 `package.json.version`，升级版本后自动使用新缓存空间。
- 未发布新应用版本但调整缓存结构时，递增 `VITE_APP_CACHE_VERSION`。相同版本、相同配置的重新部署仍复用缓存。
- 改变项目标识或任一版本后，登录状态和偏好都重新初始化。首次接入也不会读取或迁移旧的无前缀键，以免引入其他项目数据。
- 旧空间保留但不读取、不自动删除，避免破坏同域旧版本正在运行的页面。没有调用全域 `localStorage.clear()` 或 `sessionStorage.clear()`。
- 首屏 HTML 和静态 `404.html` 使用同一个构建插件注入命名空间，确保加载画面与 Vue 读取相同的语言和主题；部署时应使用完整构建产物。

## 业务使用

原生字符串接口（框架内部统一使用）：

```ts
import { appLocalStorage, appSessionStorage } from '@/utils/cache';

appLocalStorage.setItem('filters', JSON.stringify({ status: 'enabled' }));
const raw = appLocalStorage.getItem('filters');
appLocalStorage.removeItem('filters');
appLocalStorage.clear(); // 只清除当前项目、模式、应用版本、缓存版本
appSessionStorage.setItem('workflow-step', '2');
```

需要 JSON 和过期时间时，使用已有的类型化接口，`expire` 单位保持为**秒**（Vben 示例 TTL 为毫秒，两者不要混用）：

```ts
import { localStorage as cache } from '@/utils/storage';

cache.set('draft', { title: '草稿' }, 3600);
const draft = cache.get<{ title: string }>('draft');
cache.remove('draft');
cache.clear(); // 同样只清除当前空间
```

存储不可用时读取返回空，写入失败会记录警告，页面继续使用内存状态；此时刷新不能恢复未持久化的数据。原 `encryptedLocalStorage` / `encryptedSessionStorage` 也使用命名空间，但其 XOR 仅为旧有混淆功能，不提供安全加密。

第三方或可独立复制的表格模块使用宿主生成的物理键，不向独立模块引入项目配置：

```ts
import { getStorageKey } from '@/utils/cache';

const persist = {
  type: 'indexedDB' as const,
  dbName: getStorageKey('viewed-table-db'),
  key: getStorageKey(`orders:${userId}`),
  ttl: 24 * 60 * 60 * 1000, // 表格模块 TTL 单位为毫秒
};
```

只在直接操作第三方存储驱动时调用 `getStorageKey`；向 `appLocalStorage` / `appSessionStorage` 传业务键即可，避免重复添加前缀。需要用户间隔离的数据还应在业务键内加入用户或租户标识；项目隔离不会自动代替用户隔离。IndexedDB 的 `dbVersion` 用于数据库结构升级，不等同于框架缓存版本。
