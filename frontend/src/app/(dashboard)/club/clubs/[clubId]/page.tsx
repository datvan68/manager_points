'use client';

import React, { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import {
  Users, Calendar, ClipboardCheck, Settings, ArrowLeft, UserPlus,
  Crown, Shield, Clock, MapPin, CheckCircle2, XCircle, Loader2, Sparkles, BookOpen, MessageSquare, Award, AlertCircle,
  QrCode, Radio,
} from 'lucide-react';
import { clubApi, clubScheduleApi, Club, ClubMember, ClubSchedule } from '@/api/club-api';
import { toast } from 'sonner';
import { API_ORIGIN } from '@/api/config';
import { useAttendanceSession } from '@/hooks/useAttendanceSession';
import AttendanceMethodSelector from '@/components/attendance/AttendanceMethodSelector';
import AttendanceSessionStatus from '@/components/attendance/AttendanceSessionStatus';
import QrDisplayPanel from '@/components/attendance/QrDisplayPanel';
import QrScannerModal from '@/components/attendance/QrScannerModal';
import ProximityPanel from '@/components/attendance/ProximityPanel';
import ProximityCheckinButton from '@/components/attendance/ProximityCheckinButton';

const getImageUrl = (url?: string) => {
  if (!url) return '';
  if (url.startsWith('http://') || url.startsWith('https://') || url.startsWith('data:')) {
    return url;
  }
  return `${API_ORIGIN}${url}`;
};

const categoryConfigs: Record<string, {
  label: string;
  gradient: string;
  bg: string;
  text: string;
  border: string;
  heroGradient: string;
  badge: string;
}> = {
  academic: {
    label: 'Học thuật',
    gradient: 'from-blue-500 to-indigo-600',
    bg: 'bg-blue-500/10',
    text: 'text-blue-600',
    border: 'border-blue-500/20',
    heroGradient: 'linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%)',
    badge: 'ACADEMIC HUB',
  },
  sports: {
    label: 'Thể thao',
    gradient: 'from-emerald-500 to-teal-600',
    bg: 'bg-emerald-500/10',
    text: 'text-emerald-600',
    border: 'border-emerald-500/20',
    heroGradient: 'linear-gradient(135deg, #059669 0%, #047857 100%)',
    badge: 'SPORTS HUB',
  },
  art: {
    label: 'Nghệ thuật',
    gradient: 'from-purple-500 to-pink-600',
    bg: 'bg-purple-500/10',
    text: 'text-purple-600',
    border: 'border-purple-500/20',
    heroGradient: 'linear-gradient(135deg, #7c3aed 0%, #6d28d9 100%)',
    badge: 'ART HUB',
  },
  volunteer: {
    label: 'Tình nguyện',
    gradient: 'from-amber-500 to-orange-600',
    bg: 'bg-amber-500/10',
    text: 'text-amber-600',
    border: 'border-amber-500/20',
    heroGradient: 'linear-gradient(135deg, #d97706 0%, #b45309 100%)',
    badge: 'VOLUNTEER HUB',
  },
  technology: {
    label: 'Công nghệ',
    gradient: 'from-cyan-500 to-blue-600',
    bg: 'bg-cyan-500/10',
    text: 'text-cyan-600',
    border: 'border-cyan-500/20',
    heroGradient: 'linear-gradient(135deg, #0891b2 0%, #0369a1 100%)',
    badge: 'RESEARCH HUB',
  },
  other: {
    label: 'Khác',
    gradient: 'from-slate-500 to-gray-600',
    bg: 'bg-slate-500/10',
    text: 'text-slate-600',
    border: 'border-slate-500/20',
    heroGradient: 'linear-gradient(135deg, #475569 0%, #334155 100%)',
    badge: 'COMMUNITY HUB',
  },
};

const roleLabels: Record<string, string> = {
  president: 'Chủ nhiệm',
  vice_president: 'Phó chủ nhiệm',
  secretary: 'Thư ký',
  treasurer: 'Thủ quỹ',
  member: 'Thành viên',
};

const roleIcons: Record<string, any> = {
  president: Crown,
  vice_president: Shield,
  member: Users,
};

const statusColors: Record<string, string> = {
  active: 'bg-emerald-500/10 text-emerald-600 border border-emerald-500/20',
  pending: 'bg-amber-500/10 text-amber-600 border border-amber-500/20',
  inactive: 'bg-slate-500/10 text-slate-550 border border-slate-500/10',
  rejected: 'bg-red-500/10 text-red-600 border border-red-500/20',
  left: 'bg-gray-500/10 text-gray-500 border border-gray-500/10',
};

export default function ClubDetailPage() {
  const { clubId } = useParams<{ clubId: string }>();
  const router = useRouter();
  const [club, setClub] = useState<Club | null>(null);
  const [members, setMembers] = useState<ClubMember[]>([]);
  const [schedules, setSchedules] = useState<ClubSchedule[]>([]);
  const [activeTab, setActiveTab] = useState<'info' | 'members' | 'schedules' | 'attendance'>('info');
  const [loading, setLoading] = useState(true);
  const [showMethodSelector, setShowMethodSelector] = useState(false);
  const [showQrScanner, setShowQrScanner] = useState(false);

  useEffect(() => {
    if (clubId) loadData();
  }, [clubId]);

  const loadData = async () => {
    try {
      setLoading(true);
      const [clubData, membersData, schedulesData] = await Promise.all([
        clubApi.getById(clubId),
        clubApi.getMembers(clubId, { status: '' }),
        clubScheduleApi.getAll({ club_id: clubId, limit: 15 }).then(r => r?.items || []).catch(() => []),
      ]);
      setClub(clubData);
      setMembers(Array.isArray(membersData) ? membersData : []);
      setSchedules(Array.isArray(schedulesData) ? schedulesData : []);
    } catch {
      toast.error('Không thể tải thông tin CLB');
    } finally {
      setLoading(false);
    }
  };

  const handleApproveMember = async (memberId: string, status: string) => {
    try {
      await clubApi.approveMember(clubId, memberId, { status });
      toast.success(status === 'active' ? 'Đã duyệt thành viên thành công' : 'Đã từ chối đăng ký');
      loadData();
    } catch {
      toast.error('Lỗi khi xử lý phê duyệt thành viên');
    }
  };

  if (loading) return (
    <div className="p-6 flex items-center justify-center h-full">
      <Loader2 className="animate-spin text-blue-500" size={28} />
    </div>
  );

  if (!club) return (
    <div className="p-6 text-center text-slate-500 flex flex-col items-center justify-center gap-3">
      <AlertCircle size={32} className="text-slate-400" />
      <span>Không tìm thấy thông tin Câu lạc bộ</span>
    </div>
  );

  const conf = categoryConfigs[club.category] || categoryConfigs.other;
  const pendingMembers = members.filter(m => m.status === 'pending');
  const activeMembers = members.filter(m => m.status === 'active');

  const tabs = [
    { id: 'info', label: 'Thông tin', icon: Settings },
    { id: 'members', label: `Thành viên (${activeMembers.length})`, icon: Users },
    { id: 'schedules', label: `Lịch sinh hoạt (${schedules.length})`, icon: Calendar },
    { id: 'attendance', label: 'Điểm danh', icon: ClipboardCheck },
  ];

  return (
    <div className="p-6 space-y-6 custom-scrollbar overflow-y-auto h-full">
      {/* Hero Banner Section */}
      <div className="relative overflow-hidden backdrop-blur-md bg-white/45 border border-white/80 rounded-3xl shadow-md shadow-slate-200/50">
        {/* Banner cover */}
        <div 
          className="h-56 relative w-full flex flex-col justify-end p-6 md:p-8 bg-center bg-cover"
          style={club.cover_url ? {
            backgroundImage: `linear-gradient(to bottom, rgba(0, 0, 0, 0.1), rgba(0, 0, 0, 0.6)), url(${getImageUrl(club.cover_url)})`
          } : {
            background: conf.heroGradient
          }}
        >
          {/* Back button */}
          <button 
            onClick={() => router.push('/club/clubs')} 
            className="absolute top-6 left-6 w-9 h-9 rounded-xl bg-white/20 backdrop-blur-md border border-white/30 flex items-center justify-center text-white hover:bg-white/30 hover:scale-105 active:scale-95 transition-all cursor-pointer"
          >
            <ArrowLeft size={18} />
          </button>

          <div className="absolute top-6 right-6 text-white/10 font-black text-8xl select-none leading-none pointer-events-none">
            {club.code}
          </div>

          <div className="relative z-10 space-y-2">
            <span className="inline-flex items-center px-3 py-1 rounded-full text-[9px] font-black tracking-wider text-white bg-white/20 border border-white/30 uppercase">
              {conf.badge}
            </span>
            <h1 className="text-2xl md:text-3xl font-black text-white leading-tight drop-shadow-sm">
              {club.name}
            </h1>
            <p className="text-xs text-white/90 leading-relaxed max-w-3xl font-medium drop-shadow-sm">
              {club.description || 'Câu lạc bộ sinh viên trực thuộc trường, nơi phát huy tiềm năng và giao lưu học hỏi học thuật.'}
            </p>
          </div>
        </div>
      </div>

      {/* Stats Row Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Stat 1 */}
        <div className="backdrop-blur-md bg-white/45 border border-white/70 rounded-2xl p-4 shadow-sm shadow-slate-200/40 flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-blue-500/10 flex items-center justify-center text-blue-600 shrink-0">
            <Users size={22} />
          </div>
          <div>
            <div className="text-xl font-black text-slate-800 leading-none">{activeMembers.length}</div>
            <div className="text-xs font-semibold text-slate-400 mt-1">Thành viên chính thức</div>
          </div>
        </div>

        {/* Stat 2 */}
        <div className="backdrop-blur-md bg-white/45 border border-white/70 rounded-2xl p-4 shadow-sm shadow-slate-200/40 flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-purple-500/10 flex items-center justify-center text-purple-600 shrink-0">
            <Award size={22} />
          </div>
          <div>
            <div className="text-xl font-black text-slate-800 leading-none">Hoạt động</div>
            <div className="text-xs font-semibold text-slate-400 mt-1">Đánh giá chung</div>
          </div>
        </div>

        {/* Stat 3 */}
        <div className="backdrop-blur-md bg-white/45 border border-white/70 rounded-2xl p-4 shadow-sm shadow-slate-200/40 flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-amber-500/10 flex items-center justify-center text-amber-600 shrink-0">
            <Calendar size={22} />
          </div>
          <div>
            <div className="text-xl font-black text-slate-800 leading-none">{schedules.length}</div>
            <div className="text-xs font-semibold text-slate-400 mt-1">Sự kiện đã lên lịch</div>
          </div>
        </div>
      </div>

      {/* Tabs Switcher */}
      <div className="flex gap-1.5 p-1 bg-white/30 backdrop-blur-md rounded-2xl border border-white/50">
        {tabs.map(tab => {
          const Icon = tab.icon;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                activeTab === tab.id
                  ? 'bg-white text-blue-600 shadow-sm border border-slate-100'
                  : 'text-slate-500 hover:text-slate-700 hover:bg-white/30'
              }`}
            >
              <Icon size={15} /> {tab.label}
            </button>
          );
        })}
      </div>

      {/* Tab Content Components */}
      <div className="transition-all duration-300">
        {activeTab === 'info' && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Left Columns - Mentor and schedules info */}
            <div className="lg:col-span-2 space-y-6">
              {/* Mentor Card */}
              <div className="backdrop-blur-md bg-white/45 border border-white/70 rounded-2xl p-5 shadow-sm shadow-slate-200/40 space-y-4">
                <h3 className="text-sm font-bold text-slate-800 flex items-center gap-2 pb-3 border-b border-white/50">
                  <Crown size={16} className="text-blue-500" /> Giáo viên phụ trách
                </h3>
                <div className="flex flex-col sm:flex-row items-center gap-5">
                  <div className="w-20 h-20 rounded-2xl bg-blue-500/10 flex items-center justify-center text-blue-500 text-2xl font-black shrink-0 border border-blue-500/20">
                    {(club.advisor_id?.full_name || club.advisor_id?.user_name || 'GV').slice(0, 2).toUpperCase()}
                  </div>
                  <div className="space-y-1.5 text-center sm:text-left flex-1">
                    <h4 className="text-base font-extrabold text-slate-800">
                      {club.advisor_id?.full_name || club.advisor_id?.user_name || 'Chưa phân công'}
                    </h4>
                    <p className="text-xs font-semibold text-blue-600">Cố vấn chuyên môn và Giám sát hoạt động</p>
                    <p className="text-xs text-slate-400 font-medium">Email liên hệ: {club.advisor_id?.email || '—'}</p>
                    <div className="pt-2 italic text-slate-500 text-xs font-normal max-w-xl leading-relaxed">
                      &quot;Hành trình vạn dặm khởi đầu từ một dòng mã. Hãy luôn giữ tinh thần học hỏi, chia sẻ và sáng tạo cùng nhau để xây dựng một cộng đồng xuất sắc.&quot;
                    </div>
                  </div>
                </div>
              </div>

              {/* Schedules summary */}
              <div className="backdrop-blur-md bg-white/45 border border-white/70 rounded-2xl p-5 shadow-sm shadow-slate-200/40 space-y-4">
                <h3 className="text-sm font-bold text-slate-800 flex items-center gap-2 pb-3 border-b border-white/50">
                  <Calendar size={16} className="text-blue-500" /> Kế hoạch sinh hoạt
                </h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="bg-white/45 border border-white/60 p-4 rounded-xl space-y-2">
                    <div className="w-8 h-8 rounded-lg bg-blue-500/10 flex items-center justify-center text-blue-600 font-bold text-xs">
                      T3
                    </div>
                    <div>
                      <h4 className="text-xs font-bold text-slate-700">Sinh hoạt Học thuật định kỳ</h4>
                      <p className="text-[11px] text-slate-400 font-medium mt-0.5">Thứ Ba hàng tuần · 18:00 - 20:00</p>
                    </div>
                  </div>
                  <div className="bg-white/45 border border-white/60 p-4 rounded-xl space-y-2">
                    <div className="w-8 h-8 rounded-lg bg-emerald-500/10 flex items-center justify-center text-emerald-600 font-bold text-xs">
                      T5
                    </div>
                    <div>
                      <h4 className="text-xs font-bold text-slate-700">Sinh hoạt thực hành / Giao lưu</h4>
                      <p className="text-[11px] text-slate-400 font-medium mt-0.5">Thứ Năm hàng tuần · 18:00 - 20:00</p>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Right Column - Configurations */}
            <div className="space-y-6">
              <div className="backdrop-blur-md bg-white/45 border border-white/70 rounded-2xl p-5 shadow-sm shadow-slate-200/40 space-y-4">
                <h3 className="text-sm font-bold text-slate-800 flex items-center gap-2 pb-3 border-b border-white/50">
                  <Settings size={16} className="text-blue-500" /> Cấu hình & Giới hạn
                </h3>
                <div className="space-y-3.5">
                  <InfoItem label="Chủ nhiệm" value={(club.president_id as any)?.full_name || '—'} />
                  <InfoItem label="Phòng học hoạt động mặc định" value={club.classroom || 'Chưa xếp phòng'} />
                  <InfoItem label="Học kỳ" value={club.semester_id?.name || '—'} />
                  <InfoItem label="Ngày bắt đầu hoạt động" value={club.activity_start_date ? new Date(club.activity_start_date).toLocaleDateString('vi-VN') : '—'} />
                  <InfoItem label="Ngày kết thúc hoạt động" value={club.activity_end_date ? new Date(club.activity_end_date).toLocaleDateString('vi-VN') : '—'} />
                  <InfoItem label="Giới hạn thành viên" value={club.max_members ? `${club.max_members} người` : 'Không giới hạn'} />
                  <InfoItem label="Tự đăng ký tham gia" value={club.settings?.allow_self_registration ? 'Cho cho phép' : 'Tắt'} />
                  <InfoItem label="Yêu cầu duyệt đơn" value={club.settings?.require_approval ? 'Bắt buộc duyệt' : 'Duyệt tự động'} />
                  <InfoItem label="Cộng điểm rèn luyện" value={club.settings?.attendance_point_enabled ? `${club.settings.point_per_attendance} điểm / buổi` : 'Tắt'} />
                </div>

                {/* Self registration CTA */}
                {club.settings?.allow_self_registration && (
                  <button
                    onClick={async () => {
                      try {
                        await clubApi.joinClub(club._id, { semester_id: club.semester_id || '' });
                        toast.success('Đã gửi yêu cầu đăng ký tham gia CLB thành công!');
                        loadData();
                      } catch (err: any) {
                        toast.error(err?.response?.data?.message || 'Không thể đăng ký tham gia');
                      }
                    }}
                    className="w-full flex items-center justify-center gap-2 py-3 mt-4 bg-blue-600 text-white text-xs font-bold rounded-xl hover:bg-blue-700 shadow-md shadow-blue-500/20 active:scale-95 transition-all cursor-pointer"
                  >
                    <UserPlus size={14} /> Gửi Đơn Đăng Ký Tham Gia
                  </button>
                )}
              </div>
            </div>
          </div>
        )}

        {activeTab === 'members' && (
          <div className="space-y-6">
            {/* Pending approvals section */}
            {pendingMembers.length > 0 && (
              <div className="bg-amber-50/70 border border-amber-200/50 rounded-2xl p-5 space-y-4 shadow-sm">
                <h3 className="text-xs font-black text-amber-700 flex items-center gap-2 pb-2 border-b border-amber-200/30">
                  <UserPlus size={16} /> Danh sách chờ duyệt tham gia ({pendingMembers.length})
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                  {pendingMembers.map(m => (
                    <div key={m._id} className="flex items-center justify-between p-3.5 bg-white/80 border border-amber-200/30 rounded-xl shadow-sm">
                      <div className="min-w-0 flex-1">
                        <p className="text-xs font-extrabold text-slate-800 truncate">{(m.student_id as any)?.full_name || '—'}</p>
                        <p className="text-[10px] text-slate-400 font-mono mt-0.5">{(m.student_id as any)?.student_code || '—'}</p>
                      </div>
                      <div className="flex items-center gap-1.5 shrink-0 ml-3">
                        <button
                          onClick={() => handleApproveMember(m._id, 'active')}
                          className="p-1.5 rounded-lg bg-emerald-500/10 text-emerald-650 hover:bg-emerald-500/20 cursor-pointer transition-all"
                          title="Duyệt"
                        >
                          <CheckCircle2 size={16} className="text-emerald-650" />
                        </button>
                        <button
                          onClick={() => handleApproveMember(m._id, 'rejected')}
                          className="p-1.5 rounded-lg bg-red-500/10 text-red-650 hover:bg-red-500/20 cursor-pointer transition-all"
                          title="Từ chối"
                        >
                          <XCircle size={16} className="text-red-650" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Active Members Grid */}
            <div className="backdrop-blur-md bg-white/45 border border-white/70 rounded-3xl p-5 shadow-sm shadow-slate-200/40 space-y-4">
              <div className="pb-3 border-b border-white/50 flex justify-between items-center">
                <h3 className="text-sm font-bold text-slate-800">
                  Thành viên chính thức ({activeMembers.length})
                </h3>
              </div>
              
              {activeMembers.length === 0 ? (
                <div className="py-12 text-center text-xs text-slate-400 font-semibold">Chưa có thành viên nào tham gia hoạt động</div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                  {activeMembers.map(m => {
                    const RoleIcon = roleIcons[m.role] || Users;
                    return (
                      <div 
                        key={m._id} 
                        className="flex items-center gap-3.5 p-3.5 bg-white/60 border border-white/80 rounded-2xl shadow-sm hover:shadow hover:bg-white/80 transition-all"
                      >
                        <div className="w-10 h-10 rounded-full bg-blue-500/10 flex items-center justify-center text-blue-600 shrink-0 border border-blue-500/20">
                          <RoleIcon size={16} />
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="text-xs font-extrabold text-slate-850 truncate">{(m.student_id as any)?.full_name}</p>
                          <p className="text-[10px] text-slate-400 font-mono mt-0.5">{(m.student_id as any)?.student_code} · {roleLabels[m.role]}</p>
                        </div>
                        <span className={`text-[9px] font-black px-2 py-0.5 rounded-full shrink-0 ${statusColors[m.status] || 'bg-slate-100 text-slate-500'}`}>
                          {m.status === 'active' ? 'Hoạt động' : m.status}
                        </span>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        )}

        {activeTab === 'schedules' && (
          <div className="backdrop-blur-md bg-white/45 border border-white/70 rounded-3xl p-5 shadow-sm shadow-slate-200/40 space-y-4">
            <div className="pb-3 border-b border-white/50 flex justify-between items-center">
              <h3 className="text-sm font-bold text-slate-800">Lịch sinh hoạt CLB</h3>
              <button 
                onClick={() => router.push(`/club/clubs/${clubId}/schedules`)}
                className="text-xs font-extrabold text-blue-600 hover:text-blue-700 hover:underline cursor-pointer"
              >
                Quản lý lịch →
              </button>
            </div>
            
            {schedules.length === 0 ? (
              <div className="py-12 text-center text-xs text-slate-400 font-semibold">Chưa thiết lập lịch sinh hoạt định kỳ</div>
            ) : (
              <div className="divide-y divide-slate-150/50">
                {schedules.map(s => {
                  const scheduleDate = new Date(s.start_time);
                  return (
                    <div key={s._id} className="flex items-center gap-4 py-4 first:pt-0 last:pb-0">
                      {/* Date block */}
                      <div className="w-12 h-12 rounded-xl bg-blue-500/10 flex flex-col items-center justify-center shrink-0 border border-blue-500/20">
                        <span className="text-[9px] font-black text-blue-500 uppercase leading-none">{scheduleDate.toLocaleDateString('vi-VN', { month: 'short' })}</span>
                        <span className="text-base font-black text-blue-600 mt-1 leading-none">{scheduleDate.getDate()}</span>
                      </div>
                      
                      <div className="min-w-0 flex-1 space-y-1">
                        <p className="text-xs font-bold text-slate-800 truncate">{s.title}</p>
                        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-slate-400 font-medium">
                          <span className="flex items-center gap-1">
                            <Clock size={11} /> {scheduleDate.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })}
                          </span>
                          {(s.location || club.classroom) && (
                            <span className="flex items-center gap-1 truncate">
                              <MapPin size={11} /> {s.location || club.classroom}
                            </span>
                          )}
                        </div>
                      </div>

                      <span className={`text-[9px] font-black px-2 py-0.5 rounded-full shrink-0 ${
                        s.status === 'completed' ? 'bg-emerald-500/10 text-emerald-600 border border-emerald-500/20' :
                        s.status === 'cancelled' ? 'bg-red-500/10 text-red-600 border border-red-500/20' :
                        'bg-blue-500/10 text-blue-600 border border-blue-500/20'
                      }`}>
                        {s.status === 'completed' ? 'Hoàn thành' : s.status === 'cancelled' ? 'Đã hủy' : 'Đã lên lịch'}
                      </span>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {activeTab === 'attendance' && (
          <ClubAttendanceTab
            clubId={clubId}
            club={club}
            schedules={schedules}
            showMethodSelector={showMethodSelector}
            setShowMethodSelector={setShowMethodSelector}
            showQrScanner={showQrScanner}
            setShowQrScanner={setShowQrScanner}
          />
        )}
      </div>
    </div>
  );
}

function InfoItem({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between items-center py-2 border-b border-slate-250/20 last:border-b-0 text-xs">
      <span className="text-slate-450 font-semibold">{label}</span>
      <span className="text-slate-800 font-bold">{value}</span>
    </div>
  );
}

// ── Club Attendance Tab Component ──

function ClubAttendanceTab({
  clubId,
  club,
  schedules,
  showMethodSelector,
  setShowMethodSelector,
  showQrScanner,
  setShowQrScanner,
}: {
  clubId: string;
  club: Club;
  schedules: ClubSchedule[];
  showMethodSelector: boolean;
  setShowMethodSelector: (v: boolean) => void;
  showQrScanner: boolean;
  setShowQrScanner: (v: boolean) => void;
}) {
  const attendance = useAttendanceSession({
    contextType: 'club',
    contextId: clubId,
    enabled: true,
  });

  const hasActiveSession = attendance.session?.status === 'active';
  const isQrSession = hasActiveSession && attendance.session?.method === 'qr';
  const isProximitySession = hasActiveSession && attendance.session?.method === 'proximity';

  const handleOpenSession = async (params: {
    method: 'qr' | 'proximity';
    latitude?: number;
    longitude?: number;
    radius_meters?: number;
    qr_refresh_interval?: number;
  }) => {
    try {
      await attendance.openSession({
        ...params,
        semester_id: club.semester_id?._id || club.semester_id || '',
        title: `Điểm danh CLB ${club.name}`,
      });
      setShowMethodSelector(false);
      toast.success('Đã mở phiên điểm danh thành công!');
    } catch (err: any) {
      toast.error(err.message || 'Không thể mở phiên điểm danh');
    }
  };

  const handleCloseSession = async () => {
    try {
      await attendance.closeSession();
      toast.success('Đã đóng phiên điểm danh');
    } catch {
      toast.error('Không thể đóng phiên');
    }
  };

  return (
    <div className="space-y-6">
      {/* Session Status Bar */}
      {hasActiveSession && attendance.session && (
        <AttendanceSessionStatus
          status={attendance.session.status as any}
          method={attendance.session.method as any}
          checkinCount={attendance.session.checkin_count}
          openedAt={attendance.session.opened_at}
        />
      )}

      {/* No active session — show open button or method selector */}
      {!hasActiveSession && !showMethodSelector && (
        <div className="backdrop-blur-md bg-white/45 border border-white/70 rounded-3xl p-8 shadow-sm shadow-slate-200/40 flex flex-col items-center text-center max-w-lg mx-auto">
          <ClipboardCheck size={44} className="text-blue-500 mb-4" />
          <h3 className="text-base font-extrabold text-slate-800">Điểm danh sinh hoạt CLB</h3>
          <p className="text-xs text-slate-450 mt-1.5 mb-6 max-w-sm leading-relaxed font-semibold">
            Mở phiên điểm danh bằng QR Code hoặc GPS Proximity để sinh viên tự điểm danh qua thiết bị.
          </p>
          <div className="flex flex-col sm:flex-row gap-3 w-full max-w-xs">
            <button
              onClick={() => setShowMethodSelector(true)}
              className="flex-1 flex items-center justify-center gap-2 px-5 py-3 bg-blue-600 text-white text-xs font-bold rounded-xl hover:bg-blue-700 shadow-md shadow-blue-500/20 active:scale-95 transition-all cursor-pointer"
            >
              <Radio size={15} /> Mở điểm danh
            </button>
            <button
              onClick={() => setShowQrScanner(true)}
              className="flex-1 flex items-center justify-center gap-2 px-5 py-3 bg-emerald-600 text-white text-xs font-bold rounded-xl hover:bg-emerald-700 shadow-md shadow-emerald-500/20 active:scale-95 transition-all cursor-pointer"
            >
              <QrCode size={15} /> Quét QR
            </button>
          </div>
          <button
            onClick={() => window.location.href = '/club/attendance'}
            className="mt-4 text-xs text-blue-600 font-semibold hover:underline cursor-pointer"
          >
            Xem lịch sử điểm danh →
          </button>
        </div>
      )}

      {/* Method Selector Modal */}
      {!hasActiveSession && showMethodSelector && (
        <div className="backdrop-blur-md bg-white/45 border border-white/70 rounded-3xl p-6 shadow-sm shadow-slate-200/40">
          <AttendanceMethodSelector
            onSelect={handleOpenSession}
            loading={attendance.loading}
          />
          <button
            onClick={() => setShowMethodSelector(false)}
            className="w-full mt-4 py-2.5 text-xs font-semibold text-gray-500 hover:text-gray-700 transition-colors"
          >
            ← Quay lại
          </button>
        </div>
      )}

      {/* Active QR Session — Admin Panel */}
      {isQrSession && attendance.qrData && (
        <div className="backdrop-blur-md bg-white/45 border border-white/70 rounded-3xl shadow-sm shadow-slate-200/40 overflow-hidden">
          <QrDisplayPanel
            token={attendance.qrData.token}
            expiresAt={attendance.qrData.expires_at}
            refreshInterval={attendance.qrData.refresh_interval}
            checkinCount={attendance.qrData.checkin_count}
            onClose={handleCloseSession}
            sessionTitle={attendance.session?.title}
          />
        </div>
      )}

      {/* Active Proximity Session — Admin Panel */}
      {isProximitySession && attendance.session && (
        <div className="backdrop-blur-md bg-white/45 border border-white/70 rounded-3xl shadow-sm shadow-slate-200/40 overflow-hidden">
          <ProximityPanel
            latitude={attendance.session.latitude!}
            longitude={attendance.session.longitude!}
            radiusMeters={attendance.session.radius_meters!}
            checkinCount={attendance.session.checkin_count}
            checkins={attendance.checkins}
            onClose={handleCloseSession}
            sessionTitle={attendance.session.title}
          />
        </div>
      )}

      {/* Student: Proximity Check-in Button (when session active) */}
      {isProximitySession && attendance.session && (
        <div className="backdrop-blur-md bg-white/45 border border-white/70 rounded-3xl shadow-sm shadow-slate-200/40 overflow-hidden">
          <ProximityCheckinButton
            sessionLatitude={attendance.session.latitude!}
            sessionLongitude={attendance.session.longitude!}
            sessionRadius={attendance.session.radius_meters!}
            onCheckin={async (lat, lng) => { await attendance.checkinProximity(lat, lng); }}
            checkinStatus={attendance.checkinStatus}
            checkinError={attendance.checkinError}
          />
        </div>
      )}

      {/* Student: QR Scanner (when active QR session or manual trigger) */}
      {isQrSession && (
        <div className="flex justify-center">
          <button
            onClick={() => setShowQrScanner(true)}
            className="flex items-center gap-2 px-6 py-3 bg-emerald-600 text-white text-sm font-bold rounded-xl hover:bg-emerald-700 shadow-md shadow-emerald-500/20 active:scale-95 transition-all cursor-pointer"
          >
            <QrCode size={18} /> Quét mã để điểm danh
          </button>
        </div>
      )}

      {/* Checkin List */}
      {hasActiveSession && attendance.checkins.length > 0 && (
        <div className="backdrop-blur-md bg-white/45 border border-white/70 rounded-3xl p-5 shadow-sm shadow-slate-200/40">
          <h3 className="text-sm font-bold text-slate-800 pb-3 border-b border-white/50 mb-3">
            Đã điểm danh ({attendance.checkins.length})
          </h3>
          <div className="space-y-2 max-h-64 overflow-y-auto">
            {attendance.checkins.map((c) => (
              <div
                key={c._id}
                className="flex items-center justify-between px-3 py-2.5 bg-white/60 rounded-xl border border-white/80"
              >
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-full bg-blue-500/10 flex items-center justify-center text-xs font-bold text-blue-600 border border-blue-500/20">
                    {(c.student_id?.full_name || '?')[0]}
                  </div>
                  <div>
                    <p className="text-xs font-bold text-slate-800">{c.student_id?.full_name || '—'}</p>
                    <p className="text-[10px] text-slate-400 font-mono">{c.student_id?.student_code || ''}</p>
                  </div>
                </div>
                <div className="text-right">
                  <span className="text-[10px] text-emerald-600 font-bold bg-emerald-50 px-2 py-0.5 rounded-full">
                    {c.method === 'qr' ? 'QR' : 'GPS'}
                  </span>
                  {c.distance_meters != null && (
                    <p className="text-[10px] text-slate-400 mt-0.5">{c.distance_meters}m</p>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* QR Scanner Modal */}
      <QrScannerModal
        open={showQrScanner}
        onClose={() => {
          setShowQrScanner(false);
          attendance.resetCheckinStatus();
        }}
        onScanned={async (token) => {
          await attendance.checkinQr(token);
        }}
        checkinStatus={attendance.checkinStatus}
        checkinError={attendance.checkinError}
        onReset={attendance.resetCheckinStatus}
      />

      {/* Error display */}
      {attendance.error && (
        <div className="bg-red-50 border border-red-200 rounded-xl px-4 py-3 text-xs text-red-600 font-medium">
          {attendance.error}
        </div>
      )}
    </div>
  );
}
