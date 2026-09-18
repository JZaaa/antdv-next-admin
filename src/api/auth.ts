import type { ApiResponse } from '@/types/api';
import type { LoginParams, LoginResult, User } from '@/types/auth';

import { appDefaultSettings } from '@/settings';
import { request } from '@/utils/request';

/**
 * 将后端自定义字段转换为内部统一的令牌结构，不改变外层响应契约。
 * @param data 响应中的 data 对象，只读取配置指定的直接属性名。
 * @param requireRefreshToken 双令牌登录必须返回刷新令牌；刷新时允许不轮换。
 * @returns 校验后的访问令牌、可选刷新令牌和秒数有效期。
 * @throws 字段缺失、令牌为空或有效期不是有限正数时拒绝响应。
 */
function normalizeTokens(data: unknown, requireRefreshToken: boolean): LoginResult {
  if (typeof data !== 'object' || data === null || Array.isArray(data)) {
    throw new Error('认证响应格式无效');
  }
  const fields = appDefaultSettings.auth;
  const values = data as Record<string, unknown>;
  const token = values[fields.tokenField];
  const refreshValue = fields.enableRefreshToken ? values[fields.refreshTokenField] : undefined;
  const expiresIn = values[fields.expiresInField];
  if (typeof token !== 'string' || !token.trim()) {
    throw new Error('认证响应缺少有效的访问令牌');
  }
  if (
    (requireRefreshToken || refreshValue !== undefined) &&
    (typeof refreshValue !== 'string' || !refreshValue.trim())
  ) {
    throw new Error('认证响应缺少有效的刷新令牌');
  }
  if (
    expiresIn !== undefined &&
    (typeof expiresIn !== 'number' || !Number.isFinite(expiresIn) || expiresIn <= 0)
  ) {
    throw new Error('认证响应有效期必须为正数秒数');
  }
  return {
    token,
    ...(typeof refreshValue === 'string' ? { refreshToken: refreshValue } : {}),
    ...(typeof expiresIn === 'number' ? { expiresIn } : {}),
  };
}

/**
 * 登录并映射配置的令牌字段。
 * @param data 账号、密码及记住登录选项。
 * @returns 按配置映射后的凭据及秒数有效期。
 * @throws 登录、频率校验失败或令牌响应不符合配置，由登录页展示提示。
 */
export async function login(data: LoginParams): Promise<ApiResponse<LoginResult>> {
  const response = await request.post<ApiResponse<unknown>>('/auth/login', data, {
    skipAuth: true,
    skipAuthRefresh: true,
    skipErrorMessage: true,
  });
  return {
    ...response,
    data: normalizeTokens(response.data, appDefaultSettings.auth.enableRefreshToken),
  };
}

/**
 * Logout
 */
export function logout(): Promise<ApiResponse<null>> {
  return request.post('/auth/logout');
}

/**
 * Get user info
 */
export function getUserInfo(): Promise<ApiResponse<User>> {
  return request.get('/auth/info');
}

/**
 * 使用配置的请求字段和地址刷新凭据，并映射后端响应字段。
 * @param token 当前刷新令牌。
 * @returns 统一的令牌响应；未返回刷新令牌表示继续使用原令牌。
 * @throws 单令牌模式、请求失败或响应字段无效时拒绝。
 */
export async function refreshToken(token: string): Promise<ApiResponse<LoginResult>> {
  const config = appDefaultSettings.auth;
  if (!config.enableRefreshToken) {
    throw new Error('单令牌模式不支持刷新，请重新登录');
  }
  const response = await request.post<ApiResponse<unknown>>(
    config.refreshUrl,
    { [config.refreshTokenRequestField]: token },
    { skipAuth: true, skipAuthRefresh: true, skipErrorMessage: true, skipRedirect: true },
  );
  return { ...response, data: normalizeTokens(response.data, false) };
}
