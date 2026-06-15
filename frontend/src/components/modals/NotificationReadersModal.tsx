'use client';

import React, { useState, useEffect } from 'react';
import { X, Users, Mail, ShieldAlert } from 'lucide-react';
import { notificationApi } from '@/api/notification-api';

interface ReaderInfo {
  id: string;
  user_name: string;
  email: string;
  roleName: string;
}

interface NotificationReadersModalProps {
  isOpen: boolean;
  onClose: () => void;
  notificationId: string | null;
  notificationTitle?: string;
}

const NotificationReadersModal: React.FC<NotificationReadersModalProps> = ({
  isOpen,
  onClose,
  notificationId,
  notificationTitle,
}) => {
  const [readers, setReaders] = useState<ReaderInfo[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen && notificationId) {
      const fetchReaders = async () => {
        setIsLoading(true);
        setError(null);
        try {
          const data = await notificationApi.getNotificationReaders(notificationId);
          setReaders(data);
        } catch (err: any) {
          console.error(err);
          setError(err.message || 'Không thể tải danh sách người đã xem.');
        } finally {
          setIsLoading(false);
        }
      };

      fetchReaders();
    } else {
      setReaders([]);
    }
  }, [isOpen, notificationId]);

  if (!isOpen) return null;

  const getInitials = (name: string) => {
    if (!name || typeof name !== 'string') return '??';
    return name
      .split(' ')
      .map((n) => n[0])
      .join('')
      .toUpperCase()
      .substring(0, 2);
  };

  return (
    <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-[999] flex items-center justify-center p-4">
      <div className="w-full max-w-2xl bg-white/45 backdrop-blur-md border border-white/70 rounded-2xl shadow-xl overflow-hidden animate-in fade-in zoom-in-95 duration-150 flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="px-5 py-4 border-b border-white/60 flex items-center justify-between bg-white/20 shrink-0">
          <div className="flex items-center gap-2">
            <Users className="text-[#1A73E8] w-5 h-5" />
            <div>
              <h3 className="font-bold text-base text-[#1E293B]">
                Danh sách người đã xem
              </h3>
              {notificationTitle && (
                <p className="text-xs text-[#64748B] mt-0.5 truncate max-w-[400px]">
                  Thông báo: "{notificationTitle}"
                </p>
              )}
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-xl text-gray-400 hover:text-[#1E293B] hover:bg-white/50 transition-all duration-150 ease-out cursor-pointer"
          >
            <X size={18} />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-5 min-h-[300px] flex flex-col">
          {isLoading ? (
            <div className="flex-1 flex flex-col items-center justify-center py-12">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#1A73E8] mb-3" />
              <p className="text-xs text-[#64748B]">Đang tải danh sách người xem...</p>
            </div>
          ) : error ? (
            <div className="flex-1 flex flex-col items-center justify-center text-center p-6 text-red-500 py-12">
              <ShieldAlert size={36} className="mb-2" />
              <p className="text-sm font-semibold">{error}</p>
            </div>
          ) : readers.length > 0 ? (
            <div className="border border-white/60 rounded-xl overflow-hidden bg-white/40 backdrop-blur-xs">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-white/20 border-b border-white/60">
                    <th className="px-4 py-2.5 text-xs font-bold text-[#64748B] tracking-wide">Người dùng</th>
                    <th className="px-4 py-2.5 text-xs font-bold text-[#64748B] tracking-wide">Email</th>
                    <th className="px-4 py-2.5 text-xs font-bold text-[#64748B] tracking-wide">Vai trò</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/40">
                  {readers.map((reader) => (
                    <tr key={reader.id} className="hover:bg-white/60 transition-colors duration-150">
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-full bg-blue-500/10 flex items-center justify-center text-[#1A73E8] font-bold text-xs">
                            {getInitials(reader.user_name)}
                          </div>
                          <span className="text-sm font-semibold text-[#1E293B]">
                            {reader.user_name}
                          </span>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-1.5 text-xs text-[#64748B]">
                          <Mail size={12} className="text-slate-400" />
                          <span>{reader.email}</span>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <span className={`inline-flex items-center px-2 py-0.5 rounded-xl text-[10px] font-bold ${
                          reader.roleName === 'Admin' 
                            ? 'bg-rose-500/10 text-rose-700 border border-rose-500/20' 
                            : reader.roleName === 'Teacher' || reader.roleName === 'Giáo viên'
                              ? 'bg-amber-500/10 text-amber-700 border border-amber-500/20'
                              : 'bg-blue-500/10 text-[#1A73E8] border border-blue-500/20'
                        }`}>
                          {reader.roleName}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="flex-1 flex flex-col items-center justify-center text-center p-6 py-12">
              <Users size={36} className="text-slate-300 mb-2" />
              <p className="text-sm font-semibold text-gray-500">Chưa có người xem nào</p>
              <p className="text-xs text-gray-400 mt-1">
                Thông báo này chưa được người dùng nào đánh dấu là đã đọc.
              </p>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-5 py-3 border-t border-white/60 bg-white/20 flex items-center justify-end shrink-0">
          <button
            onClick={onClose}
            className="px-5 py-2 bg-white/50 border border-white/80 hover:bg-white/80 hover:scale-[1.01] active:scale-[0.99] text-slate-700 font-semibold rounded-xl text-sm transition-all duration-150 ease-out cursor-pointer shadow-sm shadow-slate-300/10"
          >
            Đóng
          </button>
        </div>
      </div>
    </div>
  );
};

export default NotificationReadersModal;
