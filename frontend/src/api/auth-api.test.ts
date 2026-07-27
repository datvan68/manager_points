import { describe, it, expect, vi, beforeEach } from 'vitest';
import { authApi } from './auth-api';

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
});
