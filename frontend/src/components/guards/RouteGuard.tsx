'use client';

import React, { useEffect, useState } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { useAuth } from '@/providers/auth-provider';
import { authApi } from '@/api/auth-api';
import { toast } from 'sonner';
import { ShieldAlert } from 'lucide-react';

interface RouteGuardProps {
  /** Permission code required to access this route (e.g. 'view_users', 'STUDENT_READ') */
  requiredPermission?: string;
  /** Multiple permission codes — user must have ALL to access */
  requiredPermissions?: string[];
  /** Multiple permission codes — user must have at least ONE to access */
  anyPermission?: string[];
  /** Redirect path when permission denied. Default: previous page or /select-module */
  fallbackPath?: string;
  /** Custom forbidden message */
  forbiddenMessage?: string;
  /** If true, also check dynamic route-permission mappings from DB */
  useDynamicMapping?: boolean;
  children: React.ReactNode;
}

// Cache route-permission mappings to avoid repeated API calls
let cachedMappings: any[] | null = null;
let cacheTimestamp = 0;
const CACHE_TTL = 60_000; // 60 seconds

async function fetchRouteMappings(): Promise<any[]> {
  const now = Date.now();
  if (cachedMappings && (now - cacheTimestamp) < CACHE_TTL) {
    return cachedMappings;
  }
  try {
    const data = await authApi.getRoutePermissionsPublic();
    cachedMappings = data;
    cacheTimestamp = now;
    return data;
  } catch {
    return cachedMappings || [];
  }
}

/**
 * RouteGuard — Frontend Route Guard component for permission-based access control.
 * 
 * Supports TWO modes:
 * 1. Static mode: pass requiredPermission/requiredPermissions/anyPermission as props
 * 2. Dynamic mode: set useDynamicMapping={true} to auto-read from DB mappings (managed via Admin UI)
 * 
 * Usage (Static):
 *   <RouteGuard requiredPermission="view_users">
 *     <PermissionsPage />
 *   </RouteGuard>
 * 
 * Usage (Dynamic — reads from Admin-configured DB):
 *   <RouteGuard useDynamicMapping>
 *     <StudentsPage />
 *   </RouteGuard>
 */
export function RouteGuard({
  requiredPermission,
  requiredPermissions,
  anyPermission,
  fallbackPath,
  forbiddenMessage = 'Bạn không có quyền truy cập trang này',
  useDynamicMapping = false,
  children,
}: RouteGuardProps) {
  const { user, isLoading, hasPermission, hasAnyPermission, hasAllPermissions } = useAuth();
  const router = useRouter();
  const pathname = usePathname();
  const [dynamicCheckDone, setDynamicCheckDone] = useState(!useDynamicMapping);
  const [dynamicAllowed, setDynamicAllowed] = useState(true);

  // Dynamic mapping check
  useEffect(() => {
    if (!useDynamicMapping || !user || isLoading || !requiredPermission) return;

    (async () => {
      try {
        const mappings = await fetchRouteMappings();
        const match = mappings.find(
          (m: any) => m.route_path === pathname && m.is_active !== false
        );

        if (!match || !match.permissions || match.permissions.length === 0) {
          setDynamicAllowed(true);
          setDynamicCheckDone(true);
          return;
        }

        const requiredCodes = match.permissions.map((p: any) => p.code || p);

        if (user.role === 'Admin') {
          setDynamicAllowed(true);
        } else if (match.check_type === 'any') {
          setDynamicAllowed(hasAnyPermission(...requiredCodes));
        } else {
          setDynamicAllowed(hasAllPermissions(...requiredCodes));
        }
      } catch {
        setDynamicAllowed(true); // Fail open
      } finally {
        setDynamicCheckDone(true);
      }
    })();
  }, [useDynamicMapping, user, isLoading, pathname]);

  // Compute static permission check (no hooks, just logic)
  let isStaticAllowed = true;
  if (user) {
    if (requiredPermission) {
      isStaticAllowed = hasPermission(requiredPermission);
    } else if (requiredPermissions && requiredPermissions.length > 0) {
      isStaticAllowed = hasAllPermissions(...requiredPermissions);
    } else if (anyPermission && anyPermission.length > 0) {
      isStaticAllowed = hasAnyPermission(...anyPermission);
    }
  }

  // Final decision
  const isAllowed = isStaticAllowed && dynamicAllowed;

  // Redirect effect — MUST be declared before any early returns
  useEffect(() => {
    if (!isLoading && dynamicCheckDone && !isAllowed && user) {
      toast.error(forbiddenMessage, {
        id: 'permission-denied-toast',
        description: 'Liên hệ quản trị viên để được cấp quyền truy cập.',
        duration: 3000,
      });
      router.replace(fallbackPath || '/');
    }
  }, [isAllowed, isLoading, dynamicCheckDone, user]);

  // --- All hooks above, early returns below ---

  if (isLoading || !dynamicCheckDone) {
    return (
      <div className="flex h-full w-full items-center justify-center p-8">
        <div className="h-8 w-8 animate-spin rounded-full border-3 border-blue-600 border-t-transparent"></div>
      </div>
    );
  }

  if (!user) return null; // AuthProvider handles redirect to /login

  if (!isAllowed) {
    return null; // Ẩn hoàn toàn — không hiển thị gì
  }

  return <>{children}</>;
}

/**
 * usePermission — Hook for checking permissions inside components.
 * 
 * Usage:
 *   const { canView, canCreate, canDelete } = usePermission({
 *     view: 'STUDENT_READ',
 *     create: 'STUDENT_CREATE',
 *     delete: 'delete_course',
 *   });
 * 
 *   {canCreate && <Button>Thêm mới</Button>}
 */
export function usePermission(permissionMap: Record<string, string>) {
  const { hasPermission } = useAuth();
  
  const result: Record<string, boolean> = {};
  for (const [key, code] of Object.entries(permissionMap)) {
    result[key] = hasPermission(code);
  }
  return result;
}

/**
 * Utility to invalidate cached route-permission mappings.
 * Call this after admin creates/updates/deletes a route mapping.
 */
export function invalidateRoutePermissionCache() {
  cachedMappings = null;
  cacheTimestamp = 0;
}
