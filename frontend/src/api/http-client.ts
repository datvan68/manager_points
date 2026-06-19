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

export async function synchronizedRefreshToken(): Promise<RefreshResponse> {
  if (refreshPromise) {
    return refreshPromise;
  }
  
  refreshPromise = authApi.refreshToken().finally(() => {
    refreshPromise = null;
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
