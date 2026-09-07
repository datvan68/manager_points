import type { RefreshResponse } from './auth-api';
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

const refreshes = new Map<string, Promise<RefreshResponse>>();

export async function synchronizedRefreshToken(_forceSelf = false): Promise<RefreshResponse> {
  const { authApi, tokenStorage } = await import('./auth-api');
  const identity = tokenStorage.getAuthIdentity();
  const existing = refreshes.get(identity);
  if (existing) return existing;
  const promise = authApi.refreshToken().then((result) => {
    if (tokenStorage.getAuthIdentity() !== identity) throw new DOMException('Session changed', 'AbortError');
    tokenStorage.setAccessToken(result.access_token);
    return result;
  }).finally(() => { if (refreshes.get(identity) === promise) refreshes.delete(identity); });
  refreshes.set(identity, promise);
  return promise;
}

export async function httpClient(url: string, options: RequestInit = {}): Promise<Response> {
  const { tokenStorage } = await import('./auth-api');
  const identity = tokenStorage.getAuthIdentity();
  const token = tokenStorage.getAccessToken();
  const headers = new Headers(options.headers || {});
  if (token && !headers.has('Authorization')) headers.set('Authorization', 'Bearer ' + token);
  const res = await fetch(url, { ...options, headers });
  if (tokenStorage.getAuthIdentity() !== identity) throw new DOMException('Session changed', 'AbortError');
  if (res.status !== 401 || url.includes('/api/auth/refresh')) return res;
  try {
    const result = await synchronizedRefreshToken();
    if (tokenStorage.getAuthIdentity() !== identity) throw new DOMException('Session changed', 'AbortError');
    headers.set('Authorization', 'Bearer ' + result.access_token);
    const retried = await fetch(url, { ...options, headers });
    if (tokenStorage.getAuthIdentity() !== identity) throw new DOMException('Session changed', 'AbortError');
    return retried;
  } catch (error: any) {
    if (tokenStorage.getAuthIdentity() === identity && error?.status === 401) {
      tokenStorage.clearTokens();
      window.dispatchEvent(new Event('auth-session-ended'));
      toast.error('Phiên đăng nhập đã hết hạn, vui lòng đăng nhập lại.', { id: 'session-expired-toast' });
    }
    throw error;
  }
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
    if (res.status === 403 && typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('authorization-denied'));
    }
    const message = Array.isArray(data.message)
      ? data.message.join(', ')
      : data.message || data.error || 'Đã xảy ra lỗi';
    throw new ApiError(message, res.status);
  }
  return data as T;
}

export async function fetchWithRetry(url: string, options: RequestInit = {}): Promise<Response> {
  const method = (options.method || 'GET').toUpperCase();
  const isIdempotent = method === 'GET' || method === 'HEAD';

  if (!isIdempotent) {
    return fetch(url, options);
  }

  const maxAttempts = 4;
  const delays = [500, 1000, 2000];
  const signal = options.signal;

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    if (signal?.aborted) {
      throw new DOMException('The user aborted a request.', 'AbortError');
    }

    try {
      return await fetch(url, options);
    } catch (error: any) {
      if (error.name === 'AbortError' || signal?.aborted) {
        throw error;
      }

      if (attempt === maxAttempts) {
        throw error;
      }

      const delayMs = delays[attempt - 1];
      await new Promise<void>((resolve, reject) => {
        let timeoutId: any;

        const onAbort = () => {
          clearTimeout(timeoutId);
          reject(new DOMException('The user aborted a request.', 'AbortError'));
        };

        if (signal) {
          signal.addEventListener('abort', onAbort);
        }

        timeoutId = setTimeout(() => {
          if (signal) {
            signal.removeEventListener('abort', onAbort);
          }
          resolve();
        }, delayMs);
      });
    }
  }

  throw new Error('Unreachable');
}

