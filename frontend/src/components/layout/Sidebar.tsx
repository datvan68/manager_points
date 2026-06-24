"use client";
import React, { useState, useEffect } from "react";
import Link from "next/link";
import Image from "next/image";
import { usePathname, useRouter } from "next/navigation";
import logoNsg from "@/assets/cropped-logo-nsg.png";
import {
  LayoutDashboard,
  Users,
  GraduationCap,
  ChevronLeft,
  Settings,
  LayoutGrid,
  Bell,
  User,
  Shield,
  BarChart3
} from "lucide-react";
import { useAuth, isAdminUser } from "@/providers/auth-provider";
import { isTeacherRole, isStudentRole } from "@/utils/role.util";
import { authApi } from "@/api/auth-api";
import { studentApi } from "@/api/student-api";
import { toast } from "sonner";
import SubsystemPopup from "@/components/popups/SubsystemPopup";

// Cache (shared with RouteGuard via same API)
let sidebarCachedMappings: any[] | null = null;
let sidebarCacheTimestamp = 0;
const SIDEBAR_CACHE_TTL = 60_000;

async function fetchSidebarMappings(token?: string): Promise<any[]> {
  const now = Date.now();
  if (
    sidebarCachedMappings &&
    now - sidebarCacheTimestamp < SIDEBAR_CACHE_TTL
  ) {
    return sidebarCachedMappings;
  }
  try {
    const data = await authApi.getRoutePermissionsPublic(token);
    sidebarCachedMappings = data;
    sidebarCacheTimestamp = now;
    return data;
  } catch {
    return sidebarCachedMappings || [];
  }
}

// Minimalist main items
const allMenuItems = [
  { icon: LayoutDashboard, label: "Trang chủ", href: "/" },
  { icon: Users, label: "Học sinh sinh viên", href: "/students" },
  { icon: GraduationCap, label: "Rèn luyện", href: "/grading" },
  { icon: BarChart3, label: "Báo cáo", href: "/reports" },
  { icon: Settings, label: "Quản trị hệ thống", href: "/system" },
];

// Global variables to persist sidebar state across client-side page transitions
let globalIsCollapsed = true; // Mặc định thu gọn
let globalIsHovered = false;

const skeletonWidths = ["w-2/3", "w-1/2", "w-3/4"];

const Sidebar = () => {
  const router = useRouter();
  const [isCollapsed, setIsCollapsed] = React.useState(globalIsCollapsed);
  const [isHovered, setIsHovered] = useState(globalIsHovered);
  const hoverTimeoutRef = React.useRef<any>(null);
  const ignoreHoverRef = React.useRef(false);

  const handleMouseEnter = () => {
    if (ignoreHoverRef.current) return;
    if (hoverTimeoutRef.current) {
      clearTimeout(hoverTimeoutRef.current);
      hoverTimeoutRef.current = null;
    }
    setIsHovered(true);
    globalIsHovered = true;
  };

  const handleMouseLeave = () => {
    ignoreHoverRef.current = false; // Reset ignore flag khi chuột đã rời đi hẳn
    if (hoverTimeoutRef.current) {
      clearTimeout(hoverTimeoutRef.current);
    }
    hoverTimeoutRef.current = setTimeout(() => {
      setIsHovered(false);
      globalIsHovered = false;
    }, 5000); // 400ms delay tránh giật mắt khi vô tình di chuột ra ngoài
  };

  const handleCompactClick = () => {
    const nextCollapsed = !isCollapsed;
    setIsCollapsed(nextCollapsed);
    globalIsCollapsed = nextCollapsed;
    if (nextCollapsed) {
      setIsHovered(false);
      globalIsHovered = false;
      ignoreHoverRef.current = true; // Bỏ qua hover cho đến khi chuột rời khỏi hẳn
      if (hoverTimeoutRef.current) {
        clearTimeout(hoverTimeoutRef.current);
      }
    }
  };

  useEffect(() => {
    return () => {
      if (hoverTimeoutRef.current) {
        clearTimeout(hoverTimeoutRef.current);
      }
    };
  }, []);

  const isExpanded = !isCollapsed || isHovered;

  const [isSubsystemOpen, setIsSubsystemOpen] = useState(false);
  const pathname = usePathname();
  const {
    user,
    isLoading: authLoading,
    hasPermission,
    hasAnyPermission,
    hasAllPermissions,
  } = useAuth();
  const isStudent = isStudentRole(user);
  const [visibleItems, setVisibleItems] = useState<typeof allMenuItems>([]);
  const [isSidebarLoading, setIsSidebarLoading] = useState(true);
  const [isResolvingProfile, setIsResolvingProfile] = useState(false);
  const [refreshTrigger, setRefreshTrigger] = useState(0);

  // Invalidate cache and trigger reload on update event
  useEffect(() => {
    const handleUpdate = () => {
      sidebarCachedMappings = null;
      sidebarCacheTimestamp = 0;
      setRefreshTrigger((prev) => prev + 1);
    };
    if (typeof window !== 'undefined') {
      window.addEventListener('route-permissions-updated', handleUpdate);
      return () => window.removeEventListener('route-permissions-updated', handleUpdate);
    }
  }, []);

  const handleProfileClick = async () => {
    if (isResolvingProfile) return;
    if (!user) {
      toast.error('Vui lòng đăng nhập.');
      router.push('/login');
      return;
    }

    setIsResolvingProfile(true);
    const isStudent = isStudentRole(user);

    if (isStudent) {
      try {
        const student = await studentApi.getMyStudent();
        const classId = typeof student.class_id === 'object'
          ? (student.class_id as any)?._id
          : student.class_id;
        const studentId = student._id;

        if (classId && studentId) {
          router.push(`/students/${classId}/${studentId}`);
        } else {
          toast.error('Hồ sơ học sinh thiếu thông tin lớp học. Fallback về trang hồ sơ cá nhân.');
          router.push('/profile');
        }
      } catch (error: any) {
        console.error('Failed to resolve student profile in sidebar:', error);
        toast.error(error.message || 'Không thể tải hồ sơ sinh viên. Fallback về trang hồ sơ cá nhân.');
        router.push('/profile');
      } finally {
        setIsResolvingProfile(false);
      }
    } else {
      setIsResolvingProfile(false);
      router.push('/profile');
    }
  };

  useEffect(() => {
    if (authLoading) {
      setIsSidebarLoading(true);
      return;
    }

    if (!user) {
      setVisibleItems([]);
      setIsSidebarLoading(false);
      return;
    }

    (async () => {
      const isStudentUser = isStudentRole(user);
      const isTeacherUser = isTeacherRole(user);

      try {
        const token = typeof window !== 'undefined' ? (sessionStorage.getItem('access_token') || '') : '';
        const mappings = await fetchSidebarMappings(token);

        if (isAdminUser(user)) {
          setVisibleItems(allMenuItems);
          setIsSidebarLoading(false);
          return;
        }

        // Filter menu items based on route-permission mappings
        const filtered = allMenuItems.filter((item) => {
          if (item.href === "/" && isStudentUser) {
            return false;
          }

          // Luôn hiển thị mục "Học sinh sinh viên" cho vai trò học sinh/sinh viên hoặc giáo viên
          if (item.href === "/students" && (isStudentUser || isTeacherUser || hasPermission("STUDENT_READ") || hasPermission("READ_STUDENT_TASK"))) {
            return true;
          }

          const mapping = mappings.find(
            (m: any) =>
              m.route_path === item.href &&
              m.is_active !== false &&
              m.type === "page",
          );

          if (
            !mapping ||
            !mapping.permissions ||
            mapping.permissions.length === 0
          ) {
            return true;
          }

          const requiredCodes = mapping.permissions.map(
            (p: any) => p.code || p,
          );
          if (mapping.check_type === "any") {
            return hasAnyPermission(...requiredCodes);
          }
          return hasAllPermissions(...requiredCodes);
        });

        setVisibleItems(filtered);
      } catch (error) {
        console.error("Lỗi tải cấu hình sidebar:", error);
        // Fallback to static permissions filtering instead of showing everything
        const fallbackFiltered = allMenuItems.filter((item) => {
          if (item.href === "/") return !isStudentUser;
          if (isAdminUser(user)) return true;

          if (item.href === "/students") {
            return isStudentUser || isTeacherUser || hasPermission("STUDENT_PAGE") || hasPermission("STUDENT_READ") || hasPermission("READ_STUDENT_TASK");
          }
          if (item.href === "/grading") {
            return isTeacherUser || hasPermission("GRADING_PAGE") || hasPermission("GRADING_READ");
          }
          if (item.href === "/reports") {
            return isAdminUser(user) || hasPermission("REPORTS_PAGE") || hasPermission("REPORTS_READ");
          }
          if (item.href === "/system") {
            return hasAnyPermission(
              "SYSTEM_ADMIN",
              "LOGIN_LOG_READ",
              "SYSTEM_REQUEST_READ",
              "SYSTEM_REQUEST_MANAGE",
              "DATABASE_BACKUP_READ",
              "DATABASE_BACKUP_CREATE",
              "DATABASE_BACKUP_DOWNLOAD",
              "DATABASE_BACKUP_DELETE"
            );
          }
          return false;
        });
        setVisibleItems(fallbackFiltered);
      } finally {
        setIsSidebarLoading(false);
      }
    })();
  }, [user, authLoading, refreshTrigger]);

  return (
    <>
      {/* Desktop Left Sidebar (Hidden on mobile) */}
      <div
        onMouseEnter={handleMouseEnter}
        onMouseLeave={handleMouseLeave}
        className={`hidden md:flex flex-col h-screen ${isExpanded ? "w-64" : "w-20"} bg-white/45 backdrop-blur-md border-r border-white/75 justify-between transition-all duration-300 shrink-0 shadow-sm shadow-slate-300/40`}
      >
        {/* Header */}
        <div className={`p-4 ${isExpanded ? "block" : "flex justify-center"}`}>
          <div
            className={`flex items-center gap-2 mb-2 ${isExpanded ? "" : "justify-center"}`}
          >
            <div className="w-8 h-8 min-w-[32px] flex items-center justify-center rounded-xl overflow-hidden shadow-sm bg-white/80">
              <Image
                src={logoNsg}
                alt="NSG Logo"
                width={32}
                height={32}
                className="object-contain"
              />
            </div>
            {isExpanded && (
              <span className="text-[14px] font-black glassmorphic-text tracking-wide whitespace-nowrap animate-in fade-in duration-200">
                HOCSINHSINHVIEN
              </span>
            )}
          </div>
          {isExpanded && (
            <div className="text-[11px] text-[#64748B] font-semibold px-1 animate-in fade-in duration-200">
              Quản lý sinh viên
            </div>
          )}
        </div>

        {/* Navigation */}
        <nav className="flex-1 px-3 py-4 space-y-2 overflow-hidden">
          {isSidebarLoading
            ? Array.from({ length: 3 }).map((_, index) => {
              const widthClass = skeletonWidths[index % skeletonWidths.length];
              return (
                <div
                  key={index}
                  className={`w-full flex items-center gap-3 px-3 h-8 rounded-xl animate-pulse ${isExpanded ? "" : "justify-center"
                    }`}
                >
                  <div className="w-5 h-5 bg-white/40 border border-white/50 rounded-xl shrink-0" />
                  {isExpanded && (
                    <div className={`h-4 bg-white/40 border border-white/50 rounded-xl ${widthClass}`} />
                  )}
                </div>
              );
            })
            : visibleItems.map((item, index) => {
              const targetHref = (item.href === "/students" && isStudent) ? "/students/tasks" : item.href;
              const isActive = pathname === item.href || (item.href !== '/' && pathname.startsWith(item.href));
              return (
                <Link
                  key={index}
                  href={targetHref}
                  className={`w-full flex items-center gap-3 px-3 h-8 rounded-xl text-[13px] font-semibold transition-all duration-300 ease-in-out hover:scale-[1.01] ${isActive
                    ? "bg-[#1A73E8]/10 border border-[#1A73E8]/20 text-[#1A73E8] shadow-sm shadow-slate-200/20"
                    : "text-[#64748B] border border-transparent hover:bg-[#1A73E8]/10 hover:border-[#1A73E8]/20 hover:text-[#1A73E8] hover:shadow-sm"
                    } ${isExpanded ? "" : "justify-center"}`}
                  title={isExpanded ? "" : item.label}
                >
                  <item.icon size={18} className="min-w-4.5" />
                  {isExpanded && (
                    <span className="truncate">{item.label}</span>
                  )}
                </Link>
              );
            })}
        </nav>

        {/* Footer */}
        <div className="p-3 border-t border-white/75 space-y-1.5">
          <button
            onClick={handleCompactClick}
            className={`w-full flex items-center gap-3 px-3 h-8 rounded-xl text-[13px] font-semibold text-[#64748B] border border-transparent hover:bg-white/50 hover:text-[#1E293B] hover:scale-[1.01] hover:shadow-sm transition-all duration-150 ease-out ${isExpanded ? "" : "justify-center"}`}
            data-id="btn/Compact"
          >
            <ChevronLeft
              size={18}
              className={`transition-transform duration-300 ${isCollapsed ? "rotate-180" : ""}`}
            />
            {isExpanded && <span>Thu gọn</span>}
          </button>
          {isAdminUser(user) && (
            <Link 
              href="/system/settings" 
              className={`w-full flex items-center gap-3 px-3 h-8 rounded-xl text-[13px] font-semibold transition-all duration-150 ease-out hover:scale-[1.01] hover:shadow-sm ${pathname === "/system/settings" ? "bg-[#1A73E8]/10 border border-[#1A73E8]/20 text-[#1A73E8]" : "text-[#64748B] border border-transparent hover:bg-[#1A73E8]/10 hover:border-[#1A73E8]/20 hover:text-[#1A73E8]"} ${isExpanded ? "" : "justify-center"}`}
              title={isExpanded ? "" : "Cài đặt"}
            >
              <Settings size={18} />
              {isExpanded && <span>Cài đặt</span>}
            </Link>
          )}
        </div>
      </div>

      {/* Mobile Bottom Navigation Bar (Hidden on desktop) */}
      <div className="md:hidden fixed bottom-3 left-4 right-4 h-[60px] bg-white/40 backdrop-blur-lg border border-white/50 rounded-[20px] flex items-center justify-around z-40 px-1 shadow-[0_8px_32px_rgba(0,0,0,0.08)] ring-1 ring-white/20">
        {isSidebarLoading ? (
          Array.from({ length: 5 }).map((_, index) => (
            <div key={index} className="w-9 h-9 bg-white/40 border border-white/50 rounded-full animate-pulse shrink-0" />
          ))
        ) : (
          <>
            {/* 3 Main Items */}
            {visibleItems.map((item, index) => {
              const targetHref = (item.href === "/students" && isStudent) ? "/students/tasks" : item.href;
              const isActive = pathname === item.href || (item.href !== '/' && pathname.startsWith(item.href));
              return (
                <Link
                  key={index}
                  href={targetHref}
                  className="flex flex-col items-center justify-center flex-1 h-full transition-all duration-150 ease-out cursor-pointer overflow-hidden px-0.5"
                >
                  <div
                    className={`flex flex-col items-center justify-center w-full max-w-[64px] py-1 rounded-xl transition-all duration-300 ease-in-out ${isActive
                        ? "bg-[#1A73E8]/15 border border-[#1A73E8]/25 text-[#1A73E8] shadow-[0_2px_8px_rgba(26,115,232,0.15)]"
                        : "text-[#64748B] hover:text-[#1E293B] hover:bg-white/20 border border-transparent"
                      }`}
                  >
                    <item.icon size={18} className="mb-0.5" />
                    <span className={`text-[10px] w-full truncate px-0.5 text-center leading-tight ${isActive ? "font-bold" : "font-medium"
                      }`}>
                      {item.label}
                    </span>
                  </div>
                </Link>
              );
            })}

            {/* Notifications Link */}
            <Link
              href="/notifications"
              className="flex flex-col items-center justify-center flex-1 h-full transition-all duration-150 ease-out cursor-pointer overflow-hidden px-0.5"
            >
              <div
                className={`flex flex-col items-center justify-center w-full max-w-[64px] py-1 rounded-xl transition-all duration-300 ease-in-out ${pathname === "/notifications" || pathname.startsWith("/notifications")
                    ? "bg-[#1A73E8]/15 border border-[#1A73E8]/25 text-[#1A73E8] shadow-[0_2px_8px_rgba(26,115,232,0.15)]"
                    : "text-[#64748B] hover:text-[#1E293B] hover:bg-white/20 border border-transparent"
                  }`}
              >
                <Bell size={18} className="mb-0.5" />
                <span className={`text-[10px] w-full truncate px-0.5 text-center leading-tight ${pathname === "/notifications" || pathname.startsWith("/notifications") ? "font-bold" : "font-medium"
                  }`}>
                  Thông báo
                </span>
              </div>
            </Link>

            {/* Personal Profile Button */}
            <button
              onClick={handleProfileClick}
              disabled={isResolvingProfile}
              className="flex flex-col items-center justify-center flex-1 h-full transition-all duration-150 ease-out cursor-pointer overflow-hidden px-0.5"
            >
              <div
                className={`flex flex-col items-center justify-center w-full max-w-[64px] py-1 rounded-xl transition-all duration-300 ease-in-out ${pathname === "/profile" || pathname.includes("/students/") && pathname.endsWith(user?.studentId || "none")
                    ? "bg-[#1A73E8]/15 border border-[#1A73E8]/25 text-[#1A73E8] shadow-[0_2px_8px_rgba(26,115,232,0.15)]"
                    : "text-[#64748B] hover:text-[#1E293B] hover:bg-white/20 border border-transparent"
                  } ${isResolvingProfile ? "opacity-50" : ""}`}
              >
                {isResolvingProfile ? (
                  <svg className="animate-spin h-4.5 w-4.5 mb-0.5" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                ) : (
                  <User size={18} className="mb-0.5" />
                )}
                <span className={`text-[10px] w-full truncate px-0.5 text-center leading-tight ${pathname === "/profile" || pathname.includes("/students/") && pathname.endsWith(user?.studentId || "none") ? "font-bold" : "font-medium"
                  }`}>
                  Hồ sơ
                </span>
              </div>
            </button>
          </>
        )}
      </div>

      {/* Render SubsystemPopup for Mobile Trigger */}
      <SubsystemPopup isOpen={isSubsystemOpen} onClose={() => setIsSubsystemOpen(false)} />
    </>
  );
};

export default Sidebar;
