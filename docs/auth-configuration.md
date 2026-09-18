# 认证协议配置

编辑 `src/settings.ts` 的 `appDefaultSettings.auth`。配置仅由源码提供，不读写用户偏好、localStorage 或 sessionStorage；修改后重新加载应用，部署时需更新前端产物。令牌自身仍按各项目原有策略保存，与“配置不缓存”无关。

```ts
auth: {
  enableRefreshToken: false,
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

经营分析项目默认 `enableRefreshToken: false`，适配当前固定有效期后端；原框架默认 `true`，保持既有 Mock 双令牌行为。启用双令牌前，后端需要实现相应刷新接口；修改前端配置不会新增后端能力。协议切换后建议重新登录。自动刷新以 HTTP 401 为触发条件；HTTP 200 中的业务错误码仍遵循原有业务错误处理。

请求配置 `skipAuth` 用于公开接口；`skipAuthRefresh` 只跳过本次刷新，认证请求返回 401 仍会清理会话。`skipErrorMessage`、`skipRedirect` 分别控制提示和跳转。

## 本次框架同步记录（2026-09-18）

- 按任务指定顺序，先在 `D:\www\project\business-analytics\web` 开发验证，再同步到 `D:\www\vue\antdv-next-admin`。源工作区基于 `bb086d3f8e4cba55c909fefcffd420e88d95947a`，目标基于 `b5ed366f4573da1603ad4479c8d8ca5208acb458`；本次功能尚未提交。
- 同步通用认证配置与类型、登录/刷新字段映射、Store 刷新能力、请求拦截器和本文档；原框架路由守卫增加等待异步认证恢复。两侧保留各自的账号、角色、权限和令牌存储策略，未同步业务账号实现。
- 两侧均通过内存 Mock 运行验证：单双模式、并发刷新、令牌轮换、字段/请求头映射、异常响应拒绝、过期启动恢复、重试上限、刷新失败退出、退出后旧刷新响应保护。
- 项目已有请求基础用例 8 项通过；原框架认证、请求及路由已有用例 28 项通过。两侧定向 Lint 无错误，Chrome 100 源码检查通过；原框架完整类型检查通过。
- 项目完整类型检查受既有 `src/views/profile/index.vue` 的 `roles`、`createdAt` 字段错误影响；Node 配置类型检查通过。未修改测试文件，未执行生产构建，未联调真实双令牌后端。
