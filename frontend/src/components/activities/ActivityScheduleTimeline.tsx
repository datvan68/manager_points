'use client';

import React, { useState } from 'react';
import { ActivitySchedule } from '@/api/activity-api';
import { Calendar, MapPin, Users, Clock, Plus, Trash2, CheckCircle2, AlertCircle, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';

interface ActivityScheduleTimelineProps {
  schedules: any[];
  onRegister?: (scheduleId: string) => Promise<void>;
  onCancelRegistration?: (scheduleId: string) => Promise<void>;
  onOpenAttendance?: () => void;
  onCreateSchedule?: (data: any) => Promise<void>;
  onDeleteSchedule?: (scheduleId: string) => Promise<void>;
  isAdminOrAdvisor?: boolean;
  isStudent?: boolean;
  loading?: boolean;
}

export default function ActivityScheduleTimeline({
  schedules,
  onRegister,
  onCancelRegistration,
  onOpenAttendance,
  onCreateSchedule,
  onDeleteSchedule,
  isAdminOrAdvisor = false,
  isStudent = false,
  loading = false,
}: ActivityScheduleTimelineProps) {
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [actionLoadingId, setActionLoadingId] = useState<string | null>(null);

  // Form states for new schedule
  const [newSchedule, setNewSchedule] = useState({
    title: '',
    description: '',
    location: '',
    start_time: '',
    end_time: '',
    max_attendees: '',
  });

  const handleCreateSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newSchedule.title || !newSchedule.start_time || !newSchedule.end_time || !newSchedule.location) {
      toast.error('Vui lòng điền đầy đủ các thông tin bắt buộc');
      return;
    }
    if (new Date(newSchedule.start_time) >= new Date(newSchedule.end_time)) {
      toast.error('Thời gian bắt đầu phải trước thời gian kết thúc');
      return;
    }

    setSubmitting(true);
    try {
      if (onCreateSchedule) {
        await onCreateSchedule({
          ...newSchedule,
          max_attendees: newSchedule.max_attendees ? Number(newSchedule.max_attendees) : undefined,
        });
        toast.success('Tạo lịch hoạt động thành công');
        setShowCreateForm(false);
        setNewSchedule({
          title: '',
          description: '',
          location: '',
          start_time: '',
          end_time: '',
          max_attendees: '',
        });
      }
    } catch {
      toast.error('Lỗi khi tạo lịch hoạt động');
    } finally {
      setSubmitting(false);
    }
  };

  const handleRegisterClick = async (scheduleId: string) => {
    setActionLoadingId(scheduleId);
    try {
      if (onRegister) {
        await onRegister(scheduleId);
        toast.success('Đăng ký tham gia thành công');
      }
    } catch {
      toast.error('Lỗi khi đăng ký tham gia');
    } finally {
      setActionLoadingId(null);
    }
  };

  const handleCancelRegisterClick = async (scheduleId: string) => {
    if (!confirm('Bạn có chắc chắn muốn hủy đăng ký tham gia buổi sinh hoạt này?')) return;
    setActionLoadingId(scheduleId);
    try {
      if (onCancelRegistration) {
        await onCancelRegistration(scheduleId);
        toast.success('Đã hủy đăng ký tham gia');
      }
    } catch {
      toast.error('Lỗi khi hủy đăng ký');
    } finally {
      setActionLoadingId(null);
    }
  };

  const handleDeleteClick = async (scheduleId: string) => {
    if (!confirm('Bạn có chắc chắn muốn xóa lịch sinh hoạt này? Hành động này không thể hoàn tác.')) return;
    setActionLoadingId(scheduleId);
    try {
      if (onDeleteSchedule) {
        await onDeleteSchedule(scheduleId);
        toast.success('Đã xóa lịch sinh hoạt');
      }
    } catch {
      toast.error('Lỗi khi xóa lịch sinh hoạt');
    } finally {
      setActionLoadingId(null);
    }
  };

  const formatDate = (dateStr: string) => {
    const d = new Date(dateStr);
    return {
      day: d.getDate(),
      month: `TH${d.getMonth() + 1}`,
      year: d.getFullYear(),
      time: d.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' }),
      dateLabel: d.toLocaleDateString('vi-VN', { weekday: 'long', day: '2-digit', month: '2-digit' }),
    };
  };

  if (loading) {
    return (
      <div className="space-y-4 py-4">
        {[...Array(2)].map((_, i) => (
          <div key={i} className="flex gap-4 animate-pulse">
            <div className="w-12 h-12 bg-slate-100 rounded-xl" />
            <div className="flex-1 h-24 bg-slate-100 rounded-2xl" />
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header action */}
      {isAdminOrAdvisor && (
        <div className="flex justify-end">
          {!showCreateForm ? (
            <Button
              onClick={() => setShowCreateForm(true)}
              className="flex items-center gap-1.5 px-4 py-2 bg-blue-500 text-white rounded-xl hover:bg-blue-600 shadow-md shadow-blue-500/10 cursor-pointer"
            >
              <Plus size={16} />
              Tạo lịch mới
            </Button>
          ) : (
            <Button
              variant="outline"
              onClick={() => setShowCreateForm(false)}
              className="flex items-center gap-1.5 px-4 py-2 border-slate-200 hover:bg-slate-50 rounded-xl cursor-pointer"
            >
              <X size={16} />
              Đóng form
            </Button>
          )}
        </div>
      )}

      {/* Create form */}
      {showCreateForm && (
        <form
          onSubmit={handleCreateSubmit}
          className="bg-white/60 backdrop-blur-md border border-white/70 p-5 rounded-2xl shadow-sm space-y-4 animate-in slide-in-from-top duration-200"
        >
          <h3 className="text-sm font-bold text-slate-800 uppercase tracking-wider mb-2 flex items-center gap-1.5">
            <Calendar className="text-blue-500" size={18} />
            Tạo buổi sinh hoạt mới
          </h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="sm:col-span-2">
              <label className="text-[12px] font-bold text-slate-700 block mb-1">Tiêu đề buổi <span className="text-red-500">*</span></label>
              <input
                type="text"
                value={newSchedule.title}
                onChange={(e) => setNewSchedule(prev => ({ ...prev, title: e.target.value }))}
                placeholder="Ví dụ: Sinh hoạt định kỳ tuần 12"
                className="w-full h-9 px-3 text-xs rounded-xl border border-slate-200 bg-white/50 focus:outline-none"
                required
              />
            </div>
            <div className="sm:col-span-2">
              <label className="text-[12px] font-bold text-slate-700 block mb-1">Mô tả nội dung</label>
              <textarea
                value={newSchedule.description}
                onChange={(e) => setNewSchedule(prev => ({ ...prev, description: e.target.value }))}
                placeholder="Nội dung sinh hoạt, chuẩn bị..."
                className="w-full p-2.5 text-xs rounded-xl border border-slate-200 bg-white/50 focus:outline-none resize-none"
                rows={2}
              />
            </div>
            <div>
              <label className="text-[12px] font-bold text-slate-700 block mb-1">Địa điểm <span className="text-red-500">*</span></label>
              <input
                type="text"
                value={newSchedule.location}
                onChange={(e) => setNewSchedule(prev => ({ ...prev, location: e.target.value }))}
                placeholder="Ví dụ: Phòng máy B.202"
                className="w-full h-9 px-3 text-xs rounded-xl border border-slate-200 bg-white/50 focus:outline-none"
                required
              />
            </div>
            <div>
              <label className="text-[12px] font-bold text-slate-700 block mb-1">Giới hạn người tham gia</label>
              <input
                type="number"
                value={newSchedule.max_attendees}
                onChange={(e) => setNewSchedule(prev => ({ ...prev, max_attendees: e.target.value }))}
                placeholder="Không giới hạn"
                className="w-full h-9 px-3 text-xs rounded-xl border border-slate-200 bg-white/50 focus:outline-none"
              />
            </div>
            <div>
              <label className="text-[12px] font-bold text-slate-700 block mb-1">Thời gian bắt đầu <span className="text-red-500">*</span></label>
              <input
                type="datetime-local"
                value={newSchedule.start_time}
                onChange={(e) => setNewSchedule(prev => ({ ...prev, start_time: e.target.value }))}
                className="w-full h-9 px-3 text-xs rounded-xl border border-slate-200 bg-white/50 focus:outline-none"
                required
              />
            </div>
            <div>
              <label className="text-[12px] font-bold text-slate-700 block mb-1">Thời gian kết thúc <span className="text-red-500">*</span></label>
              <input
                type="datetime-local"
                value={newSchedule.end_time}
                onChange={(e) => setNewSchedule(prev => ({ ...prev, end_time: e.target.value }))}
                className="w-full h-9 px-3 text-xs rounded-xl border border-slate-200 bg-white/50 focus:outline-none"
                required
              />
            </div>
          </div>
          <div className="flex justify-end gap-2 pt-2 border-t border-slate-100/60">
            <Button
              type="button"
              variant="outline"
              onClick={() => setShowCreateForm(false)}
              className="h-9 px-3 text-xs rounded-xl cursor-pointer"
              disabled={submitting}
            >
              Hủy
            </Button>
            <Button
              type="submit"
              className="h-9 px-4 text-xs bg-blue-500 text-white rounded-xl hover:bg-blue-600 cursor-pointer"
              disabled={submitting}
            >
              Tạo buổi
            </Button>
          </div>
        </form>
      )}

      {/* Timeline list */}
      {schedules.length === 0 ? (
        <div className="py-12 text-center bg-white/40 border border-slate-100 rounded-2xl">
          <Calendar size={36} className="text-slate-300 mx-auto mb-2" />
          <p className="text-sm font-semibold text-slate-500">Chưa có lịch sinh hoạt nào được lên kế hoạch</p>
        </div>
      ) : (
        <div className="relative border-l-2 border-blue-100 ml-6 pl-6 space-y-8 py-2">
          {schedules.map((schedule) => {
            const dateInfo = formatDate(schedule.start_time);
            const endDateInfo = formatDate(schedule.end_time);
            const isActionLoading = actionLoadingId === schedule._id;
            const regCount = schedule.registration_count || 0;
            const maxAtt = schedule.max_attendees || 0;
            const isFull = maxAtt > 0 && regCount >= maxAtt;
            const isRegistered = schedule.is_registered || (schedule.my_attendance !== null && schedule.my_attendance !== undefined);
            const myAtt = schedule.my_attendance;

            return (
              <div key={schedule._id} className="relative group">
                {/* Timeline node icon */}
                <div className="absolute -left-[35px] top-1.5 w-4 h-4 rounded-full bg-blue-500 border-4 border-white shadow-sm ring-2 ring-blue-100 group-hover:scale-110 transition-transform duration-200" />

                <div className="bg-white/50 backdrop-blur-md border border-white/60 p-4 rounded-2xl hover:bg-white/75 hover:shadow-sm transition-all duration-200 flex flex-col sm:flex-row gap-4 justify-between items-start sm:items-center">
                  <div className="space-y-2 flex-1">
                    {/* Date badge & Title */}
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-lg bg-blue-500/10 text-blue-600 text-[10px] font-bold">
                        {dateInfo.dateLabel}
                      </span>
                      <span className="text-[11px] font-bold text-slate-400">
                        {dateInfo.time} - {endDateInfo.time}
                      </span>
                    </div>

                    <h4 className="text-sm font-bold text-slate-700">{schedule.title}</h4>
                    {schedule.description && (
                      <p className="text-xs text-slate-400 font-semibold">{schedule.description}</p>
                    )}

                    {/* Metadata details */}
                    <div className="flex flex-wrap gap-x-4 gap-y-1.5 pt-1 text-[11px] text-slate-500 font-semibold">
                      <div className="flex items-center gap-1">
                        <MapPin size={12} className="text-slate-400" />
                        <span>{schedule.location || 'Chưa có địa điểm'}</span>
                      </div>
                      {maxAtt > 0 && (
                        <div className="flex items-center gap-1">
                          <Users size={12} className="text-slate-400" />
                          <span>Đăng ký: {regCount}/{maxAtt} {isFull && <span className="text-red-500 font-bold">(Đầy)</span>}</span>
                        </div>
                      )}
                    </div>

                    {/* Student Attendance display */}
                    {isStudent && myAtt && (
                      <div className="mt-2.5 flex items-center gap-1.5">
                        <span className="text-[11px] font-bold text-slate-400">Trạng thái điểm danh:</span>
                        <span
                          className={`px-2 py-0.5 rounded-lg border text-[10px] font-bold ${
                            myAtt.status === 'present'
                              ? 'bg-emerald-100/60 text-emerald-600 border-emerald-200'
                              : myAtt.status === 'late'
                              ? 'bg-amber-100/60 text-amber-600 border-amber-200'
                              : myAtt.status === 'absent'
                              ? 'bg-red-100/60 text-red-600 border-red-200'
                              : 'bg-slate-100 text-slate-500 border-slate-200'
                          }`}
                        >
                          {myAtt.status === 'present'
                            ? 'Có mặt'
                            : myAtt.status === 'late'
                            ? 'Đi trễ'
                            : myAtt.status === 'absent'
                            ? 'Vắng'
                            : myAtt.status === 'excused'
                            ? 'Nghỉ phép'
                            : myAtt.status}
                        </span>
                      </div>
                    )}
                  </div>

                  {/* Actions right side */}
                  <div className="flex items-center gap-2 self-end sm:self-center shrink-0">
                    {isStudent && (
                      <>
                        {isRegistered ? (
                          <Button
                            variant="outline"
                            onClick={() => onCancelRegistration && handleCancelRegisterClick(schedule._id)}
                            className="h-8 px-3 text-xs text-rose-600 border-rose-200 hover:bg-rose-50 rounded-xl cursor-pointer"
                            disabled={isActionLoading}
                          >
                            Hủy đăng ký
                          </Button>
                        ) : (
                          <Button
                            onClick={() => onRegister && handleRegisterClick(schedule._id)}
                            className={`h-8 px-3 text-xs text-white rounded-xl shadow-sm cursor-pointer ${
                              isFull
                                ? 'bg-slate-300 hover:bg-slate-300 cursor-not-allowed shadow-none'
                                : 'bg-gradient-to-r from-blue-500 to-indigo-600 hover:from-blue-600 hover:to-indigo-750'
                            }`}
                            disabled={isFull || isActionLoading}
                          >
                            Đăng ký tham gia
                          </Button>
                        )}
                      </>
                    )}

                    {isAdminOrAdvisor && (
                      <Button
                        variant="outline"
                        onClick={() => handleDeleteClick(schedule._id)}
                        className="h-8 w-8 p-0 text-slate-400 hover:text-rose-600 hover:border-rose-200 rounded-xl cursor-pointer"
                        disabled={isActionLoading}
                        title="Xóa lịch hoạt động"
                      >
                        <Trash2 size={14} />
                      </Button>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
