import { API_BASE } from './config';
import { apiCache } from './api-cache';
import { fetchWithRetry } from './http-client';

export interface LoginResponse {
  access_token: string;
  user: {
    id: string;
    username: string;
    role: string;
  };
}

export interface MessageResponse {
  message: string;
}

export interface RefreshResponse {
  access_token: string;
}

class AuthApiError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.status = status;
    this.name = 'AuthApiError';
  }
}

async function handleResponse<T>(res: Response): Promise<T> {
  const text = await res.text();
  let data: any = {};
  try {
    data = text ? JSON.parse(text) : {};
  } catch {
    data = { message: text || 'Đã xảy ra lỗi' };
  }

  if (!res.ok) {
    const message = Array.isArray(data.message)
      ? data.message.join(', ')
      : data.message || data.error || 'Đã xảy ra lỗi';
    throw new AuthApiError(message, res.status);
  }
  return data as T;
}

export const authApi = {
  async login(email: string, password: string, remember: boolean = false): Promise<LoginResponse> {
    const sessionId = tokenStorage.getSessionId();
    const res = await fetch(`${API_BASE}/auth/login`, {
      method: 'POST',
      body: JSON.stringify({ email, password, remember }),
      credentials: 'include', // Important to receive the cookie
      headers: { 'Content-Type': 'application/json', 'X-Auth-Session-Id': sessionId },
    });
    return handleResponse<LoginResponse>(res);
  },

  async register(user_name: string, email: string, password: string): Promise<MessageResponse> {
    const res = await fetch(`${API_BASE}/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ user_name, email, password }),
    });
    return handleResponse<MessageResponse>(res);
  },

  async forgotPassword(email: string): Promise<MessageResponse> {
    const res = await fetch(`${API_BASE}/auth/forgot-password`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email }),
    });
    return handleResponse<MessageResponse>(res);
  },

  async requestPasswordReset(email: string): Promise<any> {
    const res = await fetch(`${API_BASE}/auth/password-reset/request`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email }),
    });
    return handleResponse<any>(res);
  },

  async resendPasswordResetOtp(requestId: string): Promise<any> {
    const res = await fetch(`${API_BASE}/auth/password-reset/resend`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ requestId }),
    });
    return handleResponse<any>(res);
  },

  async verifyPasswordResetOtp(requestId: string, code: string): Promise<any> {
    const res = await fetch(`${API_BASE}/auth/password-reset/verify`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ requestId, code }),
    });
    return handleResponse<any>(res);
  },

  async resetPassword(token: string, newPassword: string): Promise<MessageResponse> {
    const res = await fetch(`${API_BASE}/auth/reset-password`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token, new_password: newPassword }),
    });
    return handleResponse<MessageResponse>(res);
  },

  async completePasswordReset(resetToken: string, newPassword: string, confirmPassword: string): Promise<MessageResponse> {
    const res = await fetch(`${API_BASE}/auth/password-reset/complete`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ resetToken, newPassword, confirmPassword }),
    });
    return handleResponse<MessageResponse>(res);
  },

  async changePassword(old_password: string, new_password: string, accessToken: string): Promise<MessageResponse> {
    const res = await fetch(`${API_BASE}/auth/change-password`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${accessToken}`,
      },
      body: JSON.stringify({ old_password, new_password }),
    });
    return handleResponse<MessageResponse>(res);
  },

  async refreshToken(): Promise<RefreshResponse> {
    console.log(`[AuthApi/Refresh] Requesting ${API_BASE}/auth/refresh`);
    const res = await fetch(`${API_BASE}/auth/refresh`, {
      method: 'POST',
      credentials: 'include', // Important to send the cookie
      headers: { 'Content-Type': 'application/json', 'X-Auth-Session-Id': tokenStorage.getSessionId() },
    });
    console.log(`[AuthApi/Refresh] Response status: ${res.status}`);
    return handleResponse<RefreshResponse>(res);
  },

  async logout(): Promise<MessageResponse> {
    const res = await fetch(`${API_BASE}/auth/logout`, {
      method: 'POST',
      credentials: 'include',
      headers: { 'X-Auth-Session-Id': tokenStorage.getSessionId() },
    });
    return handleResponse<MessageResponse>(res);
  },

  async forkSession(sessionId: string, remember: boolean): Promise<RefreshResponse> {
    const res = await fetch(`${API_BASE}/auth/session/fork`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${tokenStorage.getAccessToken()}`,
        'X-Auth-Session-Id': tokenStorage.getSessionId(),
      },
      body: JSON.stringify({ session_id: sessionId, remember }),
      credentials: 'include',
    });
    return handleResponse<RefreshResponse>(res);
  },
  
  // RBAC Management
  async getUsers(accessToken: string): Promise<any[]> {
    const res = await fetch(`${API_BASE}/auth/users`, {
      headers: { 'Authorization': `Bearer ${accessToken}` },
    });
    return handleResponse<any[]>(res);
  },

  async createUser(data: any, accessToken: string): Promise<any> {
    const res = await fetch(`${API_BASE}/auth/users`, {
      method: 'POST',
      headers: { 
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${accessToken}` 
      },
      body: JSON.stringify(data),
    });
    const result = await handleResponse<any>(res);
    apiCache.invalidate('classes');
    return result;
  },

  async createUsersBulk(data: any, accessToken: string): Promise<any> {
    const res = await fetch(`${API_BASE}/auth/users/bulk-create`, {
      method: 'POST',
      headers: { 
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${accessToken}` 
      },
      body: JSON.stringify(data),
    });
    const result = await handleResponse<any>(res);
    apiCache.invalidate('classes');
    return result;
  },

  async getRoles(accessToken: string): Promise<any[]> {
    const res = await fetch(`${API_BASE}/auth/roles`, {
      headers: { 'Authorization': `Bearer ${accessToken}` },
    });
    return handleResponse<any[]>(res);
  },

  async getPermissions(accessToken: string): Promise<any[]> {
    const res = await fetch(`${API_BASE}/auth/permissions`, {
      headers: { 'Authorization': `Bearer ${accessToken}` },
    });
    return handleResponse<any[]>(res);
  },

  async updateRole(roleId: string, data: any, accessToken: string): Promise<any> {
    const res = await fetch(`${API_BASE}/auth/roles/${roleId}`, {
      method: 'PATCH',
      headers: { 
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${accessToken}` 
      },
      body: JSON.stringify(data),
    });
    return handleResponse<any>(res);
  },

  async createRole(data: any, accessToken: string): Promise<any> {
    const res = await fetch(`${API_BASE}/auth/roles`, {
      method: 'POST',
      headers: { 
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${accessToken}` 
      },
      body: JSON.stringify(data),
    });
    return handleResponse<any>(res);
  },

  async deleteRole(roleId: string, accessToken: string): Promise<any> {
    const res = await fetch(`${API_BASE}/auth/roles/${roleId}`, {
      method: 'DELETE',
      headers: { 'Authorization': `Bearer ${accessToken}` },
    });
    return handleResponse<any>(res);
  },

  async createPermission(data: any, accessToken: string): Promise<any> {
    const res = await fetch(`${API_BASE}/auth/permissions`, {
      method: 'POST',
      headers: { 
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${accessToken}` 
      },
      body: JSON.stringify(data),
    });
    return handleResponse<any>(res);
  },

  async updatePermission(id: string, data: any, accessToken: string): Promise<any> {
    const res = await fetch(`${API_BASE}/auth/permissions/${id}`, {
      method: 'PATCH',
      headers: { 
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${accessToken}` 
      },
      body: JSON.stringify(data),
    });
    return handleResponse<any>(res);
  },

  async deletePermission(id: string, accessToken: string): Promise<any> {
    const res = await fetch(`${API_BASE}/auth/permissions/${id}`, {
      method: 'DELETE',
      headers: { 'Authorization': `Bearer ${accessToken}` },
    });
    return handleResponse<any>(res);
  },

  async getPermissionGroups(accessToken: string): Promise<any[]> {
    const res = await fetch(`${API_BASE}/auth/permission-groups`, {
      headers: { 'Authorization': `Bearer ${accessToken}` },
    });
    return handleResponse<any[]>(res);
  },

  async createPermissionGroup(data: any, accessToken: string): Promise<any> {
    const res = await fetch(`${API_BASE}/auth/permission-groups`, {
      method: 'POST',
      headers: { 
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${accessToken}` 
      },
      body: JSON.stringify(data),
    });
    return handleResponse<any>(res);
  },

  async updatePermissionGroup(id: string, data: any, accessToken: string): Promise<any> {
    const res = await fetch(`${API_BASE}/auth/permission-groups/${id}`, {
      method: 'PATCH',
      headers: { 
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${accessToken}` 
      },
      body: JSON.stringify(data),
    });
    return handleResponse<any>(res);
  },

  async deletePermissionGroup(id: string, accessToken: string): Promise<any> {
    const res = await fetch(`${API_BASE}/auth/permission-groups/${id}`, {
      method: 'DELETE',
      headers: { 'Authorization': `Bearer ${accessToken}` },
    });
    return handleResponse<any>(res);
  },

  async assignRole(userId: string, roleId: string, accessToken: string): Promise<any> {
    const res = await fetch(`${API_BASE}/auth/users/${userId}/role`, {
      method: 'PATCH',
      headers: { 
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${accessToken}` 
      },
      body: JSON.stringify({ role_id: roleId }),
    });
    return handleResponse<any>(res);
  },

  async updateUser(userId: string, data: any, accessToken: string): Promise<any> {
    const res = await fetch(`${API_BASE}/auth/users/${userId}`, {
      method: 'PATCH',
      headers: { 
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${accessToken}` 
      },
      body: JSON.stringify(data),
    });
    const result = await handleResponse<any>(res);
    apiCache.invalidate('classes');
    return result;
  },

  async getMe(accessToken: string): Promise<any> {
    const res = await fetch(`${API_BASE}/auth/me`, {
      headers: { 'Authorization': `Bearer ${accessToken}` },
    });
    return handleResponse<any>(res);
  },

  async updateMe(data: any, accessToken: string): Promise<any> {
    const res = await fetch(`${API_BASE}/auth/me`, {
      method: 'PATCH',
      headers: { 
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${accessToken}` 
      },
      body: JSON.stringify(data),
    });
    return handleResponse<any>(res);
  },
  
  async deleteUser(userId: string, accessToken: string): Promise<any> {
    const res = await fetch(`${API_BASE}/auth/users/${userId}`, {
      method: 'DELETE',
      headers: { 'Authorization': `Bearer ${accessToken}` },
    });
    const result = await handleResponse<any>(res);
    apiCache.invalidate('classes');
    return result;
  },

  async deleteUsersBulk(userIds: string[], accessToken: string): Promise<any> {
    const res = await fetch(`${API_BASE}/auth/users/bulk-delete`, {
      method: 'POST',
      headers: { 
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${accessToken}` 
      },
      body: JSON.stringify({ userIds }),
    });
    const result = await handleResponse<any>(res);
    apiCache.invalidate('classes');
    return result;
  },

  // ─── ROUTE PERMISSION MANAGEMENT ────────────────

  async getRoutePermissions(accessToken: string): Promise<any[]> {
    const res = await fetch(`${API_BASE}/auth/route-permissions`, {
      headers: { 'Authorization': `Bearer ${accessToken}` },
    });
    return handleResponse<any[]>(res);
  },

  async getRoutePermissionsPublic(accessToken?: string, signal?: AbortSignal): Promise<any[]> {
    const headers: Record<string, string> = {};
    if (accessToken) {
      headers['Authorization'] = `Bearer ${accessToken}`;
    }
    const res = await fetchWithRetry(`${API_BASE}/auth/route-permissions/all`, {
      headers,
      signal
    });
    return handleResponse<any[]>(res);
  },

  async createRoutePermission(data: any, accessToken: string): Promise<any> {
    const res = await fetch(`${API_BASE}/auth/route-permissions`, {
      method: 'POST',
      headers: { 
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${accessToken}` 
      },
      body: JSON.stringify(data),
    });
    return handleResponse<any>(res);
  },

  async updateRoutePermission(id: string, data: any, accessToken: string): Promise<any> {
    const res = await fetch(`${API_BASE}/auth/route-permissions/${id}`, {
      method: 'PATCH',
      headers: { 
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${accessToken}` 
      },
      body: JSON.stringify(data),
    });
    return handleResponse<any>(res);
  },

  async deleteRoutePermission(id: string, accessToken: string): Promise<any> {
    const res = await fetch(`${API_BASE}/auth/route-permissions/${id}`, {
      method: 'DELETE',
      headers: { 'Authorization': `Bearer ${accessToken}` },
    });
    return handleResponse<any>(res);
  },

  async getPagePermissionScopes(accessToken: string): Promise<any[]> {
    const res = await fetch(`${API_BASE}/auth/page-permission-scopes`, {
      headers: { 'Authorization': `Bearer ${accessToken}` },
    });
    return handleResponse<any[]>(res);
  },
};

// Token helpers — supports "remember login" persistence
export const tokenStorage = {
  setSessionId(value: string) {
    sessionStorage.setItem('auth_session_id', value);
    localStorage.setItem('auth_session_id', value);
  },
  getSessionId(): string {
    const key = 'auth_session_id';
    let value = sessionStorage.getItem(key);
    if (!value) {
      value = localStorage.getItem('auth_session_id') || (typeof crypto !== 'undefined' && crypto.randomUUID
        ? crypto.randomUUID()
        : `${Math.random().toString(36).slice(2)}${Date.now()}`);
      sessionStorage.setItem(key, value);
      localStorage.setItem(key, value);
    }
    return value;
  },
  // ─── Remember flag ────────────────────────────────
  setRemember(remember: boolean) {
    sessionStorage.setItem('remember_login', remember ? 'true' : 'false');
    if (remember) {
      localStorage.setItem('remember_login', 'true');
    } else {
      localStorage.removeItem('remember_login');
    }
  },
  getRemember(): boolean {
    return sessionStorage.getItem('remember_login') === 'true'
      || localStorage.getItem('remember_login') === 'true';
  },

  // ─── Access Token ─────────────────────────────────
  // remember=true  → localStorage  (persists across browser close)
  // remember=false → sessionStorage (cleared when browser closes)
  setAccessToken(access_token: string) {
    sessionStorage.setItem('access_token', access_token);
  },
  getAccessToken(): string | null {
    return sessionStorage.getItem('access_token');
  },

  // ─── Clear All ────────────────────────────────────
  clearTokens() {
    sessionStorage.removeItem('access_token');
    sessionStorage.removeItem('remember_login');
    localStorage.removeItem('remember_login');
    sessionStorage.removeItem('user');
    try {
      const keysToRemove: string[] = [];
      for (let i = 0; i < sessionStorage.length; i++) {
        const key = sessionStorage.key(i);
        if (key && key.startsWith('congrats_shown_')) {
          keysToRemove.push(key);
        }
      }
      keysToRemove.forEach(key => sessionStorage.removeItem(key));
    } catch (e) {
      console.error('Failed to clear congrats storage keys:', e);
    }
  },

  // ─── Saved Email (for pre-fill on login page) ────
  setSavedEmail(email: string) {
    localStorage.setItem('saved_login_email', email);
  },
  getSavedEmail(): string | null {
    return localStorage.getItem('saved_login_email');
  },
  clearSavedEmail() {
    localStorage.removeItem('saved_login_email');
  },

  // ─── User Info ────────────────────────────────────
  setUser(user: any) {
    sessionStorage.setItem('user', JSON.stringify(user));
  },
  getUser(): any | null {
    const raw = sessionStorage.getItem('user');
    if (!raw) return null;
    try {
      return JSON.parse(raw);
    } catch {
      sessionStorage.removeItem('user');
      return null;
    }
  },
};
