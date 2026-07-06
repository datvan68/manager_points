'use client';

import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  Users, Calendar, ClipboardCheck, TrendingUp, Plus,
  ArrowRight, Clock, Sparkles, Activity
} from 'lucide-react';
import { clubApi, clubScheduleApi, clubAttendanceApi, Club, ClubSchedule } from '@/api/club-api';
import { toast } from 'sonner';

const categoryColors: Record<string, { bg: string; text: string; border: string }> = {
  academic: { bg: 'bg-blue-500/10', text: 'text-blue-600', border: 'border-blue-200' },
  sports: { bg: 'bg-emerald-500/10', text: 'text-emerald-600', border: 'border-emerald-200' },
  art: { bg: 'bg-purple-500/10', text: 'text-purple-600', border: 'border-purple-200' },
  volunteer: { bg: 'bg-amber-500/10', text: 'text-amber-600', border: 'border-amber-200' },
  technology: { bg: 'bg-cyan-500/10', text: 'text-cyan-600', border: 'border-cyan-200' },
  other: { bg: 'bg-slate-500/10', text: 'text-slate-600', border: 'border-slate-200' },
};

const categoryLabels: Record<string, string> = {
  academic: 'Học thuật',
  sports: 'Thể thao',
  art: 'Nghệ thuật',
  volunteer: 'Tình nguyện',
  technology: 'Công nghệ',
  other: 'Khác',
};

export default function ClubDashboard() {
  const router = useRouter();
  const [clubs, setClubs] = useState<Club[]>([]);
  const [upcoming, setUpcoming] = useState<ClubSchedule[]>([]);
  const [pendingCount, setPendingCount] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadDashboard();
  }, []);

  const loadDashboard = async () => {
    try {
      setLoading(true);
      const [clubsData, upcomingData, pendingData] = await Promise.all([
        clubApi.getAll().catch(() => []),
        clubScheduleApi.getUpcoming({ limit: 5 }).catch(() => []),
        clubAttendanceApi.getPendingCount().catch(() => ({ count: 0 })),
      ]);
      setClubs(Array.isArray(clubsData) ? clubsData : []);
      setUpcoming(Array.isArray(upcomingData) ? upcomingData : []);
      setPendingCount(pendingData?.count || 0);
    } catch {
      toast.error('Không thể tải dữ liệu tổng quan');
    } finally {
      setLoading(false);
    }
  };

  const activeClubs = clubs.filter(c => c.status === 'active');

  const stats = [
    {
      label: 'Tổng CLB',
      value: activeClubs.length,
      icon: Users,
      color: 'from-blue-500 to-indigo-600',
      bgIcon: 'bg-blue-500/10 text-blue-500',
    },
    {
      label: 'Buổi sắp tới',
      value: upcoming.length,
      icon: Calendar,
      color: 'from-emerald-500 to-teal-600',
      bgIcon: 'bg-emerald-500/10 text-emerald-500',
    },
    {
      label: 'Chờ duyệt',
      value: pendingCount,
      icon: ClipboardCheck,
      color: 'from-amber-500 to-orange-600',
      bgIcon: 'bg-amber-500/10 text-amber-500',
    },
    {
      label: 'Thành viên',
      value: '—',
      icon: TrendingUp,
      color: 'from-purple-500 to-pink-600',
      bgIcon: 'bg-purple-500/10 text-purple-500',
    },
  ];

  if (loading) {
    return (
      <div className="p-6 space-y-6 animate-pulse">
        <div className="h-8 bg-white/40 rounded-xl w-48" />
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="h-28 bg-white/40 rounded-2xl" />
          ))}
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="h-80 bg-white/40 rounded-2xl" />
          <div className="h-80 bg-white/40 rounded-2xl" />
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-black text-slate-800 flex items-center gap-2">
            <Sparkles size={22} className="text-blue-500" />
            Quản lý Câu lạc bộ
          </h1>
          <p className="text-sm text-slate-500 mt-0.5">
            Tổng quan hoạt động các câu lạc bộ
          </p>
        </div>
        <button
          onClick={() => router.push('/club/clubs')}
          className="flex items-center gap-2 px-4 py-2 bg-blue-500 text-white text-sm font-semibold rounded-xl hover:bg-blue-600 transition-all shadow-md shadow-blue-500/20 hover:shadow-lg hover:shadow-blue-500/30 cursor-pointer"
        >
          <Plus size={16} />
          Tạo CLB
        </button>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {stats.map((stat, i) => {
          const Icon = stat.icon;
          return (
            <div
              key={i}
              className="relative overflow-hidden bg-white/60 backdrop-blur-sm border border-white/70 rounded-2xl p-4 hover:bg-white/80 transition-all duration-200 group"
            >
              <div className="absolute top-0 right-0 w-20 h-20 rounded-full bg-gradient-to-br opacity-[0.07] -translate-y-4 translate-x-4 group-hover:scale-125 transition-transform duration-300" style={{ backgroundImage: `linear-gradient(135deg, var(--tw-gradient-stops))` }} />
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
                    {stat.label}
                  </p>
                  <p className="text-2xl font-black text-slate-800 mt-1">
                    {stat.value}
                  </p>
                </div>
                <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${stat.bgIcon}`}>
                  <Icon size={20} />
                </div>
              </div>
            </div>
          );
        })}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Recent Clubs */}
        <div className="bg-white/60 backdrop-blur-sm border border-white/70 rounded-2xl overflow-hidden">
          <div className="flex items-center justify-between px-5 py-4 border-b border-white/50">
            <h2 className="text-sm font-bold text-slate-700">Câu lạc bộ hoạt động</h2>
            <button
              onClick={() => router.push('/club/clubs')}
              className="text-xs font-semibold text-blue-500 hover:text-blue-600 flex items-center gap-1 cursor-pointer"
            >
              Xem tất cả <ArrowRight size={12} />
            </button>
          </div>
          <div className="divide-y divide-white/40">
            {activeClubs.length === 0 ? (
              <div className="px-5 py-8 text-center text-sm text-slate-400">
                Chưa có CLB nào. Hãy tạo CLB đầu tiên!
              </div>
            ) : (
              activeClubs.slice(0, 5).map((club) => {
                const color = categoryColors[club.category] || categoryColors.other;
                return (
                  <button
                    key={club._id}
                    onClick={() => router.push(`/club/clubs/${club._id}`)}
                    className="w-full flex items-center gap-3 px-5 py-3 hover:bg-white/40 transition-colors cursor-pointer text-left"
                  >
                    <div className={`w-9 h-9 rounded-xl ${color.bg} flex items-center justify-center shrink-0`}>
                      <span className={`text-xs font-black ${color.text}`}>
                        {club.code?.slice(0, 2) || 'CL'}
                      </span>
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-slate-700 truncate">
                        {club.name}
                      </p>
                      <p className="text-xs text-slate-400">
                        {categoryLabels[club.category] || club.category} · {club.advisor_id?.user_name || 'Chưa có GV'}
                      </p>
                    </div>
                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${color.bg} ${color.text}`}>
                      {categoryLabels[club.category]}
                    </span>
                  </button>
                );
              })
            )}
          </div>
        </div>

        {/* Upcoming Schedules */}
        <div className="bg-white/60 backdrop-blur-sm border border-white/70 rounded-2xl overflow-hidden">
          <div className="flex items-center justify-between px-5 py-4 border-b border-white/50">
            <h2 className="text-sm font-bold text-slate-700">Lịch sinh hoạt sắp tới</h2>
            <button
              onClick={() => router.push('/club/schedules')}
              className="text-xs font-semibold text-blue-500 hover:text-blue-600 flex items-center gap-1 cursor-pointer"
            >
              Xem tất cả <ArrowRight size={12} />
            </button>
          </div>
          <div className="divide-y divide-white/40">
            {upcoming.length === 0 ? (
              <div className="px-5 py-8 text-center text-sm text-slate-400">
                Không có buổi sinh hoạt nào sắp tới
              </div>
            ) : (
              upcoming.map((schedule) => {
                const startDate = new Date(schedule.start_time);
                const day = startDate.getDate();
                const month = startDate.toLocaleDateString('vi-VN', { month: 'short' });
                const time = startDate.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' });

                return (
                  <button
                    key={schedule._id}
                    onClick={() => router.push(`/club/clubs/${schedule.club_id?._id || schedule.club_id}`)}
                    className="w-full flex items-center gap-3 px-5 py-3 hover:bg-white/40 transition-colors cursor-pointer text-left"
                  >
                    <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-blue-500/10 to-indigo-500/10 flex flex-col items-center justify-center shrink-0 border border-blue-100">
                      <span className="text-[10px] font-bold text-blue-400 uppercase leading-none">
                        {month}
                      </span>
                      <span className="text-sm font-black text-blue-600 leading-tight">
                        {day}
                      </span>
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-slate-700 truncate">
                        {schedule.title}
                      </p>
                      <div className="flex items-center gap-2 text-xs text-slate-400 mt-0.5">
                        <Clock size={11} />
                        <span>{time}</span>
                        {schedule.location && (
                          <>
                            <span>·</span>
                            <span className="truncate">{schedule.location}</span>
                          </>
                        )}
                      </div>
                    </div>
                    <Activity size={14} className="text-slate-300" />
                  </button>
                );
              })
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
