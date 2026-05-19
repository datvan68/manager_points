'use client';

import React, { createContext, useContext, useEffect, useState } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { tokenStorage, authApi } from '@/api/auth-api';
import { toast } from 'sonner';

interface AuthContextType {
  user: { id: string; user_name?: string; username?: string; role?: string; } | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  logout: () => void;
  checkAuth: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<{ id: string; user_name?: string; username?: string; role?: string; } | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const router = useRouter();
  const pathname = usePathname();

  const isPublicRoute = ['/login', '/register', '/forgot-password', '/reset-password'].includes(pathname);

  const checkAuth = async () => {
    const storedUser = tokenStorage.getUser();
    const token = tokenStorage.getAccessToken();

    if (storedUser && token) {
      setUser(storedUser);
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
      toast.success('Đã đăng xuất thành công');
      router.push('/login');
    }
  };

  return (
    <AuthContext.Provider value={{ user, isAuthenticated: !!user, isLoading, logout, checkAuth }}>
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
