'use client';

import React, { useState } from 'react';
import { Calendar, MapPin, Users } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';

interface ActivityScheduleTimelineProps {
  schedules: any[];
  onRegister?: (scheduleId: string) => Promise<void>;
  onCancelRegistration?: (scheduleId: string) => Promise<void>;
  onOpenAttendance?: () => void;
  isAdminOrAdvisor?: boolean;
  isStudent?: boolean;
  loading?: boolean;
}

export default function ActivityScheduleTimeline({
  schedules,
  onRegister,
  onCancelRegistration,
  onOpenAttendance,
  isAdminOrAdvisor = false,
  isStudent = false,
  loading = false,
}: ActivityScheduleTimelineProps) {
  const [actionLoadingId, setActionLoadingId] = useState<string | null>(null);

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

  // Sorting logic: is_today first; then start_time asc; then _id asc
  const sortedSchedules = [...schedules].sort((a, b) => {
    const isTodayA = a.is_today === true;
    const isTodayB = b.is_today === true;
    if (isTodayA && !isTodayB) return -1;
    if (!isTodayA && isTodayB) return 1;

    const timeA = a.start_time ? new Date(a.start_time).getTime() : 0;
    const timeB = b.start_time ? new Date(b.start_time).getTime() : 0;
    if (timeA !== timeB) {
      return timeA - timeB;
    }
    return (a._id || '').localeCompare(b._id || '');
  });

  return (
    <div className="space-y-6">
      {/* Timeline list */}
      {sortedSchedules.length === 0 ? (
        <div className="py-12 text-center bg-white/40 border border-slate-100 rounded-2xl">
          <Calendar size={36} className="text-slate-300 mx-auto mb-2" />
          <p className="text-sm font-semibold text-slate-500">Chưa có lịch sinh hoạt nào được lên kế hoạch</p>
        </div>
      ) : (
        <div className="relative border-l-2 border-blue-100 ml-6 pl-6 space-y-8 py-2">
          {sortedSchedules.map((schedule) => {
            const dateInfo = formatDate(schedule.start_time);
            const endDateInfo = formatDate(schedule.end_time);
            const isActionLoading = actionLoadingId === schedule._id;
            const regCount = schedule.registration_count || 0;
            const maxAtt = schedule.max_attendees || 0;
            const isFull = maxAtt > 0 && regCount >= maxAtt;
            const isRegistered = schedule.is_registered || (schedule.my_attendance !== null && schedule.my_attendance !== undefined);
            const myAtt = schedule.my_attendance;
            const isToday = schedule.is_today === true;

            // Fading logic for past schedule: strictly earlier than now and not today
            const isPast = !isToday && schedule.end_time && new Date(schedule.end_time).getTime() < Date.now();

            return (
              <div key={schedule._id} className="relative group">
                {/* Timeline node icon */}
                <div className="absolute -left-[35px] top-1.5 w-4 h-4 rounded-full bg-blue-500 border-4 border-white shadow-sm ring-2 ring-blue-100 group-hover:scale-110 transition-transform duration-200" />

                <div
                  className={`p-4 rounded-2xl border transition-all duration-200 flex flex-col sm:flex-row gap-4 justify-between items-start sm:items-center ${
                    isToday
                      ? 'border-blue-500 bg-blue-50/50 hover:bg-blue-50/60 shadow-sm'
                      : isPast
                      ? 'border-white/60 bg-white/50 hover:bg-white/75 opacity-60'
                      : 'border-white/60 bg-white/50 hover:bg-white/75'
                  }`}
                >
                  <div className="space-y-2 flex-1">
                    {/* Date badge & Title */}
                    <div className="flex flex-wrap items-center gap-2">
                      {isToday && (
                        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-lg bg-blue-500/10 text-blue-600 text-[10px] font-bold">
                          Hôm nay
                        </span>
                      )}
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
                    {isStudent && (
                      <div className="mt-2.5 flex items-center gap-1.5">
                        <span className="text-[11px] font-bold text-slate-400">Trạng thái điểm danh:</span>
                        <span
                          className={`px-2 py-0.5 rounded-lg border text-[10px] font-bold ${
                            myAtt?.status === 'present'
                              ? 'bg-emerald-100/60 text-emerald-600 border-emerald-200'
                              : myAtt?.status === 'late'
                              ? 'bg-amber-100/60 text-amber-600 border-amber-200'
                              : myAtt?.status === 'absent'
                              ? 'bg-red-100/60 text-red-600 border-red-200'
                              : myAtt?.status === 'excused'
                              ? 'bg-blue-100/60 text-blue-600 border-blue-200'
                              : 'bg-slate-100 text-slate-500 border-slate-200'
                          }`}
                        >
                          {myAtt?.status === 'present'
                            ? 'Có mặt'
                            : myAtt?.status === 'late'
                            ? 'Đi trễ'
                            : myAtt?.status === 'absent'
                            ? 'Vắng'
                            : myAtt?.status === 'excused'
                            ? 'Nghỉ phép'
                            : 'Chưa điểm danh'}
                        </span>
                      </div>
                    )}

                    {/* Admin/Advisor Attendance statistics */}
                    {isAdminOrAdvisor && (
                      <div className="mt-2.5 flex items-center gap-1.5">
                        <span className="text-[11px] font-bold text-slate-555">
                          Đã điểm danh: {schedule.attendance_records ? schedule.attendance_records.length : 0}
                        </span>
                      </div>
                    )}
                  </div>

                  {/* Actions right side */}
                  <div className="flex items-center gap-2 self-end sm:self-center shrink-0">
                    {/* Attendance Button for Today schedules only */}
                    {isToday && onOpenAttendance && (isStudent || isAdminOrAdvisor) && (
                      <Button
                        onClick={onOpenAttendance}
                        className="h-8 px-3 text-xs bg-blue-500 text-white rounded-xl hover:bg-blue-600 cursor-pointer"
                      >
                        Điểm danh
                      </Button>
                    )}

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
