'use client';

import React, { useState, useRef, useEffect } from 'react';
import Image from 'next/image';
import logoNsg from '@/assets/cropped-logo-nsg.png';
import UserModal from '@/components/modals/UserModal';
import GroupModal from '@/components/modals/GroupModal';
import PermissionModal from '@/components/modals/PermissionModal';
import RoleModal from '@/components/modals/RoleModal';
import RoutePermissionModal from '@/components/modals/RoutePermissionModal';
import { Search, Settings, Plus, Mail, Phone, Pencil, Trash2, ChevronLeft, ChevronRight, Save, Route, Globe, Cpu, Zap, Shield, ToggleLeft, ToggleRight, LayoutDashboard, Users, GraduationCap, Lock, Unlock, Eye, EyeOff, Check, LogIn, Loader2 } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { toast } from 'sonner';
import { Skeleton } from '@/components/ui/skeleton';
import { CustomPagination } from '@/components/ui/pagination';
import TabNavigation from '@/components/ui/TabNavigation';
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/components/ui/select';
import Action from '@/components/ui/Action';
import ResponsiveDataView, { ResponsiveColumn } from '@/components/ui/ResponsiveDataView';
import { authApi, tokenStorage } from '@/api/auth-api';
import { systemApi } from '@/api/system-api';
import { classApi } from '@/api/class-api';
import { synchronizedRefreshToken } from '@/api/http-client';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/providers/auth-provider';
import ConfirmModal from '@/components/modals/ConfirmModal';
import { RouteGuard, invalidateRoutePermissionCache } from '@/components/guards/RouteGuard';
import dynamic from 'next/dynamic';
import {
  createSecureNonce,
  getImpersonationChannelName,
  IMPERSONATION_HANDOFF_TIMEOUT_MS,
  isValidImpersonationNonce,
  type ImpersonationChannelMessage,
} from '@/lib/impersonation-channel';

const PermissionFlowDiagram = dynamic(() => import('@/components/permissions/PermissionFlowDiagram'), {
  loading: () => (
    <div className="w-full h-full flex items-center justify-center bg-white/20 backdrop-blur-sm rounded-2xl">
      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#1A73E8]"></div>
    </div>
  ),
  ssr: false
});
import { 
  resolvePreviewSubject, 
  getPreviewPermissions, 
  buildSystemPreviewAccess,
  getPagePreviewScope,
  type PreviewSubject,
  type PreviewPermissionItem,
} from './preview-permissions';

const getUserDisplayName = (user: any) =>
  user?.student_profile?.full_name || user?.display_name || user?.user_name || user?.username || 'Unknown user';

function hasPersistedAdminRole(user: any): boolean {
  return [
    user?.roleCode,
    user?.role_code,
    user?.role?.role_code,
    user?.role?.roleCode,
  ].includes('ADMIN');
}

function getImpersonationErrorMessage(error: unknown): string {
  const code = (error as { code?: unknown } | null)?.code;
  switch (code) {
    case 'IMPERSONATION_LIMIT_REACHED':
      return 'Bạn đang truy cập tối đa 5 tài khoản. Hãy kết thúc một phiên trước khi tiếp tục.';
    case 'IMPERSONATION_TARGET_ALREADY_ACTIVE':
      return 'Tài khoản này đang có một phiên truy cập khác.';
    case 'IMPERSONATION_TARGET_INACTIVE':
      return 'Tài khoản đích hiện không hoạt động.';
    case 'IMPERSONATION_SELF_NOT_ALLOWED':
      return 'Bạn không thể truy cập chính tài khoản của mình.';
    case 'IMPERSONATION_ADMIN_TARGET_NOT_ALLOWED':
      return 'Không thể mở phiên truy cập vào tài khoản quản trị.';
    case 'IMPERSONATION_TARGET_NOT_FOUND':
      return 'Tài khoản đích không tồn tại.';
    case 'IMPERSONATION_ADMIN_REQUIRED':
      return 'Phiên quản trị không còn hợp lệ. Vui lòng đăng nhập lại.';
    default:
      return (error as { status?: unknown } | null)?.status === 401
        ? 'Phiên quản trị đã hết hạn. Vui lòng đăng nhập lại.'
        : 'Không thể mở phiên truy cập tài khoản.';
  }
}

export const MOBILE_USER_BATCH_SIZE = 20;

export function filterPermissionUsers(users: any[], searchTerm: string, filterRole: string, filterStatuses: string[]) {
  const query = searchTerm.toLowerCase();
  return users.filter((u) => {
    const matchesSearch =
      (u.user_name || '').toLowerCase().includes(query) ||
      (u.email || '').toLowerCase().includes(query) ||
      (u.display_name || '').toLowerCase().includes(query) ||
      (u.student_profile?.full_name || '').toLowerCase().includes(query) ||
      (u.student_profile?.student_code || '').toLowerCase().includes(query);
    const matchesRole = filterRole === 'Tất cả' || (u.role?.name || 'User') === filterRole;
    const userStatus = u.status || 'active';
    const matchesStatus = filterStatuses.includes('Tất cả') || filterStatuses.some((status) => {
      if (status === 'Hoạt động') return userStatus === 'active';
      if (status === 'Chưa kích hoạt') return userStatus === 'inactive' || userStatus === 'pending' || !u.status;
      if (status === 'Bị khóa') return userStatus === 'locked';
      return false;
    });
    return matchesSearch && matchesRole && matchesStatus;
  });
}

export function getPermissionUsersForViewport(users: any[], isMobile: boolean, visibleCount: number, page: number, pageSize: number) {
  return isMobile
    ? users.slice(0, visibleCount)
    : users.slice((page - 1) * pageSize, page * pageSize);
}

function PermissionsPageContent() {
  const [activeTab, setActiveTab] = useState('Người dùng');
  const [searchTerm, setSearchTerm] = useState('');
  const [filterRole, setFilterRole] = useState('Tất cả');
  const [filterStatuses, setFilterStatuses] = useState<string[]>(['Tất cả']);
  const [isInitialLoading, setIsInitialLoading] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<any>(null);
  const [classes, setClasses] = useState<any[]>([]);
  const [accessingUserId, setAccessingUserId] = useState<string | null>(null);
  const [isTerminateModalOpen, setIsTerminateModalOpen] = useState(false);
  const [terminatingUser, setTerminatingUser] = useState<any>(null);
  const handoffCleanupRef = useRef<(() => void) | null>(null);

  const [users, setUsers] = useState<any[]>([]);
  const [roles, setRoles] = useState<any[]>([]);
  const [allPermissions, setAllPermissions] = useState<any[]>([]);
  const [groups, setGroups] = useState<any[]>([]);
  const [permissionsByGroup, setPermissionsByGroup] = useState<Record<string, any[]>>({});
  const [selectedGroup, setSelectedGroup] = useState<string>('');
  const [isRightPanelLoading, setIsRightPanelLoading] = useState(false);
  const [innerRightTab, setInnerRightTab] = useState('Danh sách Quyền');

  // Route Permissions state
  const [routePermissions, setRoutePermissions] = useState<any[]>([]);
  const [isRoutePermModalOpen, setIsRoutePermModalOpen] = useState(false);
  const [editingRoutePerm, setEditingRoutePerm] = useState<any>(null);

  // Page Permission Scopes state
  const [pagePermissionScopes, setPagePermissionScopes] = useState<any[]>([]);

  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [deleteConfig, setDeleteConfig] = useState<{
    title: string;
    message: string;
    onConfirm: () => Promise<void>;
  } | null>(null);

  // State cho việc chọn hàng loạt User
  const [selectedUserIds, setSelectedUserIds] = useState<string[]>([]);

  // Pagination for users table
  const [userPageSize, setUserPageSize] = useState(20);
  const [userCurrentPage, setUserCurrentPage] = useState(1);
  const [isMobile, setIsMobile] = useState(false);
  const [mobileVisibleCount, setMobileVisibleCount] = useState(20);
  const mobileScrollRef = useRef<HTMLDivElement>(null);
  const mobileSentinelRef = useRef<HTMLDivElement>(null);

  // Preview RBAC state
  const [selectedPreviewRole, setSelectedPreviewRole] = useState('');
  const [selectedPreviewUser, setSelectedPreviewUser] = useState('');
  const [previewActiveTab, setPreviewActiveTab] = useState<'logs' | 'requests' | 'backup'>('logs');
  const [selectedPreviewPage, setSelectedPreviewPage] = useState<string>('/system');
  const previewRequestIdRef = React.useRef(0);

  const [sidebarOrder, setSidebarOrder] = useState<string[]>(() => {
    if (typeof window !== 'undefined') {
      try {
        const saved = localStorage.getItem('perm_preview_layout');
        if (saved) {
          const parsed = JSON.parse(saved);
          if (Array.isArray(parsed) && parsed.length > 0) return parsed;
        }
      } catch (e) {
        console.error(e);
      }
    }
    return ['/dashboard', '/students', '/grading', '/system', '/permissions', '/reports'];
  });

  const handleDragStart = (e: React.DragEvent, index: number) => {
    e.dataTransfer.setData('text/plain', index.toString());
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
  };

  const handleDrop = (e: React.DragEvent, targetIndex: number) => {
    const sourceIndex = parseInt(e.dataTransfer.getData('text/plain'), 10);
    if (isNaN(sourceIndex) || sourceIndex === targetIndex) return;

    const newOrder = [...sidebarOrder];
    const [removed] = newOrder.splice(sourceIndex, 1);
    newOrder.splice(targetIndex, 0, removed);

    setSidebarOrder(newOrder);
    if (typeof window !== 'undefined') {
      localStorage.setItem('perm_preview_layout', JSON.stringify(newOrder));
    }
  };

  const handleResetSidebarOrder = () => {
    const defaultOrder = ['/dashboard', '/students', '/grading', '/system', '/permissions', '/reports'];
    setSidebarOrder(defaultOrder);
    if (typeof window !== 'undefined') {
      localStorage.removeItem('perm_preview_layout');
    }
  };

  // Preview real data state
  const [previewLogs, setPreviewLogs] = useState<any[]>([]);
  const [previewRequests, setPreviewRequests] = useState<any[]>([]);
  const [previewBackups, setPreviewBackups] = useState<any[]>([]);
  const [isPreviewLogsLoading, setIsPreviewLogsLoading] = useState(false);
  const [isPreviewRequestsLoading, setIsPreviewRequestsLoading] = useState(false);
  const [isPreviewBackupsLoading, setIsPreviewBackupsLoading] = useState(false);
  const [previewLogsError, setPreviewLogsError] = useState<string | null>(null);
  const [previewRequestsError, setPreviewRequestsError] = useState<string | null>(null);
  const [previewBackupsError, setPreviewBackupsError] = useState<string | null>(null);

  const renderDynamicPagePreview = (
    routePath: string,
    pagePermissionScopes: any[],
    routePermissions: any[],
    allPermissions: any[],
    previewPermissions: string[],
    isPreviewAdmin: boolean
  ) => {
    const previewScopeItems = getPagePreviewScope({
      routePath,
      pagePermissionScopes,
      routePermissions,
      allPermissions,
      previewPermissions,
      isPreviewAdmin
    });

    let title = 'Báo cáo thống kê';
    let icon = <Globe className="w-5 h-5 text-indigo-650" />;
    if (routePath === '/permissions') {
      title = 'Phân quyền hệ thống (RBAC)';
      icon = <Shield className="w-5 h-5 text-indigo-650" />;
    } else if (routePath === '/students') {
      title = 'Quản lý Học sinh sinh viên';
      icon = <Users className="w-5 h-5 text-emerald-600" />;
    } else if (routePath === '/grading') {
      title = 'Đánh giá rèn luyện';
      icon = <GraduationCap className="w-5 h-5 text-indigo-650" />;
    }

    return (
      <div className="p-6 space-y-6 overflow-y-auto">
        <div className="flex items-center gap-2">
          {icon}
          <h4 className="text-xs font-bold text-slate-800">{title}</h4>
        </div>

        {routePath === '/permissions' && (
          <div className="p-3 bg-amber-50 text-amber-800 border border-amber-200 rounded-xl text-[10px] font-semibold">
            ⚠️ <strong>Cảnh báo đề xuất:</strong> Chưa có guard/registry thực tế ở backend cho các quyền CRUD (USER_CREATE, ROLE_DELETE, PERMISSION_UPDATE). Cấu hình này chỉ đang được xử lý ở giao diện phân bổ.
          </div>
        )}

        <div className="border border-slate-150 rounded-xl overflow-hidden text-[11px] bg-white shadow-xs">
          <div className="bg-slate-50 px-4 py-2 font-bold text-slate-500 grid grid-cols-5 border-b border-slate-150">
            <span className="col-span-2">Tên Quyền / Hành động</span>
            <span>Mã Quyền</span>
            <span>Loại Quyền</span>
            <div className="flex justify-between items-center pr-2">
              <span>Trạng thái áp dụng</span>
              <span>Truy cập</span>
            </div>
          </div>
          <div className="divide-y divide-slate-100">
            {previewScopeItems.length === 0 ? (
              <div className="px-4 py-6 text-center text-slate-450 italic font-medium">
                Không có quyền con nào được định nghĩa
              </div>
            ) : (
              previewScopeItems.map((perm) => {
                let enforcementBadge = null;
                switch (perm.status) {
                  case 'route_enforced':
                    enforcementBadge = (
                      <span className="px-2 py-0.5 bg-emerald-50 text-emerald-800 border border-emerald-150 rounded text-[9px] font-extrabold shadow-sm">
                        Route Enforced
                      </span>
                    );
                    break;
                  case 'scope_defined':
                    enforcementBadge = (
                      <span className="px-2 py-0.5 bg-blue-50 text-blue-800 border border-blue-150 rounded text-[9px] font-extrabold shadow-sm">
                        Scope Defined
                      </span>
                    );
                    break;
                  case 'proposed':
                    enforcementBadge = (
                      <span className="px-2 py-0.5 bg-amber-50 text-amber-800 border border-amber-150 rounded text-[9px] font-extrabold shadow-sm">
                        Đề xuất / Chưa enforce
                      </span>
                    );
                    break;
                  case 'missing':
                    enforcementBadge = (
                      <span className="px-2 py-0.5 bg-rose-50 text-rose-800 border border-rose-150 rounded text-[9px] font-extrabold shadow-sm animate-pulse" title="Quyền không tồn tại trong Registry/Database">
                        Missing
                      </span>
                    );
                    break;
                  case 'unmapped':
                    enforcementBadge = (
                      <span className="px-2 py-0.5 bg-slate-100 text-slate-655 border border-slate-200 rounded text-[9px] font-extrabold shadow-sm" title="Quyền có trong database nhưng chưa map cho route nào">
                        Unmapped
                      </span>
                    );
                    break;
                }

                let accessBadge = null;
                switch (perm.allowedStatus) {
                  case 'allowed':
                    accessBadge = (
                      <span className="px-2 py-0.5 bg-emerald-500 text-white rounded text-[9px] font-black tracking-wide shadow-sm flex items-center justify-center gap-0.5 w-fit ml-auto">
                        ✓ Cho phép
                      </span>
                    );
                    break;
                  case 'admin_override':
                    accessBadge = (
                      <span className="px-2 py-0.5 bg-indigo-600 text-white rounded text-[9px] font-black tracking-wide shadow-sm flex items-center justify-center gap-0.5 w-fit ml-auto" title="Cho phép do Admin override (không được gán trực tiếp)">
                        🛡️ Admin override
                      </span>
                    );
                    break;
                  case 'denied':
                    accessBadge = (
                      <span className="px-2 py-0.5 bg-rose-50 text-rose-600 border border-rose-150 rounded text-[9px] font-bold shadow-xs flex items-center justify-center gap-0.5 w-fit ml-auto">
                        🔒 Bị khóa
                      </span>
                    );
                    break;
                }

                return (
                  <div key={perm.code} className="px-4 py-3 grid grid-cols-5 text-slate-655 font-medium items-center hover:bg-slate-50/40 transition-colors">
                    <div className="col-span-2 flex flex-col pr-4">
                      <span className="font-bold text-slate-800">{perm.name}</span>
                      <span className="text-[9px] text-slate-400 mt-1 font-semibold leading-relaxed">{perm.desc}</span>
                    </div>
                    <span className="font-mono text-slate-700 text-[10px] font-bold">{perm.code}</span>
                    <span>
                      {perm.isRoute ? (
                        <span className="px-2 py-0.5 bg-indigo-50 text-indigo-600 rounded text-[9px] font-bold">Menu/Route</span>
                      ) : (
                        <span className="px-2 py-0.5 bg-slate-50 text-slate-655 rounded text-[9px] font-bold">Hành động</span>
                      )}
                    </span>
                    <div className="flex justify-between items-center pr-2">
                      <div className="shrink-0">{enforcementBadge}</div>
                      <div className="shrink-0 text-right select-none">{accessBadge}</div>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      </div>
    );
  };

  const toggleSelectUser = (userId: string) => {
    setSelectedUserIds(prev => 
      prev.includes(userId) ? prev.filter(id => id !== userId) : [...prev, userId]
    );
  };

  const toggleSelectAllUsers = (filteredUsers: any[]) => {
    const filteredUserIds = filteredUsers.map(u => u._id || u.id);
    const allSelected = filteredUserIds.length > 0 && filteredUserIds.every(id => selectedUserIds.includes(id));
    
    if (allSelected) {
      setSelectedUserIds(prev => prev.filter(id => !filteredUserIds.includes(id)));
    } else {
      setSelectedUserIds(prev => {
        const newSelection = [...prev];
        filteredUserIds.forEach(id => {
          if (!newSelection.includes(id)) {
            newSelection.push(id);
          }
        });
        return newSelection;
      });
    }
  };

  const handleToggleStatus = (status: string) => {
    if (status === 'Tất cả') {
      setFilterStatuses(['Tất cả']);
    } else {
      setFilterStatuses(prev => {
        let next = prev.filter(s => s !== 'Tất cả');
        if (next.includes(status)) {
          next = next.filter(s => s !== status);
        } else {
          next.push(status);
        }
        return next.length === 0 ? ['Tất cả'] : next;
      });
    }
  };

  const handleDeleteUsersBulk = () => {
    if (selectedUserIds.length === 0) return;
    
    setDeleteConfig({
      title: 'Xác nhận xóa nhiều tài khoản',
      message: `Bạn có chắc chắn muốn xóa ${selectedUserIds.length} tài khoản đã chọn? Hành động này sẽ không thể hoàn tác.`,
      onConfirm: async () => {
        const token = tokenStorage.getAccessToken();
        if (!token) return;
        
        try {
          setIsRefreshing(true);
          const res = await authApi.deleteUsersBulk(selectedUserIds, token);
          toast.success(res.message || 'Đã xóa các tài khoản thành công!');
          setSelectedUserIds([]); // Reset selection
          fetchData(); // Reload table
        } catch (error: any) {
          toast.error(error.message || 'Xóa tài khoản hàng loạt thất bại');
        } finally {
          setIsRefreshing(false);
          setIsDeleteModalOpen(false);
        }
      }
    });
    setIsDeleteModalOpen(true);
  };

  const router = useRouter();
  const { user: authUser, isLoading: isAuthLoading, logout } = useAuth();

  useEffect(() => () => handoffCleanupRef.current?.(), []);

  const handleAccessUser = (targetUser: any) => {
    if (!hasPersistedAdminRole(authUser) || accessingUserId) return;
    if (targetUser?.is_under_impersonation) {
      setTerminatingUser(targetUser);
      setIsTerminateModalOpen(true);
      return;
    }
    if (typeof window === 'undefined' || typeof BroadcastChannel === 'undefined') {
      toast.error('Trình duyệt không hỗ trợ mở phiên truy cập an toàn.');
      return;
    }

    const targetUserId = targetUser?._id || targetUser?.id;
    if (!targetUserId) {
      toast.error('Không xác định được tài khoản cần truy cập.');
      return;
    }

    let nonce: string;
    try {
      nonce = createSecureNonce();
    } catch {
      toast.error('Không thể tạo phiên truy cập an toàn.');
      return;
    }

    const channel = new BroadcastChannel(getImpersonationChannelName(nonce));
    let requestStarted = false;
    let closed = false;
    let terminal = false;
    let childSessionId: string | null = null;
    let cancellationRequested = false;
    let timeoutId: number | undefined;

    const cancelChildSession = () => {
      const accessToken = tokenStorage.getAccessToken();
      if (!childSessionId || !accessToken || cancellationRequested) return;
      cancellationRequested = true;
      void authApi.cancelImpersonation(childSessionId, accessToken).catch(() => undefined);
    };

    const cleanup = () => {
      if (closed) return;
      closed = true;
      if (timeoutId !== undefined) window.clearTimeout(timeoutId);
      channel.close();
      handoffCleanupRef.current = null;
      setAccessingUserId(null);
    };

    const sendError = (message: string) => {
      if (closed || terminal) return;
      terminal = true;
      cancelChildSession();
      channel.postMessage({ type: 'ERROR', message } satisfies ImpersonationChannelMessage);
      toast.error(message);
      window.clearTimeout(timeoutId);
      timeoutId = window.setTimeout(cleanup, 1_000);
    };

    channel.onmessage = async (event: MessageEvent<ImpersonationChannelMessage>) => {
      const message = event.data;
      if (message?.type === 'ACK') {
        cleanup();
        return;
      }
      if (terminal || closed) return;
      if (message?.type !== 'READY' || requestStarted) return;
      if (!isValidImpersonationNonce(message.sessionId)) {
        sendError('Cửa sổ truy cập gửi thông tin phiên không hợp lệ.');
        return;
      }

      requestStarted = true;
      childSessionId = message.sessionId;
      const accessToken = tokenStorage.getAccessToken();
      if (!accessToken) {
        sendError('Phiên quản trị đã hết hạn. Vui lòng đăng nhập lại.');
        return;
      }

      try {
        const result = await authApi.createImpersonation(targetUserId, message.sessionId, accessToken);
        if (terminal || closed) {
          cancelChildSession();
          return;
        }
        channel.postMessage({ type: 'SUCCESS', payload: result } satisfies ImpersonationChannelMessage);
        toast.success(`Đã mở phiên truy cập cho ${getUserDisplayName(targetUser)}.`);
        window.clearTimeout(timeoutId);
        timeoutId = window.setTimeout(cleanup, 2_000);
      } catch (error) {
        if (terminal || closed) {
          cancelChildSession();
          return;
        }
        sendError(getImpersonationErrorMessage(error));
      }
    };

    handoffCleanupRef.current?.();
    handoffCleanupRef.current = cleanup;
    setAccessingUserId(targetUserId);
    timeoutId = window.setTimeout(() => {
      sendError('Không thể kết nối cửa sổ truy cập. Hãy cho phép cửa sổ bật lên và thử lại.');
    }, IMPERSONATION_HANDOFF_TIMEOUT_MS);

    try {
      window.open(`/access#channel=${encodeURIComponent(nonce)}`, '_blank', 'noopener,noreferrer');
    } catch {
      sendError('Không thể mở cửa sổ truy cập. Hãy cho phép cửa sổ bật lên và thử lại.');
    }
  };

  const handleTerminateImpersonation = async () => {
    const targetUserId = terminatingUser?._id || terminatingUser?.id;
    const accessToken = tokenStorage.getAccessToken();
    if (!targetUserId || !accessToken) {
      toast.error('Phiên quản trị đã hết hạn. Vui lòng đăng nhập lại.');
      return;
    }
    try {
      const result = await authApi.terminateImpersonation(targetUserId, accessToken);
      if (!result.terminated) {
        toast.error('Phiên truy cập đã kết thúc hoặc không còn hiệu lực.');
        return;
      }
      toast.success(`Đã kết thúc truy cập ${getUserDisplayName(terminatingUser)}.`);
      setIsTerminateModalOpen(false);
      setTerminatingUser(null);
      await fetchData({ silent: true });
    } catch {
      toast.error('Không thể kết thúc phiên truy cập. Vui lòng thử lại.');
    }
  };

  const fetchData = async (options?: { silent?: boolean }) => {
    // Wait for auth to be determined
    if (isAuthLoading) return;

    const token = tokenStorage.getAccessToken();
    if (!token) {
      router.push('/login');
      return;
    }

    if (!options?.silent) {
      if (users.length === 0 && roles.length === 0) {
        setIsInitialLoading(true);
      } else {
        setIsRefreshing(true);
      }
    }
    
    try {
      const [u, r, p, g, rp, pps, cls] = await Promise.all([
        authApi.getUsers(token),
        authApi.getRoles(token),
        authApi.getPermissions(token),
        authApi.getPermissionGroups(token),
        authApi.getRoutePermissions(token).catch(() => []),
        authApi.getPagePermissionScopes(token).catch(() => []),
        classApi.getClasses().catch(() => [])
      ]);

      setUsers(u);
      setRoles(r);
      setAllPermissions(p);
      setRoutePermissions(rp);
      setPagePermissionScopes(pps);
      setClasses(cls);

      // Groups from API
      const apiGroups = g.map((group: any, idx: number) => {
        const uniquePermissions = [];
        const seenCodes = new Set();
        (group.permissions || []).forEach((perm: any) => {
          if (perm && perm.code && !seenCodes.has(perm.code)) {
            seenCodes.add(perm.code);
            uniquePermissions.push(perm);
          }
        });

        return {
          id: group._id,
          name: group.name,
          desc: group.description || `Các quyền thuộc nhóm ${group.name}`,
          tag: group.code || `G_${idx}`,
          status: group.status || 'Active',
          count: uniquePermissions.length,
          permissions: uniquePermissions
        };
      });

      // Handle permissions NOT in any group (Legacy/Fallback)
      const permsInGroups = new Set(apiGroups.flatMap((group: any) => group.permissions?.map((p: any) => p._id.toString()) || []));
      
      const seenAllPermCodes = new Set();
      const uniqueAllPermissions = p.filter((perm: any) => {
        if (!perm || !perm.code || seenAllPermCodes.has(perm.code)) return false;
        seenAllPermCodes.add(perm.code);
        return true;
      });

      const ungroupedPerms = uniqueAllPermissions.filter(perm => !permsInGroups.has(perm._id.toString()));

      if (ungroupedPerms.length > 0) {
        const fallbackId = 'fallback_group';
        apiGroups.push({
          id: fallbackId,
          name: 'Chưa phân nhóm',
          desc: 'Các quyền chưa được gán vào nhóm cụ thể',
          tag: 'G_UNGROUPED',
          status: 'Active',
          count: ungroupedPerms.length,
          permissions: ungroupedPerms
        });
      }

      // Sort groups in specified order, fallback to sorting by name
      const groupOrder: Record<string, number> = {
        'G_ADMIN_RBAC': 1,
        'G_SYSTEM_OPERATIONS': 2,
        'G_STUDENT': 3,
        'G_GRADING': 4,
        'G_TASK': 5,
        'G_REPORT': 6,
        'G_CLUB': 7,
        'G_DORMITORY': 8,
        'G_UNGROUPED': 9,
      };

      apiGroups.sort((a: any, b: any) => {
        const orderA = groupOrder[a.tag] || 999;
        const orderB = groupOrder[b.tag] || 999;
        if (orderA !== orderB) return orderA - orderB;
        return a.name.localeCompare(b.name);
      });

      // Sort permissions inside each group (page access first, then by code)
      apiGroups.forEach((group: any) => {
        if (Array.isArray(group.permissions)) {
          group.permissions.sort((a: any, b: any) => {
            const isPageA = a.code.endsWith('_PAGE') || a.code === 'admin';
            const isPageB = b.code.endsWith('_PAGE') || b.code === 'admin';
            if (isPageA && !isPageB) return -1;
            if (!isPageA && isPageB) return 1;
            return a.code.localeCompare(b.code);
          });
        }
      });

      const groupsMap: Record<string, any[]> = {};
      apiGroups.forEach((group: any) => {
        groupsMap[group.id] = (group.permissions || []).map((perm: any) => ({
          code: perm.code,
          name: perm.name,
          desc: perm.description || perm.name,
          _id: perm._id,
          groupId: group.id
        }));
      });

      setGroups(apiGroups);
      setPermissionsByGroup(groupsMap);

      // Auto-select first group if none selected or if selectedGroup no longer exists
      if (apiGroups.length > 0) {
        if (!selectedGroup || !apiGroups.some(g => g.id === selectedGroup)) {
          setSelectedGroup(apiGroups[0].id);
        }
      }
    } catch (error: any) {
      if (error.status === 401) {
        try {
          // Thử âm thầm làm mới token trước khi đăng xuất
          const refreshResult = await synchronizedRefreshToken();
          tokenStorage.setAccessToken(refreshResult.access_token);
          // Tải lại dữ liệu bằng token mới
          fetchData();
        } catch (refreshErr) {
          console.error("Silent refresh failed on 401 error:", refreshErr);
          logout();
        }
      } else {
        toast.error('Lỗi khi tải dữ liệu: ' + (error.message || 'Hết phiên làm việc'));
      }
    } finally {
      if (!options?.silent) {
        setIsInitialLoading(false);
        setIsRefreshing(false);
      }
    }
  };

  React.useEffect(() => {
    if (!isAuthLoading && authUser?.id) {
      fetchData();
    }
  }, [isAuthLoading, authUser?.id]);

  // Auto-switch preview active tab based on selected user/role permissions
  React.useEffect(() => {
    const subject = resolvePreviewSubject({
      users,
      roles,
      selectedPreviewUser,
      selectedPreviewRole
    });
    const perms = getPreviewPermissions(subject);
    const access = buildSystemPreviewAccess(perms, subject.role);

    let isCurrentTabAccessible = false;
    if (previewActiveTab === 'logs' && access.previewCanReadLogs) isCurrentTabAccessible = true;
    if (previewActiveTab === 'requests' && access.previewCanReadRequests) isCurrentTabAccessible = true;
    if (previewActiveTab === 'backup' && access.previewCanReadBackups) isCurrentTabAccessible = true;

    if (!isCurrentTabAccessible) {
      if (access.previewCanReadLogs) {
        setPreviewActiveTab('logs');
      } else if (access.previewCanReadRequests) {
        setPreviewActiveTab('requests');
      } else if (access.previewCanReadBackups) {
        setPreviewActiveTab('backup');
      }
    }
  }, [selectedPreviewRole, selectedPreviewUser, roles, users, previewActiveTab]);

  // Fetch preview data function
  const fetchPreviewData = async (tab: 'logs' | 'requests' | 'backup', hasPerm: boolean) => {
    const token = tokenStorage.getAccessToken();
    if (!token) return;

    if (!hasPerm) {
      if (tab === 'logs') { setPreviewLogs([]); setPreviewLogsError(null); }
      if (tab === 'requests') { setPreviewRequests([]); setPreviewRequestsError(null); }
      if (tab === 'backup') { setPreviewBackups([]); setPreviewBackupsError(null); }
      return;
    }

    const currentRequestId = ++previewRequestIdRef.current;

    try {
      if (tab === 'logs') {
        setIsPreviewLogsLoading(true);
        setPreviewLogsError(null);
        const res = await systemApi.getLoginLogs({ page: 1, limit: 2 });
        if (currentRequestId !== previewRequestIdRef.current) return;
        setPreviewLogs(res.items || []);
      } else if (tab === 'requests') {
        setIsPreviewRequestsLoading(true);
        setPreviewRequestsError(null);
        const res = await systemApi.getRequests({ page: 1, limit: 2 });
        if (currentRequestId !== previewRequestIdRef.current) return;
        setPreviewRequests(res.items || []);
      } else if (tab === 'backup') {
        setIsPreviewBackupsLoading(true);
        setPreviewBackupsError(null);
        const res = await systemApi.getBackups({ page: 1, limit: 2 });
        if (currentRequestId !== previewRequestIdRef.current) return;
        setPreviewBackups(res.items || []);
      }
    } catch (error: any) {
      if (currentRequestId !== previewRequestIdRef.current) return;
      console.error(`Preview fetch error for ${tab}:`, error);
      const errMsg = error.status === 403 ? 'Backend từ chối quyền (lệch cấu hình)' : (error.message || 'Lỗi tải dữ liệu');
      if (tab === 'logs') { setPreviewLogsError(errMsg); setPreviewLogs([]); }
      if (tab === 'requests') { setPreviewRequestsError(errMsg); setPreviewRequests([]); }
      if (tab === 'backup') { setPreviewBackupsError(errMsg); setPreviewBackups([]); }
    } finally {
      if (currentRequestId === previewRequestIdRef.current) {
        if (tab === 'logs') setIsPreviewLogsLoading(false);
        if (tab === 'requests') setIsPreviewRequestsLoading(false);
        if (tab === 'backup') setIsPreviewBackupsLoading(false);
      }
    }
  };

  // Fetch preview data on tab or subject change
  React.useEffect(() => {
    if (activeTab !== 'Xem trước') return;
    if (selectedPreviewPage !== '/system') return;

    const subject = resolvePreviewSubject({
      users,
      roles,
      selectedPreviewUser,
      selectedPreviewRole
    });
    const perms = getPreviewPermissions(subject);
    const access = buildSystemPreviewAccess(perms, subject.role);

    if (previewActiveTab === 'logs') {
      fetchPreviewData('logs', access.previewCanReadLogs);
    } else if (previewActiveTab === 'requests') {
      fetchPreviewData('requests', access.previewCanReadRequests);
    } else if (previewActiveTab === 'backup') {
      fetchPreviewData('backup', access.previewCanReadBackups);
    }
  }, [activeTab, previewActiveTab, selectedPreviewRole, selectedPreviewUser, roles, users]);

  const [isGroupModalOpen, setIsGroupModalOpen] = useState(false);
  const [editingGroup, setEditingGroup] = useState<any>(null);

  const [isPermissionModalOpen, setIsPermissionModalOpen] = useState(false);
  const [editingPermission, setEditingPermission] = useState<any>(null);

  const [isRoleModalOpen, setIsRoleModalOpen] = useState(false);
  const [editingRole, setEditingRole] = useState<any>(null);

  // Roles Tabs state
  const [selectedRole, setSelectedRole] = useState('');
  const [roleFilter, setRoleFilter] = useState('Tất cả');
  const [checkedPerms, setCheckedPerms] = useState<string[]>([]);
  const [isRoleSaving, setIsRoleSaving] = useState(false);

  // Update checked perms when selectedRole changes
  React.useEffect(() => {
    if (selectedRole) {
      const role = roles.find(r => r._id === selectedRole || r.id === selectedRole);
      if (role && role.permissions) {
        // Handle both populated and unpopulated permissions
        const perms = role.permissions.map((p: any) => typeof p === 'string' ? p : p.code || p._id);
        setCheckedPerms(perms);
      }
    }
  }, [selectedRole, roles]);

  const togglePermission = (code: string) => {
    setCheckedPerms(prev => prev.includes(code) ? prev.filter(p => p !== code) : [...prev, code]);
  };

  const toggleGroupPermissions = (groupId: string, isChecked: boolean) => {
    const groupPerms = permissionsByGroup[groupId]?.map(p => p.code) || [];
    if (isChecked) {
      setCheckedPerms(prev => Array.from(new Set([...prev, ...groupPerms])));
    } else {
      setCheckedPerms(prev => prev.filter(code => !groupPerms.includes(code)));
    }
  };

  const isGroupFullyChecked = (groupId: string) => {
    const groupPerms = permissionsByGroup[groupId]?.map(p => p.code) || [];
    return groupPerms.length > 0 && groupPerms.every(code => checkedPerms.includes(code));
  };

  const handleSaveRole = async () => {
    if (!selectedRole) {
      toast.error('Vui lòng chọn vai trò để lưu');
      return;
    }

    setIsRoleSaving(true);
    try {
      const token = tokenStorage.getAccessToken();
      if (!token) throw new Error('Hết phiên làm việc');

      // Map codes back to _ids for the backend
      const permissionIds = allPermissions
        .filter(p => checkedPerms.includes(p.code))
        .map(p => p._id);

      await authApi.updateRole(selectedRole, { permissions: permissionIds }, token);

      toast.success('Lưu cấu hình phân quyền thành công!');
      fetchData(); // Refresh data
    } catch (error: any) {
      toast.error('Lỗi khi lưu: ' + error.message);
    } finally {
      setIsRoleSaving(false);
    }
  };

  const isEditingUser = !!editingUser;

  const handleUserSave = async (userData: any) => {
    const token = tokenStorage.getAccessToken();
    if (!token) throw new Error('Hết phiên làm việc');

    if (isEditingUser) {
      await authApi.updateUser(editingUser._id, {
        user_name: userData.username,
        email: userData.email,
        status: userData.status,
        role_id: userData.role,
        advisor_class_ids: userData.advisor_class_ids || [],
        ...(userData.password ? { password: userData.password } : {})
      }, token);
    } else {
      await authApi.createUser({
        user_name: userData.username,
        email: userData.email,
        password: userData.password,
        role_id: userData.role,
        status: userData.status,
        advisor_class_ids: userData.advisor_class_ids || []
      }, token);
    }
    fetchData();
  };

  const handleBulkUserSave = async (bulkData: any) => {
    const token = tokenStorage.getAccessToken();
    if (!token) throw new Error('Hết phiên làm việc');
    return await authApi.createUsersBulk(bulkData, token).then((res) => {
      fetchData({ silent: true });
      return res;
    });
  };

  const handleDeleteUser = (user: any) => {
    setDeleteConfig({
      title: 'Xóa người dùng',
      message: `Bạn có chắc chắn muốn xóa người dùng "${user.user_name || user.username}"? Hành động này không thể hoàn tác.`,
      onConfirm: async () => {
        const token = tokenStorage.getAccessToken();
        if (!token) {
          toast.error('Hết phiên làm việc');
          return;
        }
        await authApi.deleteUser(user._id, token);
        toast.success('Xóa người dùng thành công');
        fetchData();
      }
    });
    setIsDeleteModalOpen(true);
  };

  const handlePermissionSave = async (permData: any) => {
    const token = tokenStorage.getAccessToken();
    if (!token) throw new Error('Hết phiên làm việc');

    if (editingPermission) {
      await authApi.updatePermission(editingPermission._id, permData, token);
      toast.success('Cập nhật quyền thành công');
    } else {
      await authApi.createPermission(permData, token);
      toast.success('Tạo quyền mới thành công');
    }
    fetchData();
  };

  const handleRoleModalSave = async (roleData: any) => {
    const token = tokenStorage.getAccessToken();
    if (!token) throw new Error('Hết phiên làm việc');

    try {
      if (editingRole) {
        await authApi.updateRole(editingRole._id, roleData, token);
        toast.success('Cập nhật vai trò thành công');
      } else {
        await authApi.createRole(roleData, token);
        toast.success('Tạo vai trò thành công');
      }
      fetchData();
    } catch (error: any) {
      toast.error('Lỗi khi lưu: ' + error.message);
      throw error;
    }
  };

  const handleRoleDelete = (role: any) => {
    if (role.name === 'Admin') {
      toast.error('Không thể xóa vai trò quản trị hệ thống');
      return;
    }

    setDeleteConfig({
      title: 'Xóa vai trò',
      message: `Bạn có chắc chắn muốn xóa vai trò "${role.name}"? Hành động này không thể hoàn tác.`,
      onConfirm: async () => {
        const token = tokenStorage.getAccessToken();
        if (!token) {
          toast.error('Hết phiên làm việc');
          return;
        }
        await authApi.deleteRole(role._id, token);
        toast.success('Xóa vai trò thành công');
        fetchData();
      }
    });
    setIsDeleteModalOpen(true);
  };

  const handlePermissionDelete = (perm: any) => {
    setDeleteConfig({
      title: 'Xóa quyền hạn',
      message: `Bạn có chắc chắn muốn xóa quyền "${perm.name}"? Hành động này không thể hoàn tác.`,
      onConfirm: async () => {
        const token = tokenStorage.getAccessToken();
        if (!token) {
          toast.error('Hết phiên làm việc');
          return;
        }
        await authApi.deletePermission(perm._id, token);
        toast.success('Xóa quyền thành công');
        fetchData();
      }
    });
    setIsDeleteModalOpen(true);
  };

  const handleGroupSave = async (groupData: any) => {
    const token = tokenStorage.getAccessToken();
    if (!token) throw new Error('Hết phiên làm việc');

    if (editingGroup) {
      await authApi.updatePermissionGroup(editingGroup.id, groupData, token);
      toast.success('Cập nhật nhóm quyền thành công');
    } else {
      await authApi.createPermissionGroup(groupData, token);
      toast.success('Tạo nhóm quyền mới thành công');
    }
    fetchData();
  };

  const handleGroupDelete = (group: any) => {
    setDeleteConfig({
      title: 'Xóa nhóm quyền',
      message: `Bạn có chắc chắn muốn xóa nhóm quyền "${group.name}"? Hành động này không thể hoàn tác.`,
      onConfirm: async () => {
        const token = tokenStorage.getAccessToken();
        if (!token) {
          toast.error('Hết phiên làm việc');
          return;
        }
        await authApi.deletePermissionGroup(group.id, token);
        toast.success('Xóa nhóm quyền thành công');
        fetchData();
      }
    });
    setIsDeleteModalOpen(true);
  };

  const handleOpenAddModal = () => {
    setEditingUser(null);
    setIsModalOpen(true);
  };

  const handleOpenEditModal = (user: any) => {
    const advisorClasses = classes.filter(c => c.advisor_id === user._id || c.advisor_id?._id === user._id).map(c => c._id);
    setEditingUser({ ...user, advisor_class_ids: advisorClasses });
    setIsModalOpen(true);
  };

  const handleOpenAddGroupModal = () => {
    setEditingGroup(null);
    setIsGroupModalOpen(true);
  };

  const handleOpenEditGroupModal = (group: any) => {
    setEditingGroup(group);
    setIsGroupModalOpen(true);
  };

  const handleOpenAddPermissionModal = () => {
    setEditingPermission(null);
    setIsPermissionModalOpen(true);
  };

  const handleOpenEditPermissionModal = (perm: any) => {
    setEditingPermission(perm);
    setIsPermissionModalOpen(true);
  };

  const handleOpenAddRoleModal = () => {
    setEditingRole(null);
    setIsRoleModalOpen(true);
  };

  const handleOpenEditRoleModal = (role: any) => {
    setEditingRole(role);
    setIsRoleModalOpen(true);
  };

  React.useEffect(() => {
    if (activeTab === 'Quyền hạn') {
      setIsRightPanelLoading(true);
      const timer = setTimeout(() => setIsRightPanelLoading(false), 300);
      return () => clearTimeout(timer);
    }
  }, [selectedGroup, activeTab]);


  const filteredUsers = filterPermissionUsers(users, searchTerm, filterRole, filterStatuses);

  // Pagination derived data for users table
  const totalUserPages = Math.max(1, Math.ceil(filteredUsers.length / userPageSize));
  React.useEffect(() => {
    // Reset to first page when searching, filtering, or changing page size
    setUserCurrentPage(1);
    setMobileVisibleCount(MOBILE_USER_BATCH_SIZE);
    mobileScrollRef.current?.scrollTo?.({ top: 0 });
  }, [searchTerm, filterRole, filterStatuses, userPageSize]);

  // If current page is out of range after filters change, bring it back
  React.useEffect(() => {
    if (userCurrentPage > totalUserPages) {
      setUserCurrentPage(totalUserPages);
    }
  }, [filteredUsers.length, totalUserPages, userCurrentPage]);

  const paginatedUsers = getPermissionUsersForViewport(filteredUsers, false, mobileVisibleCount, userCurrentPage, userPageSize);
  const mobileUsers = getPermissionUsersForViewport(filteredUsers, true, mobileVisibleCount, userCurrentPage, userPageSize);

  useEffect(() => {
    if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return;
    const mediaQuery = window.matchMedia('(max-width: 767px)');
    const updateIsMobile = () => setIsMobile(mediaQuery.matches);
    updateIsMobile();
    mediaQuery.addEventListener('change', updateIsMobile);
    return () => mediaQuery.removeEventListener('change', updateIsMobile);
  }, []);

  useEffect(() => {
    const sentinel = mobileSentinelRef.current;
    const root = mobileScrollRef.current;
    if (!isMobile || !sentinel || !root || mobileVisibleCount >= filteredUsers.length) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setMobileVisibleCount((count) => Math.min(count + MOBILE_USER_BATCH_SIZE, filteredUsers.length));
        }
      },
      { root, rootMargin: '240px' },
    );
    observer.observe(sentinel);
    return () => observer.disconnect();
  }, [isMobile, mobileVisibleCount, filteredUsers.length]);

  const userColumns: ResponsiveColumn<any>[] = [
    {
      key: 'name',
      header: 'Tên',
      priority: 'primary',
      render: (_, u) => (
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-full bg-white/60 border border-white/80 flex items-center justify-center text-xs font-bold text-[#1E293B] shadow-xs shrink-0">
            {getUserDisplayName(u).substring(0, 2).toUpperCase()}
          </div>
          <div className="flex flex-col">
            <span className="text-xs font-bold text-[#1E293B]">{getUserDisplayName(u)}</span>
            <span className="text-[11px] font-medium text-[#64748B] mt-0.5">
              {u.student_profile ? '' : `Username: ${u.user_name || u.username} • `}ID: {u._id.substring(u._id.length - 8)}
            </span>
          </div>
        </div>
      )
    },
    {
      key: 'email',
      header: 'Liên hệ',
      priority: 'metadata',
      render: (_, u) => (
        <div className="flex flex-col gap-1">
          <div className="flex items-center gap-1.5 text-xs">
            <Mail className="w-3.5 h-3.5 text-[#64748B] shrink-0" />
            <span className="text-[#1E293B] font-medium">{u.email}</span>
          </div>
        </div>
      )
    },
    {
      key: 'role',
      header: 'Vai trò',
      priority: 'metadata',
      render: (_, u) => (
        <div className="flex items-center gap-1.5 flex-wrap">
          {u.role && (
            <span className={`px-2 py-0.5 text-[10px] font-extrabold rounded-xl border ${u.role.name === 'Admin' 
              ? 'bg-purple-500/10 text-purple-700 border-purple-500/20' 
              : 'bg-blue-500/10 text-[#1A73E8] border-blue-500/20'
              }`}>
              {u.role.name}
            </span>
          )}
        </div>
      )
    },
    {
      key: 'status',
      header: 'Trạng thái',
      priority: 'metadata',
      render: (_, u) => (
        <div className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-xl border ${u.status === 'active' 
          ? 'bg-emerald-500/10 text-emerald-700 border-emerald-500/20' 
          : 'bg-rose-500/10 text-rose-700 border-rose-500/20'
          }`}>
          <div className={`w-1.5 h-1.5 rounded-full ${u.status === 'active' ? 'bg-emerald-500' : 'bg-rose-500'}`} />
          <span className="text-[10px] font-bold">{u.status === 'active' ? 'Hoạt động' : u.status}</span>
        </div>
      )
    },
    {
      key: 'actions',
      header: 'Hành động',
      priority: 'action',
      className: 'text-right',
      render: (_, u) => (
        <div className="flex items-center justify-end gap-1.5" onClick={(e) => e.stopPropagation()}>
          {hasPersistedAdminRole(authUser) ? (
            <button
              type="button"
              onClick={() => handleAccessUser(u)}
              disabled={accessingUserId !== null}
              className={`h-8 w-8 inline-flex items-center justify-center rounded-xl border text-[11px] font-bold transition-all disabled:cursor-not-allowed disabled:opacity-50 ${
                u.is_under_impersonation
                  ? 'border-red-200/70 bg-red-50/70 text-red-700 hover:bg-red-100'
                  : 'border-blue-200/70 bg-blue-50/70 text-blue-700 hover:bg-blue-100'
              }`}
              aria-label={`${u.is_under_impersonation ? 'Kết thúc truy cập' : 'Truy cập tài khoản'} ${getUserDisplayName(u)}`}
              title={u.is_under_impersonation ? 'Kết thúc truy cập' : `Truy cập tài khoản ${getUserDisplayName(u)}`}
            >
              {accessingUserId === (u._id || u.id) ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                u.is_under_impersonation ? (
                  <span aria-hidden="true" className="text-base leading-none font-black">×</span>
                ) : (
                  <LogIn className="h-3.5 w-3.5" />
                )
              )}
            </button>
          ) : null}
          <Action
            onView={() => router.push(`/permissions/${u._id || u.id}`)}
            onEdit={() => handleOpenEditModal(u)}
            onDelete={() => handleDeleteUser(u)}
          />
        </div>
      )
    }
  ];

  const permissionColumns: ResponsiveColumn<any>[] = [
    {
      key: 'code',
      header: 'Mã Quyền',
      priority: 'secondary',
      className: 'font-mono text-[11.5px] font-semibold text-[#64748B] tracking-tight w-full md:w-[20%]',
    },
    {
      key: 'name',
      header: 'Tên Quyền',
      priority: 'primary',
      className: 'font-bold text-xs text-[#1E293B] w-full md:w-[25%]',
    },
    {
      key: 'desc',
      header: 'Mô tả',
      priority: 'metadata',
      className: 'text-xs text-[#64748B] font-medium leading-relaxed w-full md:w-[40%]',
    },
    {
      key: 'actions',
      header: 'Thao tác',
      priority: 'action',
      className: 'text-right w-full md:w-[15%]',
      render: (_, perm) => (
        <div className="flex items-center justify-end gap-1.5 opacity-100 transition-all duration-150 ease-out" onClick={(e) => e.stopPropagation()}>
          <button
            onClick={() => handleOpenEditPermissionModal(perm)}
            aria-label={`Chỉnh sửa quyền ${perm.name}`}
            className="p-1.5 bg-white/60 hover:bg-[#1A73E8]/10 text-[#64748B] hover:text-[#1A73E8] rounded-xl border border-white/80 hover:scale-[1.05] active:scale-[0.95] transition-all duration-150 ease-out"
          >
            <Pencil className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={() => handlePermissionDelete(perm)}
            aria-label={`Xóa quyền ${perm.name}`}
            className="p-1.5 bg-white/60 hover:bg-rose-500/10 text-[#64748B] hover:text-rose-700 rounded-xl border border-white/80 hover:scale-[1.05] active:scale-[0.95] transition-all duration-150 ease-out"
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        </div>
      )
    }
  ];

  return (
    <>
        <TabNavigation
          tabs={[
            { id: 'Người dùng', label: 'Người dùng' },
            { id: 'Vai trò', label: 'Vai trò' },
            { id: 'Quyền hạn', label: 'Quyền hạn' },
            { id: 'Sơ đồ luồng', label: 'Sơ đồ luồng' },
            { id: 'Xem trước', label: 'Xem trước' },
            { id: 'Cấu hình', label: 'Cấu hình' }
          ]}
          activeTab={activeTab}
          onTabChange={(id) => setActiveTab(id)}
          responsiveScrollable
        />
        <main className="flex-1 p-4 md:p-5 overflow-hidden flex flex-col bg-transparent relative">
          <AnimatePresence>
            {isRefreshing && (
              <motion.div
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className="absolute top-2 left-1/2 -translate-x-1/2 z-50 flex items-center gap-2 px-3 py-1.5 bg-white/80 backdrop-blur-md rounded-xl shadow-sm border border-white/80 text-xs font-bold text-[#1A73E8]"
              >
                <div className="w-3.5 h-3.5 border-2 border-[#1A73E8] border-t-transparent rounded-full animate-spin"></div>
                Đang làm mới dữ liệu...
              </motion.div>
            )}
          </AnimatePresence>

          {/* Content Area */}
          <div className="flex-1 flex flex-col min-h-0 bg-white/45 backdrop-blur-md rounded-2xl shadow-sm shadow-slate-300/40 border border-white/70 overflow-hidden">
            {activeTab === 'Người dùng' && (
              <>
                {/* Toolbar */}
                <div className="flex flex-col md:flex-row gap-3 items-stretch md:items-center justify-between px-4 sm:px-5 py-3 border-b border-white/50 bg-white/20 shrink-0">
                  <div className="flex flex-wrap items-center gap-2.5">
                    <div className="relative">
                      <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-[#64748B]/70" />
                      <input
                        type="text"
                        placeholder="Tìm kiếm..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="pl-8.5 pr-3 h-9 text-xs font-semibold text-[#1E293B] bg-white/50 backdrop-blur-sm border border-white/70 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#1A73E8]/30 focus:border-[#1A73E8]/50 w-full sm:w-60 transition-all duration-150 ease-out placeholder:text-[#64748B]/70 shadow-xs"
                      />
                    </div>
                    <div className="flex flex-wrap items-center gap-2.5 w-full sm:w-auto">
                      <label className="flex min-w-[145px] flex-1 sm:flex-initial items-center gap-2 text-[11px] font-bold text-[#64748B] whitespace-nowrap">
                        <span className="shrink-0 whitespace-nowrap">Vai trò</span>
                        <Select value={filterRole} onValueChange={setFilterRole}>
                          <SelectTrigger aria-label="Vai trò" className="h-9 min-w-[110px] w-full sm:w-32 bg-white/50 backdrop-blur-sm border border-white/80 rounded-xl text-xs font-semibold text-[#1E293B] focus-within:bg-white/70 focus-within:ring-2 focus-within:ring-[#1A73E8]/30 shadow-none">
                            <SelectValue placeholder="Tất cả" />
                          </SelectTrigger>
                          <SelectContent className="bg-white/90 backdrop-blur-md border border-white/80 rounded-xl shadow-md">
                            {['Tất cả', ...(roles || []).map((r: any) => r.name).filter(Boolean)].map((role) => (
                              <SelectItem key={role} value={role} className="text-xs rounded-lg font-medium">{role}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </label>
                      <label className="flex min-w-[165px] flex-1 sm:flex-initial items-center gap-2 text-[11px] font-bold text-[#64748B] whitespace-nowrap">
                        <span className="shrink-0 whitespace-nowrap">Trạng thái</span>
                        <Select value={filterStatuses.join('|')} onValueChange={handleToggleStatus}>
                          <SelectTrigger aria-label="Trạng thái" className="h-9 min-w-[120px] w-full sm:w-36 bg-white/50 backdrop-blur-sm border border-white/80 rounded-xl text-xs font-semibold text-[#1E293B] focus-within:bg-white/70 focus-within:ring-2 focus-within:ring-[#1A73E8]/30 shadow-none">
                            <SelectValue>{filterStatuses.join(', ')}</SelectValue>
                          </SelectTrigger>
                          <SelectContent className="bg-white/90 backdrop-blur-md border border-white/80 rounded-xl shadow-md">
                            {['Tất cả', 'Hoạt động', 'Chưa kích hoạt', 'Bị khóa'].map((status) => (
                              <SelectItem key={status} value={status} className="text-xs rounded-lg font-medium">{status}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </label>
                    </div>

                    {selectedUserIds.length > 0 && (
                      <button
                        onClick={handleDeleteUsersBulk}
                        className="flex h-9 items-center gap-1.5 px-3 text-xs font-bold text-rose-700 bg-rose-500/10 border border-rose-500/20 rounded-xl hover:bg-rose-500/20 hover:scale-[1.01] active:scale-[0.99] transition-all duration-150 ease-out shadow-xs animate-fade-in"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                        Xóa ({selectedUserIds.length})
                      </button>
                    )}
                  </div>

                  <div className="flex w-full md:w-auto items-center justify-end gap-2 shrink-0">
                    <button className="w-9 h-9 flex items-center justify-center text-[#64748B] bg-white/50 backdrop-blur-sm hover:bg-white/70 hover:text-[#1E293B] hover:scale-[1.05] active:scale-[0.95] rounded-xl border border-white/70 shadow-xs transition-all duration-150 ease-out">
                      <Settings className="w-4 h-4" />
                    </button>

                    <button
                      onClick={handleOpenAddModal}
                      className="flex items-center gap-1.5 px-4 h-9 text-xs font-bold text-white bg-[#1A73E8] hover:bg-[#155cb4] rounded-xl shadow-sm hover:scale-[1.01] active:scale-[0.99] transition-all duration-150 ease-out shrink-0"
                    >
                      <Plus className="w-4 h-4" strokeWidth={3} />
                      Thêm người dùng
                    </button>
                  </div>
                </div>

                <ResponsiveDataView
                  data={isMobile ? mobileUsers : paginatedUsers}
                  columns={userColumns}
                  isLoading={isInitialLoading}
                  keyExtractor={(u) => u._id || u.id}
                  mobileScrollRef={mobileScrollRef}
                  mobileVirtualization
                  hidePaginationOnMobile
                  mobileFooter={
                    <div ref={mobileSentinelRef} className="h-8 flex items-center justify-center text-[11px] text-slate-400">
                      {isMobile && mobileVisibleCount < filteredUsers.length ? 'Đang tải thêm...' : null}
                    </div>
                  }
                  selection={{
                    selectedKeys: selectedUserIds,
                    onSelectRow: (id) => toggleSelectUser(id),
                    onSelectAll: () => toggleSelectAllUsers(isMobile ? mobileUsers : paginatedUsers),
                    allSelected: (isMobile ? mobileUsers : paginatedUsers).length > 0 && (isMobile ? mobileUsers : paginatedUsers).every(u => selectedUserIds.includes(u._id || u.id))
                  }}
                  pagination={
                    <CustomPagination
                      currentPage={userCurrentPage}
                      pageSize={userPageSize}
                      totalItems={filteredUsers.length}
                      onPageChange={setUserCurrentPage}
                      onPageSizeChange={setUserPageSize}
                      label="người"
                      isLoading={isInitialLoading}
                    />
                  }
                />
              </>
            )}

            {/* --- TAB QUYỀN HẠN --- */}
            {activeTab === 'Quyền hạn' && (
              <div className="flex-1 flex flex-col lg:flex-row overflow-y-auto lg:overflow-hidden">
                {/* Left Sidebar: Groups */}
                <div className="w-full lg:w-[320px] bg-white/10 border-b lg:border-b-0 lg:border-r border-white/50 flex flex-col shrink-0">
                  <div className="px-4 py-3 border-b border-white/50 bg-white/10 flex items-center justify-between">
                    <h2 className="text-xs font-bold text-[#1E293B] uppercase tracking-wider">Danh sách Nhóm quyền</h2>
                    <button
                      onClick={handleOpenAddGroupModal}
                      className="text-[#1A73E8] hover:text-[#155cb4] p-1.5 bg-[#1A73E8]/10 border border-[#1A73E8]/20 rounded-xl hover:scale-[1.05] active:scale-[0.95] transition-all duration-150 ease-out"
                    >
                      <Plus className="w-4 h-4" strokeWidth={2.5} />
                    </button>
                  </div>
                  <div className="px-4 py-3 flex flex-col gap-3 border-b border-white/50 bg-white/5">
                    <div className="relative">
                      <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-[#64748B]/70" />
                      <input
                        type="text"
                        placeholder="Tìm kiếm nhóm..."
                        className="w-full pl-8.5 pr-3 py-1.5 text-xs font-semibold text-[#1E293B] bg-white/50 border border-white/80 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#1A73E8]/30 focus:border-[#1A73E8]/50 transition-all duration-150 ease-out placeholder:text-[#64748B]/70 shadow-sm"
                      />
                    </div>
                  </div>
                  <div className="flex-1 overflow-y-auto p-3 space-y-2.5">
                    {isInitialLoading ? (
                      Array.from({ length: 4 }).map((_, i) => (
                        <Skeleton key={i} className="w-full h-24 rounded-xl" />
                      ))
                    ) : (
                      groups.map((group) => (
                        <div
                          key={group.id}
                          onClick={() => setSelectedGroup(group.id)}
                          className={`group p-3 rounded-xl cursor-pointer transition-all border-l-2 shadow-sm hover:scale-[1.01] active:scale-[0.99] duration-150 ease-out ${
                            selectedGroup === group.id
                              ? 'bg-white/70 border-[#1A73E8] shadow-[#1A73E8]/5'
                              : 'bg-white/30 border-transparent hover:bg-white/50'
                          }`}
                        >
                          <div className="flex items-start justify-between mb-1">
                            <h3 className={`text-xs font-bold ${selectedGroup === group.id ? 'text-[#1A73E8]' : 'text-[#1E293B]'}`}>
                              {group.name}
                            </h3>
                            <span className="px-2 py-0.5 bg-white/60 text-[#64748B] border border-white/80 text-[9.5px] font-bold rounded-xl uppercase tracking-wider shadow-sm">
                              {group.tag}
                            </span>
                          </div>
                          <p className="text-[11px] text-[#64748B] mb-3 line-clamp-1">{group.desc}</p>
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                              <div className="flex items-center gap-1">
                                <div className={`w-1.5 h-1.5 rounded-full ${group.status === 'Active' ? 'bg-emerald-500 animate-pulse' : 'bg-slate-300'}`} />
                                <span className={`text-[10.5px] font-bold ${group.status === 'Active' ? 'text-emerald-700' : 'text-[#64748B]/50'}`}>
                                  {group.status === 'Active' ? 'Hoạt động' : 'Ngừng kích hoạt'}
                                </span>
                              </div>
                              <span className="text-slate-300 text-[10px]">•</span>
                              <span className="text-[10.5px] font-bold text-[#64748B]">{group.count} Quyền</span>
                            </div>
                            <div className={`flex items-center gap-1.5 ${selectedGroup === group.id ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'}`}>
                              <button
                                onClick={(e) => { e.stopPropagation(); handleOpenEditGroupModal(group); }}
                                className="p-1 bg-white/60 hover:bg-[#1A73E8]/10 text-[#64748B] hover:text-[#1A73E8] rounded-lg border border-white/80 hover:scale-[1.05] active:scale-[0.95] transition-all"
                              >
                                <Pencil className="w-3 h-3" />
                              </button>
                              <button
                                onClick={(e) => { e.stopPropagation(); handleGroupDelete(group); }}
                                className="p-1 bg-white/60 hover:bg-rose-500/10 text-[#64748B] hover:text-rose-700 rounded-lg border border-white/80 hover:scale-[1.05] active:scale-[0.95] transition-all"
                              >
                                <Trash2 className="w-3 h-3" />
                              </button>
                            </div>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </div>

                {/* Right Panel: Permissions List */}
                <div className="flex-1 bg-transparent flex flex-col min-w-0 min-h-[400px] lg:min-h-0">
                  {/* Header / Tabs right panel */}
                  <div className="px-5 py-2 flex flex-col sm:flex-row sm:items-center justify-between border-b border-white/50 bg-white/10 shrink-0 gap-4">
                    {/* Inner Tabs */}
                    <div className="flex items-center gap-6">
                      {['Danh sách Quyền', 'Lịch sử Audit'].map(tab => (
                        <button
                          key={tab}
                          onClick={() => setInnerRightTab(tab)}
                          className={`py-3.5 text-xs font-bold transition-colors relative ${
                            innerRightTab === tab ? 'text-[#1A73E8]' : 'text-[#64748B] hover:text-[#1E293B]'
                          }`}
                        >
                          {tab}
                          {innerRightTab === tab && (
                            <motion.div
                              layoutId="innerTabIndicator"
                              className="absolute bottom-0 left-0 right-0 h-[2.5px] bg-[#1A73E8] rounded-t-full"
                            />
                          )}
                        </button>
                      ))}
                    </div>

                    <div className="flex items-center gap-2">
                      <button className="w-8 h-8 flex items-center justify-center text-[#64748B] bg-white/50 hover:bg-white/80 rounded-xl transition-all duration-150 ease-out border border-white/80 hover:scale-[1.02] active:scale-[0.98] shadow-sm">
                        <Settings className="w-4 h-4" />
                      </button>
                      <button
                        onClick={handleOpenAddPermissionModal}
                        className="flex items-center gap-1.5 px-4 h-8 text-xs font-bold text-white bg-[#1A73E8] rounded-xl hover:bg-[#155cb4] shadow-sm hover:scale-[1.01] active:scale-[0.99] transition-all duration-150 ease-out"
                      >
                        <Plus className="w-4 h-4" />
                        Thêm quyền
                      </button>
                    </div>
                  </div>

                  {/* Table area */}
                  <div className="flex-1 overflow-y-auto p-5 bg-transparent">
                    <div className="bg-white/60 border border-white/80 shadow-sm shadow-slate-200/20 rounded-2xl overflow-hidden flex flex-col h-full min-h-[300px]">
                      <ResponsiveDataView
                        data={permissionsByGroup[selectedGroup] || []}
                        columns={permissionColumns}
                        isLoading={isRightPanelLoading || isInitialLoading}
                        keyExtractor={(perm) => `${selectedGroup}-${perm.code}`}
                        pagination={
                          <CustomPagination
                            currentPage={1}
                            pageSize={10}
                            totalItems={(permissionsByGroup[selectedGroup] || []).length}
                            onPageChange={() => { }}
                            label="quyền"
                          />
                        }
                      />
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* --- TAB VAI TRÒ --- */}
            {activeTab === 'Vai trò' && (
              <div className="flex-1 flex flex-col lg:flex-row overflow-y-auto lg:overflow-hidden">
                {/* Left Sidebar: Roles */}
                <div className="w-full lg:w-[340px] bg-white/10 border-b lg:border-b-0 lg:border-r border-white/50 flex flex-col shrink-0">
                  <div className="px-4 py-3 border-b border-white/50 bg-white/10 flex items-center justify-between">
                    <h2 className="text-xs font-bold text-[#1E293B] uppercase tracking-wider">Danh sách vai trò</h2>
                    <button
                      onClick={handleOpenAddRoleModal}
                      className="text-[#1A73E8] hover:text-[#155cb4] p-1.5 bg-[#1A73E8]/10 border border-[#1A73E8]/20 rounded-xl hover:scale-[1.05] active:scale-[0.95] transition-all duration-150 ease-out"
                    >
                      <Plus className="w-4 h-4" strokeWidth={2.5} />
                    </button>
                  </div>
                  <div className="px-4 py-3 flex flex-col gap-3 border-b border-white/50 bg-white/5">
                    <div className="relative">
                      <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-[#64748B]/70" />
                      <input
                        type="text"
                        placeholder="Tìm kiếm vai trò..."
                        className="w-full pl-8.5 pr-3 py-1.5 text-xs font-semibold text-[#1E293B] bg-white/50 border border-white/80 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#1A73E8]/30 focus:border-[#1A73E8]/50 transition-all duration-150 ease-out placeholder:text-[#64748B]/70 shadow-sm"
                      />
                    </div>
                  </div>
                  <div className="flex-1 overflow-y-auto p-3 space-y-2.5">
                    {isInitialLoading ? (
                      Array.from({ length: 4 }).map((_, i) => (
                        <Skeleton key={i} className="w-full h-24 rounded-xl" />
                      ))
                    ) : (
                      roles.map((role) => (
                        <div
                          key={role._id}
                          onClick={() => setSelectedRole(role._id)}
                          className={`p-3 rounded-xl cursor-pointer transition-all border-l-2 shadow-sm hover:scale-[1.01] active:scale-[0.99] duration-150 ease-out ${
                            selectedRole === role._id
                              ? 'bg-white/70 border-[#1A73E8] shadow-[#1A73E8]/5'
                              : 'bg-white/30 border-transparent hover:bg-white/50'
                          }`}
                        >
                          <div className="flex items-start justify-between mb-1">
                            <h3 className={`text-xs font-bold ${selectedRole === role._id ? 'text-[#1A73E8]' : 'text-[#1E293B]'}`}>
                              {role.name}
                            </h3>
                            <span
                              className={`px-2 py-0.5 text-[9.5px] font-bold rounded-xl border ${
                                role.name === 'Admin'
                                  ? 'bg-purple-500/10 text-purple-700 border-purple-500/20'
                                  : 'bg-blue-500/10 text-[#1A73E8] border-blue-500/20'
                              }`}
                            >
                              {role.name}
                            </span>
                          </div>
                          <p className="text-[11px] text-[#64748B] font-medium leading-relaxed mt-1">{role.description || 'Chưa cấu hình mô tả'}</p>
                          <div className="flex items-center justify-between mt-3.5 pt-2.5 border-t border-white/20">
                            <span className="text-[10px] text-[#64748B] font-bold">
                              {role.permissions ? role.permissions.length : 0} Quyền hạn
                            </span>
                            <div className="flex items-center gap-1.5">
                              <button
                                onClick={(e) => { e.stopPropagation(); handleOpenEditRoleModal(role); }}
                                className="p-1 bg-white/60 hover:bg-[#1A73E8]/10 text-[#64748B] hover:text-[#1A73E8] rounded-lg border border-white/80 hover:scale-[1.05] active:scale-[0.95] transition-all"
                              >
                                <Pencil className="w-3.5 h-3.5" />
                              </button>
                              <button
                                onClick={(e) => { e.stopPropagation(); handleRoleDelete(role); }}
                                className="p-1 bg-white/60 hover:bg-rose-500/10 text-[#64748B] hover:text-rose-700 rounded-lg border border-white/80 hover:scale-[1.05] active:scale-[0.95] transition-all"
                              >
                              </button>
                            </div>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </div>

                {/* Right Panel: Permission Matrix */}
                <div className="flex-1 bg-transparent flex flex-col min-w-0">
                  {/* Header / Tabs right panel */}
                  <div className="px-5 py-2 flex flex-col sm:flex-row sm:items-center justify-between border-b border-white/50 bg-white/10 shrink-0 gap-4">
                    <div className="flex items-center gap-6">
                      {['Ma trận quyền', 'Lịch sử Audit'].map(tab => (
                        <button
                          key={tab}
                          className={`py-3.5 text-xs font-bold transition-colors relative ${
                            tab === 'Ma trận quyền' ? 'text-[#1A73E8]' : 'text-[#64748B] hover:text-[#1E293B]'
                          }`}
                        >
                          {tab}
                          {tab === 'Ma trận quyền' && (
                            <motion.div
                              layoutId="matrixTabIndicator"
                              className="absolute bottom-0 left-0 right-0 h-[2.5px] bg-[#1A73E8] rounded-t-full"
                            />
                          )}
                        </button>
                      ))}
                    </div>

                    <div className="flex items-center gap-2">
                      <button className="w-8 h-8 flex items-center justify-center text-[#64748B] bg-white/50 hover:bg-white/80 rounded-xl transition-all duration-150 ease-out border border-white/80 hover:scale-[1.02] active:scale-[0.98] shadow-sm">
                        <Settings className="w-4 h-4" />
                      </button>
                      <button
                        onClick={handleSaveRole}
                        disabled={isRoleSaving}
                        className="flex items-center gap-1.5 px-4 h-8 text-xs font-bold text-white bg-[#1A73E8] rounded-xl hover:bg-[#155cb4] shadow-sm hover:scale-[1.01] active:scale-[0.99] transition-all duration-150 ease-out disabled:opacity-50"
                      >
                        {isRoleSaving ? (
                          <motion.div animate={{ rotate: 360 }} transition={{ duration: 1, repeat: Infinity, ease: 'linear' }} className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full" />
                        ) : (
                          <Save className="w-3.5 h-3.5" />
                        )}
                        Lưu thay đổi
                      </button>
                    </div>
                  </div>

                  {/* Matrix Content Area */}
                  <div className="flex-1 overflow-y-auto p-5 bg-transparent">
                    <div className="max-w-5xl mx-auto space-y-5">
                      {isInitialLoading ? (
                        Array.from({ length: 3 }).map((_, i) => (
                          <Skeleton key={i} className="w-full h-40 rounded-2xl" />
                        ))
                      ) : (
                        groups.map((groupData) => {
                          const permissions = permissionsByGroup[groupData.id] || [];

                          return (
                            <div key={groupData.id} className="bg-white/60 border border-white/80 shadow-sm shadow-slate-200/20 rounded-2xl overflow-hidden">
                              {/* Group Header */}
                              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-4 border-b border-white/50 bg-white/20 relative">
                                <div className="pr-40">
                                  <div className="flex items-center gap-3 mb-1 flex-wrap">
                                    <h3 className="text-sm font-bold text-[#1E293B]">{groupData.name}</h3>
                                    {(groupData.tag === 'G_ADMIN_RBAC' || groupData.tag === 'G_SYSTEM_OPERATIONS') && (
                                      <span className="px-2 py-0.5 bg-red-105 text-red-700 border border-red-200 text-[9px] font-extrabold rounded-md uppercase tracking-wider shadow-sm animate-pulse">
                                        High Risk
                                      </span>
                                    )}
                                  </div>
                                  <p className="text-[11.5px] text-[#64748B] font-medium">{groupData.desc}</p>
                                </div>
                                <div className="flex items-center gap-4 sm:absolute sm:top-1/2 sm:-translate-y-1/2 sm:right-4">
                                  <span className="px-2 py-0.5 bg-white/60 text-[#64748B] border border-white/80 text-[9.5px] font-bold rounded-xl uppercase tracking-wider shadow-sm">
                                    MÃ: {groupData.tag}
                                  </span>
                                  <div className="flex items-center gap-1.5">
                                    <input
                                      type="checkbox"
                                      id={`checkAll-${groupData.id}`}
                                      checked={isGroupFullyChecked(groupData.id)}
                                      onChange={(e) => toggleGroupPermissions(groupData.id, e.target.checked)}
                                      className="w-3.5 h-3.5 rounded border-slate-300 text-[#1A73E8] focus:ring-[#1A73E8]/30 cursor-pointer"
                                    />
                                    <label htmlFor={`checkAll-${groupData.id}`} className="text-xs font-bold text-[#1E293B] cursor-pointer select-none">
                                      Chọn tất cả
                                    </label>
                                  </div>
                                </div>
                              </div>

                              {/* Permissions Grid */}
                              <div className="p-4 grid grid-cols-1 lg:grid-cols-2 gap-y-4 gap-x-8">
                                {permissions.map((perm) => (
                                  <div key={`${groupData.id}-${perm.code}`} className="flex items-start gap-3 flex-1 group">
                                    <div className="mt-0.5 shrink-0">
                                      <input
                                        type="checkbox"
                                        id={`perm-${groupData.id}-${perm.code}`}
                                        checked={checkedPerms.includes(perm.code)}
                                        onChange={() => togglePermission(perm.code)}
                                        className="w-3.5 h-3.5 rounded border-slate-300 text-[#1A73E8] focus:ring-[#1A73E8]/30 cursor-pointer transition-colors"
                                      />
                                    </div>
                                    <div className="flex flex-col flex-1 min-w-0">
                                      <div className="flex items-start justify-between gap-3 mb-0.5">
                                        <label htmlFor={`perm-${groupData.id}-${perm.code}`} className="text-xs font-bold text-[#1E293B] cursor-pointer hover:text-[#1A73E8] transition-colors leading-tight">
                                          {perm.name}
                                        </label>
                                        <span className="font-mono text-[9.5px] font-semibold text-[#64748B] mt-0.5 shrink-0">
                                          {perm.code}
                                        </span>
                                      </div>
                                      <p className="text-[11px] text-[#64748B] font-medium leading-relaxed pr-2">
                                        {perm.desc}
                                      </p>
                                    </div>

                                    {/* Permission Actions */}
                                    <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-all">
                                      <button
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          handleOpenEditPermissionModal(perm);
                                        }}
                                        className="p-1 bg-white/60 hover:bg-[#1A73E8]/10 text-[#64748B] hover:text-[#1A73E8] rounded-lg border border-white/80 hover:scale-[1.05] active:scale-[0.95] transition-all"
                                        title="Sửa quyền"
                                      >
                                        <Pencil className="w-3 h-3" />
                                      </button>
                                      <button
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          handlePermissionDelete(perm);
                                        }}
                                        className="p-1 bg-white/60 hover:bg-rose-500/10 text-[#64748B] hover:text-rose-700 rounded-lg border border-white/80 hover:scale-[1.05] active:scale-[0.95] transition-all"
                                        title="Xóa quyền"
                                      >
                                        <Trash2 className="w-3.5 h-3.5" />
                                      </button>
                                    </div>
                                  </div>
                                ))}
                              </div>
                            </div>
                          );
                        })
                      )}
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Tab Sơ đồ luồng */}
            {activeTab === 'Sơ đồ luồng' && (
              <div className="flex-1 w-full h-[600px] min-h-[600px] overflow-hidden relative bg-slate-50/50 rounded-b-2xl">
                <PermissionFlowDiagram 
                  routePermissions={routePermissions} 
                  pagePermissionScopes={pagePermissionScopes}
                  groups={groups} 
                  permissionsByGroup={permissionsByGroup} 
                />
              </div>
            )}

            {/* Tab Gán quyền trang */}
            {activeTab === 'Cấu hình' && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="flex-grow flex flex-col overflow-hidden bg-transparent"
              >
                {/* Toolbar */}
                <div className="px-5 py-2 flex flex-col sm:flex-row sm:items-center justify-between border-b border-white/50 bg-white/10 shrink-0 gap-4">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-xl bg-[#1A73E8]/10 border border-[#1A73E8]/20 flex items-center justify-center shrink-0">
                      <Route className="w-4.5 h-4.5 text-white" />
                    </div>
                    <div>
                      <h3 className="text-xs font-bold text-[#1E293B] uppercase tracking-wider">Cấu hình quyền theo trang</h3>
                      <p className="text-[10.5px] text-[#64748B] font-bold mt-0.5">{routePermissions.length} cấu hình đang hoạt động</p>
                    </div>
                  </div>
                  <button
                    onClick={() => { setEditingRoutePerm(null); setIsRoutePermModalOpen(true); }}
                    className="flex items-center gap-1.5 px-4 h-8 text-xs font-bold text-white bg-[#1A73E8] rounded-xl hover:bg-[#155cb4] shadow-sm hover:scale-[1.01] active:scale-[0.99] transition-all duration-150 ease-out"
                  >
                    <Plus className="w-3.5 h-3.5" strokeWidth={2.5} />
                    Thêm cấu hình
                  </button>
                </div>

                {/* Table */}
                <div className="flex-1 overflow-y-auto p-5 bg-transparent">
                  <div className="bg-white/60 border border-white/80 shadow-sm shadow-slate-200/20 rounded-2xl overflow-hidden flex flex-col h-full">
                    <table className="w-full text-left border-collapse">
                      <thead className="bg-white/20 border-b border-white/50 sticky top-0 z-10">
                        <tr>
                          <th className="px-6 py-3 text-[11px] font-bold text-[#64748B] uppercase tracking-wider">Route</th>
                          <th className="px-6 py-3 text-[11px] font-bold text-[#64748B] uppercase tracking-wider">Tên</th>
                          <th className="px-6 py-3 text-[11px] font-bold text-[#64748B] uppercase tracking-wider">Loại</th>
                          <th className="px-6 py-3 text-[11px] font-bold text-[#64748B] uppercase tracking-wider">Quyền yêu cầu</th>
                          <th className="px-6 py-3 text-[11px] font-bold text-[#64748B] uppercase tracking-wider text-center">Kiểm tra</th>
                          <th className="px-6 py-3 text-[11px] font-bold text-[#64748B] uppercase tracking-wider text-center">Trạng thái</th>
                          <th className="px-6 py-3 text-[11px] font-bold text-[#64748B] uppercase tracking-wider text-right">Thao tác</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-50">
                        {isInitialLoading ? (
                          Array.from({ length: 5 }).map((_, idx) => (
                            <tr key={`sk-${idx}`}>
                              {Array.from({ length: 7 }).map((_, ci) => (
                                <td key={ci} className="px-6 py-4"><Skeleton className="h-4 w-24 rounded" /></td>
                              ))}
                            </tr>
                          ))
                        ) : routePermissions.length === 0 ? (
                          <tr>
                            <td colSpan={7} className="px-6 py-16 text-center">
                              <div className="flex flex-col items-center gap-3">
                                <div className="w-12 h-12 rounded-xl bg-white/50 border border-white/80 shadow-sm flex items-center justify-center">
                                  <Route className="w-7 h-7 text-slate-400" />
                                </div>
                                <p className="text-[#64748B] font-bold text-xs">Chưa có cấu hình nào</p>
                                <p className="text-[11px] text-[#64748B]/70">Nhấn "Thêm cấu hình" để gán quyền cho trang</p>
                              </div>
                            </td>
                          </tr>
                        ) : (
                          routePermissions.map((rp: any) => {
                            const typeConfig = rp.type === 'api'
                              ? { icon: Cpu, label: 'API', color: 'text-purple-700 bg-purple-500/10 border-purple-500/20' }
                              : rp.type === 'feature'
                                ? { icon: Zap, label: 'Chức năng', color: 'text-amber-700 bg-amber-500/10 border-amber-500/20' }
                                : { icon: Globe, label: 'Trang', color: 'text-[#1A73E8] bg-blue-500/10 border-blue-500/20' };
                            const TypeIcon = typeConfig.icon;
                            return (
                              <tr key={rp._id} className="hover:bg-white/40 border-b border-white/20 transition-all duration-150 ease-out hover:scale-[1.005] group">
                                <td className="px-6 py-3.5 align-middle">
                                  <span className="text-[10.5px] font-mono font-bold text-indigo-655 bg-indigo-500/10 px-2 py-0.5 rounded-xl border border-indigo-500/20">{rp.route_path}</span>
                                </td>
                                <td className="px-6 py-3.5 align-middle">
                                  <div>
                                    <p className="text-xs font-bold text-[#1E293B]">{rp.route_name}</p>
                                    {rp.description && <p className="text-[10.5px] font-bold text-[#64748B] mt-0.5 truncate max-w-[200px]">{rp.description}</p>}
                                  </div>
                                </td>
                                <td className="px-6 py-3.5 align-middle">
                                  <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-xl text-[10.5px] font-bold border ${typeConfig.color}`}>
                                    <TypeIcon size={12} />
                                    {typeConfig.label}
                                  </span>
                                </td>
                                <td className="px-6 py-3.5 align-middle">
                                  <div className="flex flex-wrap gap-1 max-w-[240px]">
                                    {(rp.permissions || []).slice(0, 3).map((p: any) => (
                                      <span key={p._id || p} className="text-[9.5px] font-mono font-bold text-[#1A73E8] bg-blue-500/10 px-2 py-0.5 rounded-xl border border-blue-500/20">
                                        {p.code || p}
                                      </span>
                                    ))}
                                    {(rp.permissions || []).length > 3 && (
                                      <span className="text-[9.5px] font-bold text-[#64748B] bg-white/60 px-2 py-0.5 rounded-xl border border-white/80 shadow-sm">
                                        +{rp.permissions.length - 3}
                                      </span>
                                    )}
                                  </div>
                                </td>
                                <td className="px-6 py-3.5 align-middle text-center">
                                  <span className={`inline-flex items-center px-2 py-0.5 rounded-xl text-[10.5px] font-bold border ${rp.check_type === 'any' ? 'bg-amber-500/10 text-amber-700 border-amber-500/20' : 'bg-emerald-500/10 text-emerald-700 border-emerald-500/20'}`}>
                                    {rp.check_type === 'any' ? 'Ít nhất 1' : 'Tất cả'}
                                  </span>
                                </td>
                                <td className="px-6 py-3.5 align-middle text-center">
                                  <div className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-xl border text-[10.5px] font-bold ${rp.is_active !== false ? 'bg-emerald-500/10 text-emerald-700 border-emerald-500/20' : 'bg-slate-500/10 text-[#64748B] border-slate-500/20'}`}>
                                    <div className={`w-1.5 h-1.5 rounded-full ${rp.is_active !== false ? 'bg-emerald-500 animate-pulse' : 'bg-slate-300'}`} />
                                    <span className="text-xs font-bold">{rp.is_active !== false ? 'Active' : 'Inactive'}</span>
                                  </div>
                                </td>
                                <td className="px-6 py-3.5 align-middle text-right w-[15%]">
                                  <div className="flex items-center justify-end gap-2 opacity-0 group-hover:opacity-100 transition-all duration-150">
                                    <Action
                                      onEdit={() => { setEditingRoutePerm(rp); setIsRoutePermModalOpen(true); }}
                                      onDelete={() => {
                                        setDeleteConfig({
                                          title: 'Xóa cấu hình route',
                                          message: `Bạn có chắc chắn muốn xóa cấu hình cho route "${rp.route_path}"?`,
                                          onConfirm: async () => {
                                            const token = tokenStorage.getAccessToken();
                                            if (!token) { toast.error('Hết phiên làm việc'); return; }
                                            await authApi.deleteRoutePermission(rp._id, token);
                                            invalidateRoutePermissionCache();
                                            if (typeof window !== 'undefined') {
                                              window.dispatchEvent(new CustomEvent('route-permissions-updated'));
                                            }
                                            toast.success('Xóa cấu hình thành công');
                                            fetchData();
                                          }
                                        });
                                        setIsDeleteModalOpen(true);
                                      }}
                                    />
                                  </div>
                                </td>
                              </tr>
                            );
                          })
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              </motion.div>
            )}

            {/* --- TAB XEM TRƯỚC (PREVIEW) --- */}
            {activeTab === 'Xem trước' && (
              <div className="flex-grow flex flex-col overflow-hidden bg-slate-50/20">
                {/* Header Controls */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 px-6 py-4 border-b border-slate-100 bg-white shrink-0">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-indigo-50 rounded-xl flex items-center justify-center text-indigo-600 shadow-sm border border-indigo-100 shrink-0">
                      <Shield className="w-5 h-5" />
                    </div>
                    <div>
                      <h3 className="text-sm font-bold text-slate-800 uppercase tracking-wider">Xem trước phân quyền</h3>
                      <p className="text-[11px] text-slate-400 font-medium mt-0.5">Giả lập hiển thị và chức năng hệ thống theo đối tượng được chọn</p>
                    </div>
                  </div>
                  
                  {/* Selectors */}
                  <div className="flex items-center gap-3 flex-wrap">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-bold text-slate-500 whitespace-nowrap">Chọn Vai trò:</span>
                      <div className="w-[180px]">
                        <Select
                          value={selectedPreviewRole}
                          onValueChange={(val) => {
                            setSelectedPreviewRole(val === 'none' ? '' : val);
                            setSelectedPreviewUser('');
                          }}
                        >
                          <SelectTrigger className="h-9 text-xs font-bold text-slate-700 border-slate-200 rounded-lg bg-white">
                            <SelectValue placeholder="Chọn vai trò..." />
                          </SelectTrigger>
                          <SelectContent className="z-[60] bg-white border border-slate-200 shadow-lg rounded-lg">
                            <SelectItem value="none" className="text-xs font-bold text-slate-500 italic">Mặc định (Admin)</SelectItem>
                            {roles.map((r) => (
                              <SelectItem key={r._id || r.id} value={r._id || r.id} className="text-xs font-bold text-slate-700 hover:bg-slate-50 cursor-pointer">
                                {r.name}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    </div>

                    <span className="text-xs font-bold text-slate-300">HOẶC</span>

                    <div className="flex items-center gap-2">
                      <span className="text-xs font-bold text-slate-500 whitespace-nowrap">Chọn Người dùng:</span>
                      <div className="w-[180px]">
                        <Select
                          value={selectedPreviewUser}
                          onValueChange={(val) => {
                            setSelectedPreviewUser(val === 'none' ? '' : val);
                            setSelectedPreviewRole('');
                          }}
                        >
                          <SelectTrigger className="h-9 text-xs font-bold text-slate-700 border-slate-200 rounded-lg bg-white">
                            <SelectValue placeholder="Chọn người dùng..." />
                          </SelectTrigger>
                          <SelectContent className="z-[60] bg-white border border-slate-200 shadow-lg rounded-lg">
                            <SelectItem value="none" className="text-xs font-bold text-slate-500 italic">Mặc định (Admin)</SelectItem>
                            {users.map((u) => {
                              const displayName = getUserDisplayName(u);
                              const subLabel = u.student_profile ? ` (${u.student_profile.student_code})` : '';
                              return (
                                <SelectItem key={u._id || u.id} value={u._id || u.id} className="text-xs font-bold text-slate-700 hover:bg-slate-50 cursor-pointer">
                                  {displayName}{subLabel} ({u.role?.name || 'User'})
                                </SelectItem>
                              );
                            })}
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Simulation Area */}
                {(() => {
                  const subject = resolvePreviewSubject({
                    users,
                    roles,
                    selectedPreviewUser,
                    selectedPreviewRole
                  });
                  const previewPermissions = getPreviewPermissions(subject);
                  const access = buildSystemPreviewAccess(previewPermissions, subject.role);

                  const {
                    isPreviewAdmin,
                    showStudents,
                    showGrading,
                    showSystem,
                    showPermissions,
                    showReports,
                    previewCanReadLogs,
                    previewCanReadRequests,
                    previewCanManageRequests,
                    previewCanReadBackups,
                    previewCanCreateBackup,
                    previewCanDownloadBackup,
                    previewCanDeleteBackup
                  } = access;

                  const previewRoleCode = subject.role?.role_code || '';
                  const previewRoleObj = subject.role;
                  const previewUserObj = subject.user;

                  // Mask helpers
                  const maskIp = (ip: string) => {
                    if (!ip) return 'N/A';
                    const parts = ip.split('.');
                    if (parts.length === 4) {
                      return `${parts[0]}.${parts[1]}.*.*`;
                    }
                    return ip.replace(/:[0-9a-fA-F]{1,4}$/, ':****');
                  };

                  const maskEmailOrUsername = (username: string) => {
                    if (!username) return 'N/A';
                    if (username.includes('@')) {
                      const [name, domain] = username.split('@');
                      if (name.length <= 2) return `**@${domain}`;
                      return `${name.substring(0, 2)}***@${domain}`;
                    }
                    if (username.length <= 2) return '**';
                    return `${username.substring(0, 2)}***`;
                  };

                  const previewPagesList = ['/permissions', '/students', '/grading', '/reports'];

                  // Check if current active page is locked
                  let isPageLocked = false;
                  if (selectedPreviewPage === '/students' && !showStudents) isPageLocked = true;
                  if (selectedPreviewPage === '/grading' && !showGrading) isPageLocked = true;
                  if (selectedPreviewPage === '/system' && !showSystem) isPageLocked = true;
                  if (selectedPreviewPage === '/permissions' && !showPermissions) isPageLocked = true;
                  if (selectedPreviewPage === '/reports' && !showReports) isPageLocked = true;

                  const hasPreviewPermission = (code: string) => isPreviewAdmin || previewPermissions.includes(code);

                  return (
                    <div className="flex-grow flex flex-col min-h-0">
                      {/* Vùng 1: Hiển thị Effective Permissions */}
                      <div className="px-6 py-3 bg-slate-50 border-b border-slate-150 flex flex-wrap items-center gap-2 shrink-0 select-none">
                        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Quyền hiệu lực ({previewPermissions.length}):</span>
                        <div className="flex flex-wrap gap-1.5 max-h-[50px] overflow-y-auto pr-2 flex-grow">
                          {previewPermissions.length === 0 ? (
                            <span className="text-xs text-slate-400 italic">Không có quyền nào</span>
                          ) : (
                            previewPermissions.map(code => (
                              <span key={code} className="px-2 py-0.5 bg-blue-50 text-blue-600 border border-blue-100 rounded text-[10px] font-bold font-mono">
                                {code}
                              </span>
                            ))
                          )}
                        </div>
                      </div>

                      {/* Ghi chú Token hiện tại */}
                      <div className="px-6 py-2 bg-indigo-50/50 border-b border-slate-150 text-[11px] text-indigo-800 font-semibold flex items-center gap-2 select-none shrink-0">
                        <span>ℹ️</span>
                        <span>Đang mô phỏng quyền theo đối tượng được chọn. Dữ liệu API thật được kiểm chứng bằng phiên đăng nhập hiện tại.</span>
                      </div>

                      <div className="flex-1 flex overflow-hidden p-6 gap-6 min-h-0">
                        {/* Vùng 2: Sidebar Mockup */}
                        <div className="w-[240px] bg-white border border-slate-200 rounded-2xl flex flex-col p-4 shrink-0 shadow-sm relative overflow-hidden select-none">
                          <div className="absolute top-0 right-0 bg-indigo-550 text-[8px] font-black text-white px-2 py-0.5 rounded-bl-lg tracking-widest uppercase">Khung mô phỏng</div>
                          
                          <div className="flex items-center gap-2 px-2 pb-4 border-b border-slate-100 mb-4">
                            <div className="w-7 h-7 flex items-center justify-center rounded-lg overflow-hidden bg-slate-50 border border-slate-100 shrink-0">
                              <Image
                                src={logoNsg}
                                alt="NSG Logo"
                                width={28}
                                height={28}
                                className="object-contain"
                              />
                            </div>
                            <span className="text-xs font-black glassmorphic-text tracking-wide whitespace-nowrap">HOCSINHSINHVIEN</span>
                          </div>

                          <div className="flex flex-col gap-1.5 flex-grow overflow-y-auto">
                            <div className="flex items-center justify-between px-2 mb-1.5">
                              <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wider">Menu Hệ thống</span>
                              <button 
                                onClick={handleResetSidebarOrder}
                                className="text-[9px] font-bold text-blue-500 hover:text-blue-700 transition-colors"
                                title="Khôi phục thứ tự mặc định"
                              >
                                Reset
                              </button>
                            </div>
                            
                            {sidebarOrder.map((route, index) => {
                              const isSelected = selectedPreviewPage === route;
                              let icon = <LayoutDashboard size={15} />;
                              let label = 'Trang chủ';
                              let isOpen = true;

                              switch (route) {
                                case '/dashboard':
                                  icon = <LayoutDashboard size={15} />;
                                  label = 'Trang chủ';
                                  isOpen = true;
                                  break;
                                case '/students':
                                  icon = <Users size={15} />;
                                  label = 'Học sinh sinh viên';
                                  isOpen = showStudents;
                                  break;
                                case '/grading':
                                  icon = <GraduationCap size={15} />;
                                  label = 'Rèn luyện';
                                  isOpen = showGrading;
                                  break;
                                case '/system':
                                  icon = <Settings size={15} />;
                                  label = 'Quản trị hệ thống';
                                  isOpen = showSystem;
                                  break;
                                case '/permissions':
                                  icon = <Shield size={15} />;
                                  label = 'Phân quyền (RBAC)';
                                  isOpen = showPermissions;
                                  break;
                                case '/reports':
                                  icon = <Globe size={15} />;
                                  label = 'Báo cáo thống kê';
                                  isOpen = showReports;
                                  break;
                              }

                              const activeClasses = isSelected
                                ? 'bg-blue-50 text-blue-600 border-blue-200'
                                : isOpen
                                  ? 'bg-white text-slate-700 border-slate-100 hover:bg-slate-50'
                                  : 'bg-slate-50/50 text-slate-400 border-slate-150/40 opacity-50';

                              return (
                                <div 
                                  key={route}
                                  draggable={true}
                                  onDragStart={(e) => handleDragStart(e, index)}
                                  onDragOver={handleDragOver}
                                  onDrop={(e) => handleDrop(e, index)}
                                  onClick={() => setSelectedPreviewPage(route)}
                                  className={`flex items-center justify-between px-3 py-2 rounded-xl text-xs font-semibold border transition-all cursor-grab active:cursor-grabbing ${activeClasses}`}
                                >
                                  <div className="flex items-center gap-2.5">
                                    {icon}
                                    <span>{label}</span>
                                  </div>
                                  {isOpen ? (
                                    <span className="text-[9px] font-bold bg-emerald-500 text-white px-1.5 py-0.5 rounded">Mở</span>
                                  ) : (
                                    <span className="text-[9px] font-bold bg-slate-400 text-white px-1.5 py-0.5 rounded">🔒 Ẩn</span>
                                  )}
                                </div>
                              );
                            })}
                          </div>

                          {/* Profile Info mockup */}
                          <div className="p-3 bg-slate-50 border border-slate-100 rounded-xl flex items-center gap-2.5 mt-auto">
                            <div className="w-8 h-8 rounded-full bg-blue-50 border border-blue-100 flex items-center justify-center text-xs font-black text-blue-600 shrink-0">
                              {(previewUserObj ? getUserDisplayName(previewUserObj) : (previewRoleObj?.name || 'A')).substring(0, 2).toUpperCase()}
                            </div>
                            <div className="flex flex-col min-w-0">
                              <span className="text-[11px] font-black text-slate-800 truncate leading-none">
                                {previewUserObj ? getUserDisplayName(previewUserObj) : (previewRoleObj?.name || 'Chưa chọn')}
                              </span>
                              {previewUserObj?.student_profile && (
                                <span className="text-[9px] font-bold text-indigo-600 truncate mt-1 leading-none">
                                  Mã SV: {previewUserObj.student_profile.student_code}
                                </span>
                              )}
                              <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wider mt-1.5 leading-none">
                                {previewRoleCode || 'GUEST'}
                              </span>
                            </div>
                          </div>
                        </div>

                        {/* Vùng 3: Kết quả preview bên phải */}
                        <div className="flex-1 bg-white border border-slate-200 rounded-2xl flex flex-col overflow-hidden shadow-sm relative min-w-0">
                          {/* Live data badge dynamic wording */}
                          <div className="absolute top-0 right-0 bg-emerald-500 text-[8px] font-black text-white px-2 py-0.5 rounded-bl-lg tracking-widest uppercase">
                            {selectedPreviewPage === '/system' && ['logs', 'requests', 'backup'].includes(previewActiveTab) && 
                              ((previewActiveTab === 'logs' && previewCanReadLogs && !previewLogsError) ||
                               (previewActiveTab === 'requests' && previewCanReadRequests && !previewRequestsError) ||
                               (previewActiveTab === 'backup' && previewCanReadBackups && !previewBackupsError))
                                ? 'Dữ liệu thật' : 'Khung mô phỏng'}
                          </div>

                          {isPageLocked ? (
                            <div className="h-full flex flex-col items-center justify-center text-slate-400 gap-3 p-10 bg-slate-50/10">
                              <Lock className="w-12 h-12 text-rose-400 animate-pulse" />
                              <h4 className="text-sm font-black text-rose-500 uppercase tracking-wider">Trang bị khóa truy cập (Fail-Closed)</h4>
                              <p className="text-xs text-slate-500 max-w-sm text-center font-semibold leading-relaxed">
                                Đối tượng được preview không có quyền vào trang <code className="bg-slate-100 px-1.5 py-0.5 rounded font-mono font-bold text-slate-700 text-[10px]">{selectedPreviewPage}</code>.
                                Hệ thống sẽ tự động chặn và báo lỗi 403.
                              </p>
                            </div>
                          ) : (
                            <div className="h-full flex flex-col min-h-0">
                              {/* --- PREVIEW PAGE: DASHBOARD --- */}
                              {selectedPreviewPage === '/dashboard' && (
                                <div className="p-6 space-y-6 overflow-y-auto">
                                  <div className="flex items-center gap-2">
                                    <LayoutDashboard className="w-5 h-5 text-blue-600" />
                                    <h4 className="text-xs font-bold text-slate-800">Trang chủ HOCSINHSINHVIEN</h4>
                                  </div>

                                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                    <div className="p-4 border border-slate-100 rounded-xl bg-slate-50/40">
                                      <span className="text-[10px] font-bold text-slate-400 uppercase">Tổng số học sinh</span>
                                      <p className="text-xl font-bold text-slate-800 mt-1">1,250 <span className="text-[9px] font-medium text-slate-450 italic">(Mô phỏng)</span></p>
                                    </div>
                                    <div className="p-4 border border-slate-100 rounded-xl bg-slate-50/40">
                                      <span className="text-[10px] font-bold text-slate-400 uppercase">Vai trò hoạt động</span>
                                      <p className="text-xl font-bold text-slate-800 mt-1">{roles.length} <span className="text-[9px] font-medium text-slate-450 italic">(Thực tế)</span></p>
                                    </div>
                                    <div className="p-4 border border-slate-100 rounded-xl bg-slate-50/40">
                                      <span className="text-[10px] font-bold text-slate-400 uppercase">Yêu cầu hệ thống</span>
                                      <p className="text-xl font-bold text-slate-800 mt-1">2 <span className="text-[9px] font-medium text-slate-450 italic">(Mô phỏng)</span></p>
                                    </div>
                                  </div>

                                  <div className="border border-slate-150 rounded-xl p-4 space-y-3">
                                    <h5 className="text-[11px] font-bold text-slate-700">Thông báo mới nhất</h5>
                                    <div className="text-[11px] text-slate-500 font-medium space-y-2">
                                      <p className="p-2 bg-slate-50 rounded">📢 Hệ thống HOCSINHSINHVIEN nâng cấp tính năng Xem trước phân quyền thành công.</p>
                                      <p className="p-2 bg-slate-50 rounded">📢 Lịch sao lưu cơ sở dữ liệu định kỳ tự động chạy vào 0h hàng ngày.</p>
                                    </div>
                                  </div>
                                </div>
                              )}

                              {/* --- PREVIEW PAGE: SYSTEM --- */}
                              {selectedPreviewPage === '/system' && (
                                <div className="flex flex-col h-full min-h-0">
                                  {/* Top bar of Page */}
                                  <div className="px-6 py-4 border-b border-slate-100 bg-slate-50/30 flex items-center justify-between shrink-0 gap-4">
                                    <div className="flex items-center gap-2.5">
                                      <div className="w-8 h-8 bg-blue-50 text-blue-600 rounded-lg flex items-center justify-center border border-blue-100">
                                        <Settings size={15} />
                                      </div>
                                      <div>
                                        <h4 className="text-xs font-bold text-slate-800 leading-none">Quản trị Hệ thống</h4>
                                        <p className="text-[9px] text-slate-400 font-semibold mt-1 font-sans">Mô phỏng giao diện /system theo vai trò</p>
                                      </div>
                                    </div>

                                    {/* Sub-tab Selectors */}
                                    <div className="flex bg-slate-100 p-0.5 rounded-lg text-[10px] font-bold text-slate-600 select-none">
                                      <button
                                        onClick={() => setPreviewActiveTab('logs')}
                                        className={`px-2.5 py-1 rounded-md transition-all flex items-center gap-1 ${
                                          previewActiveTab === 'logs' ? 'bg-white text-slate-800 shadow-xs' : 'hover:text-slate-800'
                                        }`}
                                      >
                                        Nhật ký
                                        {!previewCanReadLogs && <span>🔒</span>}
                                      </button>
                                      <button
                                        onClick={() => setPreviewActiveTab('requests')}
                                        className={`px-2.5 py-1 rounded-md transition-all flex items-center gap-1 ${
                                          previewActiveTab === 'requests' ? 'bg-white text-slate-800 shadow-xs' : 'hover:text-slate-800'
                                        }`}
                                      >
                                        Yêu cầu
                                        {!previewCanReadRequests && <span>🔒</span>}
                                      </button>
                                      <button
                                        onClick={() => setPreviewActiveTab('backup')}
                                        className={`px-2.5 py-1 rounded-md transition-all flex items-center gap-1 ${
                                          previewActiveTab === 'backup' ? 'bg-white text-slate-800 shadow-xs' : 'hover:text-slate-800'
                                        }`}
                                      >
                                        Sao lưu
                                        {!previewCanReadBackups && <span>🔒</span>}
                                      </button>
                                    </div>
                                  </div>

                                  {/* Page body */}
                                  <div className="flex-1 overflow-y-auto p-6 min-h-0 bg-slate-50/10">
                                    {/* TAB PREVIEW: LOGS */}
                                    {previewActiveTab === 'logs' && (
                                      <div className="flex-grow flex flex-col space-y-4">
                                        {!previewCanReadLogs ? (
                                          <div className="flex-grow flex flex-col items-center justify-center text-slate-400 gap-3 py-12 border border-dashed border-slate-200 rounded-xl bg-slate-50/50">
                                            <Lock className="w-10 h-10 text-slate-300" />
                                            <h5 className="text-xs font-bold text-slate-600">TAB KHÔNG THỂ TRUY CẬP</h5>
                                            <p className="text-[11px] text-slate-400 max-w-xs text-center font-medium leading-relaxed">
                                              Tab Nhật ký đăng nhập bị chặn do thiếu quyền <code className="bg-slate-100 text-slate-600 px-1 rounded font-mono">LOGIN_LOG_READ</code>.
                                            </p>
                                          </div>
                                        ) : (
                                          <div className="space-y-4">
                                            <div className="flex items-center justify-between bg-emerald-50 text-emerald-800 border border-emerald-100/60 p-3 rounded-xl">
                                              <div className="flex items-center gap-2">
                                                <Check className="w-4 h-4 text-emerald-600" />
                                                <span className="text-xs font-bold">Quyền hạn hợp lệ: LOGIN_LOG_READ</span>
                                              </div>
                                              <span className="text-[10px] bg-emerald-500 text-white px-2 py-0.5 rounded font-black tracking-wider">CHO PHÉP XEM</span>
                                            </div>

                                            {previewLogsError ? (
                                              <div className="p-3 bg-red-50 text-red-700 border border-red-200 rounded-xl text-xs font-semibold flex items-center gap-2">
                                                <span className="text-base">⚠️</span>
                                                <div>
                                                  <p className="font-bold">Lệch cấu hình guard: Preview cho phép nhưng backend từ chối (403)</p>
                                                  <p className="text-[10px] text-red-500 font-medium">Phiên đăng nhập thực tế của bạn không có quyền truy cập API Nhật ký hoặc cấu hình backend khác với frontend.</p>
                                                </div>
                                              </div>
                                            ) : isPreviewLogsLoading ? (
                                              <div className="space-y-2 p-2 bg-white rounded-xl border border-slate-150">
                                                <Skeleton className="h-6 w-full" />
                                                <Skeleton className="h-6 w-full" />
                                              </div>
                                            ) : previewLogs.length === 0 ? (
                                              <div className="p-4 text-center text-slate-400 bg-white border border-slate-150 rounded-xl font-medium">
                                                Chưa có dữ liệu đăng nhập
                                              </div>
                                            ) : (
                                              <div className="border border-slate-150 rounded-xl overflow-hidden text-[11px] bg-white shadow-xs">
                                                <div className="bg-slate-50 px-3 py-2 font-bold text-slate-500 grid grid-cols-3 border-b border-slate-150">
                                                  <span>Thời gian</span>
                                                  <span>Tài khoản</span>
                                                  <span>Địa chỉ IP</span>
                                                </div>
                                                <div className="divide-y divide-slate-100">
                                                  {previewLogs.map((log) => (
                                                    <div key={log._id} className="px-3 py-2 grid grid-cols-3 text-slate-600 font-medium items-center">
                                                      <span>{new Date(log.login_time || log.createdAt).toLocaleTimeString()}</span>
                                                      <span className="font-bold text-slate-800">{maskEmailOrUsername(log.user_id?.user_name || 'Hệ thống')}</span>
                                                      <span className="font-mono">{maskIp(log.ip_address)}</span>
                                                    </div>
                                                  ))}
                                                </div>
                                              </div>
                                            )}
                                          </div>
                                        )}
                                      </div>
                                    )}

                                    {/* TAB PREVIEW: REQUESTS */}
                                    {previewActiveTab === 'requests' && (
                                      <div className="flex-grow flex flex-col space-y-4">
                                        {!previewCanReadRequests ? (
                                          <div className="flex-grow flex flex-col items-center justify-center text-slate-400 gap-3 py-12 border border-dashed border-slate-200 rounded-xl bg-slate-50/50">
                                            <Lock className="w-10 h-10 text-slate-300" />
                                            <h5 className="text-xs font-bold text-slate-600">TAB KHÔNG THỂ TRUY CẬP</h5>
                                            <p className="text-[11px] text-slate-400 max-w-xs text-center font-medium leading-relaxed">
                                              Không thể xem các yêu cầu do thiếu quyền <code className="bg-slate-100 text-slate-600 px-1 rounded font-mono">SYSTEM_REQUEST_READ</code>.
                                            </p>
                                          </div>
                                        ) : (
                                          <div className="space-y-4">
                                            <div className="flex items-center justify-between bg-emerald-50 text-emerald-800 border border-emerald-100/60 p-3 rounded-xl">
                                              <div className="flex items-center gap-2">
                                                <Check className="w-4 h-4 text-emerald-600" />
                                                <span className="text-xs font-bold">Quyền hạn hợp lệ: SYSTEM_REQUEST_READ</span>
                                              </div>
                                              <span className="text-[10px] bg-emerald-500 text-white px-2 py-0.5 rounded font-black tracking-wider">CHO PHÉP XEM</span>
                                            </div>

                                            {previewRequestsError ? (
                                              <div className="p-3 bg-red-50 text-red-700 border border-red-200 rounded-xl text-xs font-semibold flex items-center gap-2">
                                                <span className="text-base">⚠️</span>
                                                <div>
                                                  <p className="font-bold">Lệch cấu hình guard: Preview cho phép nhưng backend từ chối (403)</p>
                                                  <p className="text-[10px] text-red-500 font-medium">Phiên đăng nhập thực tế của bạn không có quyền truy cập API Yêu cầu hoặc cấu hình backend khác với frontend.</p>
                                                </div>
                                              </div>
                                            ) : isPreviewRequestsLoading ? (
                                              <div className="space-y-2 p-2 bg-white rounded-xl border border-slate-150">
                                                <Skeleton className="h-10 w-full" />
                                                <Skeleton className="h-10 w-full" />
                                              </div>
                                            ) : previewRequests.length === 0 ? (
                                              <div className="p-4 text-center text-slate-400 bg-white border border-slate-150 rounded-xl font-medium">
                                                Chưa có yêu cầu hệ thống nào
                                              </div>
                                            ) : (
                                              <div className="border border-slate-150 rounded-xl overflow-hidden text-[11px] bg-white shadow-xs">
                                                <div className="bg-slate-50 px-3 py-2.5 font-bold text-slate-500 grid grid-cols-4 border-b border-slate-150">
                                                  <span className="col-span-2">Yêu cầu</span>
                                                  <span>Độ ưu tiên</span>
                                                  <span className="text-right">Hành động</span>
                                                </div>
                                                <div className="divide-y divide-slate-100">
                                                  {previewRequests.map((req) => (
                                                    <div key={req._id} className="px-3 py-3 grid grid-cols-4 text-slate-600 font-medium items-center">
                                                      <div className="col-span-2 flex flex-col pr-4">
                                                        <span className="font-bold text-slate-800">{req.title}</span>
                                                        {req.description && <span className="text-[9px] text-slate-400 mt-1">{req.description}</span>}
                                                      </div>
                                                      <div>
                                                        <span className={`px-2 py-0.5 rounded border font-bold text-[9px] uppercase ${
                                                          req.priority === 'critical' ? 'bg-red-50 text-red-600 border-red-100' :
                                                          req.priority === 'high' ? 'bg-orange-50 text-orange-600 border-orange-100' :
                                                          req.priority === 'medium' ? 'bg-blue-50 text-blue-600 border-blue-100' :
                                                          'bg-slate-50 text-slate-600 border-slate-100'
                                                        }`}>
                                                          {req.priority}
                                                        </span>
                                                      </div>
                                                      <div className="flex items-center justify-end gap-2 shrink-0">
                                                        {previewCanManageRequests ? (
                                                          <>
                                                            <button disabled className="px-2 py-1 bg-blue-600/50 text-white rounded text-[10px] font-bold cursor-not-allowed" title="Nút chỉ mang tính chất minh họa">Duyệt (Mô phỏng)</button>
                                                            <button disabled className="px-2 py-1 bg-rose-50 text-rose-400 border border-rose-100 rounded text-[10px] font-bold cursor-not-allowed" title="Nút chỉ mang tính chất minh họa">Xóa (Mô phỏng)</button>
                                                          </>
                                                        ) : (
                                                          <div className="flex items-center gap-1.5 px-2.5 py-1 text-[10px] font-black rounded bg-slate-100 text-slate-450 border border-slate-200" title="Yêu cầu SYSTEM_REQUEST_MANAGE">
                                                            <Lock size={10} />
                                                            <span>Khóa (Cần SYSTEM_REQUEST_MANAGE)</span>
                                                          </div>
                                                        )}
                                                      </div>
                                                    </div>
                                                  ))}
                                                </div>
                                              </div>
                                            )}
                                          </div>
                                        )}
                                      </div>
                                    )}

                                    {/* TAB PREVIEW: BACKUP */}
                                    {previewActiveTab === 'backup' && (
                                      <div className="flex-grow flex flex-col space-y-4">
                                        {!previewCanReadBackups ? (
                                          <div className="flex-grow flex flex-col items-center justify-center text-slate-400 gap-3 py-12 border border-dashed border-slate-200 rounded-xl bg-slate-50/50">
                                            <Lock className="w-10 h-10 text-slate-300" />
                                            <h5 className="text-xs font-bold text-slate-600">TAB KHÔNG THỂ TRUY CẬP</h5>
                                            <p className="text-[11px] text-slate-400 max-w-xs text-center font-medium leading-relaxed">
                                              Bạn không có quyền DATABASE_BACKUP_READ để xem các bản sao lưu.
                                            </p>
                                          </div>
                                        ) : (
                                          <div className="space-y-4">
                                            <div className="flex items-center justify-between bg-emerald-50 text-emerald-800 border border-emerald-100/60 p-3 rounded-xl">
                                              <div className="flex items-center gap-2">
                                                <Check className="w-4 h-4 text-emerald-600" />
                                                <span className="text-xs font-bold">Quyền hạn hợp lệ: DATABASE_BACKUP_READ</span>
                                              </div>
                                              <span className="text-[10px] bg-emerald-500 text-white px-2 py-0.5 rounded font-black tracking-wider">CHO PHÉP XEM</span>
                                            </div>

                                            {/* Backup action panel mockup */}
                                            <div className="flex items-center justify-between p-3.5 bg-slate-50 border border-slate-150 rounded-xl">
                                              <div className="flex flex-col">
                                                <span className="text-xs font-bold text-slate-800">Sao lưu dữ liệu tức thời</span>
                                                <span className="text-[9px] text-slate-400 mt-1 font-semibold">Khởi chạy sao lưu cơ sở dữ liệu</span>
                                              </div>
                                              {previewCanCreateBackup ? (
                                                <button disabled className="px-3 py-1.5 bg-blue-600/50 text-white rounded-lg text-[10px] font-bold cursor-not-allowed shadow-xs">
                                                  Khởi chạy sao lưu (Mô phỏng)
                                                </button>
                                              ) : (
                                                <div className="flex items-center gap-1 text-slate-400 bg-white border border-slate-200 px-3 py-1.5 rounded-lg text-[10px] font-bold">
                                                  <Lock size={10} />
                                                  <span>Khóa (Cần CREATE)</span>
                                                </div>
                                              )}
                                            </div>

                                            {previewBackupsError ? (
                                              <div className="p-3 bg-red-50 text-red-700 border border-red-200 rounded-xl text-xs font-semibold flex items-center gap-2">
                                                <span className="text-base">⚠️</span>
                                                <div>
                                                  <p className="font-bold">Lệch cấu hình guard: Preview cho phép nhưng backend từ chối (403)</p>
                                                  <p className="text-[10px] text-red-500 font-medium">Phiên đăng nhập thực tế của bạn không có quyền truy cập API Sao lưu hoặc cấu hình backend khác với frontend.</p>
                                                </div>
                                              </div>
                                            ) : isPreviewBackupsLoading ? (
                                              <div className="space-y-2 p-2 bg-white rounded-xl border border-slate-150">
                                                <Skeleton className="h-10 w-full" />
                                                <Skeleton className="h-10 w-full" />
                                              </div>
                                            ) : previewBackups.length === 0 ? (
                                              <div className="p-4 text-center text-slate-400 bg-white border border-slate-150 rounded-xl font-medium">
                                                Chưa có bản sao lưu nào
                                              </div>
                                            ) : (
                                              <div className="border border-slate-150 rounded-xl overflow-hidden text-[11px] bg-white shadow-xs">
                                                <div className="bg-slate-50 px-3 py-2.5 font-bold text-slate-500 grid grid-cols-4 border-b border-slate-150">
                                                  <span className="col-span-2">Tên file</span>
                                                  <span>Dung lượng</span>
                                                  <span className="text-right">Hành động</span>
                                                </div>
                                                <div className="divide-y divide-slate-100">
                                                  {previewBackups.map((backup) => (
                                                    <div key={backup._id} className="px-3 py-3 grid grid-cols-4 text-slate-600 font-medium items-center">
                                                      <div className="col-span-2 flex flex-col pr-4">
                                                        <span className="font-bold text-slate-800">{backup.file_name || 'Đang tiến hành...'}</span>
                                                        <span className="text-[9px] text-slate-400 mt-1 font-semibold">Trạng thái: {backup.status}</span>
                                                      </div>
                                                      <div>
                                                        <span>{backup.file_size ? `${(backup.file_size / (1024 * 1024)).toFixed(2)} MB` : 'N/A'}</span>
                                                      </div>
                                                      <div className="flex items-center justify-end gap-3 shrink-0 select-none">
                                                        {/* Download Action */}
                                                        {previewCanDownloadBackup ? (
                                                          <span className="text-blue-400 font-black cursor-not-allowed flex items-center gap-0.5" title="Mô phỏng hành động (Quyền nhạy cảm: Download)">
                                                            Tải (Mô phỏng)
                                                            <span className="text-[9px] bg-rose-500/10 text-rose-600 px-1 rounded shrink-0">⚠️</span>
                                                          </span>
                                                        ) : (
                                                          <div className="flex items-center gap-0.5 text-slate-400" title="Cần DATABASE_BACKUP_DOWNLOAD">
                                                            <Lock size={10} />
                                                            <span>Tải</span>
                                                          </div>
                                                        )}
                                                        
                                                        {/* Delete Action */}
                                                        {previewCanDeleteBackup ? (
                                                          <span className="text-rose-455 font-black cursor-not-allowed flex items-center gap-0.5" title="Mô phỏng hành động (Quyền nhạy cảm: Delete)">
                                                            Xóa (Mô phỏng)
                                                            <span className="text-[9px] bg-rose-500/10 text-rose-600 px-1 rounded shrink-0">⚠️</span>
                                                          </span>
                                                        ) : (
                                                          <div className="flex items-center gap-0.5 text-slate-400" title="Cần DATABASE_BACKUP_DELETE">
                                                            <Lock size={10} />
                                                            <span>Xóa</span>
                                                          </div>
                                                        )}
                                                      </div>
                                                    </div>
                                                  ))}
                                                </div>
                                              </div>
                                            )}
                                        </div>
                                      )}
                                    </div>
                                  )}
                                </div>
                              </div>
                            )}

                                    {/* --- PREVIEW PAGES: PERMISSIONS, STUDENTS, GRADING, REPORTS (Rendered dynamically) --- */}
                                  {previewPagesList.includes(selectedPreviewPage) && renderDynamicPagePreview(selectedPreviewPage, pagePermissionScopes, routePermissions, allPermissions, previewPermissions, isPreviewAdmin)}
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })()}
              </div>
            )}

            {/* Other tabs dummy content */}
            {activeTab !== 'Người dùng' && activeTab !== 'Quyền hạn' && activeTab !== 'Vai trò' && activeTab !== 'Xem trước' && activeTab !== 'Cấu hình' && activeTab !== 'Sơ đồ luồng' && (
              <div className="flex-1 flex items-center justify-center text-slate-400 font-medium">
                Nội dung tab {activeTab} đang được phát triển...
              </div>
            )}
          </div>
        </main>

      {/* Insert Modal Component here */}
      <ConfirmModal
        isOpen={isDeleteModalOpen}
        onClose={() => setIsDeleteModalOpen(false)}
        title={deleteConfig?.title}
        message={deleteConfig?.message}
        variant="danger"
        onConfirm={async () => {
          if (deleteConfig?.onConfirm) {
            try {
              await deleteConfig.onConfirm();
            } catch (error: any) {
              toast.error('Lỗi: ' + error.message);
            }
          }
          setIsDeleteModalOpen(false);
        }}
      />

      <ConfirmModal
        isOpen={isTerminateModalOpen}
        onClose={() => {
          setIsTerminateModalOpen(false);
          setTerminatingUser(null);
        }}
        title="Kết thúc truy cập?"
        message={`Bạn có chắc chắn muốn kết thúc phiên truy cập của ${getUserDisplayName(terminatingUser)} không? Quyền truy cập sẽ bị thu hồi ngay.`}
        confirmLabel="Kết thúc truy cập"
        variant="danger"
        onConfirm={handleTerminateImpersonation}
      />

      <UserModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        isEditing={isEditingUser}
        initialData={editingUser}
        roles={roles}
        classes={classes}
        onSave={handleUserSave}
        onBulkSave={handleBulkUserSave}
      />

      <GroupModal
        isOpen={isGroupModalOpen}
        onClose={() => setIsGroupModalOpen(false)}
        isEditing={!!editingGroup}
        initialData={editingGroup}
        onSave={handleGroupSave}
      />

      <PermissionModal
        isOpen={isPermissionModalOpen}
        onClose={() => setIsPermissionModalOpen(false)}
        isEditing={!!editingPermission}
        initialData={editingPermission}
        defaultGroupId={selectedGroup}
        groups={groups}
        onSave={handlePermissionSave}
      />

      <RoleModal
        isOpen={isRoleModalOpen}
        onClose={() => setIsRoleModalOpen(false)}
        isEditing={!!editingRole}
        initialData={editingRole}
        allPermissions={allPermissions}
        groups={groups}
        onSave={handleRoleModalSave}
      />

      <RoutePermissionModal
        isOpen={isRoutePermModalOpen}
        onClose={() => setIsRoutePermModalOpen(false)}
        onSave={async (data) => {
          const token = tokenStorage.getAccessToken();
          if (!token) { toast.error('Hết phiên làm việc'); return; }
          if (editingRoutePerm) {
            await authApi.updateRoutePermission(editingRoutePerm._id, data, token);
            toast.success('Cập nhật cấu hình thành công');
          } else {
            await authApi.createRoutePermission(data, token);
            toast.success('Tạo cấu hình thành công');
          }
          invalidateRoutePermissionCache();
          if (typeof window !== 'undefined') {
            window.dispatchEvent(new CustomEvent('route-permissions-updated'));
          }
          fetchData();
        }}
        initialData={editingRoutePerm}
        allPermissions={allPermissions}
      />
    </>
  );
}

export default function PermissionsPage() {
  return (
    <RouteGuard
      requiredPermission="admin"
      useDynamicMapping={true}
      failClosed={true}
    >
      <PermissionsPageContent />
    </RouteGuard>
  );
}
