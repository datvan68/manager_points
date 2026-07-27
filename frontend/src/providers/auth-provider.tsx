"use client";

import React, {
  createContext,
  useContext,
  useEffect,
  useState,
  useCallback,
} from "react";
import { useRouter, usePathname } from "next/navigation";
import { tokenStorage, authApi } from "@/api/auth-api";
import { synchronizedRefreshToken } from "@/api/http-client";
import { toast } from "sonner";
import { isStudentRole, isTeacherRole } from "@/utils/role.util";
import { API_ORIGIN } from "@/api/config";

const TAB_INSTANCE_ID = typeof window !== 'undefined'
  ? `${Date.now()}-${Math.random().toString(36).slice(2)}`
  : 'ssr';
const tabPresenceChannel = typeof window !== 'undefined'
  ? new BroadcastChannel('auth_tab_presence')
  : null;

if (tabPresenceChannel) {
  tabPresenceChannel.onmessage = (event) => {
    const currentSession = sessionStorage.getItem('auth_session_id');
    if (event.data?.type === 'TAB_HELLO' && event.data.sessionId === currentSession && event.data.tabId !== TAB_INSTANCE_ID) {
      tabPresenceChannel.postMessage({
        type: 'TAB_PRESENT',
        sessionId: currentSession,
        tabId: TAB_INSTANCE_ID,
      });
    }
  };
}

async function isolateDuplicatedTab(): Promise<void> {
  if (!tabPresenceChannel || !tokenStorage.getAccessToken()) return;
  const sourceSessionId = tokenStorage.getSessionId();
  const duplicateDetected = await new Promise<boolean>((resolve) => {
    let found = false;
    const listener = (event: MessageEvent) => {
      if (event.data?.type === 'TAB_PRESENT' && event.data.sessionId === sourceSessionId) {
        found = true;
      }
    };
    tabPresenceChannel.addEventListener('message', listener);
    tabPresenceChannel.postMessage({ type: 'TAB_HELLO', sessionId: sourceSessionId, tabId: TAB_INSTANCE_ID });
    setTimeout(() => {
      tabPresenceChannel.removeEventListener('message', listener);
      resolve(found);
    }, 100);
  });
  if (!duplicateDetected) return;

  const newSessionId = typeof crypto !== 'undefined' && crypto.randomUUID
    ? crypto.randomUUID()
    : `${Math.random().toString(36).slice(2)}${Date.now()}`;
  const result = await authApi.forkSession(newSessionId, tokenStorage.getRemember());
  tokenStorage.setSessionId(newSessionId);
  tokenStorage.setAccessToken(result.access_token);
}

interface UserInfo {
  id: string;
  user_name?: string;
  username?: string;
  display_name?: string;
  role?: string;
  roleName?: string;
  roleCode?: string;
  permissions?: string[];
  studentId?: string;
  classId?: string;
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
  forceLogoutAfterRestore: (reason?: string) => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

function isDefinitiveAuthFailure(error: unknown): boolean {
  const status = (error as any)?.status;
  return typeof status === "number" && [400, 401, 403].includes(status);
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<UserInfo | null>(null);
  const [permissions, setPermissions] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const router = useRouter();
  const pathname = usePathname();

  const isPublicRoute = [
    "/login",
    "/register",
    "/forgot-password",
    "/reset-password",
  ].includes(pathname) || pathname.startsWith("/public");

  // Permission checking utilities
  const hasPermission = useCallback(
    (permission: string): boolean => {
      if (isAdminUser(user)) return true;
      return permissions.includes(permission);
    },
    [user, permissions],
  );

  const hasAnyPermission = useCallback(
    (...perms: string[]): boolean => {
      if (isAdminUser(user)) return true;
      return perms.some((p) => permissions.includes(p));
    },
    [user, permissions],
  );

  const hasAllPermissions = useCallback(
    (...perms: string[]): boolean => {
      if (isAdminUser(user)) return true;
      return perms.every((p) => permissions.includes(p));
    },
    [user, permissions],
  );

  const loadUserPermissions = async (token: string, isRetry = false) => {
    try {
      // Note: We use raw fetch() here instead of httpClient() because this is the primary
      // session validation logic. Using httpClient() here could trigger recursive silent refresh
      // attempts if the token validation itself has expired or failed.
      const res = await fetch(
        `${API_ORIGIN}/api/auth/me`,
        { headers: { Authorization: `Bearer ${token}` } },
      );

      if (res.ok) {
        const data = await res.json();
        const perms: string[] = data.permissions || [];
        setPermissions(perms);

        // Rebuild the client user from the server response as well as any cached
        // fields. This is required after a browser/PWA context is recreated,
        // when sessionStorage no longer contains the previous user object.
        const storedUser = tokenStorage.getUser();
        const serverUser = data as Record<string, any>;
        const serverRole = typeof serverUser.role === 'string'
          ? serverUser.role
          : serverUser.role?.name;
        const baseUser = storedUser || {
          id: serverUser.id,
          user_name: serverUser.user_name,
          username: serverUser.username || serverUser.user_name,
          display_name: serverUser.display_name,
          role: serverUser.roleName || serverRole,
          roleName: serverUser.roleName || serverRole,
          roleCode: serverUser.roleCode || serverUser.role?.role_code,
        };
        const isStudent = isStudentRole({
          ...baseUser,
          ...serverUser,
          role: serverUser.roleName || serverRole || baseUser.role,
        });

        let studentId = storedUser?.studentId;
        let classId = storedUser?.classId;

        if (isStudent && !studentId) {
          try {
            const studentRes = await fetch(
              `${API_ORIGIN}/api/students/me`,
              { headers: { Authorization: `Bearer ${token}` } },
            );
            if (studentRes.ok) {
              const studentData = await studentRes.json();
              studentId = studentData._id;
              classId = typeof studentData.class_id === "object" ? studentData.class_id?._id : studentData.class_id;
            } else if (studentRes.status === 401) {
              if (!isRetry) {
                try {
                  const result = await synchronizedRefreshToken();
                  tokenStorage.setAccessToken(result.access_token);
                  return loadUserPermissions(result.access_token, true);
                } catch (refreshErr) {
                  if (!isDefinitiveAuthFailure(refreshErr)) {
                    return;
                  }
                }
              }
              tokenStorage.clearTokens();
              setUser(null);
              setPermissions([]);
              return; // Early return to prevent subsequent blocks from rehydrating user state
            }
          } catch (studentErr) {
            console.error("Failed to load student link in auth provider:", studentErr);
          }
        }

        const updatedUser = {
            ...baseUser,
            id: serverUser.id || baseUser.id,
            user_name: serverUser.user_name || baseUser.user_name,
            username: serverUser.username || serverUser.user_name || baseUser.username,
            display_name: serverUser.display_name || baseUser.display_name,
            permissions: perms,
            role: serverUser.roleName || serverRole || baseUser.role,
            roleName: serverUser.roleName || baseUser.roleName || baseUser.role,
            roleCode: serverUser.roleCode || baseUser.roleCode,
            studentId,
            classId,
        };
        tokenStorage.setUser(updatedUser);
        setUser(updatedUser);
      } else if (res.status === 401) {
        if (!isRetry) {
          try {
            const result = await synchronizedRefreshToken();
            tokenStorage.setAccessToken(result.access_token);
            return loadUserPermissions(result.access_token, true);
          } catch (refreshErr) {
            if (!isDefinitiveAuthFailure(refreshErr)) {
              return;
            }
          }
        }
        tokenStorage.clearTokens();
        setUser(null);
        setPermissions([]);
        return; // Early return to prevent subsequent blocks from rehydrating user state
      }
    } catch (err) {
      console.error("Failed to load user permissions:", err);
    }
  };

  const checkAuth = async () => {
    try {
      await isolateDuplicatedTab();
    } catch (error) {
      console.error('Failed to isolate duplicated auth tab:', error);
    }
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
        const result = await synchronizedRefreshToken();
        tokenStorage.setAccessToken(result.access_token);
        // The refresh endpoint intentionally returns only a new access token.
        // Re-fetching /auth/me safely rehydrates the user without durable JWT storage.
        await loadUserPermissions(result.access_token);
      } catch (err: any) {
        const isAuthFailure = 
          err && 
          typeof err.status === 'number' && 
          [400, 401, 403].includes(err.status);
          
        if (isAuthFailure) {
          tokenStorage.clearTokens();
          setUser(null);
        } else {
          // Lỗi mạng hoặc server tạm thời - giữ nguyên user từ localStorage
          if (storedUser) {
            setUser(storedUser);
          } else {
            setUser(null);
          }
        }
      } finally {
        setIsLoading(false);
      }
    }
  };

  useEffect(() => {
    checkAuth();
  }, []);

  // Tự động làm mới token định kỳ mỗi 5 phút để duy trì phiên làm việc khi đang hoạt động
  useEffect(() => {
    if (!user) return;

    const interval = setInterval(() => {
      if (sessionStorage.getItem("restore_logout_in_progress")) return;

      const attemptRefresh = async (retryCount = 0) => {
        if (sessionStorage.getItem("restore_logout_in_progress")) return;
        try {
          const result = await synchronizedRefreshToken();
          tokenStorage.setAccessToken(result.access_token);
          loadUserPermissions(result.access_token);
        } catch (err: any) {
          if (sessionStorage.getItem("restore_logout_in_progress")) return;

          const isAuthFailure = 
            err && 
            typeof err.status === 'number' && 
            [400, 401, 403].includes(err.status);
            
          const isSessionNotExist = err?.message === 'Phiên làm việc không tồn tại' || err?.message === 'Phiên làm việc đã kết thúc';

          if (!isSessionNotExist) {
            console.error(`Silent refresh failed (attempt ${retryCount + 1}):`, err);
          }
          
          if (retryCount === 0 && !isSessionNotExist) {
            setTimeout(() => attemptRefresh(1), 2000); // Retry after 2 seconds
            return;
          }
          
          if (isAuthFailure) {
            logout();
          }
        }
      };
      
      attemptRefresh();
    }, 5 * 60 * 1000); // 5 phút

    return () => clearInterval(interval);
  }, [user]);

  useEffect(() => {
    if (!isLoading) {
      if (!user && !isPublicRoute) {
        toast.error("Vui lòng đăng nhập để tiếp tục", {
          id: "unauthorized-toast", // Prevent duplicate toasts
        });
        router.push("/login");
      } else if (user && isPublicRoute) {
        if (isStudentRole(user) || isTeacherRole(user)) {
          router.push("/students/tasks");
        } else {
          router.push("/");
        }
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
      toast.success("Đã đăng xuất thành công");
      router.push("/login");
    }
  };

  const forceLogoutAfterRestore = async (reason?: string) => {
    try {
      sessionStorage.setItem("restore_logout_in_progress", "true");
      const bc = new BroadcastChannel('auth_sync_channel');
      bc.postMessage({ type: 'RESTORE_SESSION_INVALIDATED' });
      bc.close();
      tokenStorage.clearTokens();
      setUser(null);
      setPermissions([]);
      await authApi.logout();
    } catch (e) {
      // Ignore
    } finally {
      sessionStorage.removeItem("restore_logout_in_progress");
      router.push(`/login?reason=${reason || 'restore'}`);
    }
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        isAuthenticated: !!user,
        isLoading,
        permissions,
        logout,
        forceLogoutAfterRestore,
        checkAuth,
        hasPermission,
        hasAnyPermission,
        hasAllPermissions,
      }}
    >
      {isLoading ? (
        <div className="flex h-screen w-screen items-center justify-center bg-slate-50">
          <div className="flex flex-col items-center gap-4">
            <div className="h-12 w-12 animate-spin rounded-full border-4 border-[#135bec] border-t-transparent shadow-lg"></div>
            <p className="font-['Inter'] text-slate-500 animate-pulse">
              Đang kiểm tra bảo mật...
            </p>
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
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}

export function isAdminUser(user: UserInfo | null): boolean {
  if (!user) return false;
  return (
    user.role === "Admin" ||
    user.roleName === "Admin" ||
    user.roleCode === "ADMIN" ||
    user.permissions?.includes("ADMIN_FULL") === true
  );
}
