# 认证协议配置

编辑 `src/settings.ts` 的 `appDefaultSettings.auth`。配置仅由源码提供，不读写用户偏好、localStorage 或 sessionStorage；修改后重新加载应用，部署时需更新前端产物。令牌及用户资料缓存按下述记住登录策略保存，与“配置不缓存”无关。

```ts
auth: {
  enableRefreshToken: true,
  enableRememberLogin: true,
  rememberLogin: false,
  tokenField: 'token',
  refreshTokenField: 'refreshToken',
  expiresInField: 'expiresIn',
  refreshTokenRequestField: 'refreshToken',
  refreshUrl: '/auth/refresh',
  headerName: 'Authorization',
  tokenPrefix: 'Bearer',
},
```

- `false`：单令牌模式，忽略并清理旧 refresh token，401 清理会话并返回登录页，不调用刷新接口。
- `true`：双令牌模式，登录必须返回两个非空字符串令牌；401 合并并发刷新，成功后每个请求最多重试一次。刷新失败或重试仍为 401 时清理会话。启动时访问令牌已到期且有刷新令牌，会先刷新再恢复身份。
- 三个响应字段名均为现有响应 `data` 对象下的直接属性名，不是嵌套路径。外层 `{ code, message, data, success }` 契约保持不变。
- `expiresInField` 对应有限正数，单位为秒，不接受字符串、时间戳或毫秒。可省略；经营分析项目省略时由后端 HTTP 401 判定失效，原框架保留 JWT `exp` / 24 小时兜底策略。
- 刷新成功可返回新的刷新令牌进行轮换；省略该字段则保留原令牌。显式返回 null、空字符串或错误类型会拒绝响应。
- `refreshTokenRequestField` 独立控制刷新 POST 请求体字段，`refreshUrl` 相对于现有 API baseURL。刷新请求不附加访问令牌。
- `headerName` 和 `tokenPrefix` 控制业务请求认证头；前缀为空字符串时直接发送 token。

例如后端返回 `data: { access_token: '...', refresh_token: '...', expires_in: 3600 }`，将三个响应字段改为 `access_token`、`refresh_token`、`expires_in`；若刷新请求也接受 `refresh_token`，同时修改 `refreshTokenRequestField`。

原框架默认 `enableRefreshToken: true`，保持既有 Mock 双令牌行为；各业务项目以自身源码配置和后端契约为准。启用双令牌前，后端需要实现相应刷新接口；修改前端配置不会新增后端能力。协议切换后建议重新登录。自动刷新以 HTTP 401 为触发条件；HTTP 200 中的业务错误码仍遵循原有业务错误处理。

请求配置 `skipAuth` 跳过自动注入当前访问令牌及 401 会话处理，可用于公开接口或显式携带旧凭据的 Logout；`skipAuthRefresh` 只跳过本次刷新，认证请求返回 401 仍会清理会话。`skipErrorMessage`、`skipRedirect` 分别控制提示和跳转。

## 记住登录与标签页隔离

- 配置只存在于源码，不进入偏好面板，也不持久化配置值。
- `enableRememberLogin: true` 显示登录复选框，`rememberLogin` 指定初始勾选状态；默认显示且不勾选。
- `enableRememberLogin: false` 隐藏复选框，Store 忽略调用方传入的 remember，固定使用 `rememberLogin` 登录。
- 记住登录时，访问令牌、刷新令牌、到期时间及用户资料缓存统一使用 localStorage；否则统一使用当前标签页的 sessionStorage。只保存凭据和资料，不保存密码，也不改变后端有效期。
- 启动优先选择当前标签页已有凭据的 sessionStorage，否则选择 localStorage；整套凭据及身份缓存从同一来源恢复，缺失字段不从另一存储补齐。配置决定下一次登录的策略，不迁移已有会话。
- 保存、续期和退出只处理当前会话对应存储；共享凭据已被其他账号替换时，旧页面不能删除或覆盖新会话及其用户缓存。
- 使用原生 focus、storage 事件检查共享登录变化，并在认证请求与刷新前再次检查。检测到变化后提示刷新，阻止旧页面继续发送认证请求；整页重载后再恢复身份和路由，避免只换 Token 而保留旧账号界面。独立的 sessionStorage 登录不受共享登录变化影响。
- 无需 VueUse，也未引入跨标签页刷新锁。同一记住登录被其他标签页刷新并轮换 Token 时，旧页面同样提示重新加载，不自动接管新凭据。该检查不提供跨标签页原子事务，也不能撤回已经发出的请求。
- 关闭标签页不保证服务端撤销会话；浏览器恢复标签页可能恢复 sessionStorage。过期和撤销仍由后端处理。

## 主动退出

- 账号菜单确认退出后调用 `authStore.signOut()`，立即清除访问令牌、刷新令牌、用户资料和角色权限；菜单同时清理动态路由与标签页，使用 `replace('/login')` 返回登录页，不等待服务端响应。
- `signOut()` 保存退出时的访问令牌，后台仅发送一次 `POST /auth/logout`。请求按配置的认证头和前缀显式携带旧令牌，避免本地清理后丢失凭据或误用重新登录后的令牌。
- 访问令牌缺失、过期或刷新令牌失效时，仍只调用 Logout，不触发刷新或重试。令牌缺失时不附加认证头，服务端决定是否以及如何撤销关联的刷新令牌；前端不额外调用刷新接口。
- Logout 使用 `skipAuth`、`skipAuthRefresh`、`skipErrorMessage`、`skipRedirect`，请求失败由 `signOut()` 静默捕获，不弹错、不跳转错误页，也不让迟到的响应清除新会话。本地退出成功不代表服务端已成功撤销凭据。
- `authStore.logout()` 仍仅清理本地认证状态，供会话失效等内部流程使用；主动退出使用 `signOut()`，页面无需等待其 Promise。

## 记住登录同步记录（2026-09-19）

- 来源为经营分析项目前端工作区的未提交修改，基线提交为 08907b1c9a24168479f4febb1fd037282d6f116d；原框架同步前基线为 20ee1ce7302c26e46a82e815f99ac90eb7dd796e。
- 同步源码配置、登录复选框、凭据成套存储、清理归属和共享会话变化保护；原框架额外将用户资料缓存纳入同一存储来源并保留中英文提示。保留原有 RBAC、Mock、验证码及 JWT 有效期兜底。
- 原框架类型检查和 Chrome 100 源码检查通过；请求、偏好及路由认证三个已有测试文件共 35 项通过。定向 Lint 无错误，保留 request.ts 中 3 条已有警告。
- 未新增或修改测试，未执行生产构建，未进行真实浏览器双账号联调。未运行仍断言默认 localStorage 或 login 两参数调用的旧认证集成、登录导航用例。未新增依赖或提交 Git。

## 本次框架同步记录（2026-09-18）

- 按任务指定顺序，先在 `D:\www\project\business-analytics\web` 开发验证，再同步到 `D:\www\vue\antdv-next-admin`。源工作区基于 `bb086d3f8e4cba55c909fefcffd420e88d95947a`，目标基于 `b5ed366f4573da1603ad4479c8d8ca5208acb458`；本次功能尚未提交。
- 同步通用认证配置与类型、登录/刷新字段映射、Store 刷新能力、请求拦截器和本文档；原框架路由守卫增加等待异步认证恢复。两侧保留各自的账号、角色、权限和令牌存储策略，未同步业务账号实现。
- 两侧均通过内存 Mock 运行验证：单双模式、并发刷新、令牌轮换、字段/请求头映射、异常响应拒绝、过期启动恢复、重试上限、刷新失败退出、退出后旧刷新响应保护。
- 项目已有请求基础用例 8 项通过；原框架认证、请求及路由已有用例 28 项通过。两侧定向 Lint 无错误，Chrome 100 源码检查通过；原框架完整类型检查通过。
- 项目完整类型检查受既有 `src/views/profile/index.vue` 的 `roles`、`createdAt` 字段错误影响；Node 配置类型检查通过。未修改测试文件，未执行生产构建，未联调真实双令牌后端。
