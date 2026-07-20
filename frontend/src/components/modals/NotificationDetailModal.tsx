'use client';

import { X, ExternalLink } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { vi } from 'date-fns/locale';
import NotificationDestination from '@/components/notifications/NotificationDestination';

export interface NotificationDetailItem {
  title: string;
  description: string;
  type?: string;
  createdAt?: string;
  routeUrl?: string;
}

interface NotificationDetailModalProps {
  isOpen: boolean;
  notification: NotificationDetailItem | null;
  onClose: () => void;
  onNavigate?: (routeUrl: string) => void;
}

export default function NotificationDetailModal({ isOpen, notification, onClose, onNavigate }: NotificationDetailModalProps) {
  if (!isOpen || !notification) return null;
  const destination = notification.routeUrl?.trim();
  const time = notification.createdAt
    ? formatDistanceToNow(new Date(notification.createdAt), { addSuffix: true, locale: vi })
    : 'Vừa xong';

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center bg-slate-900/30 p-4" role="presentation" onMouseDown={onClose}>
      <div role="dialog" aria-modal="true" aria-labelledby="notification-detail-title" className="w-full max-w-lg rounded-2xl border border-white/80 bg-white p-5 shadow-2xl" onMouseDown={(event) => event.stopPropagation()}>
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-wider text-[#64748B]">Chi tiết thông báo</p>
            <h2 id="notification-detail-title" className="mt-1 text-lg font-bold text-[#1E293B]">{notification.title}</h2>
          </div>
          <button type="button" aria-label="Đóng" onClick={onClose} className="rounded-lg p-1.5 text-slate-500 hover:bg-slate-100"><X size={18} /></button>
        </div>
        <p className="mt-4 whitespace-pre-wrap text-sm leading-6 text-[#515F72]">{notification.description}</p>
        <div className="mt-5 flex flex-wrap items-center gap-2 border-t border-slate-100 pt-4">
          <span className="rounded-full border border-slate-200 bg-slate-100 px-2 py-0.5 text-[10px] font-semibold text-slate-600">Loại: {notification.type || 'system'}</span>
          <span className="text-[10px] font-semibold text-slate-500">{time}</span>
          {destination && <NotificationDestination routeUrl={destination} />}
        </div>
        {destination && (
          <button type="button" onClick={() => onNavigate?.(destination)} className="mt-5 inline-flex items-center gap-1.5 rounded-xl bg-[#1A73E8] px-3.5 py-2 text-xs font-bold text-white hover:bg-[#155cb4]">
            <ExternalLink size={13} /> Đi tới trang liên kết
          </button>
        )}
      </div>
    </div>
  );
}
