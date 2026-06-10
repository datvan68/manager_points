"use client";
import React, { useState, useEffect } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  Users,
  GraduationCap,
  ChevronLeft,
  Settings,
  LayoutGrid,
  Bell
} from "lucide-react";
import { useAuth } from "@/providers/auth-provider";
import { authApi } from "@/api/auth-api";
import SubsystemPopup from "@/components/popups/SubsystemPopup";

// Cache (shared with RouteGuard via same API)
let sidebarCachedMappings: any[] | null = null;
let sidebarCacheTimestamp = 0;
const SIDEBAR_CACHE_TTL = 60_000;

async function fetchSidebarMappings(): Promise<any[]> {
  const now = Date.now();
  if (
    sidebarCachedMappings &&
    now - sidebarCacheTimestamp < SIDEBAR_CACHE_TTL
  ) {
    return sidebarCachedMappings;
  }
  try {
    const data = await authApi.getRoutePermissionsPublic();
    sidebarCachedMappings = data;
    sidebarCacheTimestamp = now;
    return data;
  } catch {
    return sidebarCachedMappings || [];
  }
}

// Minimalist 3 main items only
const allMenuItems = [
  { icon: LayoutDashboard, label: "Trang chủ", href: "/" },
  { icon: Users, label: "Học sinh sinh viên", href: "/students" },
  { icon: GraduationCap, label: "Rèn luyện", href: "/grading" },
];

const skeletonWidths = ["w-2/3", "w-1/2", "w-3/4"];

const Sidebar = () => {
  const [isCollapsed, setIsCollapsed] = React.useState(false);
  const [isSubsystemOpen, setIsSubsystemOpen] = useState(false);
  const pathname = usePathname();
  const {
    user,
    isLoading: authLoading,
    hasPermission,
    hasAnyPermission,
    hasAllPermissions,
  } = useAuth();
  const [visibleItems, setVisibleItems] = useState<typeof allMenuItems>([]);
  const [isSidebarLoading, setIsSidebarLoading] = useState(true);

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
      try {
        const mappings = await fetchSidebarMappings();

        if (user.role === "Admin") {
          setVisibleItems(allMenuItems);
          setIsSidebarLoading(false);
          return;
        }

        // Filter menu items based on route-permission mappings
        const filtered = allMenuItems.filter((item) => {
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
        setVisibleItems(allMenuItems); 
      } finally {
        setIsSidebarLoading(false);
      }
    })();
  }, [user, authLoading]);

  return (
    <>
      {/* Desktop Left Sidebar (Hidden on mobile) */}
      <div
        className={`hidden md:flex flex-col h-screen ${isCollapsed ? "w-20" : "w-64"} bg-white/45 backdrop-blur-md border-r border-white/75 justify-between transition-all duration-300 shrink-0 shadow-sm shadow-slate-300/40`}
      >
        {/* Header */}
        <div className={`p-4 ${isCollapsed ? "flex justify-center" : "block"}`}>
          <div
            className={`flex items-center gap-2 mb-2 ${isCollapsed ? "justify-center" : ""}`}
          >
            <div className="w-8 h-8 min-w-[32px] bg-[#1A73E8] rounded-xl flex items-center justify-center text-white font-bold shadow-sm">
              E
            </div>
            {!isCollapsed && (
              <span className="text-xl font-bold text-[#1E293B] animate-in fade-in duration-200">
                EduManager
              </span>
            )}
          </div>
          {!isCollapsed && (
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
                  className={`w-full flex items-center gap-3 px-3 h-8 rounded-xl animate-pulse ${isCollapsed ? "justify-center" : ""
                    }`}
                >
                  <div className="w-5 h-5 bg-white/40 border border-white/50 rounded-xl shrink-0" />
                  {!isCollapsed && (
                    <div className={`h-4 bg-white/40 border border-white/50 rounded-xl ${widthClass}`} />
                  )}
                </div>
              );
            })
            : visibleItems.map((item, index) => {
              const isActive = pathname === item.href || (item.href !== '/' && pathname.startsWith(item.href));
              return (
                <Link
                  key={index}
                  href={item.href}
                  className={`w-full flex items-center gap-3 px-3 h-8 rounded-xl text-[13px] font-semibold transition-all duration-300 ease-in-out hover:scale-[1.01] ${isActive
                    ? "bg-[#1A73E8]/10 border border-[#1A73E8]/20 text-[#1A73E8] shadow-sm shadow-slate-200/20"
                    : "text-[#64748B] border border-transparent hover:bg-[#1A73E8]/10 hover:border-[#1A73E8]/20 hover:text-[#1A73E8] hover:shadow-sm"
                    } ${isCollapsed ? "justify-center" : ""}`}
                  title={isCollapsed ? item.label : ""}
                >
                  <item.icon size={18} className="min-w-4.5" />
                  {!isCollapsed && (
                    <span className="truncate">{item.label}</span>
                  )}
                </Link>
              );
            })}
        </nav>

        {/* Footer */}
        <div className="p-3 border-t border-white/75 space-y-1.5">
          <button
            onClick={() => setIsCollapsed(!isCollapsed)}
            className={`w-full flex items-center gap-3 px-3 h-8 rounded-xl text-[13px] font-semibold text-[#64748B] border border-transparent hover:bg-white/50 hover:text-[#1E293B] hover:scale-[1.01] hover:shadow-sm transition-all duration-150 ease-out ${isCollapsed ? "justify-center" : ""}`}
            data-id="btn/Compact"
          >
            <ChevronLeft
              size={18}
              className={`transition-transform duration-300 ${isCollapsed ? "rotate-180" : ""}`}
            />
            {!isCollapsed && <span>Thu gọn</span>}
          </button>
          <button className={`w-full flex items-center gap-3 px-3 h-8 rounded-xl text-[13px] font-semibold text-[#64748B] border border-transparent hover:bg-white/50 hover:text-[#1E293B] hover:scale-[1.01] hover:shadow-sm transition-all duration-150 ease-out ${isCollapsed ? "justify-center" : ""}`}>
            <Settings size={18} />
            {!isCollapsed && <span>Cài đặt</span>}
          </button>
        </div>
      </div>

      {/* Mobile Bottom Navigation Bar (Hidden on desktop) */}
      <div className="md:hidden fixed bottom-3 left-4 right-4 h-[52px] bg-white/40 backdrop-blur-lg border border-white/50 rounded-full flex items-center justify-around z-40 px-2 shadow-[0_8px_32px_rgba(0,0,0,0.08)] ring-1 ring-white/20">
        {isSidebarLoading ? (
          Array.from({ length: 4 }).map((_, index) => (
            <div key={index} className="w-9 h-9 bg-white/40 border border-white/50 rounded-full animate-pulse shrink-0" />
          ))
        ) : (
          <>
            {/* 3 Main Items */}
            {visibleItems.map((item, index) => {
              const isActive = pathname === item.href || (item.href !== '/' && pathname.startsWith(item.href));
              return (
                <Link
                  key={index}
                  href={item.href}
                  className="flex flex-col items-center justify-center flex-1 py-1 transition-all duration-150 ease-out cursor-pointer"
                >
                  <div
                    className={`w-9 h-9 rounded-full flex items-center justify-center transition-all duration-300 ease-in-out ${
                      isActive
                        ? "bg-[#1A73E8]/15 border border-[#1A73E8]/25 text-[#1A73E8] scale-[1.08] shadow-[0_2px_8px_rgba(26,115,232,0.15)]"
                        : "text-[#64748B] hover:text-[#1E293B] hover:bg-white/20 border border-transparent"
                    }`}
                  >
                    <item.icon size={18} />
                  </div>
                </Link>
              );
            })}

            {/* Notifications Link */}
            <Link
              href="/notifications"
              className="flex flex-col items-center justify-center flex-1 py-1 transition-all duration-150 ease-out cursor-pointer"
            >
              <div
                className={`w-9 h-9 rounded-full flex items-center justify-center transition-all duration-300 ease-in-out ${
                  pathname === "/notifications" || pathname.startsWith("/notifications")
                    ? "bg-[#1A73E8]/15 border border-[#1A73E8]/25 text-[#1A73E8] scale-[1.08] shadow-[0_2px_8px_rgba(26,115,232,0.15)]"
                    : "text-[#64748B] hover:text-[#1E293B] hover:bg-white/20 border border-transparent"
                }`}
              >
                <Bell size={18} />
              </div>
            </Link>
          </>
        )}
      </div>

      {/* Render SubsystemPopup for Mobile Trigger */}
      <SubsystemPopup isOpen={isSubsystemOpen} onClose={() => setIsSubsystemOpen(false)} />
    </>
  );
};

export default Sidebar;
