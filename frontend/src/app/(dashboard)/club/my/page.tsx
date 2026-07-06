'use client';

import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { BookOpen, Calendar, ClipboardCheck, ArrowRight, Loader2 } from 'lucide-react';
import { clubApi, clubAttendanceApi, ClubMember } from '@/api/club-api';
import { toast } from 'sonner';

const categoryColors: Record<string, { bg: string; text: string; gradient: string }> = {
  academic: { bg: 'bg-blue-500/10', text: 'text-blue-600', gradient: 'from-blue-500 to-indigo-600' },
  sports: { bg: 'bg-emerald-500/10', text: 'text-emerald-600', gradient: 'from-emerald-500 to-teal-600' },
  art: { bg: 'bg-purple-500/10', text: 'text-purple-600', gradient: 'from-purple-500 to-pink-600' },
  volunteer: { bg: 'bg-amber-500/10', text: 'text-amber-600', gradient: 'from-amber-500 to-orange-600' },
  technology: { bg: 'bg-cyan-500/10', text: 'text-cyan-600', gradient: 'from-cyan-500 to-blue-600' },
  other: { bg: 'bg-slate-500/10', text: 'text-slate-600', gradient: 'from-slate-500 to-gray-600' },
};

const statusLabels: Record<string, { label: string; color: string }> = {
  active: { label: 'Đang tham gia', color: 'bg-emerald-500/10 text-emerald-600' },
  pending: { label: 'Chờ duyệt', color: 'bg-amber-500/10 text-amber-600' },
};

const roleLabels: Record<string, string> = {
  president: 'Chủ nhiệm', vice_president: 'Phó chủ nhiệm',
  secretary: 'Thư ký', treasurer: 'Thủ quỹ', member: 'Thành viên',
};

export default function MyClubsPage() {
  const router = useRouter();
  const [memberships, setMemberships] = useState<any[]>([]);
  const [myAttendance, setMyAttendance] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => { loadData(); }, []);

  const loadData = async () => {
    try {
      setLoading(true);
      const [memberData, attData] = await Promise.all([
        clubApi.getMyClubs().catch(() => []),
        clubAttendanceApi.getMyAttendance({}).catch(() => []),
      ]);
      setMemberships(Array.isArray(memberData) ? memberData : []);
      setMyAttendance(Array.isArray(attData) ? attData : []);
    } catch {}
    finally { setLoading(false); }
  };

  if (loading) return (
    <div className="p-6 flex items-center justify-center h-64">
      <Loader2 className="animate-spin text-blue-500" size={28} />
    </div>
  );

  // Stats
  const totalClubs = memberships.filter(m => m.status === 'active').length;
  const totalAttendance = myAttendance.filter(a => a.status === 'present' || a.status === 'late').length;
  const approvedCount = myAttendance.filter(a => a.approval_status === 'approved').length;

  return (
    <div className="p-6 space-y-5">
      <div>
        <h1 className="text-lg font-black text-slate-800 flex items-center gap-2">
          <BookOpen size={20} className="text-blue-500" /> CLB của tôi
        </h1>
        <p className="text-xs text-slate-400 mt-0.5">Quản lý các CLB bạn tham gia</p>
      </div>

      {/* Quick Stats */}
      <div className="grid grid-cols-3 gap-3">
        <div className="bg-white/60 backdrop-blur-sm border border-white/70 rounded-xl px-4 py-3 text-center">
          <p className="text-2xl font-black text-blue-600">{totalClubs}</p>
          <p className="text-[10px] font-semibold text-slate-400 uppercase">CLB tham gia</p>
        </div>
        <div className="bg-white/60 backdrop-blur-sm border border-white/70 rounded-xl px-4 py-3 text-center">
          <p className="text-2xl font-black text-emerald-600">{totalAttendance}</p>
          <p className="text-[10px] font-semibold text-slate-400 uppercase">Buổi có mặt</p>
        </div>
        <div className="bg-white/60 backdrop-blur-sm border border-white/70 rounded-xl px-4 py-3 text-center">
          <p className="text-2xl font-black text-purple-600">{approvedCount}</p>
          <p className="text-[10px] font-semibold text-slate-400 uppercase">Đã duyệt</p>
        </div>
      </div>

      {/* My Clubs */}
      {memberships.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <BookOpen size={36} className="text-slate-300 mb-3" />
          <p className="text-sm font-semibold text-slate-500">Bạn chưa tham gia CLB nào</p>
          <p className="text-xs text-slate-400 mt-1 mb-4">Khám phá các CLB và đăng ký tham gia</p>
          <button onClick={() => router.push('/club/clubs')}
            className="px-4 py-2 bg-blue-500 text-white text-sm font-semibold rounded-xl hover:bg-blue-600 cursor-pointer shadow-md shadow-blue-500/20">
            Xem danh sách CLB
          </button>
        </div>
      ) : (
        <div className="space-y-3">
          {memberships.map(m => {
            const club = m.club_id || {};
            const color = categoryColors[club.category] || categoryColors.other;
            const sts = statusLabels[m.status] || statusLabels.pending;
            const clubAttendance = myAttendance.filter(a =>
              ((a.club_id as any)?._id || a.club_id) === club._id
            );
            const presentCount = clubAttendance.filter(a => a.status === 'present' || a.status === 'late').length;

            return (
              <button key={m._id} onClick={() => router.push(`/club/clubs/${club._id}`)}
                className="w-full bg-white/60 backdrop-blur-sm border border-white/70 rounded-2xl overflow-hidden hover:bg-white/80 hover:shadow-lg transition-all text-left cursor-pointer group">
                <div className={`h-1 bg-gradient-to-r ${color.gradient}`} />
                <div className="p-4 flex items-center gap-4">
                  <div className={`w-12 h-12 rounded-xl ${color.bg} flex items-center justify-center shrink-0`}>
                    <span className={`text-sm font-black ${color.text}`}>{club.code?.slice(0, 2)}</span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <h3 className="text-sm font-bold text-slate-700 group-hover:text-blue-600 transition-colors truncate">{club.name}</h3>
                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${sts.color}`}>{sts.label}</span>
                    </div>
                    <div className="flex items-center gap-3 text-xs text-slate-400 mt-0.5">
                      <span>{roleLabels[m.role] || m.role}</span>
                      <span>·</span>
                      <span className="flex items-center gap-1"><ClipboardCheck size={10} /> {presentCount} buổi</span>
                      {m.joined_at && (
                        <>
                          <span>·</span>
                          <span className="flex items-center gap-1"><Calendar size={10} /> {new Date(m.joined_at).toLocaleDateString('vi-VN')}</span>
                        </>
                      )}
                    </div>
                  </div>
                  <ArrowRight size={16} className="text-slate-300 group-hover:text-blue-400 transition-colors" />
                </div>
              </button>
            );
          })}
        </div>
      )}

      {/* Recent Attendance */}
      {myAttendance.length > 0 && (
        <div className="bg-white/60 backdrop-blur-sm border border-white/70 rounded-2xl overflow-hidden">
          <div className="px-4 py-3 border-b border-white/50">
            <h3 className="text-sm font-bold text-slate-700">Lịch sử điểm danh gần đây</h3>
          </div>
          <div className="divide-y divide-white/40">
            {myAttendance.slice(0, 8).map(a => {
              const statusColor: Record<string, string> = {
                present: 'bg-emerald-500/10 text-emerald-600',
                absent: 'bg-red-500/10 text-red-600',
                late: 'bg-amber-500/10 text-amber-600',
                excused: 'bg-blue-500/10 text-blue-600',
              };
              const statusLabel: Record<string, string> = {
                present: 'Có mặt', absent: 'Vắng', late: 'Muộn', excused: 'Có phép',
              };
              return (
                <div key={a._id} className="flex items-center gap-3 px-4 py-2.5">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-slate-700 truncate">{(a.schedule_id as any)?.title || '—'}</p>
                    <p className="text-xs text-slate-400">{(a.club_id as any)?.name} · {new Date(a.recorded_at).toLocaleDateString('vi-VN')}</p>
                  </div>
                  <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${statusColor[a.status]}`}>{statusLabel[a.status]}</span>
                  <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                    a.approval_status === 'approved' ? 'bg-emerald-500/10 text-emerald-600' :
                    a.approval_status === 'rejected' ? 'bg-red-500/10 text-red-600' :
                    'bg-amber-500/10 text-amber-600'
                  }`}>{a.approval_status === 'approved' ? '✓ Duyệt' : a.approval_status === 'rejected' ? '✕ Từ chối' : '◷ Chờ'}</span>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
