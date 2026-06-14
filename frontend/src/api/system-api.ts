import { httpClient, handleResponse } from './http-client';
import { tokenStorage } from './auth-api';

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';

export interface MessageResponse {
  message: string;
}

export interface LoginLog {
  _id: string;
  user_id: {
    _id: string;
    user_name: string;
    email: string;
    role: {
      name: string;
      role_code: string;
    };
  } | null;
  ip_address: string;
  action: 'login_success' | 'login_failure' | 'logout' | 'password_reset' | 'password_change' | 'admin_reset_password';
  login_time: string;
  details?: string;
  createdAt: string;
}

export interface LoginLogsSummary {
  today: {
    login_success: number;
    login_failure: number;
    logout: number;
    password_reset: number;
    password_change: number;
    admin_reset_password: number;
    total: number;
  };
  sevenDays: {
    login_success: number;
    login_failure: number;
    logout: number;
    password_reset: number;
    password_change: number;
    admin_reset_password: number;
    total: number;
  };
}

export interface SystemRequest {
  _id: string;
  title: string;
  description?: string;
  type: 'access' | 'data_change' | 'support' | 'backup' | 'other';
  status: 'pending' | 'in_progress' | 'approved' | 'rejected' | 'completed' | 'cancelled';
  priority: 'low' | 'medium' | 'high' | 'critical';
  requester_id: {
    _id: string;
    user_name: string;
    email: string;
  };
  assignee_id?: {
    _id: string;
    user_name: string;
    email: string;
  } | null;
  related_entity_type?: string;
  related_entity_id?: string;
  metadata?: {
    history?: Array<{
      status: string;
      decision_note: string;
      updated_by: string;
      updated_at: string;
    }>;
    [key: string]: any;
  };
  status_history?: Array<{
    from_status: string;
    to_status: string;
    note: string;
    changed_by: string;
    changed_at: string;
  }>;
  decision_note?: string;
  createdAt: string;
  updatedAt: string;
}

export interface BackupJob {
  _id: string;
  status: 'queued' | 'running' | 'success' | 'failed';
  requested_by: {
    _id: string;
    user_name: string;
    email: string;
  };
  started_at?: string;
  finished_at?: string;
  file_name?: string;
  file_size?: number;
  collections?: string[];
  error_message?: string;
  createdAt: string;
}

export interface PaginatedResponse<T> {
  items: T[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export interface SystemPerformanceSummary {
  p50: Record<string, number>;
  p75: Record<string, number>;
  p95: Record<string, number>;
  average: Record<string, number>;
  total_samples: number;
  slow_apis: Array<{
    name: string;
    avg: number;
    p75: number;
    p95: number;
    samples: number;
  }>;
  recommendations: Array<{
    severity: 'critical' | 'warning' | 'info';
    code: string;
    message: string;
  }>;
}

export interface SystemPerformanceMetricPayload {
  route: string;
  device_type: 'desktop' | 'tablet' | 'mobile' | 'unknown';
  network_effective_type?: string;
  navigation_type?: 'navigate' | 'reload' | 'back_forward' | 'prerender' | 'unknown';
  ttfb_ms?: number;
  dom_content_loaded_ms?: number;
  load_event_ms?: number;
  fcp_ms?: number;
  lcp_ms?: number;
  cls?: number;
  inp_ms?: number;
  api_total_ms?: number;
  api_breakdown?: Array<{
    name: string;
    duration_ms: number;
    status?: number;
    ok?: boolean;
  }>;
}

export const systemApi = {
  // ─── LOGIN LOGS ─────────────────────────────────────────────────────────────
  async getLoginLogs(query: {
    page?: number;
    limit?: number;
    action?: string;
    userId?: string;
    ip?: string;
    from?: string;
    to?: string;
    search?: string;
  }): Promise<PaginatedResponse<LoginLog>> {
    const params = new URLSearchParams();
    Object.entries(query).forEach(([key, value]) => {
      if (value !== undefined && value !== null && value !== '') {
        params.append(key, String(value));
      }
    });
    const res = await httpClient(`${API_BASE}/api/system/login-logs?${params.toString()}`);
    return handleResponse<PaginatedResponse<LoginLog>>(res);
  },

  async getLoginLogsSummary(): Promise<LoginLogsSummary> {
    const res = await httpClient(`${API_BASE}/api/system/login-logs/summary`);
    return handleResponse<LoginLogsSummary>(res);
  },

  // ─── SYSTEM REQUESTS ─────────────────────────────────────────────────────────
  async getRequests(query: {
    page?: number;
    limit?: number;
    status?: string;
    type?: string;
    priority?: string;
    requesterId?: string;
    assigneeId?: string;
    search?: string;
    from?: string;
    to?: string;
  }): Promise<PaginatedResponse<SystemRequest>> {
    const params = new URLSearchParams();
    Object.entries(query).forEach(([key, value]) => {
      if (value !== undefined && value !== null && value !== '') {
        params.append(key, String(value));
      }
    });
    const res = await httpClient(`${API_BASE}/api/system/requests?${params.toString()}`);
    return handleResponse<PaginatedResponse<SystemRequest>>(res);
  },

  async getRequest(id: string): Promise<SystemRequest> {
    const res = await httpClient(`${API_BASE}/api/system/requests/${id}`);
    return handleResponse<SystemRequest>(res);
  },

  async createRequest(data: {
    title: string;
    description?: string;
    type: string;
    priority?: string;
    related_entity_type?: string;
    related_entity_id?: string;
    metadata?: Record<string, any>;
  }): Promise<SystemRequest> {
    const res = await httpClient(`${API_BASE}/api/system/requests`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    return handleResponse<SystemRequest>(res);
  },

  async updateRequest(
    id: string,
    data: {
      title?: string;
      description?: string;
      priority?: string;
      assignee_id?: string;
      metadata?: Record<string, any>;
    },
  ): Promise<SystemRequest> {
    const res = await httpClient(`${API_BASE}/api/system/requests/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    return handleResponse<SystemRequest>(res);
  },

  async updateRequestStatus(
    id: string,
    data: {
      status: string;
      decision_note: string;
    },
  ): Promise<SystemRequest> {
    const res = await httpClient(`${API_BASE}/api/system/requests/${id}/status`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    return handleResponse<SystemRequest>(res);
  },

  async deleteRequest(id: string): Promise<MessageResponse> {
    const res = await httpClient(`${API_BASE}/api/system/requests/${id}`, {
      method: 'DELETE',
    });
    return handleResponse<MessageResponse>(res);
  },

  // ─── DATABASE BACKUPS ────────────────────────────────────────────────────────
  async getBackups(query: { page?: number; limit?: number }): Promise<PaginatedResponse<BackupJob>> {
    const params = new URLSearchParams();
    Object.entries(query).forEach(([key, value]) => {
      if (value !== undefined && value !== null && (value as any) !== '') {
        params.append(key, String(value));
      }
    });
    const res = await httpClient(`${API_BASE}/api/system/backups?${params.toString()}`);
    return handleResponse<PaginatedResponse<BackupJob>>(res);
  },

  async createBackup(): Promise<BackupJob> {
    const res = await httpClient(`${API_BASE}/api/system/backups`, {
      method: 'POST',
    });
    return handleResponse<BackupJob>(res);
  },

  async deleteBackup(id: string): Promise<MessageResponse> {
    const res = await httpClient(`${API_BASE}/api/system/backups/${id}`, {
      method: 'DELETE',
    });
    return handleResponse<MessageResponse>(res);
  },

  async downloadBackup(id: string, fileName: string, accessToken: string): Promise<void> {
    const res = await httpClient(`${API_BASE}/api/system/backups/${id}/download`, {
      headers: {
        'Authorization': `Bearer ${accessToken}`,
      },
    });
    
    if (!res.ok) {
      throw new Error('Tải file sao lưu thất bại');
    }
    
    const blob = await res.blob();
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = fileName;
    document.body.appendChild(a);
    a.click();
    a.remove();
    window.URL.revokeObjectURL(url);
  },

  // ─── PERFORMANCE METRICS ───────────────────────────────────────────────────
  async sendPerformanceMetrics(payload: SystemPerformanceMetricPayload): Promise<void> {
    const url = `${API_BASE}/api/system/performance/metrics`;
    const tokenStr = tokenStorage.getAccessToken();
    let headers: HeadersInit = { 'Content-Type': 'application/json' };
    if (tokenStr) {
      headers['Authorization'] = `Bearer ${tokenStr}`;
    }
    
    try {
      await fetch(url, {
        method: 'POST',
        headers,
        body: JSON.stringify(payload),
        keepalive: true,
      });
    } catch (err) {
      console.warn('Failed to send performance metrics', err);
    }
  },

  async getPerformanceSummary(query?: { from?: string; to?: string; route?: string }): Promise<SystemPerformanceSummary> {
    const params = new URLSearchParams();
    if (query) {
      Object.entries(query).forEach(([key, value]) => {
        if (value !== undefined && value !== null && value !== '') {
          params.append(key, String(value));
        }
      });
    }
    const res = await httpClient(`${API_BASE}/api/system/performance/summary?${params.toString()}`);
    return handleResponse<SystemPerformanceSummary>(res);
  },
};
