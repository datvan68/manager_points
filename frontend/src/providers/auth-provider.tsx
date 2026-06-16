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
import { toast } from "sonner";
import { isStudentRole } from "@/utils/role.util";

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
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

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
  ].includes(pathname);

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

  const loadUserPermissions = async (token: string) => {
    try {
      // Note: We use raw fetch() here instead of httpClient() because this is the primary
      // session validation logic. Using httpClient() here could trigger recursive silent refresh
      // attempts if the token validation itself has expired or failed.
      const res = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000"}/api/auth/me`,
        { headers: { Authorization: `Bearer ${token}` } },
      );

      if (res.ok) {
        const data = await res.json();
        const perms: string[] = data.permissions || [];
        setPermissions(perms);

        // Update stored user with permissions and student details if Student role
        const storedUser = tokenStorage.getUser();
        const isStudent = isStudentRole({
          ...storedUser,
          ...data
        });

        let studentId = storedUser?.studentId;
        let classId = storedUser?.classId;

        if (isStudent && !studentId) {
          try {
            const studentRes = await fetch(
              `${process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000"}/students/me`,
              { headers: { Authorization: `Bearer ${token}` } },
            );
            if (studentRes.ok) {
              const studentData = await studentRes.json();
              studentId = studentData._id;
              classId = typeof studentData.class_id === "object" ? studentData.class_id?._id : studentData.class_id;
            } else if (studentRes.status === 401) {
              tokenStorage.clearTokens();
              setUser(null);
              setPermissions([]);
              return; // Early return to prevent subsequent blocks from rehydrating user state
            }
          } catch (studentErr) {
            console.error("Failed to load student link in auth provider:", studentErr);
          }
        }

        if (storedUser) {
          const updatedUser = {
            ...storedUser,
            display_name: data.display_name || storedUser.display_name,
            permissions: perms,
            role: data.roleName || storedUser.role,
            roleName: data.roleName || storedUser.roleName || storedUser.role,
            roleCode: data.roleCode || storedUser.roleCode,
            studentId,
            classId,
          };
          tokenStorage.setUser(updatedUser);
          setUser(updatedUser);
        }
      } else if (res.status === 401) {
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

  // Tự động làm mới token định kỳ mỗi 5 phút để duy trì phiên làm việc khi đang hoạt động
  useEffect(() => {
    if (!user) return;

    const interval = setInterval(async () => {
      try {
        const result = await authApi.refreshToken();
        tokenStorage.setAccessToken(result.access_token);
        loadUserPermissions(result.access_token);
      } catch (err) {
        console.error("Silent refresh failed:", err);
        // Nếu Refresh Token hết hạn thật sự, lúc này mới đăng xuất
        logout();
      }
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
        if (isStudentRole(user)) {
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

  return (
    <AuthContext.Provider
      value={{
        user,
        isAuthenticated: !!user,
        isLoading,
        permissions,
        logout,
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
