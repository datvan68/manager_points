'use client';

import React, { useState, useEffect, Suspense } from 'react';
import { useRouter } from 'next/navigation';
import Sidebar from '@/components/layout/Sidebar';
import Header from '@/components/layout/Header';
import { RouteGuard } from '@/components/guards/RouteGuard';
import { notificationApi, NotificationItem } from '@/api/notification-api';
import { useAuth } from '@/providers/auth-provider';
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
      console.error('Failed to load counts:', e);
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

      setNotifications(res.items);
      setTotal(res.total);
      setTotalPages(res.totalPages);
    } catch (e) {
      console.error('Failed to load paginated list:', e);
      toast.error('Không thể tải danh sách thông báo.');
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
      toast.error(err.message || 'Lỗi khi lưu thông báo.');
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
      console.error('Failed to mark read:', err);
    }
  };

  const handleMarkAllRead = async () => {
    try {
      await notificationApi.markAllRead();
      toast.success('Đã đánh dấu đọc tất cả thông báo!');
      window.dispatchEvent(new Event('notifications-updated'));
    } catch (err: any) {
      toast.error(err.message || 'Lỗi khi đánh dấu đọc.');
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
      toast.error(err.message || 'Lỗi khi xóa thông báo.');
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
      toast.error(err.message || 'Lỗi khi xóa các thông báo.');
    }
  };

  const handleNavigate = async (item: NotificationItem, e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      await notificationApi.markRead(item.id);
      window.dispatchEvent(new Event('notifications-updated'));
    } catch (err) {
      console.error(err);
    }
    if (item.routeUrl) {
      toast.info(`Chuyển hướng đến: ${item.title}`);
      router.push(item.routeUrl);
    } else {
      toast.error('Thông báo này không có liên kết trang.');
    }
  };

  const getIcon = (type: NotificationItem['type']) => {
    switch (type) {
      case 'warning':
        return (
          <div className="w-10 h-10 rounded-xl bg-red-50 border border-red-100 flex items-center justify-center text-red-500 shrink-0">
            <AlertTriangle size={18} />
          </div>
        );
      case 'success':
        return (
          <div className="w-10 h-10 rounded-xl bg-emerald-50 border border-emerald-100 flex items-center justify-center text-emerald-500 shrink-0">
            <Sparkles size={18} />
          </div>
        );
      case 'info':
        return (
          <div className="w-10 h-10 rounded-xl bg-blue-50 border border-blue-100 flex items-center justify-center text-[#1A73E8] shrink-0">
            <ClipboardList size={18} />
          </div>
        );
      case 'system':
      default:
        return (
          <div className="w-10 h-10 rounded-xl bg-slate-50 border border-slate-200/60 flex items-center justify-center text-slate-500 shrink-0">
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
    <div className="flex bg-gray-50 h-screen overflow-hidden font-sans">
      <Sidebar />
      <div className="flex-1 flex flex-col min-w-0 h-full">
        <Header customMappings={{ notifications: 'Trung tâm thông báo' }} />
        
        <main className="flex-1 p-4 overflow-hidden flex flex-col bg-gray-50 relative gap-4">
          
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
                  className="flex items-center gap-1.5 px-4 py-2 text-sm font-semibold text-white bg-[#1A73E8] hover:bg-[#155cb4] active:scale-[0.99] rounded-xl transition-all duration-150 ease-out hover:scale-[1.01] shadow-sm shadow-blue-500/10 cursor-pointer"
                >
                  <Plus size={16} />
                  <span>Thêm mới</span>
                </button>
              )}
              {counts.unread > 0 && (
                <button
                  onClick={handleMarkAllRead}
                  className="flex items-center gap-1.5 px-4 py-2 text-sm font-semibold text-[#1A73E8] bg-blue-50 hover:bg-blue-100 active:scale-[0.99] rounded-xl border border-blue-100/50 transition-all duration-150 cursor-pointer"
                >
                  <CheckSquare size={16} />
                  <span>Đánh dấu đọc tất cả</span>
                </button>
              )}
            </div>
          </div>

          <div className="flex-1 flex flex-col lg:flex-row gap-4 min-h-0 overflow-y-auto lg:overflow-hidden">
            
            {/* Left Column: Filter Sidebar */}
            <div className="w-full lg:w-72 flex flex-col gap-3 shrink-0 overflow-hidden lg:max-h-full">
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
                    }}
                    className={`w-full p-3 rounded-xl border text-left transition-all shrink-0 flex items-center justify-between cursor-pointer ${
                      activeFilter === filter.id
                        ? 'bg-white border-[#1A73E8] shadow-md font-bold text-[#1A73E8] ring-1 ring-[#1A73E8]/10'
                        : 'bg-white border-slate-200/50 text-[#475569] hover:border-blue-200 hover:bg-slate-50/50'
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
            <div className="flex-1 bg-white/40 backdrop-blur-md border border-white/80 rounded-2xl flex flex-col min-h-0 overflow-hidden shadow-sm shadow-slate-300/10">
              
              {/* Bulk Action Bar */}
              {isPrivileged && notifications.length > 0 && (
                <div className="px-5 py-3 border-b border-slate-200/50 bg-slate-50/50 flex items-center justify-between shrink-0">
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
                      <span className="text-xs font-bold text-[#1A73E8] bg-blue-50 px-2 py-0.5 rounded-full border border-blue-100/50">
                        Đã chọn {selectedIds.length}
                      </span>
                    )}
                  </div>
                  {selectedIds.length > 0 && (
                    <button
                      onClick={() => setIsBulkDeleteModalOpen(true)}
                      className="flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-bold text-white bg-red-500 hover:bg-red-650 active:scale-[0.98] rounded-xl transition-all shadow-xs cursor-pointer shadow-red-500/10"
                    >
                      <Trash2 size={13} />
                      <span>Xóa đã chọn ({selectedIds.length})</span>
                    </button>
                  )}
                </div>
              )}

              <div className="flex-1 p-4 overflow-y-auto min-h-0 divide-y divide-slate-100/55 bg-white/15">
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
                        } else {
                          handleMarkRead(item.id);
                        }
                      }}
                      className={`py-4 px-3.5 flex gap-4 transition-all duration-150 hover:bg-white/60 cursor-pointer relative group rounded-2xl border border-transparent hover:border-slate-200/50 ${
                        !item.isRead && activeFilter !== 'views' ? 'bg-blue-50/10' : ''
                      }`}
                    >
                      {/* Unread Indicator */}
                      {!item.isRead && activeFilter !== 'views' && (
                        <span className="absolute top-5 left-2 w-2 h-2 bg-[#1A73E8] rounded-full" />
                      )}

                      {/* Checkbox for selection */}
                      {isPrivileged && (
                        <div className="flex items-center shrink-0 pl-1 pr-1.5" onClick={(e) => e.stopPropagation()}>
                          <input
                            type="checkbox"
                            checked={selectedIds.includes(item.id)}
                            onChange={(e) => handleToggleSelect(item.id, e as any)}
                            className="w-4 h-4 rounded border-slate-300 text-[#1A73E8] focus:ring-[#1A73E8] cursor-pointer"
                          />
                        </div>
                      )}

                      {/* Icon */}
                      <div className="pl-2.5">
                        {getIcon(item.type)}
                      </div>

                      {/* Content details */}
                      <div className="flex-1 min-w-0 pr-10">
                        <div className="flex flex-wrap items-center gap-2">
                          <h4 className={`text-sm font-bold text-[#1E293B] group-hover:text-[#1A73E8] transition-colors ${
                            !item.isRead && activeFilter !== 'views' ? 'font-extrabold text-slate-900' : ''
                          }`}>
                            {item.title}
                          </h4>
                          {isPrivileged && item.targetRole && (
                            <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded-md border ${
                              item.targetRole === 'student'
                                ? 'bg-green-50 text-green-700 border-green-200'
                                : item.targetRole === 'teacher'
                                  ? 'bg-purple-50 text-purple-700 border-purple-200'
                                  : item.targetRole === 'supervisor'
                                    ? 'bg-amber-50 text-amber-700 border-amber-200'
                                    : 'bg-slate-50 text-slate-700 border-slate-200'
                            }`}>
                              {item.targetRole === 'student' ? 'HSSV' : item.targetRole === 'teacher' ? 'Giảng viên' : item.targetRole === 'supervisor' ? 'Quản sinh' : 'Tất cả'}
                            </span>
                          )}
                          {!item.isRead && activeFilter !== 'views' && (
                            <span className="bg-blue-50 text-[#1A73E8] border border-blue-100 text-[9px] font-bold px-1.5 py-0.5 rounded-md">
                              Mới
                            </span>
                          )}
                        </div>
                        <p className="text-xs text-[#64748B] mt-1 leading-5">
                          {item.description}
                        </p>
                        <div className="flex items-center gap-4 mt-2.5">
                          <span className="text-[10px] text-[#64748B] font-semibold">
                            {formatTime(item.createdAt)}
                          </span>
                          {activeFilter === 'views' ? (
                            <span className="text-[10px] font-bold text-slate-600 bg-slate-100 border border-slate-200 px-2 py-0.5 rounded-full flex items-center gap-1 shadow-xs">
                              <Users size={10} className="text-slate-500" />
                              Lượt xem: {item.readByUserIds?.length || 0}
                            </span>
                          ) : (
                            item.routeUrl && (
                              <button
                                onClick={(e) => handleNavigate(item, e)}
                                className="text-[10px] font-bold text-[#1A73E8] hover:text-[#155cb4] flex items-center gap-0.5 hover:underline cursor-pointer"
                              >
                                <ExternalLink size={10} />
                                Đi tới trang liên kết
                              </button>
                            )
                          )}
                        </div>
                      </div>

                      {/* Actions */}
                      <div className="absolute right-4 top-4 flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity duration-150" onClick={(e) => e.stopPropagation()}>
                        {activeFilter === 'views' ? (
                          <button
                            onClick={() => {
                              setReadersNotificationId(item.id);
                              setReadersNotificationTitle(item.title);
                              setIsReadersModalOpen(true);
                            }}
                            className="px-3 py-1.5 rounded-xl border border-blue-100 bg-blue-50 text-[#1A73E8] hover:bg-blue-100 hover:border-blue-200 text-xs font-bold transition-all cursor-pointer flex items-center gap-1 shadow-xs"
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
                                className="p-1.5 rounded-xl border border-gray-200 bg-white text-gray-500 hover:border-[#1A73E8] hover:text-[#1A73E8] transition-all cursor-pointer"
                                title="Đi tới trang liên kết"
                              >
                                <ExternalLink size={14} />
                              </button>
                            )}
                            {isPrivileged && (
                              <>
                                <button
                                  onClick={(e) => {
                                    setEditingNotification(item);
                                    setIsModalOpen(true);
                                  }}
                                  className="p-1.5 rounded-xl border border-gray-200 bg-white text-slate-500 hover:border-blue-300 hover:bg-blue-50 transition-all cursor-pointer"
                                  title="Chỉnh sửa thông báo"
                                >
                                  <PencilLine size={14} />
                                </button>
                                <button
                                  onClick={(e) => handleDelete(item.id, e)}
                                  className="p-1.5 rounded-xl border border-gray-200 bg-white text-red-500 hover:border-red-300 hover:bg-red-50 transition-all cursor-pointer"
                                  title="Xóa thông báo"
                                >
                                  <Trash2 size={14} />
                                </button>
                              </>
                            )}
                          </>
                        )}
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
              <div className="px-5 py-3 border-t border-white/80 bg-white/20 flex items-center justify-between shrink-0">
                <span className="text-xs text-[#64748B] font-semibold">
                  Hiển thị {startItem} - {endItem} trong tổng số {total}
                </span>

                <div className="flex items-center gap-1.5">
                  <button
                    onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                    disabled={currentPage === 1}
                    className="w-7 h-7 flex items-center justify-center rounded-xl border border-gray-200 bg-white text-gray-500 hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                  >
                    <ChevronLeft size={14} />
                  </button>

                  {Array.from({ length: totalPages }).map((_, idx) => (
                    <button
                      key={idx}
                      onClick={() => setCurrentPage(idx + 1)}
                      className={`w-7 h-7 flex items-center justify-center rounded-xl text-xs font-bold transition-all cursor-pointer ${
                        currentPage === idx + 1
                          ? 'bg-[#1A73E8] text-white shadow-sm shadow-blue-500/15'
                          : 'border border-gray-200 bg-white text-[#64748B] hover:bg-slate-50'
                      }`}
                    >
                      {idx + 1}
                    </button>
                  ))}

                  <button
                    onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
                    disabled={currentPage === totalPages}
                    className="w-7 h-7 flex items-center justify-center rounded-xl border border-gray-200 bg-white text-gray-500 hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                  >
                    <ChevronRight size={14} />
                  </button>
                </div>
              </div>

            </div>

          </div>

        </main>
      </div>

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
    </div>
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
