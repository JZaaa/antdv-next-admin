import type { User, Role, Permission } from '@/types/auth';

import { defineStore } from 'pinia';
import { ref, computed } from 'vue';

import avatarImg from '@/assets/images/avatar-256.png';
import { ALL_PERMISSION } from '@/constants/permissions';
import { appDefaultSettings } from '@/settings';
import { appLocalStorage, appSessionStorage } from '@/utils/cache';

const TOKEN_KEY = 'access_token';
const REFRESH_TOKEN_KEY = 'refresh_token';
const USER_KEY = 'user_info';
const TOKEN_EXPIRES_KEY = 'token_expires_at';
const USER_DATA_VERSION_KEY = 'user_data_version';

/**
 * Increment this version when the user data schema changes
 * (e.g. avatar format migration). Stale cached data from older
 * versions will be discarded so the next login / getUserInfo
 * call repopulates it with the current format.
 */
const CURRENT_USER_DATA_VERSION = 1;

const LEGACY_ASSET_AVATAR_PATTERN = /^\/assets\/avatar-[\w-]+\.png$/;

/**
 * Additional legacy patterns that should be migrated to DiceBear.
 * Covers common faker.image.avatar() output formats and old
 * asset paths that may be cached in appLocalStorage.
 */
const LEGACY_AVATAR_PATTERNS = [
  // Old static asset paths
  /^\/assets\/images\/avatar\.png$/,
  /^\/assets\/avatar\.(png|jpg|jpeg|webp)$/,
  // faker.image.avatar() legacy formats (picsum, loremflickr, etc.)
  /^https?:\/\/picsum\.photos\/.*/,
  /^https?:\/\/loremflickr\.com\/.*/,
  // GitHub avatars (faker avatarGitHub)
  /^https?:\/\/avatars\.githubusercontent\.com\/u\/\d+.*/,
  // cloudflare-ipfs (old faker image provider)
  /^https?:\/\/cloudflare-ipfs\.com\/.*/,
];

const DEFAULT_TOKEN_EXPIRY_MS = 24 * 60 * 60 * 1000;

function decodeJwtPayload(token: string): Record<string, unknown> | null {
  try {
    const base64Url = token.split('.')[1];
    if (!base64Url) return null;
    const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
    const jsonPayload = decodeURIComponent(
      atob(base64)
        .split('')
        .map((c) => '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2))
        .join(''),
    );
    return JSON.parse(jsonPayload);
  } catch {
    return null;
  }
}

function isLegacyAvatar(avatar: string): boolean {
  if (LEGACY_ASSET_AVATAR_PATTERN.test(avatar)) {
    return true;
  }
  return LEGACY_AVATAR_PATTERNS.some((pattern) => pattern.test(avatar));
}

function normalizeUserInfo(userInfo: User): User {
  if (!isLegacyAvatar(userInfo.avatar)) {
    return userInfo;
  }

  return {
    ...userInfo,
    avatar: avatarImg,
  };
}

/**
 * 按源码配置管理单/双令牌协议，成套恢复当前会话的凭据和用户缓存。
 * @returns 认证状态、身份权限及会话生命周期操作。
 */
export const useAuthStore = defineStore('auth', () => {
  // 先选择会话来源，缺失字段也不得从另一账号的存储补齐。
  const credentialStorage = appSessionStorage.getItem(TOKEN_KEY)
    ? appSessionStorage
    : appLocalStorage;
  const token = ref<string | null>(credentialStorage.getItem(TOKEN_KEY));
  const remembered = ref(Boolean(token.value) && credentialStorage === appLocalStorage);
  const sessionChanged = ref(false);
  const refreshTokenValue = ref<string | null>(
    appDefaultSettings.auth.enableRefreshToken
      ? credentialStorage.getItem(REFRESH_TOKEN_KEY)
      : null,
  );
  let refreshPromise: Promise<string> | null = null;
  let sessionVersion = 0;
  if (!appDefaultSettings.auth.enableRefreshToken) {
    credentialStorage.removeItem(REFRESH_TOKEN_KEY);
  }
  const tokenExpiresAt = ref<number | null>(null);
  const user = ref<User | null>(null);
  const roles = ref<Role[]>([]);
  const permissions = ref<Permission[]>([]);

  const savedExpires = credentialStorage.getItem(TOKEN_EXPIRES_KEY);
  if (savedExpires) {
    tokenExpiresAt.value = parseInt(savedExpires, 10);
  }

  const isTokenExpired = computed(() => {
    if (!token.value) return true;
    if (!tokenExpiresAt.value) return false;
    return Date.now() >= tokenExpiresAt.value;
  });

  const isLoggedIn = computed(() => !!token.value && !!user.value && !isTokenExpired.value);
  const userRoles = computed(() => roles.value.map((role) => role.code));
  const userPermissions = computed(() => permissions.value.map((perm) => perm.code));

  /**
   * 保存当前会话的令牌及有效期，退出或续期不得覆盖其他标签页的新登录。
   * @param newToken 新访问令牌，null清除会话凭据。
   * @param newRefreshToken undefined保留原刷新令牌，null清除。
   * @param expiresIn 有效秒数，缺省沿用JWT exp或24小时兜底。
   * @returns 无返回值。
   * @throws 共享会话已变更时拒绝旧页面续期写入。
   */
  const setToken = (
    newToken: string | null,
    newRefreshToken?: string | null,
    expiresIn?: number,
  ): void => {
    const previousToken = token.value;
    if (newToken && previousToken && !checkSession()) {
      throw new Error('登录状态已在其他标签页变更，请刷新页面');
    }
    const storage = remembered.value ? appLocalStorage : appSessionStorage;
    sessionVersion += 1;
    refreshPromise = null;
    token.value = newToken;
    // 共享凭据已被替换时仅清除当前页面内存，不删除其他会话。
    if (!newToken && remembered.value && storage.getItem(TOKEN_KEY) !== previousToken) {
      tokenExpiresAt.value = null;
      refreshTokenValue.value = null;
      return;
    }
    if (newToken) {
      storage.setItem(TOKEN_KEY, newToken);

      let expiresAt: number;
      if (expiresIn !== undefined && expiresIn > 0) {
        expiresAt = Date.now() + expiresIn * 1000;
      } else {
        const payload = decodeJwtPayload(newToken);
        if (payload?.exp && typeof payload.exp === 'number') {
          expiresAt = payload.exp * 1000;
        } else {
          expiresAt = Date.now() + DEFAULT_TOKEN_EXPIRY_MS;
        }
      }
      tokenExpiresAt.value = expiresAt;
      storage.setItem(TOKEN_EXPIRES_KEY, expiresAt.toString());
    } else {
      storage.removeItem(TOKEN_KEY);
      tokenExpiresAt.value = null;
      storage.removeItem(TOKEN_EXPIRES_KEY);
    }

    const refreshValue =
      newToken && appDefaultSettings.auth.enableRefreshToken ? newRefreshToken : null;
    if (refreshValue !== undefined) {
      refreshTokenValue.value = refreshValue;
      if (refreshValue) {
        storage.setItem(REFRESH_TOKEN_KEY, refreshValue);
      } else {
        storage.removeItem(REFRESH_TOKEN_KEY);
      }
    }
  };

  /**
   * 检查共享凭据是否被替换或清除，不将其他账号凭据注入当前页面。
   * @returns 会话未变更时为 true；变更提示保持至重新加载或显式重新登录。
   */
  function checkSession(): boolean {
    if (remembered.value && token.value && appLocalStorage.getItem(TOKEN_KEY) !== token.value) {
      sessionChanged.value = true;
    }
    return !sessionChanged.value;
  }

  /**
   * 将资料、角色和权限缓存到当前凭据所在存储，避免覆盖其他账号缓存。
   * @param userInfo 当前账号资料；null 清除当前页面身份。
   * @returns 无返回值。
   * @throws 共享凭据已变更时拒绝保存迟到的身份响应。
   */
  const setUserInfo = (userInfo: User | null): void => {
    if (userInfo && !checkSession()) {
      throw new Error('登录状态已在其他标签页变更，请刷新页面');
    }
    const storage = remembered.value ? appLocalStorage : appSessionStorage;
    const normalizedUserInfo = userInfo ? normalizeUserInfo(userInfo) : null;
    user.value = normalizedUserInfo;
    if (normalizedUserInfo) {
      roles.value = normalizedUserInfo.roles || [];
      permissions.value = normalizedUserInfo.permissions || [];
      storage.setItem(USER_KEY, JSON.stringify(normalizedUserInfo));
      storage.setItem(USER_DATA_VERSION_KEY, String(CURRENT_USER_DATA_VERSION));
    } else {
      roles.value = [];
      permissions.value = [];
      if (!remembered.value || storage.getItem(TOKEN_KEY) === token.value) {
        storage.removeItem(USER_KEY);
        storage.removeItem(USER_DATA_VERSION_KEY);
      }
    }
  };

  /**
   * 登录并按源码策略保存整套会话，身份获取失败时清除半登录状态。
   * @param username 登录账号。
   * @param password 登录密码，不缓存。
   * @param remember 默认读取源码配置；禁止选择时忽略传入值并使用固定策略。
   * @returns 登录和身份读取完成。
   * @throws 登录、身份请求失败或共享会话已变更。
   */
  const login = async (
    username: string,
    password: string,
    remember = appDefaultSettings.auth.rememberLogin,
  ): Promise<void> => {
    const { login: loginApi, getUserInfo } = await import('@/api/auth');
    logout();
    sessionChanged.value = false;
    remembered.value = appDefaultSettings.auth.enableRememberLogin
      ? remember
      : appDefaultSettings.auth.rememberLogin;
    try {
      const loginResult = await loginApi({ username, password });
      setToken(loginResult.data.token, loginResult.data.refreshToken, loginResult.data.expiresIn);
      const userInfo = await getUserInfo();
      setUserInfo(userInfo.data);
    } catch (error: unknown) {
      logout();
      throw error;
    }
  };

  /** 清除当前页面身份及其拥有的凭据；主动退出使用 signOut。@returns 无返回值。 */
  const logout = (): void => {
    setToken(null, null);
    setUserInfo(null);
  };

  /**
   * 主动退出立即清除本地凭据和身份，后台通知服务端，失败不影响本地退出。
   * @returns 后台通知处理完成，错误已静默捕获；交互层无需等待。
   */
  async function signOut(): Promise<void> {
    const currentToken = token.value;
    logout();
    try {
      const api = await import('@/api/auth');
      await api.logout(currentToken);
    } catch {
      // 服务端不可用或凭据失效时，本地退出仍已完成。
    }
  }

  /**
   * 双令牌模式合并并发刷新，并阻止退出或切换账号后的旧响应恢复会话。
   * @returns 更新后的访问令牌；刷新响应省略刷新令牌时保留旧值。
   * @throws 单令牌模式、缺少刷新令牌、当前或跨标签页会话已变更、刷新请求失败。
   */
  async function refreshToken(): Promise<string> {
    if (!checkSession()) {
      throw new Error('登录状态已在其他标签页变更，请刷新页面');
    }
    if (!appDefaultSettings.auth.enableRefreshToken || !refreshTokenValue.value) {
      throw new Error('登录已失效，请重新登录');
    }
    if (refreshPromise) return refreshPromise;
    const version = sessionVersion;
    const currentRefreshToken = refreshTokenValue.value;
    /** @returns 刷新并保存当前会话的凭据。@throws 请求失败或会话已变更。 */
    const refresh = async (): Promise<string> => {
      const { refreshToken: refreshTokenApi } = await import('@/api/auth');
      const result = await refreshTokenApi(currentRefreshToken);
      if (version !== sessionVersion) {
        throw new Error('认证会话已变更');
      }
      setToken(result.data.token, result.data.refreshToken, result.data.expiresIn);
      return result.data.token;
    };
    const pending = refresh();
    refreshPromise = pending;
    try {
      return await pending;
    } finally {
      if (refreshPromise === pending) refreshPromise = null;
    }
  }

  const hasRole = (role: string): boolean => {
    return userRoles.value.includes(role);
  };

  const hasAnyRole = (roleList: string[]): boolean => {
    return roleList.some((role) => hasRole(role));
  };

  const hasAllRoles = (roleList: string[]): boolean => {
    return roleList.every((role) => hasRole(role));
  };

  const hasPermission = (permission: string): boolean => {
    return (
      userPermissions.value.includes(ALL_PERMISSION) || userPermissions.value.includes(permission)
    );
  };

  const hasAnyPermission = (permissionList: string[]): boolean => {
    return permissionList.some((perm) => hasPermission(perm));
  };

  const hasAllPermissions = (permissionList: string[]): boolean => {
    return permissionList.every((perm) => hasPermission(perm));
  };

  /**
   * 从凭据所在存储恢复身份缓存；双令牌模式在启动时刷新过期访问令牌。
   * @returns 会话恢复完成；刷新失败时清除凭据和身份。
   */
  const initAuth = async (): Promise<void> => {
    if (!token.value || !checkSession()) return;
    if (token.value && tokenExpiresAt.value !== null && Date.now() >= tokenExpiresAt.value) {
      if (!appDefaultSettings.auth.enableRefreshToken || !refreshTokenValue.value) {
        logout();
        return;
      }
      const version = sessionVersion;
      try {
        await refreshToken();
      } catch {
        if (version === sessionVersion) logout();
        return;
      }
    }

    if (!checkSession()) return;
    const storage = remembered.value ? appLocalStorage : appSessionStorage;
    // Discard cached user data written by an older version of the app
    const cachedVersion = storage.getItem(USER_DATA_VERSION_KEY);
    if (cachedVersion !== null && parseInt(cachedVersion, 10) !== CURRENT_USER_DATA_VERSION) {
      storage.removeItem(USER_KEY);
      storage.removeItem(USER_DATA_VERSION_KEY);
    }

    const savedUser = storage.getItem(USER_KEY);
    if (savedUser) {
      try {
        const userInfo = JSON.parse(savedUser);
        // Re-normalise on every boot — catches legacy avatar URLs
        // that were stored before the current patterns were added.
        setUserInfo(userInfo);
      } catch (error) {
        console.error('Failed to parse saved user info:', error);
        storage.removeItem(USER_KEY);
        storage.removeItem(USER_DATA_VERSION_KEY);
      }
    }
  };

  return {
    sessionChanged,
    checkSession,
    token,
    refreshTokenValue,
    tokenExpiresAt,
    user,
    roles,
    permissions,
    isTokenExpired,
    isLoggedIn,
    userRoles,
    userPermissions,
    setToken,
    setUserInfo,
    login,
    logout,
    signOut,
    refreshToken,
    hasRole,
    hasAnyRole,
    hasAllRoles,
    hasPermission,
    hasAnyPermission,
    hasAllPermissions,
    initAuth,
  };
});
