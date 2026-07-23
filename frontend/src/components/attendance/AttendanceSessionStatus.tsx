'use client';

import React from 'react';
import { QrCode, MapPin, Clock, XCircle } from 'lucide-react';

interface AttendanceSessionStatusProps {
  status: 'active' | 'closed' | 'expired' | null;
  method?: 'qr' | 'proximity' | 'manual' | 'manual_class';
  checkinCount?: number;
  openedAt?: string;
  compact?: boolean;
}

const statusConfig = {
  active: {
    label: 'Đang mở',
    bg: 'bg-emerald-50',
    text: 'text-emerald-700',
    border: 'border-emerald-200',
    dot: 'bg-emerald-500',
    animate: true,
  },
  closed: {
    label: 'Đã đóng',
    bg: 'bg-gray-50',
    text: 'text-gray-500',
    border: 'border-gray-200',
    dot: 'bg-gray-400',
    animate: false,
  },
  expired: {
    label: 'Hết hạn',
    bg: 'bg-amber-50',
    text: 'text-amber-600',
    border: 'border-amber-200',
    dot: 'bg-amber-500',
    animate: false,
  },
};

const methodIcons = {
  qr: QrCode,
  proximity: MapPin,
  manual: Clock,
};

const methodLabels = {
  qr: 'QR Code',
  proximity: 'Phạm vi',
  manual: 'Thủ công',
};

export default function AttendanceSessionStatus({
  status,
  method,
  checkinCount,
  openedAt,
  compact = false,
}: AttendanceSessionStatusProps) {
  if (!status) return null;

  const config = statusConfig[status];
  const MethodIcon = method ? methodIcons[method] : null;

  if (compact) {
    return (
      <span
        className={`
          inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium
          ${config.bg} ${config.text} border ${config.border}
        `}
      >
        <span
          className={`w-1.5 h-1.5 rounded-full ${config.dot} ${config.animate ? 'animate-pulse' : ''}`}
        />
        {config.label}
        {method && (
          <>
            <span className="w-px h-3 bg-current opacity-20" />
            {methodLabels[method]}
          </>
        )}
      </span>
    );
  }

  return (
    <div className={`flex items-center gap-3 px-4 py-3 rounded-xl border ${config.bg} ${config.border}`}>
      {/* Status dot + icon */}
      <div className="flex items-center gap-2">
        <span
          className={`w-2 h-2 rounded-full ${config.dot} ${config.animate ? 'animate-pulse' : ''}`}
        />
        {MethodIcon && <MethodIcon className={`w-4 h-4 ${config.text}`} />}
      </div>

      {/* Info */}
      <div className="flex-1 min-w-0">
        <div className={`text-sm font-medium ${config.text}`}>
          {config.label}
          {method && ` • ${methodLabels[method]}`}
        </div>
        {openedAt && (
          <div className="text-xs text-gray-400 mt-0.5">
            {new Date(openedAt).toLocaleString('vi-VN', {
              hour: '2-digit',
              minute: '2-digit',
              day: '2-digit',
              month: '2-digit',
            })}
          </div>
        )}
      </div>

      {/* Checkin count */}
      {checkinCount != null && (
        <div className="text-right">
          <div className="text-lg font-bold text-gray-700">{checkinCount}</div>
          <div className="text-xs text-gray-400">đã ĐD</div>
        </div>
      )}
    </div>
  );
}
