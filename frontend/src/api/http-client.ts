import { tokenStorage, authApi, RefreshResponse } from './auth-api';
import { toast } from 'sonner';

export class ApiError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.status = status;
    this.name = 'ApiError';
  }
}

export function isAuthError(error: unknown): boolean {
  return typeof error === 'object' && error !== null && (error as any).status === 401;
}

interface Subscriber {
  resolve: (token: string) => void;
  reject: (error: Error) => void;
}

let isRefreshing = false;
let refreshSubscribers: Subscriber[] = [];

function subscribeTokenRefresh(resolve: (token: string) => void, reject: (error: Error) => void) {
  refreshSubscribers.push({ resolve, reject });
}

function onRefreshed(token: string) {
  refreshSubscribers.forEach((sub) => sub.resolve(token));
  refreshSubscribers = [];
}

function onRefreshFailed(error: Error) {
  refreshSubscribers.forEach((sub) => sub.reject(error));
  refreshSubscribers = [];
}

let refreshPromise: Promise<RefreshResponse> | null = null;
const authChannel = typeof window !== 'undefined' ? new BroadcastChannel('auth_sync_channel') : null;

if (authChannel) {
  authChannel.onmessage = (event) => {
    if (event.data.type === 'TOKEN_REFRESHED') {
      tokenStorage.setAccessToken(event.data.token);
      onRefreshed(event.data.token);
    } else if (event.data.type === 'TOKEN_CLEARED') {
      tokenStorage.clearTokens();
    }
  };
}

const LOCK_KEY = 'auth_refresh_lock';
const LOCK_TTL = 10000;
const TAB_ID = typeof window !== 'undefined' ? Math.random().toString(36).substring(2, 15) : 'ssr';

function acquireLock(): boolean {
  if (typeof window === 'undefined') return true;
  const lockRaw = localStorage.getItem(LOCK_KEY);
  const now = Date.now();
  if (!lockRaw) {
    localStorage.setItem(LOCK_KEY, JSON.stringify({ ownerId: TAB_ID, timestamp: now }));
    return true;
  }
  try {
    const lock = JSON.parse(lockRaw);
    if (lock.ownerId === TAB_ID) return true;
    if (now - lock.timestamp > LOCK_TTL) {
      localStorage.setItem(LOCK_KEY, JSON.stringify({ ownerId: TAB_ID, timestamp: now }));
      return true;
    }
    return false;
  } catch (e) {
    localStorage.setItem(LOCK_KEY, JSON.stringify({ ownerId: TAB_ID, timestamp: now }));
    return true;
  }
}

function releaseLock() {
  if (typeof window === 'undefined') return;
  const lockRaw = localStorage.getItem(LOCK_KEY);
  if (!lockRaw) return;
  try {
    const lock = JSON.parse(lockRaw);
    if (lock.ownerId === TAB_ID) {
      localStorage.removeItem(LOCK_KEY);
    }
  } catch (e) {
    localStorage.removeItem(LOCK_KEY);
  }
}

export async function synchronizedRefreshToken(forceSelf = false): Promise<RefreshResponse> {
  if (refreshPromise) {
    return refreshPromise;
  }
  
  if (typeof window !== 'undefined' && !forceSelf && !acquireLock()) {
    return new Promise((resolve, reject) => {
      let timeoutId: NodeJS.Timeout;
      const listener = (event: MessageEvent) => {
        if (event.data.type === 'TOKEN_REFRESHED') {
          clearTimeout(timeoutId);
          authChannel?.removeEventListener('message', listener);
          resolve({ access_token: event.data.token });
        } else if (event.data.type === 'TOKEN_CLEARED') {
          clearTimeout(timeoutId);
          authChannel?.removeEventListener('message', listener);
          reject(new ApiError('Refresh failed in another tab', 401));
        } else if (event.data.type === 'REFRESH_FAILED') {
          clearTimeout(timeoutId);
          authChannel?.removeEventListener('message', listener);
          resolve(synchronizedRefreshToken(true));
        }
      };
      authChannel?.addEventListener('message', listener);
      timeoutId = setTimeout(() => {
        authChannel?.removeEventListener('message', listener);
        // Timeout waiting for other tab to finish refresh.
        // Try to refresh ourselves.
        resolve(synchronizedRefreshToken(true));
      }, 5000);
    });
  }
  
  if (authChannel) {
    authChannel.postMessage({ type: 'REFRESH_STARTED', ownerId: TAB_ID });
  }

  refreshPromise = authApi.refreshToken().then((result) => {
    if (authChannel) {
      authChannel.postMessage({ type: 'TOKEN_REFRESHED', token: result.access_token });
    }
    return result;
  }).catch((err) => {
    if (authChannel) {
      authChannel.postMessage({ type: 'REFRESH_FAILED', error: err.message });
    }
    throw err;
  }).finally(() => {
    refreshPromise = null;
    releaseLock();
  });
  
  return refreshPromise;
}

export async function httpClient(url: string, options: RequestInit = {}): Promise<Response> {
  const token = tokenStorage.getAccessToken();
  const headers = new Headers(options.headers || {});
  
  if (token && !headers.has('Authorization')) {
    headers.set('Authorization', `Bearer ${token}`);
  }
  
  const res = await fetch(url, { ...options, headers });
  
  const isRetry = (options as any)._isRetry;
 
  if (res.status === 401 && !url.includes('/api/auth/refresh') && !isRetry) {
    if (isRefreshing) {
      // Đang có request khác thực hiện refresh token, xếp hàng chờ
      return new Promise<Response>((resolve, reject) => {
        subscribeTokenRefresh(
          async (newToken) => {
            try {
              headers.set('Authorization', `Bearer ${newToken}`);
              const retryRes = await fetch(url, { ...options, headers, _isRetry: true } as any);
              resolve(retryRes);
            } catch (err) {
              reject(err);
            }
          },
          (err) => {
            reject(err);
          }
        );
      });
    }
 
    // Đây là request đầu tiên gặp lỗi 401, chịu trách nhiệm refresh token
    isRefreshing = true;
    try {
      const result = await synchronizedRefreshToken();
      tokenStorage.setAccessToken(result.access_token);
      isRefreshing = false;
      onRefreshed(result.access_token);

      // Retry trực tiếp request gốc của chính nó
      headers.set('Authorization', `Bearer ${result.access_token}`);
      return await fetch(url, { ...options, headers, _isRetry: true } as any);
    } catch (err) {
      isRefreshing = false;
      
      const isAuthFailure = 
        err && 
        typeof err === 'object' && 
        'status' in err && 
        typeof (err as any).status === 'number' && 
        [400, 401, 403].includes((err as any).status);

      if (isAuthFailure) {
        const error = new ApiError('Phiên đăng nhập đã hết hạn', 401);
        onRefreshFailed(error);
        tokenStorage.clearTokens();
        if (authChannel) {
          authChannel.postMessage({ type: 'TOKEN_CLEARED' });
        }
        if (typeof window !== 'undefined') {
          toast.error('Phiên đăng nhập đã hết hạn, vui lòng đăng nhập lại.', {
            id: 'session-expired-toast'
          });
          setTimeout(() => {
            window.location.href = '/login';
          }, 1500);
        }
        throw error;
      } else {
        onRefreshFailed(err as Error);
        throw err;
      }
    }
  }
  
  return res;
}

export async function handleResponse<T>(res: Response): Promise<T> {
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
    throw new ApiError(message, res.status);
  }
  return data as T;
}
