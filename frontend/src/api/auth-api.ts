import { API_BASE } from './config';

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
  const data = await res.json();
  if (!res.ok) {
    throw new AuthApiError(
      data.message || data.error || 'Đã xảy ra lỗi',
      res.status,
    );
  }
  return data as T;
}

export const authApi = {
  async login(email: string, password: string, remember: boolean = false): Promise<LoginResponse> {
    const res = await fetch(`${API_BASE}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password, remember }),
      credentials: 'include', // Important to receive the cookie
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

  async resetPassword(token: string, new_password: string): Promise<MessageResponse> {
    const res = await fetch(`${API_BASE}/auth/reset-password`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token, new_password }),
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
    const res = await fetch(`${API_BASE}/auth/refresh`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include', // Important to send the cookie
    });
    return handleResponse<RefreshResponse>(res);
  },

  async logout(): Promise<MessageResponse> {
    const res = await fetch(`${API_BASE}/auth/logout`, {
      method: 'POST',
      credentials: 'include',
    });
    return handleResponse<MessageResponse>(res);
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
    return handleResponse<any>(res);
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
    return handleResponse<any>(res);
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
    return handleResponse<any>(res);
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
    return handleResponse<any>(res);
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
    return handleResponse<any>(res);
  },

  // ─── ROUTE PERMISSION MANAGEMENT ────────────────

  async getRoutePermissions(accessToken: string): Promise<any[]> {
    const res = await fetch(`${API_BASE}/auth/route-permissions`, {
      headers: { 'Authorization': `Bearer ${accessToken}` },
    });
    return handleResponse<any[]>(res);
  },

  async getRoutePermissionsPublic(accessToken?: string): Promise<any[]> {
    const headers: Record<string, string> = {};
    if (accessToken) {
      headers['Authorization'] = `Bearer ${accessToken}`;
    }
    const res = await fetch(`${API_BASE}/auth/route-permissions/all`, {
      headers
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

// Token helpers (localStorage)
export const tokenStorage = {
  setAccessToken(access_token: string) {
    sessionStorage.setItem('access_token', access_token);
  },
  getAccessToken(): string | null {
    return sessionStorage.getItem('access_token');
  },
  clearTokens() {
    sessionStorage.removeItem('access_token');
    localStorage.removeItem('user');
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
  setUser(user: any) {
    localStorage.setItem('user', JSON.stringify(user));
  },
  getUser(): any | null {
    const raw = localStorage.getItem('user');
    return raw ? JSON.parse(raw) : null;
  },
};
