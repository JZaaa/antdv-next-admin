// Authentication Types

/** 仅由源码配置的认证协议，不参与用户偏好缓存。 */
export interface AuthSettings {
  enableRefreshToken: boolean;
  /** 登录和刷新响应 data 中的访问令牌字段。 */
  tokenField: string;
  /** 登录和刷新响应 data 中的刷新令牌字段。 */
  refreshTokenField: string;
  /** 响应 data 中的有效时长字段，单位为秒。 */
  expiresInField: string;
  /** 刷新请求 JSON 中的刷新令牌字段。 */
  refreshTokenRequestField: string;
  refreshUrl: string;
  headerName: string;
  /** 认证前缀；空字符串表示直接发送令牌。 */
  tokenPrefix: string;
}

export interface LoginParams {
  username: string;
  password: string;
  remember?: boolean;
}

export interface LoginResult {
  token: string;
  refreshToken?: string;
  expiresIn?: number;
}

export interface User {
  id: string;
  username: string;
  email: string;
  realName: string;
  avatar: string;
  phone: string;
  gender?: 'male' | 'female';
  birthDate?: string;
  bio?: string;
  status: 'active' | 'inactive';
  createdAt: string;
  updatedAt: string;
  roles: Role[];
  permissions: Permission[];
}

export interface Role {
  id: string;
  name: string;
  code: string;
  description: string;
  permissions: Permission[];
  createdAt: string;
  updatedAt: string;
}

export type LocalizedText = Record<string, string>;

export interface Permission {
  id: string;
  name: string | LocalizedText;
  code: string;
  description: string;
  resource: string;
  action: string;
  type: 'menu' | 'button' | 'api';
  parentId?: string;
  path?: string;
  component?: string;
  icon?: string;
  sort?: number;
  status?: 'active' | 'inactive';
  visible?: boolean;
  children?: Permission[];
}
