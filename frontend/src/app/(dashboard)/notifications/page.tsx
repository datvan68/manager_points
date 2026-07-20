'use client';

import React, { useState, useEffect, Suspense } from 'react';
import { useRouter } from 'next/navigation';
import { RouteGuard } from '@/components/guards/RouteGuard';
import { notificationApi, NotificationItem } from '@/api/notification-api';
import { useAuth } from '@/providers/auth-provider';
import { normalizeNotifications } from './_lib/normalize-notifications';
import { 
  AlertTriangle, Sparkles, ClipboardList, Info, 
  Trash2, ExternalLink, CheckSquare, ChevronLeft, ChevronRight, BellOff, Filter,
  PencilLine, Plus, Users
} from 'lucide-react';
import { toast } from 'sonner';
import NotificationModal from '@/components/modals/NotificationModal';
import NotificationReadersModal from '@/components/modals/NotificationReadersModal';
import ConfirmModal from '@/components/modals/ConfirmModal';
import { formatDistanceToNow } from 'date-fns';
import { vi } from 'date-fns/locale';
import { isAuthError } from '@/api/http-client';
import { HeaderCustomMappings } from '@/providers/header-provider';
import NotificationDestination from '@/components/notifications/NotificationDestination';
import NotificationDetailModal from '@/components/modals/NotificationDetailModal';

function NotificationsPageContent() {
  const router = useRouter();
  const { user } = useAuth();
  const isPrivileged = user?.role === 'Admin' || user?.role === 'Supervisor';

  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [counts, setCounts] = useState({
    all: 0,
    unread: 0,
    warning: 0,
    success: 0,
    info: 0,
    system: 0,
    views: 0,
  });
  const [activeFilter, setActiveFilter] = useState<'all' | 'unread' | 'warning' | 'success' | 'info' | 'system' | 'views'>('all');
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 8;
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [isLoading, setIsLoading] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingNotification, setEditingNotification] = useState<NotificationItem | null>(null);

  const [isReadersModalOpen, setIsReadersModalOpen] = useState(false);
  const [readersNotificationId, setReadersNotificationId] = useState<string | null>(null);
  const [readersNotificationTitle, setReadersNotificationTitle] = useState<string>('');

  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [notificationToDelete, setNotificationToDelete] = useState<string | null>(null);

  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [isBulkDeleteModalOpen, setIsBulkDeleteModalOpen] = useState(false);
  const [mobileView, setMobileView] = useState<'filters' | 'list'>('filters');
  const [detailNotification, setDetailNotification] = useState<NotificationItem | null>(null);

  useEffect(() => {
    setSelectedIds([]);
  }, [currentPage, activeFilter]);

  const loadCounts = async () => {
    try {
      const res = await notificationApi.getCountSummary();
      setCounts({
        ...res,
        views: res.all, // Views filter shows statistics for all notifications
      });
    } catch (e) {
      if (!isAuthError(e)) {
        console.error('Failed to load counts:', e);
      }
    }
  };

  const loadPaginated = async () => {
    setIsLoading(true);
    try {
      const res = await notificationApi.getNotifications({
        page: currentPage,
        limit: itemsPerPage,
        type: activeFilter === 'views' ? 'all' : activeFilter,
      });

      // If we deleted the last item on a page, res.items will be empty
      // and currentPage will exceed the new res.totalPages.
      if (res.items.length === 0 && currentPage > res.totalPages && res.totalPages > 0) {
        setCurrentPage(res.totalPages);
        return;
      }

      setNotifications(normalizeNotifications(res.items));
      setTotal(res.total);
      setTotalPages(res.totalPages);
    } catch (e) {
      if (!isAuthError(e)) {
        console.error('Failed to load paginated list:', e);
        toast.error('Không thể tải danh sách thông báo.');
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handleSaveNotification = async (data: {
    title: string;
    description: string;
    type: NotificationItem['type'];
    routeUrl?: string;
    targetRole: 'all' | 'student' | 'teacher' | 'supervisor';
  }) => {
    try {
      if (editingNotification) {
        await notificationApi.updateNotification(editingNotification.id, data);
        toast.success('Đã cập nhật thông báo thành công!');
      } else {
        await notificationApi.createNotification(data);
        toast.success('Đã thêm thông báo mới thành công!');
      }
      window.dispatchEvent(new Event('notifications-updated'));
    } catch (err: any) {
      if (!isAuthError(err)) {
        toast.error(err.message || 'Lỗi khi lưu thông báo.');
      }
      throw err;
    }
    setEditingNotification(null);
  };

  useEffect(() => {
    loadCounts();
  }, [refreshKey]);

  useEffect(() => {
    loadPaginated();
  }, [currentPage, activeFilter, refreshKey]);

  useEffect(() => {
    const handleNotificationsUpdate = () => {
      setRefreshKey((prev) => prev + 1);
    };

    window.addEventListener('notifications-updated', handleNotificationsUpdate);
    return () => {
      window.removeEventListener('notifications-updated', handleNotificationsUpdate);
    };
  }, []);

  const handleMarkRead = async (id: string) => {
    try {
      await notificationApi.markRead(id);
      window.dispatchEvent(new Event('notifications-updated'));
    } catch (err) {
      if (!isAuthError(err)) {
        console.error('Failed to mark read:', err);
      }
    }
  };

  const handleMarkAllRead = async () => {
    try {
      await notificationApi.markAllRead();
      toast.success('Đã đánh dấu đọc tất cả thông báo!');
      window.dispatchEvent(new Event('notifications-updated'));
    } catch (err: any) {
      if (!isAuthError(err)) {
        toast.error(err.message || 'Lỗi khi đánh dấu đọc.');
      }
    }
  };

  const handleDelete = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setNotificationToDelete(id);
    setIsDeleteModalOpen(true);
  };

  const handleDeleteConfirm = async () => {
    if (!notificationToDelete) return;
    try {
      await notificationApi.deleteNotification(notificationToDelete);
      toast.success('Đã xóa thông báo!');
      window.dispatchEvent(new Event('notifications-updated'));
    } catch (err: any) {
      if (!isAuthError(err)) {
        toast.error(err.message || 'Lỗi khi xóa thông báo.');
      }
    } finally {
      setNotificationToDelete(null);
    }
  };

  const handleToggleSelect = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id],
    );
  };

  const handleSelectAllOnPage = () => {
    const pageIds = notifications.map((n) => n.id);
    const allPageIdsSelected = pageIds.every((id) => selectedIds.includes(id));

    if (allPageIdsSelected) {
      setSelectedIds((prev) => prev.filter((id) => !pageIds.includes(id)));
    } else {
      setSelectedIds((prev) => {
        const newSelections = pageIds.filter((id) => !prev.includes(id));
        return [...prev, ...newSelections];
      });
    }
  };

  const handleBulkDeleteConfirm = async () => {
    if (selectedIds.length === 0) return;
    try {
      await notificationApi.deleteNotificationsBulk(selectedIds);
      toast.success(`Đã xóa thành công ${selectedIds.length} thông báo!`);
      setSelectedIds([]);
      window.dispatchEvent(new Event('notifications-updated'));
    } catch (err: any) {
      if (!isAuthError(err)) {
        toast.error(err.message || 'Lỗi khi xóa các thông báo.');
      }
    }
  };

  const handleNavigate = async (item: NotificationItem, e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      await notificationApi.markRead(item.id);
      window.dispatchEvent(new Event('notifications-updated'));
    } catch (err) {
      if (!isAuthError(err)) {
        console.error(err);
      }
    }
    if (item.routeUrl?.trim()) {
      toast.info(`Chuyển hướng đến: ${item.title}`);
      router.push(item.routeUrl.trim());
    } else {
      setDetailNotification(item);
    }
  };

  const handleCardClick = async (item: NotificationItem) => {
    try {
      await notificationApi.markRead(item.id);
      window.dispatchEvent(new Event('notifications-updated'));
    } catch (err) {
      if (!isAuthError(err)) console.error(err);
    }
    if (item.routeUrl?.trim()) router.push(item.routeUrl.trim());
    else setDetailNotification(item);
  };

  const getIcon = (type: NotificationItem['type']) => {
    switch (type) {
      case 'warning':
        return (
          <div className="w-10 h-10 rounded-xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-700 shrink-0">
            <AlertTriangle size={18} />
          </div>
        );
      case 'success':
        return (
          <div className="w-10 h-10 rounded-xl bg-purple-500/10 border border-purple-500/20 flex items-center justify-center text-purple-700 shrink-0">
            <Sparkles size={18} />
          </div>
        );
      case 'info':
        return (
          <div className="w-10 h-10 rounded-xl bg-blue-500/10 border border-blue-500/20 flex items-center justify-center text-[#1A73E8] shrink-0">
            <ClipboardList size={18} />
          </div>
        );
      case 'system':
      default:
        return (
          <div className="w-10 h-10 rounded-xl bg-slate-500/10 border border-slate-500/20 flex items-center justify-center text-[#64748B] shrink-0">
            <Info size={18} />
          </div>
        );
    }
  };

  const startItem = total > 0 ? (currentPage - 1) * itemsPerPage + 1 : 0;
  const endItem = Math.min(currentPage * itemsPerPage, total);

  const formatTime = (createdAt?: string) => {
    if (!createdAt) return 'Vừa xong';
    try {
      return formatDistanceToNow(new Date(createdAt), { addSuffix: true, locale: vi });
    } catch (e) {
      return 'Không rõ';
    }
  };

  return (
    <>
      <HeaderCustomMappings mappings={{ notifications: 'Trung tâm thông báo' }} />
      <main className="flex-1 p-4 overflow-hidden flex flex-col bg-transparent relative gap-4">
          
          {/* Title and Action */}
          <div className="flex items-center justify-between shrink-0">
            <div>
              <h2 className="text-[20px] font-bold text-[#1E293B] leading-7">Trung tâm thông báo</h2>
              <p className="text-xs text-[#64748B] mt-0.5">Quản lý và xem lại lịch sử các thông báo, sự kiện trong hệ thống.</p>
            </div>
            <div className="flex items-center gap-2">
              {isPrivileged && (
                <button
                  onClick={() => {
                    setEditingNotification(null);
                    setIsModalOpen(true);
                  }}
                  className={`text-white transition-all duration-150 ease-out shrink-0 h-[40px] flex items-center justify-center rounded-xl bg-[#1A73E8] w-[40px] md:w-auto md:px-4 md:py-2 md:gap-1.5 font-semibold text-sm ${
                    isLoading ? 'opacity-60 cursor-not-allowed shadow-none' : 'hover:bg-[#155cb4] hover:scale-[1.01] shadow-sm cursor-pointer'
                  }`}
                  title="Thêm mới thông báo"
                >
                  <Plus size={16} strokeWidth={2.5} className="shrink-0" />
                  <span className="hidden md:inline">Thêm mới</span>
                </button>
              )}
              {counts.unread > 0 && (
                <button
                  onClick={handleMarkAllRead}
                  className="text-[#1A73E8] bg-white/50 backdrop-blur-sm hover:bg-[#1A73E8] hover:text-white rounded-xl border border-white/80 transition-all duration-150 ease-out hover:scale-[1.01] cursor-pointer h-[40px] w-[40px] md:w-auto md:px-4 md:py-2 md:gap-1.5 flex items-center justify-center font-semibold text-sm shrink-0"
                  title="Đánh dấu đọc tất cả"
                >
                  <CheckSquare size={16} className="shrink-0" />
                  <span className="hidden md:inline">Đánh dấu đọc tất cả</span>
                </button>
              )}
            </div>
          </div>

          <div className="flex-1 flex flex-col lg:flex-row gap-4 min-h-0 overflow-y-auto lg:overflow-hidden">
            
            {/* Left Column: Filter Sidebar */}
            <div className={`w-full lg:w-72 flex flex-col gap-3 shrink-0 overflow-hidden lg:max-h-full ${mobileView !== 'filters' ? 'hidden lg:flex' : 'flex'}`}>
              <div className="flex items-center gap-2 px-1 py-1 shrink-0">
                <Filter size={15} className="text-slate-500" />
                <h3 className="text-xs font-bold text-slate-800 tracking-wider uppercase">BỘ LỌC THÔNG BÁO</h3>
              </div>

              <div className="flex flex-col gap-2 overflow-y-auto pr-1">
                {([
                  { id: 'all' as const, label: 'Tất cả thông báo' },
                  { id: 'unread' as const, label: 'Chưa đọc' },
                  { id: 'warning' as const, label: 'Cảnh báo chuyên cần' },
                  { id: 'success' as const, label: 'Khen thưởng & Điểm số' },
                  { id: 'info' as const, label: 'Nhiệm vụ & Công việc' },
                  { id: 'system' as const, label: 'Thông báo hệ thống' },
                  ...(isPrivileged ? [{ id: 'views' as const, label: 'Lượt xem & Người đọc' }] : [])
                ]).map((filter) => (
                  <button
                    key={filter.id}
                    onClick={() => {
                      setActiveFilter(filter.id);
                      setCurrentPage(1);
                      setMobileView('list');
                    }}
                    className={`w-full p-3 rounded-xl border text-left transition-all duration-150 ease-out shrink-0 flex items-center justify-between cursor-pointer hover:scale-[1.01] ${
                      activeFilter === filter.id
                        ? 'bg-white/80 border-[#1A73E8] shadow-sm font-bold text-[#1A73E8]'
                        : 'bg-white/45 backdrop-blur-md border border-white/70 text-[#475569] hover:bg-white/70'
                    }`}
                  >
                    <span className="text-xs font-semibold">{filter.label}</span>
                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                      activeFilter === filter.id ? 'bg-[#1A73E8] text-white' : 'bg-slate-100 text-slate-500'
                    }`}>
                      {counts[filter.id]}
                    </span>
                  </button>
                ))}
              </div>
            </div>

            {/* Right Column: Notification Details List */}
            <div className={`flex-1 bg-white/45 backdrop-blur-md border border-white/70 rounded-2xl flex flex-col min-h-0 overflow-hidden shadow-sm shadow-slate-300/40 ${mobileView !== 'list' ? 'hidden lg:flex' : 'flex'}`}>
              {/* Mobile Header Bar */}
              <div className="lg:hidden px-4 py-3 border-b border-white/60 bg-white/30 flex items-center gap-3 shrink-0">
                <button
                  onClick={() => setMobileView('filters')}
                  className="p-1.5 hover:bg-white/60 rounded-xl text-slate-500 hover:text-slate-700 transition-colors cursor-pointer shrink-0"
                  title="Quay lại bộ lọc"
                >
                  <ChevronLeft size={20} strokeWidth={2.5} />
                </button>
                <div className="flex flex-col min-w-0">
                  <span className="text-xs font-bold text-slate-700 truncate">
                    {([
                      { id: 'all' as const, label: 'Tất cả thông báo' },
                      { id: 'unread' as const, label: 'Chưa đọc' },
                      { id: 'warning' as const, label: 'Cảnh báo chuyên cần' },
                      { id: 'success' as const, label: 'Khen thưởng & Điểm số' },
                      { id: 'info' as const, label: 'Nhiệm vụ & Công việc' },
                      { id: 'system' as const, label: 'Thông báo hệ thống' },
                      { id: 'views' as const, label: 'Lượt xem & Người đọc' }
                    ]).find(f => f.id === activeFilter)?.label || 'Thông báo'}
                  </span>
                </div>
              </div>
              
              {/* Bulk Action Bar */}
              {isPrivileged && notifications.length > 0 && (
                <div className="px-5 py-3 border-b border-white/60 bg-white/20 flex items-center justify-between shrink-0">
                  <div className="flex items-center gap-3">
                    <label className="flex items-center gap-2.5 cursor-pointer select-none">
                      <input
                        type="checkbox"
                        checked={notifications.length > 0 && notifications.every((n) => selectedIds.includes(n.id))}
                        onChange={handleSelectAllOnPage}
                        className="w-4 h-4 rounded border-slate-300 text-[#1A73E8] focus:ring-[#1A73E8] cursor-pointer"
                      />
                      <span className="text-xs font-bold text-slate-700">Chọn tất cả trang này</span>
                    </label>
                    {selectedIds.length > 0 && (
                      <span className="text-xs font-bold text-[#1A73E8] bg-blue-500/10 px-2 py-0.5 rounded-xl border border-blue-500/20">
                        Đã chọn {selectedIds.length}
                      </span>
                    )}
                  </div>
                  {selectedIds.length > 0 && (
                    <button
                      onClick={() => setIsBulkDeleteModalOpen(true)}
                      className="flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-bold text-red-700 bg-red-500/10 hover:bg-red-500 hover:text-white border border-red-500/20 active:scale-[0.98] rounded-xl transition-all duration-150 ease-out hover:scale-[1.01] cursor-pointer shadow-xs shadow-red-500/10"
                    >
                      <Trash2 size={13} />
                      <span>Xóa đã chọn ({selectedIds.length})</span>
                    </button>
                  )}
                </div>
              )}

              <div className="flex-1 p-4 overflow-y-auto min-h-0 bg-white/15 flex flex-col gap-3.5 custom-scrollbar">
                {isLoading ? (
                  <div className="h-full min-h-[300px] flex items-center justify-center">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#1A73E8]" />
                  </div>
                ) : notifications.length > 0 ? (
                  notifications.map((item) => (
                    <div
                      key={item.id}
                      onClick={() => {
                        if (activeFilter === 'views') {
                          setReadersNotificationId(item.id);
                          setReadersNotificationTitle(item.title);
                          setIsReadersModalOpen(true);
                        } else handleCardClick(item);
                      }}
                      className={`p-4 flex gap-3.5 md:gap-4 transition-all duration-250 ease-out hover:-translate-y-0.5 hover:shadow-md cursor-pointer relative group rounded-2xl border ${
                        !item.isRead && activeFilter !== 'views'
                          ? 'bg-blue-50/70 border-blue-100/80 shadow-xs shadow-blue-100/20'
                          : 'bg-white/45 backdrop-blur-md border border-white/70 shadow-xs hover:bg-white/75'
                      }`}
                    >
                      {/* Unread Dot Indicator */}
                      {!item.isRead && activeFilter !== 'views' && (
                        <span className="absolute top-4 left-2.5 w-2.5 h-2.5 bg-[#1A73E8] rounded-full shadow-[0_0_8px_#1A73E8]" />
                      )}

                      {/* Checkbox for selection */}
                      {isPrivileged && (
                        <div className="flex items-center shrink-0 pl-1.5 pr-0.5" onClick={(e) => e.stopPropagation()}>
                          <input
                            type="checkbox"
                            checked={selectedIds.includes(item.id)}
                            onChange={(e) => handleToggleSelect(item.id, e as any)}
                            className="w-4 h-4 rounded border-slate-300 text-[#1A73E8] focus:ring-[#1A73E8] cursor-pointer"
                          />
                        </div>
                      )}

                      {/* Card content */}
                      <div className="flex-1 min-w-0 flex flex-col gap-2">
                        {/* Header: Icon + Title & Badges */}
                        <div className="flex items-start gap-3 w-full">
                          {/* Icon */}
                          <div className="shrink-0 pl-1">
                            {getIcon(item.type)}
                          </div>

                          <div className="flex-1 min-w-0">
                            <div className="flex flex-wrap items-center gap-2 mt-0.5">
                              <h4 className={`text-[14px] md:text-[15px] font-bold text-[#1E293B] group-hover:text-[#1A73E8] transition-colors leading-snug ${
                                !item.isRead && activeFilter !== 'views' ? 'font-extrabold text-slate-900' : ''
                              }`}>
                                {item.title}
                              </h4>
                              <div className="flex items-center gap-1.5 flex-wrap">
                                {isPrivileged && item.targetRole && (
                                  <span className={`text-[9px] font-extrabold px-1.5 py-0.5 rounded-lg border uppercase tracking-wider ${
                                    item.targetRole === 'student'
                                      ? 'bg-green-500/10 text-green-700 border-green-500/20'
                                      : item.targetRole === 'teacher'
                                        ? 'bg-purple-500/10 text-purple-700 border-purple-500/20'
                                        : item.targetRole === 'supervisor'
                                          ? 'bg-amber-500/10 text-amber-700 border-amber-500/20'
                                          : 'bg-slate-500/10 text-[#64748B] border-slate-500/20'
                                  }`}>
                                    {item.targetRole === 'student' ? 'HSSV' : item.targetRole === 'teacher' ? 'Giảng viên' : item.targetRole === 'supervisor' ? 'Quản sinh' : 'Tất cả'}
                                  </span>
                                )}
                                {!item.isRead && activeFilter !== 'views' && (
                                  <span className="bg-blue-500/10 text-[#1A73E8] border border-blue-500/20 text-[9px] font-extrabold px-1.5 py-0.5 rounded-lg uppercase tracking-wider">
                                    Mới
                                  </span>
                                )}
                              </div>
                            </div>
                          </div>
                        </div>

                        {/* Description (Aligned below title) */}
                        <p className="text-xs text-[#515F72] mt-0.5 leading-relaxed break-words pl-[52px]">
                          {item.description}
                        </p>

                        {/* Footer details: Metadata & Actions */}
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mt-2 pt-2.5 border-t border-slate-100/70 pl-[52px]">
                          {/* Metadata */}
                          <div className="flex flex-wrap items-center gap-4">
                            <span className="text-[10px] text-[#64748B] font-semibold">
                              {formatTime(item.createdAt)}
                            </span>
                            {activeFilter === 'views' ? (
                              <span className="text-[10px] font-bold text-slate-600 bg-slate-100 border border-slate-200 px-2 py-0.5 rounded-full flex items-center gap-1 shadow-xs">
                                <Users size={10} className="text-slate-500" />
                                Lượt xem: {item.readByUserIds?.length || 0}
                              </span>
                            ) : (
                              <NotificationDestination routeUrl={item.routeUrl} />
                            )}
                          </div>

                          {/* Actions (Always visible on mobile, hover-only on desktop) */}
                          <div className="flex items-center gap-1.5 self-end sm:self-auto opacity-100 md:opacity-0 md:group-hover:opacity-100 transition-all duration-200 ease-out" onClick={(e) => e.stopPropagation()}>
                            {activeFilter === 'views' ? (
                              <button
                                onClick={() => {
                                  setReadersNotificationId(item.id);
                                  setReadersNotificationTitle(item.title);
                                  setIsReadersModalOpen(true);
                                }}
                                className="px-2.5 py-1.5 rounded-lg border border-blue-500/20 bg-blue-500/15 text-[#1A73E8] hover:bg-[#1A73E8] hover:text-white text-[11px] font-bold transition-all duration-150 ease-out hover:scale-[1.02] cursor-pointer flex items-center gap-1 shadow-xs"
                                title="Xem chi tiết người đã đọc"
                              >
                                <Users size={12} />
                                <span>Chi tiết</span>
                              </button>
                            ) : (
                              <>
                                {item.routeUrl && (
                                  <button
                                    onClick={(e) => handleNavigate(item, e)}
                                    className="p-1.5 rounded-lg border border-white/80 bg-white/50 backdrop-blur-sm text-[#64748B] hover:border-[#1A73E8] hover:text-[#1A73E8] hover:scale-[1.02] transition-all duration-150 ease-out cursor-pointer"
                                    title="Đi tới trang liên kết"
                                  >
                                    <ExternalLink size={13} />
                                  </button>
                                )}
                                {isPrivileged && (
                                  <>
                                    <button
                                      onClick={(e) => {
                                        setEditingNotification(item);
                                        setIsModalOpen(true);
                                      }}
                                      className="p-1.5 rounded-lg border border-white/80 bg-white/50 backdrop-blur-sm text-slate-500 hover:border-blue-500/30 hover:bg-blue-500/10 hover:text-[#1A73E8] hover:scale-[1.02] transition-all duration-150 ease-out cursor-pointer"
                                      title="Chỉnh sửa thông báo"
                                    >
                                      <PencilLine size={13} />
                                    </button>
                                    <button
                                      onClick={(e) => handleDelete(item.id, e)}
                                      className="p-1.5 rounded-lg border border-white/80 bg-white/50 backdrop-blur-sm text-red-500 hover:border-red-500/30 hover:bg-red-500/10 hover:text-red-700 hover:scale-[1.02] transition-all duration-150 ease-out cursor-pointer"
                                      title="Xóa thông báo"
                                    >
                                      <Trash2 size={13} />
                                    </button>
                                  </>
                                )}
                              </>
                            )}
                          </div>
                        </div>
                      </div>

                    </div>
                  ))
                ) : (
                  <div className="h-full min-h-[300px] flex flex-col items-center justify-center text-center p-6">
                    <BellOff size={40} className="text-gray-300 mb-2 animate-bounce duration-1000" />
                    <p className="text-sm font-semibold text-gray-500">Không tìm thấy thông báo nào.</p>
                    <p className="text-xs text-gray-400 mt-1">Hãy chuyển đổi các bộ lọc hoặc thực hiện các tác vụ khác để tự động sinh thông báo.</p>
                  </div>
                )}
              </div>

              {/* Footer (Pagination) */}
              <div className="hidden lg:flex px-5 py-3 border-t border-white/60 bg-white/20 items-center justify-between shrink-0">
                <span className="text-xs text-[#64748B] font-semibold">
                  Hiển thị {startItem} - {endItem} trong tổng số {total}
                </span>

                <div className="flex items-center gap-1.5">
                  <button
                    onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                    disabled={currentPage === 1}
                    className="w-7 h-7 flex items-center justify-center rounded-xl border border-white/70 bg-white/50 backdrop-blur-sm text-[#64748B] hover:bg-white/70 disabled:opacity-40 disabled:cursor-not-allowed transition-all duration-150 ease-out hover:scale-[1.05]"
                  >
                    <ChevronLeft size={14} />
                  </button>

                  {Array.from({ length: totalPages }).map((_, idx) => (
                    <button
                      key={idx}
                      onClick={() => setCurrentPage(idx + 1)}
                      className={`w-7 h-7 flex items-center justify-center rounded-xl text-xs font-bold transition-all duration-150 ease-out hover:scale-[1.05] cursor-pointer ${
                        currentPage === idx + 1
                          ? 'bg-[#1A73E8] text-white shadow-sm shadow-blue-500/15'
                          : 'border border-white/70 bg-white/50 backdrop-blur-sm text-[#64748B] hover:bg-white/70'
                      }`}
                    >
                      {idx + 1}
                    </button>
                  ))}

                  <button
                    onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
                    disabled={currentPage === totalPages}
                    className="w-7 h-7 flex items-center justify-center rounded-xl border border-white/70 bg-white/50 backdrop-blur-sm text-[#64748B] hover:bg-white/70 disabled:opacity-40 disabled:cursor-not-allowed transition-all duration-150 ease-out hover:scale-[1.05]"
                  >
                    <ChevronRight size={14} />
                  </button>
                </div>
              </div>

            </div>

          </div>

        </main>

      <NotificationModal
        isOpen={isModalOpen}
        onClose={() => {
          setIsModalOpen(false);
          setEditingNotification(null);
        }}
        onSave={handleSaveNotification}
        editingNotification={editingNotification}
      />

      <NotificationReadersModal
        isOpen={isReadersModalOpen}
        onClose={() => {
          setIsReadersModalOpen(false);
          setReadersNotificationId(null);
          setReadersNotificationTitle('');
        }}
        notificationId={readersNotificationId}
        notificationTitle={readersNotificationTitle}
      />

      <ConfirmModal
        isOpen={isDeleteModalOpen}
        onClose={() => {
          setIsDeleteModalOpen(false);
          setNotificationToDelete(null);
        }}
        onConfirm={handleDeleteConfirm}
        title="Xác nhận xóa thông báo"
        message="Bạn có chắc chắn muốn xóa thông báo này? Hành động này sẽ không thể hoàn tác."
        confirmLabel="Xóa"
        cancelLabel="Hủy"
        variant="danger"
      />

      <NotificationDetailModal
        isOpen={Boolean(detailNotification)}
        notification={detailNotification}
        onClose={() => setDetailNotification(null)}
        onNavigate={(routeUrl) => { setDetailNotification(null); router.push(routeUrl); }}
      />

      <ConfirmModal
        isOpen={isBulkDeleteModalOpen}
        onClose={() => {
          setIsBulkDeleteModalOpen(false);
        }}
        onConfirm={handleBulkDeleteConfirm}
        title="Xác nhận xóa nhiều thông báo"
        message={`Bạn có chắc chắn muốn xóa ${selectedIds.length} thông báo đã chọn? Hành động này sẽ không thể hoàn tác.`}
        confirmLabel="Xóa"
        cancelLabel="Hủy"
        variant="danger"
      />
    </>
  );
}

export default function NotificationsPage() {
  return (
    <Suspense
      fallback={
        <div className="flex h-screen items-center justify-center bg-gray-50 text-gray-400">
          Đang tải trung tâm thông báo...
        </div>
      }
    >
      <RouteGuard>
        <NotificationsPageContent />
      </RouteGuard>
    </Suspense>
  );
}
