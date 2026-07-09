'use client';

import React, { useState } from 'react';
import {
  Clock,
  MapPin,
  ChevronDown,
  ChevronUp,
  User,
  Calendar,
} from 'lucide-react';
import {
  StudentTimelineItem,
  StaffTimelineItem,
  ClubTimelineResponse,
} from '@/api/club-api';

interface ClubScheduleTimelineProps {
  data: ClubTimelineResponse;
}

const attStatusConfig: Record<string, { label: string; bg: string; text: string; border: string }> = {
  present: {
    label: 'Có mặt',
    bg: 'bg-emerald-50',
    text: 'text-emerald-700',
    border: 'border-emerald-200',
  },
  late: {
    label: 'Đi muộn',
    bg: 'bg-amber-50',
    text: 'text-amber-700',
    border: 'border-amber-250',
  },
  absent: {
    label: 'Vắng mặt',
    bg: 'bg-red-50',
    text: 'text-red-700',
    border: 'border-red-200',
  },
  excused: {
    label: 'Có phép',
    bg: 'bg-blue-50',
    text: 'text-blue-700',
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

const scheduleStatusConfig: Record<string, { label: string; bg: string; text: string; border: string }> = {
  scheduled: {
    label: 'Đã lên lịch',
    bg: 'bg-blue-50/80',
    text: 'text-blue-700',
    border: 'border-blue-200/50',
  },
  ongoing: {
    label: 'Đang diễn ra',
    bg: 'bg-amber-50/80',
    text: 'text-amber-700',
    border: 'border-amber-200/50',
  },
  completed: {
    label: 'Đã hoàn thành',
    bg: 'bg-emerald-50/80',
    text: 'text-emerald-700',
    border: 'border-emerald-200/50',
  },
  cancelled: {
    label: 'Đã hủy',
    bg: 'bg-red-50/80',
    text: 'text-red-700',
    border: 'border-red-200/50',
  },
};

export default function ClubScheduleTimeline({ data }: ClubScheduleTimelineProps) {
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});

  const toggleExpand = (id: string) => {
    setExpanded(prev => ({ ...prev, [id]: !prev[id] }));
  };

  const formatDateTime = (isoString: string) => {
    const d = new Date(isoString);
    const dateStr = d.toLocaleDateString('vi-VN', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
    const timeStr = d.toLocaleTimeString('vi-VN', {
      hour: '2-digit',
      minute: '2-digit',
    });
    return { dateStr, timeStr };
  };

  const formatTimeRange = (startIso: string, endIso: string) => {
    const start = new Date(startIso);
    const end = new Date(endIso);
    return `${start.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })} - ${end.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })}`;
  };

  if (!data || !data.items || data.items.length === 0) {
    return (
      <div className="py-12 text-center text-xs text-slate-400 font-semibold flex flex-col items-center justify-center gap-2">
        <Calendar size={28} className="text-slate-350" />
        <span>No club schedules this week</span>
      </div>
    );
  }

  const items = data.items as any[];
  const todayItems = items.filter(item => item.is_today);
  const otherWeekItems = items.filter(item => !item.is_today);

  const renderItem = (s: any) => {
    const { dateStr } = formatDateTime(s.start_time);
    const isStudentMode = data.viewer_mode === 'student';
    const att = isStudentMode ? s.my_attendance : null;
    const attConfig = att ? attStatusConfig[att.status] : null;
    const appConfig = att ? approvalStatusConfig[att.approval_status] : null;
    const schedConfig = scheduleStatusConfig[s.status] || {
      label: s.status,
      bg: 'bg-slate-50',
      text: 'text-slate-600',
      border: 'border-slate-200',
    };

    let cardClass = 'backdrop-blur-md bg-white/50 hover:bg-white/80 border border-white/80 rounded-2xl p-5 shadow-sm hover:shadow-md transition-all space-y-3.5';
    let markerClass = 'absolute -left-[33px] top-1.5 w-4 h-4 rounded-full border-2 border-white bg-blue-500 shadow-md group-hover:scale-110 transition-transform';
    let isPulsing = false;
    let badgeText = schedConfig.label;
    let badgeClass = `${schedConfig.bg} ${schedConfig.text} ${schedConfig.border}`;

    if (s.is_active) {
      cardClass = 'backdrop-blur-md bg-gradient-to-br from-amber-50 to-orange-50 border-amber-300 rounded-2xl p-5 shadow-sm hover:shadow-md transition-all space-y-3.5';
      markerClass = 'absolute -left-[33px] top-1.5 w-4 h-4 rounded-full border-2 border-white bg-emerald-500 shadow-md group-hover:scale-110 transition-transform';
      isPulsing = true;
      badgeText = 'Happening now';
      badgeClass = 'bg-emerald-500 text-white border-emerald-600';
    } else if (s.is_today) {
      cardClass = 'backdrop-blur-md bg-emerald-500/10 hover:bg-emerald-500/15 border border-emerald-300/45 rounded-2xl p-5 shadow-sm hover:shadow-md transition-all space-y-3.5';
    }

    const isExpanded = !!expanded[s._id];
    const hasRecords = s.attendance_records && s.attendance_records.length > 0;

    return (
      <div key={s._id} className="relative group">
        {/* Timeline marker */}
        {isPulsing && (
          <div className="absolute -left-[33px] top-1.5 w-4 h-4 rounded-full bg-emerald-500 animate-ping opacity-75" />
        )}
        <div className={markerClass} />

        <div className={cardClass}>
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <h4 className="text-xs font-black text-slate-800 tracking-wide">{s.title}</h4>
              <p className="text-[10px] text-slate-450 font-semibold mt-0.5">{dateStr}</p>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <span className={`text-[9px] font-black px-2 py-0.5 rounded-full border ${badgeClass}`}>
                {badgeText}
              </span>
              {!isStudentMode && (
                <button
                  onClick={() => toggleExpand(s._id)}
                  aria-expanded={isExpanded}
                  aria-label="Toggle details view"
                  className="p-1 rounded-lg hover:bg-slate-100 transition-colors text-slate-500 flex items-center gap-1 cursor-pointer"
                >
                  <span className="text-[10px] font-bold">
                    {isExpanded ? 'Thu gọn' : `Chi tiết (${s.attendance_records?.length || 0})`}
                  </span>
                  {isExpanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                </button>
              )}
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-[10px] text-slate-500 font-semibold">
            <span className="flex items-center gap-1.5">
              <Clock size={12} className="text-slate-400" />
              {formatTimeRange(s.start_time, s.end_time)}
            </span>
            {s.location && (
              <span className="flex items-center gap-1.5">
                <MapPin size={12} className="text-slate-400" />
                {s.location}
              </span>
            )}
          </div>

          {s.description && (
            <p className="text-[10px] text-slate-450 leading-relaxed font-medium bg-slate-50/50 p-2.5 rounded-xl border border-slate-100">
              {s.description}
            </p>
          )}

          {isStudentMode && (
            <div className="flex items-center justify-between pt-3.5 border-t border-slate-150/40">
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wide">Trạng thái điểm danh:</span>
              <div className="flex items-center gap-2">
                {attConfig ? (
                  <>
                    <span className={`text-[9.5px] font-black px-2.5 py-0.5 rounded-full border ${attConfig.bg} ${attConfig.text} ${attConfig.border}`}>
                      {attConfig.label}
                    </span>
                    {appConfig && (
                      <span className={`text-[9px] font-bold px-2 py-0.5 rounded-full ${appConfig.bg} ${appConfig.text}`}>
                        {appConfig.label}
                      </span>
                    )}
                  </>
                ) : (
                  <span className="text-[9.5px] font-black px-2.5 py-0.5 rounded-full border border-slate-200 bg-slate-50 text-slate-450">
                    Chưa điểm danh
                  </span>
                )}
              </div>
            </div>
          )}

          {!isStudentMode && isExpanded && (
            <div className="pt-3 border-t border-slate-150/40 space-y-2">
              <div className="text-[10px] font-black text-slate-700 pb-1.5">DANH SÁCH ĐIỂM DANH:</div>
              {!hasRecords ? (
                <p className="text-[10px] text-slate-400 font-medium italic py-2">Không có dữ liệu điểm danh</p>
              ) : (
                <div className="space-y-2 max-h-60 overflow-y-auto pr-1">
                  {s.attendance_records.map((rec: any) => {
                    const attConfig = attStatusConfig[rec.status] || {
                      label: rec.status,
                      bg: 'bg-slate-50',
                      text: 'text-slate-700',
                      border: 'border-slate-200',
                    };
                    const appConfig = approvalStatusConfig[rec.approval_status];

                    return (
                      <div
                        key={rec._id}
                        className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3 bg-white/60 hover:bg-white border border-white/80 rounded-xl shadow-sm hover:shadow transition-all"
                      >
                        <div className="flex items-center gap-2.5">
                          <div className="w-7 h-7 rounded-lg bg-blue-500/10 flex items-center justify-center text-blue-600 shrink-0 border border-blue-500/20">
                            <User size={14} />
                          </div>
                          <div className="min-w-0">
                            <p className="text-xs font-black text-slate-800 truncate">
                              {rec.student_id?.full_name || '—'}
                            </p>
                            <div className="flex items-center gap-2 mt-0.5">
                              <span className="text-[9.5px] text-slate-400 font-mono font-bold">
                                {rec.student_id?.student_code || '—'}
                              </span>
                              {rec.check_in_time && (
                                <span className="text-[9px] text-slate-455 font-semibold flex items-center gap-0.5">
                                  <Clock size={10} />
                                  {new Date(rec.check_in_time).toLocaleTimeString('vi-VN', {
                                    hour: '2-digit',
                                    minute: '2-digit',
                                  })}
                                </span>
                              )}
                            </div>
                          </div>
                        </div>

                        <div className="flex flex-wrap items-center gap-2 sm:justify-end">
                          <span className={`text-[9px] font-black px-2 py-0.5 rounded-full border ${attConfig.bg} ${attConfig.text} ${attConfig.border}`}>
                            {attConfig.label}
                          </span>
                          {appConfig && (
                            <span className={`text-[8.5px] font-bold px-1.5 py-0.5 rounded-full ${appConfig.bg} ${appConfig.text}`}>
                              {appConfig.label}
                            </span>
                          )}
                          {rec.note && (
                            <span className="text-[9px] text-slate-455 bg-slate-100 px-2 py-0.5 rounded-full font-medium truncate max-w-[150px]" title={rec.note}>
                              Note: {rec.note}
                            </span>
                          )}
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
  };

  return (
    <div className="space-y-8">
      {/* Today's Schedule Section */}
      <div className="space-y-4">
        <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider flex items-center gap-2">
          <span className="w-1.5 h-3 bg-blue-500 rounded-full" />
          Lịch hôm nay
        </h3>
        <div className="relative border-l-2 border-slate-200/85 ml-6 pl-6 space-y-6">
          {todayItems.length === 0 ? (
            <div className="text-slate-400 text-xs font-semibold italic py-2 ml-4">
              No club schedules today
            </div>
          ) : (
            todayItems.map(renderItem)
          )}
        </div>
      </div>

      {/* This Week Section */}
      {otherWeekItems.length > 0 && (
        <div className="space-y-4">
          <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider flex items-center gap-2">
            <span className="w-1.5 h-3 bg-slate-350 rounded-full" />
            Lịch tuần này
          </h3>
          <div className="relative border-l-2 border-slate-200/85 ml-6 pl-6 space-y-6">
            {otherWeekItems.map(renderItem)}
          </div>
        </div>
      )}
    </div>
  );
}
