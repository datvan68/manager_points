'use client';

import React from 'react';
import { Activity } from '@/api/activity-api';
import { Compass, Award, Calendar, CheckCircle2, ChevronRight, Users, Star } from 'lucide-react';
import Link from 'next/link';

interface StudentActivityCardProps {
  activity: Activity;
  memberStatus?: string; // 'pending' | 'active' | 'rejected' | 'none'
  attendanceCount: number; // number of present/late sessions
  minAttendanceRequired?: number; // minimum attendance from completion rule
  isCompleted?: boolean; // whether they earned completion awards
}

const typeLabels: Record<string, string> = {
  club: 'Câu lạc bộ',
  event: 'Sự kiện',
  activity: 'Hoạt động',
  festival: 'Lễ hội',
};

const typeColors: Record<string, { bg: string; text: string; border: string; accent: string }> = {
  club: { bg: 'bg-blue-500/10', text: 'text-blue-600', border: 'border-blue-200', accent: 'from-blue-500 to-indigo-600' },
  event: { bg: 'bg-emerald-500/10', text: 'text-emerald-600', border: 'border-emerald-200', accent: 'from-emerald-500 to-teal-600' },
  activity: { bg: 'bg-purple-500/10', text: 'text-purple-600', border: 'border-purple-200', accent: 'from-purple-500 to-pink-600' },
  festival: { bg: 'bg-amber-500/10', text: 'text-amber-600', border: 'border-amber-200', accent: 'from-amber-500 to-orange-600' },
};

const statusLabels: Record<string, string> = {
  pending: 'Chờ duyệt',
  active: 'Đã tham gia',
  rejected: 'Từ chối',
  none: 'Chưa đăng ký',
};

const statusColors: Record<string, string> = {
  pending: 'bg-amber-100 text-amber-600 border-amber-200',
  active: 'bg-emerald-100 text-emerald-600 border-emerald-200',
  rejected: 'bg-red-100 text-red-600 border-red-200',
  none: 'bg-slate-100 text-slate-500 border-slate-200',
};

export default function StudentActivityCard({
  activity,
  memberStatus = 'none',
  attendanceCount = 0,
  minAttendanceRequired = 0,
  isCompleted = false,
}: StudentActivityCardProps) {
  const colors = typeColors[activity.activity_type] || typeColors.club;
  
  // Progress calculations
  const displayProgress = minAttendanceRequired > 0;
  const progressPercent = displayProgress 
    ? Math.min(100, Math.round((attendanceCount / minAttendanceRequired) * 100)) 
    : 0;

  return (
    <div className="relative overflow-hidden bg-white/60 backdrop-blur-md border border-white/75 rounded-2xl p-5 shadow-sm hover:shadow-md hover:bg-white/80 hover:scale-[1.01] transition-all duration-300 group flex flex-col justify-between h-full">
      {/* Decorative colored corner */}
      <div className={`absolute top-0 right-0 w-24 h-24 rounded-full bg-gradient-to-br ${colors.accent} opacity-[0.05] -translate-y-6 translate-x-6 group-hover:scale-125 transition-transform duration-300`} />

      <div className="space-y-4">
        {/* Top badges */}
        <div className="flex items-center justify-between">
          <span className={`px-2.5 py-0.5 rounded-lg border text-[10px] font-black uppercase tracking-wider ${colors.bg} ${colors.text} ${colors.border}`}>
            {typeLabels[activity.activity_type] || activity.activity_type}
          </span>
          <span className={`px-2.5 py-0.5 rounded-lg border text-[10px] font-bold ${statusColors[memberStatus]}`}>
            {statusLabels[memberStatus]}
          </span>
        </div>

        {/* Activity Name & Code */}
        <div>
          <h3 className="text-sm font-extrabold text-slate-700 line-clamp-1 group-hover:text-blue-600 transition-colors">
            {activity.name}
          </h3>
          <p className="text-[10px] text-slate-400 font-semibold mt-0.5">
            Mã: {activity.code} · Phòng: {activity.classroom}
          </p>
        </div>

        {/* Attendance progress bar */}
        {memberStatus === 'active' && displayProgress && (
          <div className="space-y-1.5 pt-2 border-t border-slate-100/60">
            <div className="flex items-center justify-between text-[11px] font-bold text-slate-500">
              <span className="flex items-center gap-1">
                <CheckCircle2 size={12} className={isCompleted ? 'text-emerald-500' : 'text-blue-500'} />
                Điểm danh: {attendanceCount}/{minAttendanceRequired} buổi
              </span>
              <span>{progressPercent}%</span>
            </div>
            
            {/* Progress bar line */}
            <div className="w-full h-2 bg-slate-100 rounded-full overflow-hidden border border-white/50">
              <div 
                className={`h-full rounded-full bg-gradient-to-r ${
                  isCompleted 
                    ? 'from-emerald-400 to-teal-500' 
                    : 'from-blue-500 to-indigo-600'
                } transition-all duration-500`}
                style={{ width: `${progressPercent}%` }}
              />
            </div>

            {/* Achievement notice */}
            {isCompleted ? (
              <div className="flex items-center gap-1 text-[10px] font-bold text-emerald-600 bg-emerald-500/5 px-2 py-0.5 rounded-lg border border-emerald-100">
                <Star size={10} fill="currentColor" />
                Đạt yêu cầu & đã cộng điểm rèn luyện
              </div>
            ) : (
              <p className="text-[10px] text-slate-400 font-semibold italic">
                Cần thêm {Math.max(0, minAttendanceRequired - attendanceCount)} buổi để hoàn thành.
              </p>
            )}
          </div>
        )}
      </div>

      {/* Footer link */}
      <div className="pt-4 mt-4 border-t border-slate-100/60 flex items-center justify-between">
        <span className="text-[10px] text-slate-400 font-semibold">
          GV: {activity.advisor_id?.full_name || activity.advisor_id?.user_name || 'Chưa phân công'}
        </span>
        <Link
          href={`/activities/${activity._id}`}
          className="text-xs font-bold text-blue-500 hover:text-blue-600 flex items-center gap-0.5 group-hover:translate-x-0.5 transition-transform"
        >
          Chi tiết
          <ChevronRight size={14} />
        </Link>
      </div>
    </div>
  );
}
