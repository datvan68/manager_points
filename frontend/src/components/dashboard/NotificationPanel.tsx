import React from 'react';
import { Bell, ArrowUpRight, ShieldAlert, CheckCircle2, Info, Terminal } from 'lucide-react';
import { DashboardMetrics } from './dashboard-helpers';

interface NotificationPanelProps {
  metrics: DashboardMetrics;
}

export default function NotificationPanel({ metrics }: NotificationPanelProps) {
  const { recentNotifications, kpis } = metrics;

  const handleNav = (path: string) => {
    if (typeof window !== 'undefined') {
      window.location.href = path;
    }
  };

  const getIconAndStyle = (type: string) => {
    switch (type) {
      case 'warning':
        return {
          icon: ShieldAlert,
          style: 'bg-rose-500/10 text-rose-700 border-rose-500/20'
        };
      case 'success':
        return {
          icon: CheckCircle2,
          style: 'bg-emerald-500/10 text-emerald-700 border-emerald-500/20'
        };
      case 'system':
        return {
          icon: Terminal,
          style: 'bg-purple-500/10 text-purple-700 border-purple-500/20'
        };
      default:
        return {
          icon: Info,
          style: 'bg-blue-500/10 text-[#1A73E8] border-blue-500/20'
        };
    }
  };

  const formatTimeAgo = (dateStr?: string) => {
    if (!dateStr) return '';
    try {
      const now = new Date();
      const past = new Date(dateStr);
      const diffMs = now.getTime() - past.getTime();
      const diffMin = Math.floor(diffMs / 60000);
      const diffHr = Math.floor(diffMin / 60);
      const diffDay = Math.floor(diffHr / 24);

      if (diffMin < 1) return 'Vừa xong';
      if (diffMin < 60) return `${diffMin} phút trước`;
      if (diffHr < 24) return `${diffHr} giờ trước`;
      if (diffDay === 1) return 'Hôm qua';
      return past.toLocaleDateString('vi-VN', { month: '2-digit', day: '2-digit' });
    } catch {
      return '';
    }
  };

  return (
    <div className="bg-white/45 backdrop-blur-md border border-white/75 rounded-2xl p-5 shadow-sm shadow-slate-300/40 h-full flex flex-col justify-between transition-all duration-150 ease-out">
      <div>
        <div className="flex justify-between items-center mb-4">
          <h2 className="font-bold text-[#1E293B] text-sm flex items-center gap-1.5">
            <Bell size={16} className="text-[#1A73E8]" />
            <span>Thông báo mới</span>
          </h2>
          <button 
            onClick={() => handleNav('/notifications')}
            className="text-[#1A73E8] text-xs font-bold hover:underline flex items-center gap-0.5 cursor-pointer"
          >
            <span>Tất cả</span>
            <ArrowUpRight size={12} />
          </button>
        </div>

        {recentNotifications.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-8 text-[#64748B] text-center">
            <Bell size={32} className="opacity-45 mb-2" />
            <p className="text-xs font-semibold text-[#1E293B]">Không có thông báo nào</p>
            <p className="text-[10px] text-[#64748B] mt-0.5">Bạn đã xem hết thông báo mới.</p>
          </div>
        ) : (
          <div className="space-y-2.5 max-h-[260px] overflow-y-auto scrollbar-hover pr-1">
            {recentNotifications.map((notif, i) => {
              const { icon: Icon, style } = getIconAndStyle(notif.type);
              return (
                <div 
                  key={notif.id || notif._id || i}
                  onClick={() => handleNav(notif.routeUrl || '/notifications')}
                  className={`p-3 bg-white/40 border border-white/50 rounded-xl hover:bg-white/70 hover:scale-[1.01] hover:shadow-xs transition-all duration-150 ease-out cursor-pointer flex items-start gap-3 shadow-xs ${!notif.isRead ? 'ring-1 ring-blue-500/20 bg-blue-50/10' : ''}`}
                >
                  <div className={`w-8 h-8 rounded-xl flex items-center justify-center shrink-0 border ${style}`}>
                    <Icon size={14} />
                  </div>
                  
                  <div className="min-w-0 flex-1">
                    <div className="flex items-start justify-between gap-2">
                      <p className="text-xs font-bold text-[#1E293B] leading-snug">{notif.title}</p>
                      {!notif.isRead && (
                        <span className="w-1.5 h-1.5 rounded-full bg-blue-500 shrink-0 mt-1" />
                      )}
                    </div>
                    <p className="text-[10px] text-[#64748B] font-medium mt-0.5 truncate">{notif.description}</p>
                    <p className="text-[9px] text-[#64748B] font-semibold mt-1.5">{formatTimeAgo(notif.createdAt)}</p>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      <button
        onClick={() => handleNav('/notifications')}
        className="w-full mt-4 rounded-xl border border-white/70 bg-white/40 px-4 py-2 text-xs font-bold text-[#1A73E8] hover:bg-white/70 hover:scale-[1.01] transition-all duration-150 ease-out cursor-pointer flex items-center justify-center gap-1 shadow-sm"
      >
        <span>Xem toàn bộ thông báo ({kpis.unreadNotificationsCount} chưa đọc)</span>
        <ArrowUpRight size={14} />
      </button>
    </div>
  );
}
