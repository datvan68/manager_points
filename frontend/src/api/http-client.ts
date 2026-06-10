import { tokenStorage, authApi } from './auth-api';

export class ApiError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.status = status;
    this.name = 'ApiError';
  }
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
      const result = await authApi.refreshToken();
      tokenStorage.setAccessToken(result.access_token);
      isRefreshing = false;
      onRefreshed(result.access_token);

      // Retry trực tiếp request gốc của chính nó
      headers.set('Authorization', `Bearer ${result.access_token}`);
      return await fetch(url, { ...options, headers, _isRetry: true } as any);
    } catch (err) {
      isRefreshing = false;
      const error = new ApiError('Phiên đăng nhập đã hết hạn', 401);
      onRefreshFailed(error);
      tokenStorage.clearTokens();
      if (typeof window !== 'undefined') {
        window.location.href = '/login';
      }
      throw error;
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
    throw new ApiError(data.message || data.error || 'Đã xảy ra lỗi', res.status);
  }
  return data as T;
}
