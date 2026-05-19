'use client';

import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { tokenStorage, authApi } from '@/api/auth-api';
import { toast } from 'sonner';

interface UserInfo {
  id: string;
  user_name?: string;
  username?: string;
  role?: string;
  permissions?: string[];
}

interface AuthContextType {
  user: UserInfo | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  permissions: string[];
  logout: () => void;
  checkAuth: () => void;
  hasPermission: (permission: string) => boolean;
  hasAnyPermission: (...permissions: string[]) => boolean;
  hasAllPermissions: (...permissions: string[]) => boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<UserInfo | null>(null);
  const [permissions, setPermissions] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const router = useRouter();
  const pathname = usePathname();

  const isPublicRoute = ['/login', '/register', '/forgot-password', '/reset-password'].includes(pathname);

  // Permission checking utilities
  const hasPermission = useCallback((permission: string): boolean => {
    if (user?.role === 'Admin') return true;
    return permissions.includes(permission);
  }, [user, permissions]);

  const hasAnyPermission = useCallback((...perms: string[]): boolean => {
    if (user?.role === 'Admin') return true;
    return perms.some((p) => permissions.includes(p));
  }, [user, permissions]);

  const hasAllPermissions = useCallback((...perms: string[]): boolean => {
    if (user?.role === 'Admin') return true;
    return perms.every((p) => permissions.includes(p));
  }, [user, permissions]);

  const loadUserPermissions = async (token: string) => {
    try {
      // Decode JWT payload to get user_id, then fetch permissions via /api/auth/me
      // For now, we extract permissions from the JWT token payload directly
      const payload = JSON.parse(atob(token.split('.')[1]));
      
      // Fetch user details with populated role & permissions
      const res = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000'}/api/auth/me`,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      
      if (res.ok) {
        const data = await res.json();
        const perms: string[] = data.permissions || [];
        setPermissions(perms);

        // Update stored user with permissions
        const storedUser = tokenStorage.getUser();
        if (storedUser) {
          const updatedUser = { ...storedUser, permissions: perms, role: data.roleName || storedUser.role };
          tokenStorage.setUser(updatedUser);
          setUser(updatedUser);
        }
      }
    } catch (err) {
      console.error('Failed to load user permissions:', err);
    }
  };

  const checkAuth = async () => {
    const storedUser = tokenStorage.getUser();
    const token = tokenStorage.getAccessToken();

    if (storedUser && token) {
      setUser(storedUser);
      // Restore cached permissions
      if (storedUser.permissions && storedUser.permissions.length > 0) {
        setPermissions(storedUser.permissions);
      }
      // Always refresh permissions from server
      loadUserPermissions(token);
      setIsLoading(false);
    } else {
      // Try silent refresh if token is missing (e.g. after tab close)
      try {
        const result = await authApi.refreshToken();
        tokenStorage.setAccessToken(result.access_token);
        // Refresh token succeeded - we might still need to get user info if missing
        const userRes = tokenStorage.getUser(); // Usually stored in localStorage
        if (userRes) {
          setUser(userRes);
          loadUserPermissions(result.access_token);
        } else {
          // If user info is lost but token exists, we handle it as unauthenticated for safety
          setUser(null);
        }
      } catch (err) {
        setUser(null);
      } finally {
        setIsLoading(false);
      }
    }
  };

  useEffect(() => {
    checkAuth();
  }, []);

  useEffect(() => {
    if (!isLoading) {
      if (!user && !isPublicRoute) {
        toast.error('Vui lòng đăng nhập để tiếp tục', {
          id: 'unauthorized-toast', // Prevent duplicate toasts
        });
        router.push('/login');
      } else if (user && isPublicRoute) {
        router.push('/select-module');
      }
    }
  }, [user, isLoading, pathname, isPublicRoute, router]);

  const logout = async () => {
    try {
      await authApi.logout();
    } catch (e) {
      // Ignore logout errors
    } finally {
      tokenStorage.clearTokens();
      setUser(null);
      setPermissions([]);
      toast.success('Đã đăng xuất thành công');
      router.push('/login');
    }
  };

  return (
    <AuthContext.Provider value={{ user, isAuthenticated: !!user, isLoading, permissions, logout, checkAuth, hasPermission, hasAnyPermission, hasAllPermissions }}>
      {isLoading ? (
        <div className="flex h-screen w-screen items-center justify-center bg-slate-50">
          <div className="flex flex-col items-center gap-4">
            <div className="h-12 w-12 animate-spin rounded-full border-4 border-[#135bec] border-t-transparent shadow-lg"></div>
            <p className="font-['Inter'] text-slate-500 animate-pulse">Đang kiểm tra bảo mật...</p>
          </div>
        </div>
      ) : (
        children
      )}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
