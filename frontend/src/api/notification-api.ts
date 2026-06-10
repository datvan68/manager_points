import { tokenStorage } from './auth-api';

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';

export interface NotificationItem {
  id: string;
  _id?: string;
  title: string;
  description: string;
  type: 'warning' | 'success' | 'info' | 'system';
  isRead: boolean;
  routeUrl?: string;
  recipientUserId?: string | null;
  createdBy?: string | null;
  readByUserIds?: string[];
  source?: string;
  metadata?: Record<string, any>;
  createdAt?: string;
  updatedAt?: string;
}

export interface CreateNotificationDto {
  title: string;
  description: string;
  type?: 'warning' | 'success' | 'info' | 'system';
  routeUrl?: string;
  recipientUserId?: string;
  source?: string;
  metadata?: Record<string, any>;
}

export interface UpdateNotificationDto {
  title?: string;
  description?: string;
  type?: 'warning' | 'success' | 'info' | 'system';
  routeUrl?: string;
  isRead?: boolean;
  metadata?: Record<string, any>;
}

export interface QueryNotificationDto {
  page?: number;
  limit?: number;
  type?: 'all' | 'unread' | 'warning' | 'success' | 'info' | 'system';
  isRead?: string;
  search?: string;
  recipientUserId?: string;
}

async function handleResponse<T>(res: Response): Promise<T> {
  const text = await res.text();
  let data: any;
  try {
    data = text ? JSON.parse(text) : {};
  } catch (e) {
    data = { message: text || 'Đã xảy ra lỗi phản hồi từ máy chủ' };
  }
  if (!res.ok) {
    throw new Error(data.message || data.error || 'Đã xảy ra lỗi');
  }
  return data as T;
}

function authHeaders(extra?: HeadersInit): HeadersInit {
  const token = tokenStorage.getAccessToken();
  return {
    ...(extra || {}),
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };
}

export const notificationApi = {
  async getNotifications(query: QueryNotificationDto): Promise<{
    items: NotificationItem[];
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  }> {
    const params = new URLSearchParams();
    if (query.page) params.append('page', query.page.toString());
    if (query.limit) params.append('limit', query.limit.toString());
    if (query.type && query.type !== 'all' && query.type !== 'unread') {
      params.append('type', query.type);
    }
    if (query.type === 'unread') {
      params.append('isRead', 'false');
    } else if (query.isRead !== undefined) {
      params.append('isRead', query.isRead);
    }
    if (query.search) params.append('search', query.search);
    if (query.recipientUserId) params.append('recipientUserId', query.recipientUserId);

    const queryString = params.toString();
    const url = `${API_BASE}/notifications${queryString ? `?${queryString}` : ''}`;

    const res = await fetch(url, {
      headers: authHeaders(),
    });
    const data = await handleResponse<{
      items: any[];
      total: number;
      page: number;
      limit: number;
      totalPages: number;
    }>(res);

    return {
      ...data,
      items: data.items.map((item) => ({
        ...item,
        id: item._id || item.id,
      })),
    };
  },

  async getUnreadCount(): Promise<{ count: number }> {
    const res = await fetch(`${API_BASE}/notifications/unread-count`, {
      headers: authHeaders(),
    });
    return handleResponse<{ count: number }>(res);
  },

  async getCountSummary(): Promise<{
    all: number;
    unread: number;
    warning: number;
    success: number;
    info: number;
    system: number;
  }> {
    const res = await fetch(`${API_BASE}/notifications/count-summary`, {
      headers: authHeaders(),
    });
    return handleResponse<any>(res);
  },

  async createNotification(dto: CreateNotificationDto): Promise<NotificationItem> {
    const res = await fetch(`${API_BASE}/notifications`, {
      method: 'POST',
      headers: authHeaders({ 'Content-Type': 'application/json' }),
      body: JSON.stringify(dto),
    });
    const item = await handleResponse<any>(res);
    return { ...item, id: item._id || item.id };
  },

  async updateNotification(id: string, dto: UpdateNotificationDto): Promise<NotificationItem> {
    const res = await fetch(`${API_BASE}/notifications/${id}`, {
      method: 'PATCH',
      headers: authHeaders({ 'Content-Type': 'application/json' }),
      body: JSON.stringify(dto),
    });
    const item = await handleResponse<any>(res);
    return { ...item, id: item._id || item.id };
  },

  async markRead(id: string): Promise<NotificationItem> {
    const res = await fetch(`${API_BASE}/notifications/${id}/read`, {
      method: 'PATCH',
      headers: authHeaders(),
    });
    const item = await handleResponse<any>(res);
    return { ...item, id: item._id || item.id };
  },

  async markAllRead(): Promise<any> {
    const res = await fetch(`${API_BASE}/notifications/read-all`, {
      method: 'PATCH',
      headers: authHeaders(),
    });
    return handleResponse<any>(res);
  },

  async deleteNotification(id: string): Promise<NotificationItem> {
    const res = await fetch(`${API_BASE}/notifications/${id}`, {
      method: 'DELETE',
      headers: authHeaders(),
    });
    const item = await handleResponse<any>(res);
    return { ...item, id: item._id || item.id };
  },

  async deleteNotificationsBulk(ids: string[]): Promise<{ matchedCount: number; modifiedCount: number }> {
    const res = await fetch(`${API_BASE}/notifications/delete-bulk`, {
      method: 'POST',
      headers: authHeaders({ 'Content-Type': 'application/json' }),
      body: JSON.stringify({ ids }),
    });
    return handleResponse<any>(res);
  },

  async getNotificationReaders(id: string): Promise<Array<{
    id: string;
    user_name: string;
    email: string;
    roleName: string;
  }>> {
    const res = await fetch(`${API_BASE}/notifications/${id}/readers`, {
      headers: authHeaders(),
    });
    return handleResponse<any>(res);
  },
};
