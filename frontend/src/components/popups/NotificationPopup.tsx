'use client';

import React from 'react';
import { 
  AlertTriangle, Sparkles, ClipboardList, Info, 
  Check, CheckCircle2, ChevronRight, BellOff 
} from 'lucide-react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';

export interface NotificationItem {
  id: string;
  title: string;
  description: string;
  time: string;
  type: 'warning' | 'success' | 'info' | 'system';
  isRead: boolean;
  routeUrl?: string;
}

interface NotificationPopupProps {
  isOpen: boolean;
  onClose: () => void;
  notifications: NotificationItem[];
  onMarkAllRead: () => void;
  onMarkRead: (id: string) => void;
}

const NotificationPopup: React.FC<NotificationPopupProps> = ({
  isOpen,
  onClose,
  notifications,
  onMarkAllRead,
  onMarkRead
}) => {
  const router = useRouter();

  if (!isOpen) return null;

  const handleNotificationClick = (item: NotificationItem) => {
    onMarkRead(item.id);
    onClose();
    if (item.routeUrl) {
      toast.info(`Chuyển hướng đến: ${item.title}`);
      router.push(item.routeUrl);
    }
  };

  const getIcon = (type: NotificationItem['type']) => {
    switch (type) {
      case 'warning':
        return (
          <div className="w-8 h-8 rounded-xl bg-red-50 border border-red-100 flex items-center justify-center text-red-500 shrink-0">
            <AlertTriangle size={15} />
          </div>
        );
      case 'success':
        return (
          <div className="w-8 h-8 rounded-xl bg-emerald-50 border border-emerald-100 flex items-center justify-center text-emerald-500 shrink-0">
            <Sparkles size={15} />
          </div>
        );
      case 'info':
        return (
          <div className="w-8 h-8 rounded-xl bg-blue-50 border border-blue-100 flex items-center justify-center text-[#1A73E8] shrink-0">
            <ClipboardList size={15} />
          </div>
        );
      case 'system':
      default:
        return (
          <div className="w-8 h-8 rounded-xl bg-slate-50 border border-slate-200/60 flex items-center justify-center text-slate-500 shrink-0">
            <Info size={15} />
          </div>
        );
    }
  };

  const unreadCount = notifications.filter(n => !n.isRead).length;

  return (
    <div 
      className="absolute right-0 top-full mt-2 w-80 md:w-96 bg-white/95 backdrop-blur-md border border-white/80 rounded-2xl shadow-xl py-2 z-50 overflow-hidden animate-in fade-in zoom-in-95 duration-150 flex flex-col max-h-[480px]"
      onClick={(e) => e.stopPropagation()}
    >
      {/* Header */}
      <div className="px-4 py-2.5 border-b border-gray-100 flex items-center justify-between bg-white/40">
        <div className="flex items-center gap-2">
          <span className="font-bold text-sm text-[#1E293B]">Thông báo</span>
          {unreadCount > 0 && (
            <span className="bg-[#1A73E8] text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full">
              {unreadCount} mới
            </span>
          )}
        </div>
        {unreadCount > 0 && (
          <button 
            onClick={onMarkAllRead}
            className="text-[11px] font-bold text-[#1A73E8] hover:text-[#155cb4] hover:underline transition-all flex items-center gap-1 cursor-pointer"
          >
            <CheckCircle2 size={12} />
            Đánh dấu đọc tất cả
          </button>
        )}
      </div>

      {/* Body List */}
      <div className="flex-1 overflow-y-auto divide-y divide-gray-50 scrollbar-hover pr-0.5">
        {notifications.length > 0 ? (
          notifications.map((item) => (
            <div
              key={item.id}
              onClick={() => handleNotificationClick(item)}
              className={`p-3.5 flex gap-3 transition-all duration-150 hover:bg-slate-50/80 cursor-pointer relative group ${
                !item.isRead ? 'bg-blue-50/20' : ''
              }`}
            >
              {/* Unread dot */}
              {!item.isRead && (
                <span className="absolute top-4 right-4 w-2 h-2 bg-[#1A73E8] rounded-full shrink-0" />
              )}

              {/* Notification Icon */}
              {getIcon(item.type)}

              {/* Text Detail */}
              <div className="flex-1 min-w-0 pr-2">
                <h4 className={`text-xs font-bold text-[#1E293B] group-hover:text-[#1A73E8] transition-colors truncate ${
                  !item.isRead ? 'font-extrabold' : ''
                }`}>
                  {item.title}
                </h4>
                <p className="text-[11px] text-[#64748B] mt-0.5 leading-4 line-clamp-2">
                  {item.description}
                </p>
                <span className="text-[10px] text-[#64748B] font-medium mt-1.5 block">
                  {item.time}
                </span>
              </div>
            </div>
          ))
        ) : (
          <div className="py-12 px-4 flex flex-col items-center justify-center text-center">
            <BellOff size={24} className="text-gray-300 mb-2" />
            <p className="text-xs font-bold text-gray-500">Bạn chưa có thông báo nào</p>
            <p className="text-[10px] text-gray-400 mt-1">Mọi thông tin mới từ hệ thống sẽ xuất hiện tại đây.</p>
          </div>
        )}
      </div>

      {/* Footer */}
      <div className="px-4 py-2 border-t border-gray-100 bg-white/40 flex items-center justify-center shrink-0">
        <button 
          onClick={() => {
            toast.info('Tính năng đang được phát triển thêm!');
            onClose();
          }}
          className="text-xs font-bold text-[#64748B] hover:text-[#1E293B] hover:scale-[1.01] transition-all flex items-center gap-1 cursor-pointer"
        >
          Xem tất cả thông báo
          <ChevronRight size={14} className="text-gray-400" />
        </button>
      </div>
    </div>
  );
};

export default NotificationPopup;
