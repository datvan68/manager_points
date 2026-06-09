'use client';

import React, { useState, useEffect, Suspense } from 'react';
import { useRouter } from 'next/navigation';
import Sidebar from '@/components/layout/Sidebar';
import Header from '@/components/layout/Header';
import { RouteGuard } from '@/components/guards/RouteGuard';
import { 
  getNotifications, markRead, markAllRead, deleteNotification, 
  NotificationItem, addNotification 
} from '@/lib/notifications';
import { 
  AlertTriangle, Sparkles, ClipboardList, Info, 
  Trash2, ExternalLink, CheckSquare, ChevronLeft, ChevronRight, BellOff, Filter
} from 'lucide-react';
import { toast } from 'sonner';

function NotificationsPageContent() {
  const router = useRouter();
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [activeFilter, setActiveFilter] = useState<'all' | 'unread' | 'warning' | 'success' | 'info' | 'system'>('all');
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 8;

  // Load and subscribe to notifications updates
  useEffect(() => {
    setNotifications(getNotifications());

    const handleNotificationsUpdate = () => {
      setNotifications(getNotifications());
    };

    window.addEventListener('notifications-updated', handleNotificationsUpdate);
    return () => {
      window.removeEventListener('notifications-updated', handleNotificationsUpdate);
    };
  }, []);

  const handleMarkRead = (id: string) => {
    markRead(id);
  };

  const handleMarkAllRead = () => {
    markAllRead();
    toast.success('Đã đánh dấu đọc tất cả thông báo!');
  };

  const handleDelete = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (confirm('Bạn có chắc chắn muốn xóa thông báo này?')) {
      deleteNotification(id);
      toast.success('Đã xóa thông báo!');
    }
  };

  const handleNavigate = (item: NotificationItem, e: React.MouseEvent) => {
    e.stopPropagation();
    markRead(item.id);
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

  // Filter calculations
  const filteredList = notifications.filter(n => {
    if (activeFilter === 'unread') return !n.isRead;
    if (activeFilter === 'all') return true;
    return n.type === activeFilter;
  });

  const counts = {
    all: notifications.length,
    unread: notifications.filter(n => !n.isRead).length,
    warning: notifications.filter(n => n.type === 'warning').length,
    success: notifications.filter(n => n.type === 'success').length,
    info: notifications.filter(n => n.type === 'info').length,
    system: notifications.filter(n => n.type === 'system').length,
  };

  // Pagination calculations
  const totalFiltered = filteredList.length;
  const totalPages = Math.ceil(totalFiltered / itemsPerPage) || 1;
  const paginatedList = filteredList.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);

  const startItem = totalFiltered > 0 ? (currentPage - 1) * itemsPerPage + 1 : 0;
  const endItem = Math.min(currentPage * itemsPerPage, totalFiltered);

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

          <div className="flex-1 flex flex-col lg:flex-row gap-4 min-h-0 overflow-y-auto lg:overflow-hidden">
            
            {/* Left Column: Filter Sidebar */}
            <div className="w-full lg:w-72 flex flex-col gap-3 shrink-0 overflow-hidden lg:max-h-full">
              <div className="flex items-center gap-2 px-1 py-1 shrink-0">
                <Filter size={15} className="text-slate-500" />
                <h3 className="text-xs font-bold text-slate-800 tracking-wider uppercase">BỘ LỌC THÔNG BÁO</h3>
              </div>

              <div className="flex flex-col gap-2 overflow-y-auto pr-1">
                {([
                  { id: 'all', label: 'Tất cả thông báo', color: 'text-slate-700 bg-slate-100' },
                  { id: 'unread', label: 'Chưa đọc', color: 'text-blue-600 bg-blue-50/70 border border-blue-100/30' },
                  { id: 'warning', label: 'Cảnh báo chuyên cần', color: 'text-red-600 bg-red-50/60 border border-red-100/30' },
                  { id: 'success', label: 'Khen thưởng & Điểm số', color: 'text-emerald-600 bg-emerald-50/60 border border-emerald-100/30' },
                  { id: 'info', label: 'Nhiệm vụ & Công việc', color: 'text-blue-700 bg-blue-50/50 border border-blue-100/20' },
                  { id: 'system', label: 'Thông báo hệ thống', color: 'text-slate-600 bg-slate-50 border border-slate-200/40' }
                ] as const).map((filter) => (
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
              
              <div className="flex-1 p-4 overflow-y-auto min-h-0 divide-y divide-slate-100/55 bg-white/15">
                {paginatedList.length > 0 ? (
                  paginatedList.map((item) => (
                    <div
                      key={item.id}
                      onClick={() => handleMarkRead(item.id)}
                      className={`py-4 px-3.5 flex gap-4 transition-all duration-150 hover:bg-white/60 cursor-pointer relative group rounded-2xl border border-transparent hover:border-slate-200/50 ${
                        !item.isRead ? 'bg-blue-50/10' : ''
                      }`}
                    >
                      {/* Unread Indicator */}
                      {!item.isRead && (
                        <span className="absolute top-5 left-2 w-2 h-2 bg-[#1A73E8] rounded-full" />
                      )}

                      {/* Icon */}
                      <div className="pl-2.5">
                        {getIcon(item.type)}
                      </div>

                      {/* Content details */}
                      <div className="flex-1 min-w-0 pr-10">
                        <div className="flex items-center gap-2">
                          <h4 className={`text-sm font-bold text-[#1E293B] group-hover:text-[#1A73E8] transition-colors ${
                            !item.isRead ? 'font-extrabold text-slate-900' : ''
                          }`}>
                            {item.title}
                          </h4>
                          {!item.isRead && (
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
                            {item.time}
                          </span>
                          {item.routeUrl && (
                            <button
                              onClick={(e) => handleNavigate(item, e)}
                              className="text-[10px] font-bold text-[#1A73E8] hover:text-[#155cb4] flex items-center gap-0.5 hover:underline cursor-pointer"
                            >
                              <ExternalLink size={10} />
                              Đi tới trang liên kết
                            </button>
                          )}
                        </div>
                      </div>

                      {/* Actions */}
                      <div className="absolute right-4 top-4 flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity duration-150">
                        {item.routeUrl && (
                          <button
                            onClick={(e) => handleNavigate(item, e)}
                            className="p-1.5 rounded-xl border border-gray-200 bg-white text-gray-500 hover:border-[#1A73E8] hover:text-[#1A73E8] transition-all"
                            title="Đi tới trang liên kết"
                          >
                            <ExternalLink size={14} />
                          </button>
                        )}
                        <button
                          onClick={(e) => handleDelete(item.id, e)}
                          className="p-1.5 rounded-xl border border-gray-200 bg-white text-red-500 hover:border-red-300 hover:bg-red-50 transition-all"
                          title="Xóa thông báo"
                        >
                          <Trash2 size={14} />
                        </button>
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
                <span className="text-xs font-semibold text-[#64748B]">
                  Hiển thị {startItem}-{endItem} trên tổng số {totalFiltered} thông báo
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
                      className={`w-7 h-7 flex items-center justify-center rounded-xl text-xs font-bold transition-all ${
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
      <RouteGuard requiredPermission="STUDENT_PAGE">
        <NotificationsPageContent />
      </RouteGuard>
    </Suspense>
  );
}
