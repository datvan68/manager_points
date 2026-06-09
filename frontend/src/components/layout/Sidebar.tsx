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
  LayoutGrid
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
        className={`hidden md:flex flex-col h-screen ${isCollapsed ? "w-20" : "w-64"} bg-white border-r border-gray-200 justify-between transition-all duration-300 shrink-0`}
      >
        {/* Header */}
        <div className={`p-4 ${isCollapsed ? "flex justify-center" : "block"}`}>
          <div
            className={`flex items-center gap-2 mb-2 ${isCollapsed ? "justify-center" : ""}`}
          >
            <div className="w-8 h-8 min-w-[32px] bg-primary rounded-lg flex items-center justify-center text-white font-bold">
              E
            </div>
            {!isCollapsed && (
              <span className="text-xl font-bold text-gray-800 animate-in fade-in duration-200">
                EduManager
              </span>
            )}
          </div>
          {!isCollapsed && (
            <div className="text-sm text-gray-500 px-1 animate-in fade-in duration-200">
              Quản lý sinh viên
            </div>
          )}
        </div>

        {/* Navigation */}
        <nav className="flex-1 px-3 py-4 space-y-1 overflow-hidden">
          {isSidebarLoading
            ? Array.from({ length: 3 }).map((_, index) => {
              const widthClass = skeletonWidths[index % skeletonWidths.length];
              return (
                <div
                  key={index}
                  className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg animate-pulse ${isCollapsed ? "justify-center" : ""
                    }`}
                >
                  <div className="w-5 h-5 bg-slate-100 rounded shrink-0" />
                  {!isCollapsed && (
                    <div className={`h-4 bg-slate-100 rounded ${widthClass}`} />
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
                  className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${isActive
                    ? "bg-blue-50 text-primary"
                    : "text-text-secondary hover:bg-gray-50 hover:text-text-main"
                    } ${isCollapsed ? "justify-center" : ""}`}
                  title={isCollapsed ? item.label : ""}
                >
                  <item.icon size={20} className="min-w-5" />
                  {!isCollapsed && (
                    <span className="truncate">{item.label}</span>
                  )}
                </Link>
              );
            })}
        </nav>

        {/* Footer */}
        <div className="p-3 border-t border-gray-200 space-y-1">
          <button
            onClick={() => setIsCollapsed(!isCollapsed)}
            className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium text-gray-600 hover:bg-gray-50 ${isCollapsed ? "justify-center" : ""}`}
            data-id="btn/Compact"
          >
            <ChevronLeft
              size={20}
              className={`transition-transform duration-300 ${isCollapsed ? "rotate-180" : ""}`}
            />
            {!isCollapsed && <span>Thu gọn</span>}
          </button>
          <button className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium text-gray-600 hover:bg-gray-50">
            <Settings size={20} />
            {!isCollapsed && <span>Cài đặt</span>}
          </button>
        </div>
      </div>

      {/* Mobile Bottom Navigation Bar (Hidden on desktop) */}
      <div className="md:hidden fixed bottom-0 left-0 right-0 h-16 bg-white/95 backdrop-blur-md border-t border-gray-200 flex items-center justify-around z-40 px-4 shadow-[0_-2px_10px_rgba(0,0,0,0.04)]">
        {isSidebarLoading ? (
          Array.from({ length: 4 }).map((_, index) => (
            <div key={index} className="w-10 h-10 bg-slate-100 rounded-full animate-pulse shrink-0" />
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
                  className={`flex flex-col items-center justify-center gap-1 flex-1 py-1.5 transition-colors cursor-pointer ${isActive
                    ? "text-primary font-bold"
                    : "text-text-secondary hover:text-text-main"
                    }`}
                >
                  <item.icon size={20} />
                  <span className="text-[10px] tracking-tight font-medium">{item.label}</span>
                </Link>
              );
            })}

            {/* LayoutGrid Subsystem Trigger */}
            <button
              onClick={() => setIsSubsystemOpen(true)}
              className="flex flex-col items-center justify-center gap-1 flex-1 py-1.5 text-text-secondary hover:text-text-main transition-colors cursor-pointer"
            >
              <LayoutGrid size={20} />
              <span className="text-[10px] tracking-tight font-medium">Phân hệ</span>
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
