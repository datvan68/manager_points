'use client';

import React, { useState } from 'react';
import { Calendar, MapPin, Users, ChevronDown, ChevronUp, Clock, User } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';

interface ActivityScheduleTimelineProps {
  schedules: any[];
  onRegister?: (scheduleId: string) => Promise<void>;
  onCancelRegistration?: (scheduleId: string) => Promise<void>;
  onOpenAttendance?: () => void;
  isAdminOrAdvisor?: boolean;
  isStudent?: boolean;
  canViewAttendanceRoster?: boolean;
  canViewOwnAttendance?: boolean;
  loading?: boolean;
}

const attStatusConfig: Record<string, { label: string; bg: string; text: string; border: string }> = {
  present: {
    label: 'Có mặt',
    bg: 'bg-emerald-100/60',
    text: 'text-emerald-600',
    border: 'border-emerald-200',
  },
  late: {
    label: 'Đi trễ',
    bg: 'bg-amber-100/60',
    text: 'text-amber-600',
    border: 'border-amber-200',
  },
  absent: {
    label: 'Vắng',
    bg: 'bg-red-100/60',
    text: 'text-red-600',
    border: 'border-red-200',
  },
  excused: {
    label: 'Nghỉ phép',
    bg: 'bg-blue-100/60',
    text: 'text-blue-600',
    border: 'border-blue-200',
  },
};

const approvalStatusConfig: Record<string, { label: string; bg: string; text: string }> = {
  pending: {
    label: 'Chờ duyệt',
    bg: 'bg-amber-100/80',
    text: 'text-amber-800',
  },
  approved: {
    label: 'Đã duyệt',
    bg: 'bg-emerald-100/80',
    text: 'text-emerald-800',
  },
  rejected: {
    label: 'Bị từ chối',
    bg: 'bg-red-100/80',
    text: 'text-red-800',
  },
};

export default function ActivityScheduleTimeline({
  schedules,
  onRegister,
  onCancelRegistration,
  onOpenAttendance,
  isAdminOrAdvisor = false,
  isStudent = false,
  canViewAttendanceRoster,
  canViewOwnAttendance,
  loading = false,
}: ActivityScheduleTimelineProps) {
  const [actionLoadingId, setActionLoadingId] = useState<string | null>(null);
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});

  const toggleExpand = (id: string) => {
    setExpanded((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  const showRoster = canViewAttendanceRoster !== undefined ? canViewAttendanceRoster : isAdminOrAdvisor;
  const showOwnStatus = canViewOwnAttendance !== undefined ? canViewOwnAttendance : isStudent;

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
            const isPast = !isToday && schedule.end_time && new Date(schedule.end_time).getTime() < Date.now();

            return (
              <div key={schedule._id} className="relative group">
                <div className={`absolute -left-[35px] top-1.5 w-4 h-4 rounded-full border-4 border-white shadow-sm transition-all duration-300 group-hover:scale-110 ${isToday ? 'bg-indigo-600 ring-2 ring-indigo-400/50 scale-110 z-10' : 'bg-blue-500 ring-2 ring-blue-100'}`}>
                  {isToday && (
                    <span className="absolute -inset-1 rounded-full bg-indigo-500/40 animate-ping -z-10" />
                  )}
                </div>
                <div className={`p-4 rounded-2xl border transition-all duration-300 flex flex-col gap-4 relative overflow-hidden ${
                  isToday 
                    ? 'border-indigo-200 bg-gradient-to-br from-indigo-50/50 via-blue-50/20 to-white/90 hover:from-indigo-50/70 hover:via-blue-50/30 hover:to-white shadow-md shadow-indigo-100/40 border-l-4 border-l-indigo-600 scale-[1.01] transform' 
                    : isPast 
                    ? 'border-white/60 bg-white/50 hover:bg-white/75 opacity-60' 
                    : 'border-white/60 bg-white/50 hover:bg-white/75 shadow-sm hover:shadow'
                }`}>
                  <div className="flex flex-col sm:flex-row gap-4 justify-between items-start sm:items-center w-full">
                    <div className="space-y-2 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        {isToday && (
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-gradient-to-r from-red-500 to-rose-500 text-white text-[10px] font-black uppercase tracking-wider shadow-sm shadow-red-500/20 animate-pulse">
                            <span className="w-1 h-1 rounded-full bg-white animate-ping shrink-0" />
                            Hôm nay
                          </span>
                        )}
                        <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-lg text-[10px] font-bold ${isToday ? 'bg-indigo-100 text-indigo-700 border border-indigo-200/60' : 'bg-blue-500/10 text-blue-600'}`}>{dateInfo.dateLabel}</span>
                        <span className={`text-[11px] font-bold ${isToday ? 'text-indigo-600' : 'text-slate-400'}`}>{dateInfo.time} - {endDateInfo.time}</span>
                      </div>
                      <h4 className={`text-sm font-bold transition-colors ${isToday ? 'text-indigo-950 font-black text-base' : 'text-slate-700'}`}>{schedule.title}</h4>
                      {schedule.description && (<p className={`text-xs font-semibold ${isToday ? 'text-slate-500' : 'text-slate-400'}`}>{schedule.description}</p>)}
                      <div className={`flex flex-wrap gap-x-4 gap-y-1.5 pt-1 text-[11px] font-semibold ${isToday ? 'text-indigo-900/80' : 'text-slate-500'}`}>
                        <div className="flex items-center gap-1">
                          <MapPin size={12} className={isToday ? 'text-indigo-500' : 'text-slate-400'} />
                          <span>{schedule.location || 'Chưa có địa điểm'}</span>
                        </div>
                        {maxAtt > 0 && (
                          <div className="flex items-center gap-1">
                            <Users size={12} className={isToday ? 'text-indigo-500' : 'text-slate-400'} />
                            <span>Đăng ký: {regCount}/{maxAtt} {isFull && <span className="text-red-500 font-bold">(Đầy)</span>}</span>
                          </div>
                        )}
                      </div>
                      {showOwnStatus && (
                        <div className="mt-2.5 flex items-center gap-1.5">
                          <span className="text-[11px] font-bold text-slate-400">Trạng thái điểm danh:</span>
                          <span className={`px-2 py-0.5 rounded-lg border text-[10px] font-bold ${myAtt?.status === 'present' ? 'bg-emerald-100/60 text-emerald-600 border-emerald-200' : myAtt?.status === 'late' ? 'bg-amber-100/60 text-amber-600 border-amber-200' : myAtt?.status === 'absent' ? 'bg-red-100/60 text-red-600 border-red-200' : myAtt?.status === 'excused' ? 'bg-blue-100/60 text-blue-600 border-blue-200' : 'bg-slate-100 text-slate-500 border-slate-200'}`}>
                            {myAtt?.status === 'present' ? 'Có mặt' : myAtt?.status === 'late' ? 'Đi trễ' : myAtt?.status === 'absent' ? 'Vắng' : myAtt?.status === 'excused' ? 'Nghỉ phép' : 'Chưa điểm danh'}
                          </span>
                        </div>
                      )}
                      {showRoster && (
                        <div className="mt-2.5 flex items-center gap-1.5">
                          <span className="text-[11px] font-bold text-slate-555">Đã điểm danh: {schedule.attendance_records ? schedule.attendance_records.length : 0}</span>
                          <button onClick={() => toggleExpand(schedule._id)} aria-expanded={!!expanded[schedule._id]} className="p-1 rounded-lg hover:bg-slate-100 transition-colors text-slate-500 flex items-center gap-1 cursor-pointer">
                            <span className="text-[10px] font-bold">{expanded[schedule._id] ? 'Thu gọn' : 'Chi tiết'}</span>
                            {expanded[schedule._id] ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                          </button>
                        </div>
                      )}
                    </div>
                    <div className="flex items-center gap-2 self-end sm:self-center shrink-0">
                      {isToday && onOpenAttendance && (showOwnStatus || showRoster) && (
                        <Button onClick={onOpenAttendance} className="h-8 px-4 text-xs bg-gradient-to-r from-indigo-600 to-blue-500 hover:from-indigo-700 hover:to-blue-600 text-white rounded-xl shadow-md shadow-indigo-500/10 active:scale-95 transition-all cursor-pointer font-bold border-0">Điểm danh</Button>
                      )}
                      {isStudent && (
                        <>
                          {isRegistered ? (
                            <Button variant="outline" onClick={() => onCancelRegistration && handleCancelRegisterClick(schedule._id)} className="h-8 px-3 text-xs text-rose-600 border-rose-200 hover:bg-rose-50 rounded-xl cursor-pointer" disabled={isActionLoading}>Hủy đăng ký</Button>
                          ) : (
                            <Button onClick={() => onRegister && handleRegisterClick(schedule._id)} className={`h-8 px-3 text-xs text-white rounded-xl shadow-sm cursor-pointer ${isFull ? 'bg-slate-300 hover:bg-slate-300 cursor-not-allowed shadow-none' : 'bg-gradient-to-r from-blue-500 to-indigo-600 hover:from-blue-600 hover:to-indigo-750'}`} disabled={isFull || isActionLoading}>Đăng ký tham gia</Button>
                          )}
                        </>
                      )}
                    </div>
                  </div>
                  {showRoster && expanded[schedule._id] && (
                    <div className="pt-3 border-t border-slate-150/40 space-y-2">
                      <div className="text-[10px] font-black text-slate-700 pb-1.5">DANH SÁCH ĐIỂM DANH:</div>
                      {!schedule.attendance_records || schedule.attendance_records.length === 0 ? (
                        <p className="text-xs text-slate-400 font-medium italic py-2">Không có dữ liệu điểm danh</p>
                      ) : (
                        <div className="space-y-2 max-h-60 overflow-y-auto pr-1">
                          {schedule.attendance_records.map((rec: any) => {
                            const statusConf = attStatusConfig[rec.status] || { label: rec.status, bg: 'bg-slate-100', text: 'text-slate-550', border: 'border-slate-200' };
                            const approvalConf = approvalStatusConfig[rec.approval_status];
                            const isPresent = rec.status === 'present' || rec.status === 'late';
                            return (
                              <div key={rec._id} className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3 bg-white/60 hover:bg-white border border-white/80 rounded-xl shadow-sm hover:shadow transition-all">
                                <div className="flex items-center gap-2.5">
                                  <div className="w-7 h-7 rounded-lg bg-blue-500/10 flex items-center justify-center text-blue-650 shrink-0 border border-blue-500/20">
                                    <User size={14} />
                                  </div>
                                  <div className="min-w-0">
                                    <p className="text-xs font-black text-slate-800 truncate">{rec.student_id?.full_name || '—'}</p>
                                    <div className="flex items-center gap-2 mt-0.5">
                                      <span className="text-[9.5px] text-slate-400 font-mono font-bold">{rec.student_id?.student_code || '—'}</span>
                                      {isPresent && rec.check_in_time && (
                                        <span className="text-[9px] text-slate-455 font-semibold flex items-center gap-0.5">
                                          <Clock size={10} />
                                          {new Date(rec.check_in_time).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })}
                                        </span>
                                      )}
                                    </div>
                                  </div>
                                </div>
                                <div className="flex flex-wrap items-center gap-2 sm:justify-end">
                                  <span className={`text-[9px] font-black px-2 py-0.5 rounded-full border ${statusConf.bg} ${statusConf.text} ${statusConf.border}`}>{statusConf.label}</span>
                                  {approvalConf && (<span className={`text-[8.5px] font-bold px-1.5 py-0.5 rounded-full ${approvalConf.bg} ${approvalConf.text}`}>{approvalConf.label}</span>)}
                                  {rec.note && (<span className="text-[9px] text-slate-500 bg-slate-100 px-2 py-0.5 rounded-full font-medium truncate max-w-[150px]" title={rec.note}>Note: {rec.note}</span>)}
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
