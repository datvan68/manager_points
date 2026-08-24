import { describe, it, expect, vi, beforeEach } from 'vitest';
import { authApi, AuthApiError } from './auth-api';

const mockFetch = vi.fn();
global.fetch = mockFetch;

describe('authApi', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    sessionStorage.clear();
    localStorage.clear();
  });

  describe('tokenStorage remember contract', () => {
    it('persists only the non-sensitive remember preference', async () => {
      const { tokenStorage } = await import('./auth-api');

      tokenStorage.setRemember(true);
      expect(localStorage.getItem('remember_login')).toBe('true');
      expect(localStorage.getItem('access_token')).toBeNull();
      expect(localStorage.getItem('user')).toBeNull();

      sessionStorage.clear();
      expect(tokenStorage.getRemember()).toBe(true);

      tokenStorage.setRemember(false);
      expect(localStorage.getItem('remember_login')).toBeNull();
      expect(tokenStorage.getRemember()).toBe(false);
    });

    it('does not throw when the cached user JSON is malformed', async () => {
      const { tokenStorage } = await import('./auth-api');

      sessionStorage.setItem('user', '{bad-json');
      expect(tokenStorage.getUser()).toBeNull();
      expect(sessionStorage.getItem('user')).toBeNull();
    });

    it('keeps an impersonated tab session id out of shared localStorage', async () => {
      const { tokenStorage } = await import('./auth-api');
      localStorage.setItem('auth_session_id', 'admin-session');

      tokenStorage.setTabSessionId('child-session');

      expect(sessionStorage.getItem('auth_session_id')).toBe('child-session');
      expect(localStorage.getItem('auth_session_id')).toBe('admin-session');
    });
  });

  describe('login', () => {
    it('should correctly call fetch with exact url without duplicated /api/api/', async () => {
      const mockResponse = { ok: true, text: vi.fn().mockResolvedValue(JSON.stringify({ access_token: '123' })) };
      mockFetch.mockResolvedValue(mockResponse);

      const res = await authApi.login('test@example.com', 'password');
      
      expect(mockFetch).toHaveBeenCalledTimes(1);
      const [url] = mockFetch.mock.calls[0];
      
      expect(url).not.toContain('/api/api/');
      expect(url).toContain('/api/auth/login');
      
      expect(res.access_token).toBe('123');
    });
  });

  describe('getUsers', () => {
    it('should correctly call fetch without duplicated /api/api/', async () => {
      const mockResponse = { ok: true, text: vi.fn().mockResolvedValue(JSON.stringify([])) };
      mockFetch.mockResolvedValue(mockResponse);

      await authApi.getUsers('token');
      
      const [url] = mockFetch.mock.calls[0];
      expect(url).not.toContain('/api/api/');
      expect(url).toContain('/api/auth/users');
    });
  });

  describe('createImpersonation', () => {
    it('creates an isolated child session with the admin bearer token', async () => {
      const payload = {
        access_token: 'child-token',
        user: { id: 'user-2', username: 'student-2' },
        impersonation: { id: 'imp-1', expires_at: '2026-08-22T12:00:00.000Z' },
      };
      mockFetch.mockResolvedValue({
        ok: true,
        text: vi.fn().mockResolvedValue(JSON.stringify(payload)),
      });

      const result = await authApi.createImpersonation('user-2', 'child-session', 'admin-token');

      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('/api/auth/impersonations'),
        expect.objectContaining({
          method: 'POST',
          credentials: 'include',
          headers: expect.objectContaining({
            Authorization: 'Bearer admin-token',
            'X-Auth-Session-Id': 'child-session',
          }),
          body: JSON.stringify({ target_user_id: 'user-2', session_id: 'child-session' }),
        }),
      );
      expect(result).toEqual(payload);
    });

    it('preserves status 409 for the authoritative concurrency limit', async () => {
      mockFetch.mockResolvedValue({
        ok: false,
        status: 409,
        text: vi.fn().mockResolvedValue(JSON.stringify({
          code: 'IMPERSONATION_LIMIT_REACHED',
          message: 'Maximum impersonations reached',
        })),
      });

      await expect(authApi.createImpersonation('user-2', 'child-session', 'admin-token'))
        .rejects.toMatchObject({
          status: 409,
          code: 'IMPERSONATION_LIMIT_REACHED',
          name: 'AuthApiError',
        });
      await expect(authApi.createImpersonation('user-2', 'child-session', 'admin-token'))
        .rejects.toBeInstanceOf(AuthApiError);
    });
  });

  describe('cancelImpersonation', () => {
    it('cancels an in-flight child handoff with the parent bearer token', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        text: vi.fn().mockResolvedValue(JSON.stringify({ cancelled: true })),
      });

      const result = await authApi.cancelImpersonation('child-session', 'admin-token');

      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('/api/auth/impersonations/cancel'),
        expect.objectContaining({
          method: 'POST',
          credentials: 'include',
          headers: {
            'Content-Type': 'application/json',
            Authorization: 'Bearer admin-token',
          },
          body: JSON.stringify({ session_id: 'child-session' }),
        }),
      );
      expect(mockFetch.mock.calls[0][0]).not.toContain('admin-token');
      expect(result).toEqual({ cancelled: true });
    });

    it('keeps ordinary logout on the logout endpoint', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        text: vi.fn().mockResolvedValue(JSON.stringify({ message: 'ok' })),
      });

      await authApi.logout();

      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('/api/auth/logout'),
        expect.objectContaining({ method: 'POST' }),
      );
    });
  });

  describe('terminateImpersonation', () => {
    it('sends the target in the body and the admin token only as bearer auth', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        text: vi.fn().mockResolvedValue(JSON.stringify({ terminated: true })),
      });

      await expect(authApi.terminateImpersonation('user-2', 'admin-token'))
        .resolves.toEqual({ terminated: true });

      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('/api/auth/impersonations/terminate'),
        expect.objectContaining({
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: 'Bearer admin-token',
          },
          body: JSON.stringify({ target_user_id: 'user-2' }),
        }),
      );
      expect(mockFetch.mock.calls[0][0]).not.toContain('admin-token');
    });
  });
});
