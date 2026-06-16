'use client';

import React, { useState, useEffect } from 'react';
import { X, Bell } from 'lucide-react';
import { NotificationItem } from '@/lib/notifications';

interface NotificationModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (data: {
    title: string;
    description: string;
    type: NotificationItem['type'];
    routeUrl?: string;
    targetRole: 'all' | 'student' | 'teacher' | 'supervisor';
  }) => Promise<void>;
  editingNotification?: NotificationItem | null;
}

const NotificationModal: React.FC<NotificationModalProps> = ({
  isOpen,
  onClose,
  onSave,
  editingNotification,
}) => {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [type, setType] = useState<NotificationItem['type']>('system');
  const [routeUrl, setRouteUrl] = useState('');
  const [targetRole, setTargetRole] = useState<'all' | 'student' | 'teacher' | 'supervisor'>('all');
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setIsSubmitting(false);
    }
    if (editingNotification) {
      setTitle(editingNotification.title);
      setDescription(editingNotification.description);
      setType(editingNotification.type);
      setRouteUrl(editingNotification.routeUrl || '');
      setTargetRole((editingNotification.targetRole as any) || 'all');
    } else {
      setTitle('');
      setDescription('');
      setType('system');
      setRouteUrl('');
      setTargetRole('all');
    }
  }, [editingNotification, isOpen]);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !description.trim() || isSubmitting) return;

    setIsSubmitting(true);
    try {
      await onSave({
        title: title.trim(),
        description: description.trim(),
        type,
        routeUrl: routeUrl.trim() || undefined,
        targetRole,
      });
      onClose();
    } catch (err) {
      console.error('Failed to save notification modal:', err);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-[999] flex items-center justify-center p-4">
      <div className="w-full max-w-lg bg-gradient-to-br from-[#EBF2FA]/92 to-[#DCE6F1]/92 backdrop-blur-md border border-white/80 rounded-2xl shadow-xl overflow-hidden animate-in fade-in zoom-in-95 duration-150 flex flex-col max-h-[95vh]">
        {/* Header */}
        <div className="px-5 py-4 border-b border-white/60 flex items-center justify-between bg-white/10 shrink-0">
          <div className="flex items-center gap-2">
            <Bell className="text-[#1A73E8] w-5 h-5" />
            <h3 className="font-bold text-base text-[#1E293B]">
              {editingNotification ? 'Cập nhật thông báo' : 'Thêm thông báo mới'}
            </h3>
          </div>
          <button 
            onClick={onClose}
            disabled={isSubmitting}
            className="p-1.5 rounded-xl text-gray-400 hover:text-[#1E293B] hover:bg-white/50 transition-all duration-150 ease-out cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
          >
            <X size={18} />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-5 flex-1 overflow-y-auto space-y-4">
          {/* Tiêu đề */}
          <div className="space-y-1">
            <label className="text-xs font-semibold text-[#64748B] block">Tiêu đề thông báo</label>
            <input 
              type="text"
              required
              disabled={isSubmitting}
              placeholder="Nhập tiêu đề thông báo..."
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="w-full rounded-xl border border-white/80 bg-white/50 backdrop-blur-sm px-3 py-2 text-sm text-[#1E293B] placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-[#1A73E8]/30 focus:border-[#1A73E8] transition-all disabled:opacity-60 disabled:cursor-not-allowed"
            />
          </div>

          {/* Loại thông báo */}
          <div className="space-y-1">
            <label className="text-xs font-semibold text-[#64748B] block">Loại thông báo</label>
            <select
              value={type}
              disabled={isSubmitting}
              onChange={(e) => setType(e.target.value as NotificationItem['type'])}
              className="w-full rounded-xl border border-white/80 bg-white/50 backdrop-blur-sm px-3 py-2 text-sm text-[#1E293B] focus:outline-none focus:ring-2 focus:ring-[#1A73E8]/30 focus:border-[#1A73E8] transition-all disabled:opacity-60 disabled:cursor-not-allowed"
            >
              <option value="system" className="bg-[#EBF2FA]">Hệ thống (System)</option>
              <option value="info" className="bg-[#EBF2FA]">Nhiệm vụ & Công việc (Info)</option>
              <option value="success" className="bg-[#EBF2FA]">Khen thưởng & Điểm số (Success)</option>
              <option value="warning" className="bg-[#EBF2FA]">Cảnh báo chuyên cần (Warning)</option>
            </select>
          </div>

          {/* Đối tượng nhận */}
          <div className="space-y-1">
            <label className="text-xs font-semibold text-[#64748B] block">Đối tượng nhận</label>
            <select
              value={targetRole}
              disabled={isSubmitting}
              onChange={(e) => setTargetRole(e.target.value as any)}
              className="w-full rounded-xl border border-white/80 bg-white/50 backdrop-blur-sm px-3 py-2 text-sm text-[#1E293B] focus:outline-none focus:ring-2 focus:ring-[#1A73E8]/30 focus:border-[#1A73E8] transition-all disabled:opacity-60 disabled:cursor-not-allowed"
            >
              <option value="all" className="bg-[#EBF2FA]">Tất cả đối tượng (All)</option>
              <option value="student" className="bg-[#EBF2FA]">Học sinh - Sinh viên (Student)</option>
              <option value="teacher" className="bg-[#EBF2FA]">Cố vấn - Giảng viên (Teacher)</option>
              <option value="supervisor" className="bg-[#EBF2FA]">Quản sinh (Supervisor)</option>
            </select>
          </div>

          {/* Nội dung mô tả */}
          <div className="space-y-1">
            <label className="text-xs font-semibold text-[#64748B] block">Nội dung chi tiết</label>
            <textarea 
              required
              rows={4}
              disabled={isSubmitting}
              placeholder="Nhập mô tả nội dung thông báo..."
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="w-full rounded-xl border border-white/80 bg-white/50 backdrop-blur-sm px-3 py-2 text-sm text-[#1E293B] placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-[#1A73E8]/30 focus:border-[#1A73E8] transition-all resize-none disabled:opacity-60 disabled:cursor-not-allowed"
            />
          </div>

          {/* Đường dẫn liên kết */}
          <div className="space-y-1">
            <label className="text-xs font-semibold text-[#64748B] block">Đường dẫn liên kết (Tùy chọn)</label>
            <input 
              type="text"
              disabled={isSubmitting}
              placeholder="Ví dụ: /students/record, /students/tasks"
              value={routeUrl}
              onChange={(e) => setRouteUrl(e.target.value)}
              className="w-full rounded-xl border border-white/80 bg-white/50 backdrop-blur-sm px-3 py-2 text-sm text-[#1E293B] placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-[#1A73E8]/30 focus:border-[#1A73E8] transition-all disabled:opacity-60 disabled:cursor-not-allowed"
            />
          </div>

          {/* Action Buttons */}
          <div className="pt-4 flex items-center justify-end gap-3 border-t border-white/60 bg-white/10 -mx-5 -mb-5 p-5">
            <button
              type="button"
              onClick={onClose}
              disabled={isSubmitting}
              className="px-4 py-2 rounded-xl text-sm font-semibold text-[#64748B] hover:bg-white/50 active:scale-[0.99] transition-all duration-150 ease-out hover:scale-[1.01] disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
            >
              Hủy bỏ
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className={`px-5 py-2 rounded-xl text-sm font-semibold text-white bg-[#1A73E8] hover:bg-[#155cb4] active:scale-[0.99] transition-all duration-150 ease-out hover:scale-[1.01] shadow-sm shadow-blue-500/10 ${isSubmitting ? 'opacity-70 cursor-not-allowed' : 'cursor-pointer'}`}
            >
              {isSubmitting ? 'Đang lưu...' : 'Lưu thay đổi'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default NotificationModal;
