import { message } from 'antdv-next';
import axios, {
  AxiosError,
  AxiosInstance,
  AxiosRequestConfig,
  AxiosResponse,
  InternalAxiosRequestConfig,
} from 'axios';

import router from '@/router';
import { appDefaultSettings } from '@/settings';
import { useAuthStore } from '@/stores/auth';
import { clearSessionState } from '@/utils/session';

export interface RequestConfig extends AxiosRequestConfig {
  skipAuth?: boolean;
  skipErrorMessage?: boolean;
  skipAuthRefresh?: boolean;
  skipRedirect?: boolean;
}

type RetriableRequestConfig = InternalAxiosRequestConfig &
  RequestConfig & {
    _retry?: boolean;
  };

let refreshPromise: Promise<string> | null = null;
let refreshSessionToken: string | null = null;

export const service: AxiosInstance = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL,
  timeout: 15000,
  headers: {
    'Content-Type': 'application/json',
  },
});

service.interceptors.request.use(
  /**
   * 按源码配置的请求头和前缀注入访问令牌。
   * @param config 本次请求配置。
   * @returns 已添加认证信息的请求配置。
   */
  (config) => {
    const requestConfig = config as RequestConfig;
    const authStore = useAuthStore();

    if (!requestConfig.skipAuth && authStore.token) {
      const { headerName, tokenPrefix } = appDefaultSettings.auth;
      config.headers.set(
        headerName,
        tokenPrefix ? `${tokenPrefix} ${authStore.token}` : authStore.token,
      );
    }

    return config;
  },
  /**
   * Report request setup failure without logging request bodies or credentials.
   * @param error Axios failure; only the diagnostic code is logged.
   * @returns A rejected promise with the original error.
   */
  (error: AxiosError) => {
    console.error('Request error:', error.code);
    if (!(error.config as RequestConfig | undefined)?.skipErrorMessage) {
      message.error('请求发送失败');
    }
    return Promise.reject(error);
  },
);

service.interceptors.response.use(
  (response: AxiosResponse) => {
    const res = response.data;
    const requestConfig = response.config as RequestConfig;

    if (res.code !== undefined && res.code !== 200) {
      if (res.code === 401) {
        return Promise.reject(new Error(res.message || 'Unauthorized'));
      } else if (res.code === 403) {
        console.error('No permission:', res.message);
        if (!requestConfig.skipErrorMessage) {
          message.error(res.message || '没有访问权限');
        }
      } else if (!requestConfig.skipErrorMessage) {
        message.error(res.message || '请求失败');
      }

      return Promise.reject(new Error(res.message || 'Error'));
    }

    return response;
  },
  /**
   * 按单/双令牌配置处理401；双令牌只重试一次，失效时清理会话。
   * @param error Axios failure with an optional backend error message.
   * @returns The retried response or a rejected promise.
   */
  async (error: AxiosError) => {
    const originalRequest = error.config as RetriableRequestConfig | undefined;

    if (error.response?.status === 401 && originalRequest && !originalRequest.skipAuth) {
      const authStore = useAuthStore();
      const sessionToken = authStore.token;
      let failure: unknown = error;
      if (
        appDefaultSettings.auth.enableRefreshToken &&
        !originalRequest._retry &&
        !originalRequest.skipAuthRefresh
      ) {
        originalRequest._retry = true;
        try {
          if (!refreshPromise || refreshSessionToken !== sessionToken) {
            refreshSessionToken = sessionToken;
            const pending = authStore.refreshToken().finally(() => {
              if (refreshPromise === pending) refreshPromise = null;
            });
            refreshPromise = pending;
          }

          const newToken = await refreshPromise;

          if (originalRequest.headers) {
            const { headerName, tokenPrefix } = appDefaultSettings.auth;
            originalRequest.headers.set(
              headerName,
              tokenPrefix ? `${tokenPrefix} ${newToken}` : newToken,
            );
          }

          return service(originalRequest);
        } catch (refreshError) {
          failure = refreshError;
        }
      }
      // 旧会话刷新失败不得清除用户随后建立的新会话。
      if (authStore.token === sessionToken) {
        clearSessionState(router);
        if (!originalRequest.skipErrorMessage) {
          message.error('登录已过期，请重新登录');
        }
        if (!originalRequest.skipRedirect) {
          router.push('/login');
        }
      }
      return Promise.reject(failure);
    }

    console.error('Response error:', error.code, error.response?.status);

    if (error.response) {
      const { status } = error.response;
      const body: unknown = error.response.data;
      const responseMessage =
        typeof body === 'object' &&
        body !== null &&
        'message' in body &&
        typeof body.message === 'string'
          ? body.message
          : undefined;
      const requestConfig = originalRequest as RequestConfig | undefined;

      switch (status) {
        case 403:
          console.error('Access forbidden');
          if (!requestConfig?.skipErrorMessage) {
            message.error('没有访问权限');
          }
          if (!requestConfig?.skipRedirect) {
            router.push('/403');
          }
          break;
        case 404:
          console.error('Resource not found');
          if (!requestConfig?.skipErrorMessage) {
            message.error('请求的资源不存在');
          }
          break;
        case 500:
          console.error('Server error');
          if (!requestConfig?.skipErrorMessage) {
            message.error('服务器错误，请稍后重试');
          }
          if (!requestConfig?.skipRedirect) {
            router.push('/500');
          }
          break;
        default:
          console.error(`Error ${status}:`, error.message);
          if (!requestConfig?.skipErrorMessage) {
            message.error(responseMessage || error.message || '请求失败');
          }
      }
    } else if (error.request) {
      console.error('No response received');
      if (!originalRequest?.skipErrorMessage) {
        message.error('网络连接失败，请检查网络');
      }
    } else {
      console.error('Request setup error:', error.code);
      if (!originalRequest?.skipErrorMessage) {
        message.error('请求配置错误');
      }
    }

    return Promise.reject(error);
  },
);

// Keep Axios responses intact for adapters and retries; API helpers return only the payload.
export const request = {
  get<T = unknown>(url: string, config?: RequestConfig): Promise<T> {
    return service.get<T>(url, config).then((response) => response.data);
  },

  post<T = unknown>(url: string, data?: unknown, config?: RequestConfig): Promise<T> {
    return service.post<T>(url, data, config).then((response) => response.data);
  },

  put<T = unknown>(url: string, data?: unknown, config?: RequestConfig): Promise<T> {
    return service.put<T>(url, data, config).then((response) => response.data);
  },

  delete<T = unknown>(url: string, config?: RequestConfig): Promise<T> {
    return service.delete<T>(url, config).then((response) => response.data);
  },

  patch<T = unknown>(url: string, data?: unknown, config?: RequestConfig): Promise<T> {
    return service.patch<T>(url, data, config).then((response) => response.data);
  },
};

export default service;
