'use client';
 
import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  Plus, Search, Filter, Users, MapPin, Compass, Grid, List,
  Sparkles, Download, ArrowRight, BookOpen, Clock, Calendar, CheckCircle2,
  AlertCircle, ShieldAlert, MoreVertical, Edit2, Trash2, Eye, Shield, HelpCircle,
  X, Upload, Heart, BarChart3, Palette
} from 'lucide-react';
import { Input } from '@/components/ui/Input';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { CustomCalendar } from '@/components/calendar/CustomCalendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { cn } from '@/lib/utils';
import { format } from 'date-fns';
import { clubApi, clubScheduleApi, Club } from '@/api/club-api';
import { authApi, tokenStorage } from '@/api/auth-api';
import { semesterApi, Semester } from '@/api/semester-api';
import { getClubScheduleSummary, BACKGROUND_PRESETS, getClubAccentColor } from './schedule-helper';
import { API_ORIGIN } from '@/api/config';
 
const SHOW_CLUB_AVATAR = false;

const getImageUrl = (url?: string) => {
  if (!url) return '';
  if (url.startsWith('http://') || url.startsWith('https://') || url.startsWith('data:')) {
    return url;
  }
  return `${API_ORIGIN}${url}`;
};
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { toast } from 'sonner';
 
// Config category styling matching the Figma theme
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
    heroGradient: 'linear-gradient(135deg, #dbeafe 0%, #bfdbfe 100%)',
    badge: 'ACADEMIC HUB',
  },
  sports: {
    label: 'Thể thao',
    gradient: 'from-emerald-500 to-teal-600',
    bg: 'bg-emerald-500/10',
    text: 'text-emerald-600',
    border: 'border-emerald-500/20',
    heroGradient: 'linear-gradient(135deg, #d1fae5 0%, #a7f3d0 100%)',
    badge: 'SPORTS HUB',
  },
  art: {
    label: 'Nghệ thuật',
    gradient: 'from-purple-500 to-pink-600',
    bg: 'bg-purple-500/10',
    text: 'text-purple-600',
    border: 'border-purple-500/20',
    heroGradient: 'linear-gradient(135deg, #f3e8ff 0%, #e9d5ff 100%)',
    badge: 'ART HUB',
  },
  volunteer: {
    label: 'Tình nguyện',
    gradient: 'from-amber-500 to-orange-600',
    bg: 'bg-amber-500/10',
    text: 'text-amber-600',
    border: 'border-amber-500/20',
    heroGradient: 'linear-gradient(135deg, #fef3c7 0%, #fde68a 100%)',
    badge: 'VOLUNTEER HUB',
  },
  technology: {
    label: 'Công nghệ',
    gradient: 'from-cyan-500 to-blue-600',
    bg: 'bg-cyan-500/10',
    text: 'text-cyan-600',
    border: 'border-cyan-500/20',
    heroGradient: 'linear-gradient(135deg, #ecfeff 0%, #cffafe 100%)',
    badge: 'RESEARCH HUB',
  },
  other: {
    label: 'Khác',
    gradient: 'from-slate-500 to-gray-600',
    bg: 'bg-slate-500/10',
    text: 'text-slate-600',
    border: 'border-slate-500/20',
    heroGradient: 'linear-gradient(135deg, #f1f5f9 0%, #e2e8f0 100%)',
    badge: 'COMMUNITY HUB',
  },
};
 
interface ClubWithStats extends Club {
  active_members_count: number;
  pending_members_count: number;
  favorite_count: number;
  is_favorited: boolean;
  membership_status?: 'none' | 'pending' | 'active' | 'inactive' | 'rejected' | 'left';
  favorite_loading?: boolean;
  join_loading?: boolean;
  schedule_time?: string;
}

const formatScheduleSummary = (schedules: any[], clubId: string) => {
  const summary = getClubScheduleSummary(schedules, clubId);
  if (!summary || summary.length === 0) {
    return 'Chưa xếp lịch';
  }
  return summary.map(row => `${row.weekdays.join(', ')}: ${row.timeRange}`).join(' | ');
};
 
export default function ClubsListPage() {
  const router = useRouter();
  const [clubs, setClubs] = useState<ClubWithStats[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filterCategory, setFilterCategory] = useState('');
  const [viewMode, setViewMode] = useState<'grid' | 'table'>('grid');
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showQuickReports, setShowQuickReports] = useState(false);
  const [todaySchedulesCount, setTodaySchedulesCount] = useState(0);
  const [activeSemesterId, setActiveSemesterId] = useState<string | null>(null);
  const [showBgSetupModal, setShowBgSetupModal] = useState(false);
  const [selectedClubForBg, setSelectedClubForBg] = useState<ClubWithStats | null>(null);
 
  // Pagination states
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 8;
 
  useEffect(() => {
    loadClubs();
    loadTodaySchedules();
  }, []);
 
  const loadClubs = async () => {
    try {
      setLoading(true);
      const currentUser = tokenStorage.getUser();
 
      const [data, favoriteIds, myMemberships, semestersList, schedulesData] = await Promise.all([
        clubApi.getAll(),
        currentUser ? clubApi.getMyFavoriteClubIds().catch(() => []) : Promise.resolve([]),
        currentUser ? clubApi.getMyClubs().catch(() => []) : Promise.resolve([]),
        semesterApi.getSemesters().catch(() => []),
        clubScheduleApi.getAll({ limit: 1000 }).catch(() => ({ items: [], total: 0 })),
      ]);
 
      const schedulesList = schedulesData?.items || [];

      // Find active semester
      const activeSem = semestersList.find((s) => s.status === 'active');
      if (activeSem) {
        setActiveSemesterId(activeSem._id);
      }
 
      // Fetch stats for each club to display member count and favorite count
      const clubsWithStats = await Promise.all(
        data.map(async (club) => {
          try {
            const stats = await clubApi.getStats(club._id);
            
            // Find membership status
            const membership = myMemberships.find((m: any) => {
              const mClubId = m.club_id?._id || m.club_id;
              return mClubId === club._id;
            });
 
            // Find schedules for this club
            const clubSchedules = schedulesList.filter((s: any) => {
              const sClubId = s.club_id?._id || s.club_id;
              return sClubId === club._id;
            });
            const scheduleTimeStr = formatScheduleSummary(clubSchedules, club._id);

            return {
              ...club,
              active_members_count: stats.active_members || 0,
              pending_members_count: stats.pending_members || 0,
              favorite_count: stats.favorite_count || 0,
              is_favorited: favoriteIds.includes(club._id),
              membership_status: membership?.status || 'none',
              favorite_loading: false,
              join_loading: false,
              schedule_time: scheduleTimeStr,
            };
          } catch {
            return {
              ...club,
              active_members_count: 0,
              pending_members_count: 0,
              favorite_count: 0,
              is_favorited: false,
              membership_status: 'none',
              favorite_loading: false,
              join_loading: false,
              schedule_time: 'Chưa xếp lịch',
            };
          }
        })
      );
      
      setClubs(clubsWithStats as ClubWithStats[]);
    } catch {
      toast.error('Không thể tải danh sách CLB');
    } finally {
      setLoading(false);
    }
  };

  const loadTodaySchedules = async () => {
    try {
      const res = await clubScheduleApi.getAll({ limit: 50 });
      const todayStr = new Date().toDateString();
      const count = (res?.items || []).filter((s: any) => 
        new Date(s.start_time).toDateString() === todayStr
      ).length;
      setTodaySchedulesCount(count);
    } catch {
      setTodaySchedulesCount(0);
    }
  };

  const filtered = clubs.filter((c) => {
    const matchSearch =
      !search ||
      c.name.toLowerCase().includes(search.toLowerCase()) ||
      c.code.toLowerCase().includes(search.toLowerCase());
    const matchCategory = !filterCategory || c.category === filterCategory;
    return matchSearch && matchCategory;
  });

  // Sort by favorite_count, active_members_count, updatedAt, and _id
  const sortedAndFiltered = [...filtered].sort((a, b) => {
    const favA = a.favorite_count || 0;
    const favB = b.favorite_count || 0;
    if (favB !== favA) {
      return favB - favA;
    }
    const memA = a.active_members_count || 0;
    const memB = b.active_members_count || 0;
    if (memB !== memA) {
      return memB - memA;
    }
    const timeA = a.updatedAt ? new Date(a.updatedAt).getTime() : 0;
    const timeB = b.updatedAt ? new Date(b.updatedAt).getTime() : 0;
    if (timeB !== timeA) {
      return timeB - timeA;
    }
    return a._id.localeCompare(b._id);
  });
  // Pagination calculation
  const totalPages = Math.ceil(sortedAndFiltered.length / itemsPerPage) || 1;
  const paginatedClubs = sortedAndFiltered.slice(
    (currentPage - 1) * itemsPerPage,
    currentPage * itemsPerPage
  );

  const canManageClub = (club: ClubWithStats) => {
    const currentUser = tokenStorage.getUser();
    if (!currentUser) return false;
    const userId = currentUser._id || currentUser.userId || currentUser.id;
    const role = currentUser.role?.toLowerCase();
    
    if (role === 'admin') return true;
    
    const advisorId = club.advisor_id?._id || club.advisor_id;
    const presidentId = club.president_id?._id || club.president_id;
    
    const isAdvisor = advisorId && advisorId.toString() === userId?.toString();
    const isPresident = presidentId && presidentId.toString() === userId?.toString();
    
    return !!(isAdvisor || isPresident);
  };

  const handleFavoriteClick = async (event: React.MouseEvent, club: ClubWithStats) => {
    event.stopPropagation();

    const currentUser = tokenStorage.getUser();
    if (!currentUser) {
      toast.error('Vui lòng đăng nhập để thực hiện chức năng này');
      return;
    }

    const wasFavorited = club.is_favorited;
    const prevCount = club.favorite_count || 0;

    const newFavorited = !wasFavorited;
    const newCount = newFavorited ? prevCount + 1 : Math.max(0, prevCount - 1);

    // Optimistic UI update
    setClubs((prev) =>
      prev.map((c) =>
        c._id === club._id
          ? {
              ...c,
              is_favorited: newFavorited,
              favorite_count: newCount,
              favorite_loading: true,
            }
          : c
      )
    );

    try {
      let res;
      if (newFavorited) {
        res = await clubApi.favoriteClub(club._id);
      } else {
        res = await clubApi.unfavoriteClub(club._id);
      }

      setClubs((prev) =>
        prev.map((c) =>
          c._id === club._id
            ? {
                ...c,
                is_favorited: res.is_favorited,
                favorite_count: res.favorite_count,
                favorite_loading: false,
              }
            : c
        )
      );
    } catch (err: any) {
      // Rollback
      setClubs((prev) =>
        prev.map((c) =>
          c._id === club._id
            ? {
                ...c,
                is_favorited: wasFavorited,
                favorite_count: prevCount,
                favorite_loading: false,
              }
            : c
        )
      );
      toast.error(err?.response?.data?.message || err?.message || 'Lỗi khi thay đổi trạng thái yêu thích');
    }
  };

  const handleJoinClick = async (event: React.MouseEvent, club: ClubWithStats) => {
    event.stopPropagation();

    const currentUser = tokenStorage.getUser();
    if (!currentUser) {
      toast.error('Vui lòng đăng nhập để thực hiện chức năng này');
      return;
    }

    const isStudent = currentUser.role?.toLowerCase() === 'student';
    const isAdmin = currentUser.role?.toLowerCase() === 'admin';
    if (!isStudent && !isAdmin) {
      toast.error('Chỉ sinh viên hoặc quản trị viên (test) mới được tham gia câu lạc bộ');
      return;
    }

    const semesterId = club.semester_id?._id || club.semester_id || activeSemesterId;
    if (!semesterId) {
      toast.error('Không tìm thấy học kỳ hoạt động hiện tại để đăng ký.');
      return;
    }

    setClubs((prev) =>
      prev.map((c) => (c._id === club._id ? { ...c, join_loading: true } : c))
    );

    try {
      const res = await clubApi.joinClub(club._id, { semester_id: semesterId });
      const newStatus = res.status;

      setClubs((prev) =>
        prev.map((c) => {
          if (c._id === club._id) {
            const isPending = newStatus === 'pending';
            return {
              ...c,
              membership_status: newStatus as any,
              active_members_count: isPending ? c.active_members_count : c.active_members_count + 1,
              pending_members_count: isPending ? c.pending_members_count + 1 : c.pending_members_count,
              join_loading: false,
            };
          }
          return c;
        })
      );

      if (newStatus === 'pending') {
        toast.success('Đã gửi yêu cầu tham gia câu lạc bộ, vui lòng chờ duyệt.');
      } else {
        toast.success('Tham gia câu lạc bộ thành công!');
      }
    } catch (err: any) {
      setClubs((prev) =>
        prev.map((c) => (c._id === club._id ? { ...c, join_loading: false } : c))
      );
      toast.error(err?.response?.data?.message || err?.message || 'Không thể đăng ký tham gia câu lạc bộ');
    }
  };

  const totalActiveClubs = clubs.filter((c) => c.status === 'active').length;
  const totalMembers = clubs.reduce((acc, c) => acc + c.active_members_count, 0);

  const getFriendlyTime = (dateStr: string) => {
    const updatedDate = new Date(dateStr);
    const now = new Date();
    const diffMs = now.getTime() - updatedDate.getTime();
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
    
    if (diffHours < 1) return 'Vừa xong';
    if (diffHours < 24) return `${diffHours} giờ trước`;
    const diffDays = Math.floor(diffHours / 24);
    return `${diffDays} ngày trước`;
  };

  const handleDeleteClub = async (id: string, name: string) => {
    if (confirm(`Bạn có chắc chắn muốn vô hiệu hóa CLB "${name}"?`)) {
      try {
        await clubApi.delete(id);
        toast.success(`Đã vô hiệu hóa CLB "${name}"`);
        loadClubs();
      } catch {
        toast.error('Lỗi khi vô hiệu hóa CLB');
      }
    }
  };

  return (
    <div className="px-6 pb-6 pt-0 space-y-6 custom-scrollbar overflow-y-auto h-full">
      {/* Screen-reader-only heading for accessibility */}
      <h1 className="sr-only">Phân hệ Quản lý Câu lạc bộ</h1>

      {/* Bento Stats Grid */}
      <div
        className={cn(
          "transition-all duration-300 ease-in-out overflow-hidden",
          showQuickReports
            ? "max-h-[500px] opacity-100 !mt-6"
            : "max-h-0 opacity-0 !mt-0 pointer-events-none"
        )}
      >
        <div
          className={cn(
            "grid grid-cols-1 md:grid-cols-3 gap-4 transition-transform duration-300 ease-out",
            showQuickReports ? "translate-x-0" : "translate-x-6"
          )}
        >
          {/* Stat 1 */}
          <div className="relative overflow-hidden backdrop-blur-md bg-white/40 border border-white/70 rounded-2xl p-5 shadow-sm shadow-slate-200/50 flex flex-col justify-between h-32">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-blue-500/10 flex items-center justify-center text-blue-600">
                <CheckCircle2 size={20} />
              </div>
              <span className="text-[11px] font-bold tracking-wider text-slate-500 uppercase">TỔNG CLB ĐANG HOẠT ĐỘNG</span>
            </div>
            <div className="flex items-baseline gap-3 mt-2">
              <span className="text-3xl font-black text-slate-800 leading-none">{totalActiveClubs}</span>
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-purple-500/10 text-purple-600">
                +2 mới tháng này
              </span>
            </div>
            <div className="absolute bg-gradient-to-br from-blue-500/10 to-transparent blur-xl right-[-20px] top-[-20px] w-24 h-24 rounded-full pointer-events-none" />
          </div>

          {/* Stat 2 */}
          <div className="relative overflow-hidden backdrop-blur-md bg-white/40 border border-white/70 rounded-2xl p-5 shadow-sm shadow-slate-200/50 flex flex-col justify-between h-32">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-purple-500/10 flex items-center justify-center text-purple-600">
                <Users size={20} />
              </div>
              <span className="text-[11px] font-bold tracking-wider text-slate-500 uppercase">TỔNG THÀNH VIÊN</span>
            </div>
            <div className="flex items-baseline gap-3 mt-2">
              <span className="text-3xl font-black text-slate-800 leading-none">{totalMembers.toLocaleString('vi-VN')}</span>
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-purple-500/10 text-purple-600">
                +12% tuần này
              </span>
            </div>
            <div className="absolute bg-gradient-to-br from-purple-500/10 to-transparent blur-xl right-[-20px] top-[-20px] w-24 h-24 rounded-full pointer-events-none" />
          </div>

          {/* Stat 3 */}
          <div className="relative overflow-hidden backdrop-blur-md bg-white/40 border border-white/70 rounded-2xl p-5 shadow-sm shadow-slate-200/50 flex flex-col justify-between h-32">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-amber-500/10 flex items-center justify-center text-amber-600">
                <Calendar size={20} />
              </div>
              <span className="text-[11px] font-bold tracking-wider text-slate-500 uppercase">HOẠT ĐỘNG HÔM NAY</span>
            </div>
            <div className="flex items-baseline gap-3 mt-2">
              <span className="text-3xl font-black text-slate-800 leading-none">{todaySchedulesCount}</span>
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-slate-500/10 text-slate-500">
                sự kiện đang diễn ra
              </span>
            </div>
            <div className="absolute bg-gradient-to-br from-amber-500/10 to-transparent blur-xl right-[-20px] top-[-20px] w-24 h-24 rounded-full pointer-events-none" />
          </div>
        </div>
      </div>

      {/* Filter and Action Controls */}
      <div className={cn(
        "flex flex-col md:flex-row gap-3 items-center justify-between bg-white/30 backdrop-blur-sm p-3 rounded-2xl border border-white/50",
        !showQuickReports && "!mt-0"
      )}>
        <div className="flex flex-col sm:flex-row gap-3 w-full md:w-auto flex-1">
          {/* Search */}
          <div className="relative flex-1 md:max-w-md">
            <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              placeholder="Tìm theo tên hoặc mã câu lạc bộ..."
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setCurrentPage(1);
              }}
              className="w-full pl-10 pr-4 py-2 bg-white/75 border border-slate-200 rounded-xl text-sm text-slate-700 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all shadow-sm"
            />
          </div>
          {/* Category Filter */}
          <div className="relative min-w-[160px] w-full sm:w-auto">
            <Filter size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none z-10" />
            <Select
              value={filterCategory || "all"}
              onValueChange={(val) => {
                setFilterCategory(val === "all" ? "" : val);
                setCurrentPage(1);
              }}
            >
              <SelectTrigger className="w-full pl-10 pr-8 h-10 bg-white/75 border border-slate-200 rounded-xl text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 shadow-sm cursor-pointer">
                <SelectValue placeholder="Tất cả loại CLB" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Tất cả loại CLB</SelectItem>
                {Object.entries(categoryConfigs).map(([k, conf]) => (
                  <SelectItem key={k} value={k}>
                    {conf.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* Right side actions and view toggle */}
        <div className="flex flex-wrap items-center justify-end gap-3 w-full md:w-auto">
          {/* Quick report button */}
          <button
            onClick={() => setShowQuickReports(!showQuickReports)}
            title={showQuickReports ? "Ẩn báo cáo nhanh" : "Hiện báo cáo nhanh"}
            aria-label={showQuickReports ? "Ẩn báo cáo nhanh" : "Hiện báo cáo nhanh"}
            className={cn(
              "flex items-center justify-center h-10 w-10 rounded-xl transition-all border cursor-pointer shrink-0",
              showQuickReports
                ? "bg-blue-50 border-blue-200 text-blue-600 hover:bg-blue-100"
                : "bg-white border-slate-200 text-slate-600 hover:bg-slate-50 hover:text-slate-900"
            )}
          >
            <BarChart3 size={18} />
          </button>

          {/* Create Club button */}
          <button
            onClick={() => setShowCreateModal(true)}
            className="flex items-center justify-center gap-2 px-5 py-2.5 bg-blue-600 text-white text-sm font-semibold rounded-xl hover:bg-blue-700 transition-all shadow-lg shadow-blue-600/20 active:scale-95 cursor-pointer shrink-0"
          >
            <Plus size={18} />
            <span className="hidden sm:inline">Tạo Câu lạc bộ Mới</span>
            <span className="sm:hidden">Tạo CLB</span>
          </button>

          {/* View Toggle */}
          <div className="flex items-center gap-1.5 p-1 bg-slate-200/50 rounded-xl shrink-0">
            <button
              onClick={() => setViewMode('grid')}
              className={cn(
                "p-2 rounded-lg transition-all cursor-pointer",
                viewMode === 'grid'
                  ? 'bg-white text-blue-600 shadow-sm'
                  : 'text-slate-500 hover:text-slate-700'
              )}
              title="Dạng thẻ"
            >
              <Grid size={16} />
            </button>
            <button
              onClick={() => setViewMode('table')}
              className={cn(
                "p-2 rounded-lg transition-all cursor-pointer",
                viewMode === 'table'
                  ? 'bg-white text-blue-600 shadow-sm'
                  : 'text-slate-500 hover:text-slate-700'
              )}
              title="Dạng bảng"
            >
              <List size={16} />
            </button>
          </div>
        </div>
      </div>

      {/* Main Content Area */}
      {loading ? (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="h-[180px] bg-white/40 rounded-2xl animate-pulse border border-white" />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 bg-white/30 backdrop-blur-sm rounded-2xl border border-white/60 text-center">
          <div className="w-16 h-16 bg-blue-50 rounded-2xl flex items-center justify-center mb-4 text-blue-500">
            <Compass size={32} className="animate-spin-slow" />
          </div>
          <h3 className="text-base font-bold text-slate-700">Không tìm thấy câu lạc bộ nào</h3>
          <p className="text-xs text-slate-400 mt-1 max-w-sm">
            Thử thay đổi từ khóa tìm kiếm, chọn bộ lọc khác hoặc tạo một câu lạc bộ mới.
          </p>
        </div>
      ) : viewMode === 'grid' ? (
        // Grid View
        <div className="space-y-6">


          {/* Balanced Cards Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
             {paginatedClubs.map((club) => {
              const conf = categoryConfigs[club.category] || categoryConfigs.other;
              const currentUser = tokenStorage.getUser();
              const template = BACKGROUND_TEMPLATES.find((t) => t.id === club.background_config?.pattern);
              const cardBgClass = template 
                ? template.bgClass 
                : (BACKGROUND_PRESETS.find((p) => p.id === club.background_config?.preset)?.className || "bg-white/45 border-white/70");
              const accentColor = club.background_config?.accentColor || (template ? template.accentColor : getClubAccentColor(club));
              const isCustomBg = !!club.background_config?.backgroundImageUrl || (club.background_config?.useAvatarAsBackground && !!club.logo_url);
              const customBgUrl = club.background_config?.backgroundImageUrl
                ? getImageUrl(club.background_config.backgroundImageUrl)
                : (club.background_config?.useAvatarAsBackground && club.logo_url)
                  ? getImageUrl(club.logo_url)
                  : null;

              return (
                <div
                  key={club._id}
                  onClick={() => router.push(`/club/clubs/${club._id}`)}
                  className={cn(
                    "group relative backdrop-blur-md rounded-2xl overflow-hidden shadow-sm hover:shadow-md hover:-translate-y-0.5 hover:bg-white/80 transition-all duration-300 flex flex-col sm:flex-row min-h-[210px] sm:min-h-0 sm:h-[160px] cursor-pointer border p-3.5 sm:p-4 justify-between gap-3.5",
                    cardBgClass
                  )}
                  style={{
                    borderTopWidth: '3px',
                    borderTopColor: accentColor,
                  }}
                >
                  {/* Whole-card Custom Background under a light gradient filter backdrop blur */}
                  {customBgUrl && (
                    <>
                      <div 
                        className="absolute inset-0 pointer-events-none z-0" 
                        style={{
                          backgroundImage: `url(${customBgUrl})`,
                          backgroundSize: 'cover',
                          backgroundPosition: 'center',
                          backgroundRepeat: 'no-repeat',
                          filter: 'blur(4.5px)',
                        }}
                      />
                      <div className="absolute inset-0 bg-gradient-to-b from-white/80 via-white/85 to-white/90 pointer-events-none z-0" />
                    </>
                  )}

                  {/* Pattern Overlay */}
                  {club.background_config?.pattern && (
                    <div 
                      className="absolute inset-0 pointer-events-none opacity-65 z-0" 
                      style={getPatternStyle(
                        BACKGROUND_TEMPLATES.find((t) => t.id === club.background_config.pattern)?.patternId || club.background_config.pattern, 
                        accentColor
                      )} 
                    />
                  )}

                  {/* Left Column */}
                  <div className="flex-1 flex flex-col justify-between min-w-0 z-10">
                    <div>
                      {/* Top Header Flex Row */}
                      <div className="flex flex-wrap items-center gap-1.5 min-w-0">
                        <span className="text-[9px] font-extrabold px-2 py-0.5 rounded-full bg-white/90 text-slate-800 backdrop-blur-sm shadow-sm border border-slate-200/40">
                          {conf.label}
                        </span>
                        <span className={cn(
                          "text-[9px] font-bold px-1.5 py-0.5 rounded backdrop-blur-sm shadow-sm border",
                          club.status === 'active' ? 'bg-emerald-50/80 border-emerald-100 text-emerald-600' :
                          club.status === 'suspended' ? 'bg-red-50/80 border-red-100 text-red-600' :
                          'bg-slate-50 border-slate-200 text-slate-500'
                        )}>
                          {club.status === 'active' ? 'Hoạt động' : club.status === 'suspended' ? 'Tạm dừng' : 'Không hoạt động'}
                        </span>
                        <span className="text-[10px] font-mono font-bold text-slate-400 tracking-wider">
                          {club.code}
                        </span>
                      </div>

                      {/* Club Name */}
                      <h3 className="text-sm font-bold text-slate-800 group-hover:text-blue-600 transition-colors line-clamp-2 leading-snug mt-2.5">
                        {club.name}
                      </h3>
                    </div>

                    {/* Left Bottom Stats */}
                    <div className="flex items-center gap-2.5 text-slate-500 text-xs font-semibold pt-2">
                      <div className="flex items-center gap-1" title={`${club.active_members_count} thành viên`}>
                        <Users size={12} className="text-slate-400 shrink-0" />
                        <span className="text-[11px] font-bold text-slate-700">{club.active_members_count}/{club.max_members || '∞'}</span>
                      </div>
                      <div className="flex items-center gap-1" title={`${club.favorite_count || 0} lượt yêu thích`}>
                        <Heart size={12} className={club.is_favorited ? "fill-pink-500 text-pink-500 shrink-0" : "text-slate-400 shrink-0"} />
                        <span className="text-[11px] font-bold text-slate-600">{club.favorite_count || 0}</span>
                      </div>
                    </div>
                  </div>

                  {/* Right Column */}
                  <div className="flex flex-col justify-between items-end sm:w-[170px] shrink-0 z-10 gap-2">
                    {/* Top: Favorite button */}
                    <div className="flex justify-end w-full">
                      <button
                        disabled={club.favorite_loading}
                        onClick={(e) => handleFavoriteClick(e, club)}
                        className="w-8 h-8 rounded-full bg-white/80 hover:bg-white text-slate-600 hover:text-pink-500 flex items-center justify-center backdrop-blur-sm shadow-sm border border-slate-100/50 active:scale-90 transition-all cursor-pointer disabled:opacity-50"
                      >
                        {club.favorite_loading ? (
                          <span className="w-3.5 h-3.5 border-2 border-pink-500 border-t-transparent rounded-full animate-spin" />
                        ) : club.is_favorited ? (
                          <Heart size={15} className="fill-pink-500 text-pink-500" />
                        ) : (
                          <Heart size={15} className="transition-colors" />
                        )}
                      </button>
                    </div>

                    {/* Middle: Schedule and Location boxes */}
                    <div className="space-y-1 text-xs font-semibold w-full">
                      {/* Schedule Time */}
                      <div className="flex items-center gap-1.5 text-slate-700 bg-blue-50/50 hover:bg-blue-50 px-2 py-0.5 rounded-md border border-blue-100/30 transition-colors">
                        <Clock size={11} className="text-blue-500 shrink-0" />
                        <div className="min-w-0 flex-1">
                          <span className="block text-slate-800 text-[10px] font-bold truncate" title={club.schedule_time}>
                            {club.schedule_time || 'Chưa xếp lịch'}
                          </span>
                        </div>
                      </div>

                      {/* Location / Classroom */}
                      <div className="flex items-center gap-1.5 text-slate-700 bg-amber-50/50 hover:bg-amber-50 px-2 py-0.5 rounded-md border border-amber-100/30 transition-colors">
                        <MapPin size={11} className="text-amber-500 shrink-0" />
                        <div className="min-w-0 flex-1">
                          <span className="block text-slate-800 text-[10px] font-bold truncate" title={club.classroom}>
                            {club.classroom || 'Chưa xếp phòng'}
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Bottom: Actions */}
                    <div className="flex items-center gap-1.5 w-full justify-end" onClick={(e) => e.stopPropagation()}>
                      {canManageClub(club) && (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => {
                            setSelectedClubForBg(club);
                            setShowBgSetupModal(true);
                          }}
                          className="h-7 text-[10px] px-2.5 font-bold rounded-lg cursor-pointer transition-all border-blue-500 text-blue-600 hover:bg-blue-50 flex items-center gap-1 shrink-0"
                        >
                          <Palette size={12} className="shrink-0" />
                          Nền
                        </Button>
                      )}
                      <Button
                        variant={
                          club.membership_status === 'active' ? 'outline' :
                          club.membership_status === 'pending' ? 'secondary' : 'default'
                        }
                        size="sm"
                        disabled={
                          club.join_loading ||
                          club.membership_status === 'active' ||
                          club.membership_status === 'pending' ||
                          club.status !== 'active' ||
                          !club.settings?.allow_self_registration ||
                          (club.max_members ? club.active_members_count >= club.max_members : false) ||
                          (currentUser?.role && currentUser.role.toLowerCase() !== 'student' && currentUser.role.toLowerCase() !== 'admin')
                        }
                        onClick={(e) => handleJoinClick(e, club)}
                        className={cn(
                          "h-7 text-[10px] px-3 font-bold rounded-lg cursor-pointer transition-all truncate",
                          club.membership_status === 'active' && "border-emerald-500 text-emerald-600 bg-emerald-50 hover:bg-emerald-50 cursor-default",
                          club.membership_status === 'pending' && "bg-amber-100 text-amber-700 hover:bg-amber-100 cursor-default",
                          (club.status !== 'active' || !club.settings?.allow_self_registration) && "bg-slate-100 text-slate-400 border-slate-200"
                        )}
                      >
                        {club.join_loading ? (
                          <span className="w-3.5 h-3.5 border-2 border-current border-t-transparent rounded-full animate-spin" />
                        ) : club.membership_status === 'active' ? (
                          'Đã tham gia'
                        ) : club.membership_status === 'pending' ? (
                          'Đang chờ'
                        ) : club.status !== 'active' ? (
                          'Tạm dừng'
                        ) : !club.settings?.allow_self_registration ? (
                          'Khóa đăng ký'
                        ) : (club.max_members ? club.active_members_count >= club.max_members : false) ? (
                          'Đầy'
                        ) : (currentUser?.role && currentUser.role.toLowerCase() !== 'student' && currentUser.role.toLowerCase() !== 'admin') ? (
                          'Chỉ cho SV'
                        ) : (
                          'Tham gia'
                        )}
                      </Button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Simple pagination controls */}
          {totalPages > 1 && (
            <div className="flex justify-center items-center gap-2 pt-4">
              <button
                disabled={currentPage === 1}
                onClick={() => setCurrentPage(c => Math.max(1, c - 1))}
                className="px-3 py-1.5 bg-white/60 border border-slate-200 rounded-lg text-xs font-semibold text-slate-500 hover:text-slate-700 disabled:opacity-40 transition-all cursor-pointer"
              >
                Trước
              </button>
              <span className="text-xs text-slate-400">Trang {currentPage} / {totalPages}</span>
              <button
                disabled={currentPage === totalPages}
                onClick={() => setCurrentPage(c => Math.min(totalPages, c + 1))}
                className="px-3 py-1.5 bg-white/60 border border-slate-200 rounded-lg text-xs font-semibold text-slate-500 hover:text-slate-700 disabled:opacity-40 transition-all cursor-pointer"
              >
                Sau
              </button>
            </div>
          )}
        </div>
      ) : (
        // Table View
        <div className="backdrop-blur-md bg-white/45 border border-white/70 rounded-2xl overflow-hidden shadow-sm shadow-slate-200/50">
          <div className="px-5 py-4 border-b border-white/50 flex justify-between items-center bg-white/10">
            <h3 className="text-sm font-bold text-slate-800">
              Danh sách Câu lạc bộ (Hiển thị {paginatedClubs.length}/{filtered.length})
            </h3>
            <button
              onClick={() => {
                toast.success('Xuất file thành công!');
              }}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-white border border-slate-200 rounded-xl text-xs font-bold text-slate-600 hover:bg-slate-50 hover:text-slate-800 transition-all shadow-sm cursor-pointer"
            >
              <Download size={13} /> Xuất Excel
            </button>
          </div>
          
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-100/40 text-[10px] font-bold text-slate-500 tracking-wider uppercase border-b border-slate-200/80">
                  <th className="px-5 py-3.5 w-12">
                    <input type="checkbox" className="rounded border-slate-300" disabled />
                  </th>
                  <th className="px-4 py-3.5">TÊN CLB</th>
                  <th className="px-4 py-3.5">CHỦ NHIỆM</th>
                  <th className="px-4 py-3.5">PHÒNG HỌC</th>
                  <th className="px-4 py-3.5">PHÂN LOẠI</th>
                  <th className="px-4 py-3.5">THÀNH VIÊN</th>
                  <th className="px-4 py-3.5">YÊU THÍCH</th>
                  <th className="px-4 py-3.5">TRẠNG THÁI</th>
                  <th className="px-4 py-3.5">CẬP NHẬT CUỐI</th>
                  <th className="px-5 py-3.5 text-right">THAO TÁC</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 bg-white/20">
                {paginatedClubs.map((club) => {
                  const conf = categoryConfigs[club.category] || categoryConfigs.other;
                  const currentUser = tokenStorage.getUser();
                  return (
                    <tr
                      key={club._id}
                      className="hover:bg-white/40 transition-colors text-slate-700 text-xs font-semibold"
                    >
                      <td className="px-5 py-4">
                        <input type="checkbox" className="rounded border-slate-300" disabled />
                      </td>
                      <td className="px-4 py-4 min-w-[240px]">
                        <div className="flex items-center gap-3">
                          <div
                            className="w-8 h-8 rounded-lg flex items-center justify-center font-bold text-white shrink-0 shadow-sm"
                            style={{ background: conf.heroGradient }}
                          >
                            <span className="text-[10px] text-slate-700 uppercase">
                              {club.code.slice(0, 2)}
                            </span>
                          </div>
                          <div>
                            <span
                              onClick={() => router.push(`/club/clubs/${club._id}`)}
                              className="font-bold text-slate-800 hover:text-blue-600 transition-colors cursor-pointer"
                            >
                              {club.name}
                            </span>
                            <div className="text-[10px] text-slate-400 font-mono mt-0.5">ID: {club.code}</div>
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-4">
                        <span className="text-slate-800">
                          {club.president_id?.full_name || '—'}
                        </span>
                      </td>
                      <td className="px-4 py-4 text-slate-800">
                        {club.classroom || (
                          <span className="text-slate-400 italic">Chưa xếp phòng</span>
                        )}
                      </td>
                      <td className="px-4 py-4">
                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${conf.bg} ${conf.text}`}>
                          {conf.label}
                        </span>
                      </td>
                      <td className="px-4 py-4 text-slate-800">
                        {club.active_members_count}
                      </td>
                      <td className="px-4 py-4">
                        <div className="flex items-center gap-1.5" onClick={(e) => e.stopPropagation()}>
                          <button
                            disabled={club.favorite_loading}
                            onClick={(e) => handleFavoriteClick(e, club)}
                            className="p-1 rounded-full text-slate-400 hover:text-pink-500 hover:bg-slate-100 transition-all disabled:opacity-50 cursor-pointer"
                          >
                            {club.is_favorited ? (
                              <Heart size={14} className="fill-pink-500 text-pink-500" />
                            ) : (
                              <Heart size={14} />
                            )}
                          </button>
                          <span>{club.favorite_count || 0}</span>
                        </div>
                      </td>
                      <td className="px-4 py-4">
                        <span className={`inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full ${
                          club.status === 'active' ? 'bg-emerald-500/10 text-emerald-600' :
                          club.status === 'suspended' ? 'bg-red-500/10 text-red-600' :
                          'bg-slate-500/10 text-slate-500'
                        }`}>
                          <span className={`w-1 h-1 rounded-full ${
                            club.status === 'active' ? 'bg-emerald-500' :
                            club.status === 'suspended' ? 'bg-red-500' :
                            'bg-slate-500'
                          }`} />
                          {club.status === 'active' ? 'Hoạt động' : club.status === 'suspended' ? 'Tạm dừng' : 'Không hoạt động'}
                        </span>
                      </td>
                      <td className="px-4 py-4 text-slate-400">
                        {getFriendlyTime(club.updatedAt)}
                      </td>
                      <td className="px-5 py-4 text-right">
                        <div className="flex items-center justify-end gap-1.5" onClick={(e) => e.stopPropagation()}>
                          <Button
                            variant={
                              club.membership_status === 'active' ? 'outline' :
                              club.membership_status === 'pending' ? 'secondary' : 'default'
                            }
                            size="sm"
                            disabled={
                              club.join_loading ||
                              club.membership_status === 'active' ||
                              club.membership_status === 'pending' ||
                              club.status !== 'active' ||
                              !club.settings?.allow_self_registration ||
                              (club.max_members ? club.active_members_count >= club.max_members : false) ||
                              (currentUser?.role && currentUser.role.toLowerCase() !== 'student' && currentUser.role.toLowerCase() !== 'admin')
                            }
                            onClick={(e) => handleJoinClick(e, club)}
                            className={cn(
                              "h-7 text-[9px] px-2 font-bold rounded-lg cursor-pointer transition-all mr-1.5",
                              club.membership_status === 'active' && "border-emerald-500 text-emerald-600 bg-emerald-50 hover:bg-emerald-50 cursor-default",
                              club.membership_status === 'pending' && "bg-amber-100 text-amber-700 hover:bg-amber-100 cursor-default",
                              (club.status !== 'active' || !club.settings?.allow_self_registration) && "bg-slate-100 text-slate-400 border-slate-200"
                            )}
                          >
                            {club.join_loading ? (
                              <span className="w-3 h-3 border border-current border-t-transparent rounded-full animate-spin" />
                            ) : club.membership_status === 'active' ? (
                              'Đã tham gia'
                            ) : club.membership_status === 'pending' ? (
                              'Đang chờ'
                            ) : club.status !== 'active' ? (
                              'Tạm dừng'
                            ) : !club.settings?.allow_self_registration ? (
                              'Khóa đăng ký'
                            ) : (club.max_members ? club.active_members_count >= club.max_members : false) ? (
                              'Đầy'
                            ) : (currentUser?.role && currentUser.role.toLowerCase() !== 'student' && currentUser.role.toLowerCase() !== 'admin') ? (
                              'Chỉ cho SV'
                            ) : (
                              'Tham gia'
                            )}
                          </Button>
                          <button
                            onClick={() => router.push(`/club/clubs/${club._id}`)}
                            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-all cursor-pointer"
                            title="Xem chi tiết"
                          >
                            <Eye size={14} />
                          </button>
                          {canManageClub(club) && (
                            <button
                              onClick={() => {
                                setSelectedClubForBg(club);
                                setShowBgSetupModal(true);
                              }}
                              className="p-1.5 rounded-lg text-slate-400 hover:text-blue-600 hover:bg-blue-50 transition-all cursor-pointer"
                              title="Thiết lập nền"
                            >
                              <Palette size={14} />
                            </button>
                          )}
                          <button
                            onClick={() => handleDeleteClub(club._id, club.name)}
                            className="p-1.5 rounded-lg text-slate-400 hover:text-red-600 hover:bg-red-50 transition-all cursor-pointer"
                            title="Xóa/Vô hiệu hóa"
                          >
                            <Trash2 size={14} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Table pagination */}
          <div className="px-5 py-3.5 border-t border-white/50 flex justify-between items-center bg-white/10 text-xs">
            <span className="text-slate-400">Trang {currentPage} / {totalPages}</span>
            <div className="flex items-center gap-1">
              <button
                disabled={currentPage === 1}
                onClick={() => setCurrentPage(1)}
                className="p-1 border border-slate-200 rounded hover:bg-slate-50 disabled:opacity-40 transition-all cursor-pointer"
              >
                «
              </button>
              <button
                disabled={currentPage === 1}
                onClick={() => setCurrentPage(c => Math.max(1, c - 1))}
                className="px-2.5 py-1 border border-slate-200 rounded hover:bg-slate-50 disabled:opacity-40 transition-all cursor-pointer"
              >
                Trước
              </button>
              {[...Array(totalPages)].map((_, idx) => (
                <button
                  key={idx}
                  onClick={() => setCurrentPage(idx + 1)}
                  className={`px-2.5 py-1 border rounded transition-all cursor-pointer ${
                    currentPage === idx + 1
                      ? 'bg-blue-600 border-blue-600 text-white font-bold'
                      : 'border-slate-200 hover:bg-slate-50 text-slate-600'
                  }`}
                >
                  {idx + 1}
                </button>
              ))}
              <button
                disabled={currentPage === totalPages}
                onClick={() => setCurrentPage(c => Math.min(totalPages, c + 1))}
                className="px-2.5 py-1 border border-slate-200 rounded hover:bg-slate-50 disabled:opacity-40 transition-all cursor-pointer"
              >
                Sau
              </button>
              <button
                disabled={currentPage === totalPages}
                onClick={() => setCurrentPage(totalPages)}
                className="p-1 border border-slate-200 rounded hover:bg-slate-50 disabled:opacity-40 transition-all cursor-pointer"
              >
                »
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Create Modal */}
      {showCreateModal && (
        <CreateClubModal
          onClose={() => setShowCreateModal(false)}
          onSuccess={() => {
            setShowCreateModal(false);
            loadClubs();
          }}
        />
      )}

      {/* Background Setup Modal */}
      {showBgSetupModal && selectedClubForBg && (
        <BackgroundSetupModal
          club={selectedClubForBg}
          onClose={() => {
            setShowBgSetupModal(false);
            setSelectedClubForBg(null);
          }}
          onSuccess={() => {
            setShowBgSetupModal(false);
            setSelectedClubForBg(null);
            loadClubs();
          }}
        />
      )}
    </div>
  );
}

const createClubFormSchema = z.object({
  name: z.string().min(1, { message: 'Tên câu lạc bộ bắt buộc nhập.' }),
  code: z.string().min(1, { message: 'Mã câu lạc bộ bắt buộc nhập.' }).transform(val => val.trim().toUpperCase()),
  classroom: z.string().min(1, { message: 'Phòng học/Phòng hoạt động mặc định bắt buộc nhập.' }).transform(val => val.trim()),
  category: z.string().min(1, { message: 'Vui lòng chọn loại câu lạc bộ.' }),
  cover_url: z.string().optional().or(z.literal('')),
  logo_url: z.string().optional().or(z.literal('')),
  description: z.string().optional(),
  advisor_id: z.string().min(1, { message: 'Vui lòng chọn giáo viên phụ trách.' }),
  max_members: z.coerce.number().min(1, { message: 'Giới hạn thành viên tối thiểu là 1.' }).optional().or(z.literal(0)).transform(val => val || undefined),
  semester_id: z.string().optional().or(z.literal('')),
  activity_start_date: z.string().optional().or(z.literal('')),
  activity_end_date: z.string().optional().or(z.literal('')),
  settings: z.object({
    allow_self_registration: z.boolean(),
    require_approval: z.boolean(),
    attendance_point_enabled: z.boolean(),
    point_per_attendance: z.coerce.number().min(0, { message: 'Điểm không thể âm.' }),
  })
}).refine((data) => {
  if (data.activity_start_date && data.activity_end_date) {
    return new Date(data.activity_end_date) >= new Date(data.activity_start_date);
  }
  return true;
}, {
  message: 'Ngày kết thúc không thể trước ngày bắt đầu hoạt động.',
  path: ['activity_end_date'],
});

interface CreateClubFormValues {
  name: string;
  code: string;
  classroom: string;
  category: string;
  cover_url?: string;
  logo_url?: string;
  description?: string;
  advisor_id: string;
  max_members?: number;
  semester_id?: string;
  activity_start_date?: string;
  activity_end_date?: string;
  settings: {
    allow_self_registration: boolean;
    require_approval: boolean;
    attendance_point_enabled: boolean;
    point_per_attendance: number;
  };
}

function CreateClubModal({ onClose, onSuccess }: { onClose: () => void; onSuccess: () => void }) {
  const [users, setUsers] = useState<any[]>([]);
  const [semesters, setSemesters] = useState<Semester[]>([]);
  const [loadingData, setLoadingData] = useState(false);
  const [saving, setSaving] = useState(false);

  // Device upload states
  const [coverFile, setCoverFile] = useState<File | null>(null);
  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [coverPreview, setCoverPreview] = useState<string>('');
  const [logoPreview, setLogoPreview] = useState<string>('');
  const [uploadedCoverUrl, setUploadedCoverUrl] = useState<string>('');
  const [uploadedLogoUrl, setUploadedLogoUrl] = useState<string>('');
  const [isCalendarOpen, setIsCalendarOpen] = useState(false);

  const teachers = users.filter((u: any) => u.role?.role_code === 'TEACHER');

  const {
    register,
    control,
    handleSubmit,
    watch,
    setValue,
    formState: { errors },
  } = useForm<CreateClubFormValues>({
    resolver: zodResolver(createClubFormSchema as any),
    defaultValues: {
      name: '',
      code: '',
      classroom: '',
      category: 'other',
      cover_url: '',
      logo_url: '',
      description: '',
      advisor_id: '',
      max_members: undefined,
      semester_id: '',
      activity_start_date: undefined,
      activity_end_date: undefined,
      settings: {
        allow_self_registration: true,
        require_approval: true,
        attendance_point_enabled: false,
        point_per_attendance: 0,
      }
    }
  });

  const watchAttendancePointEnabled = watch('settings.attendance_point_enabled');

  useEffect(() => {
    return () => {
      if (coverPreview) URL.revokeObjectURL(coverPreview);
      if (logoPreview) URL.revokeObjectURL(logoPreview);
    };
  }, [coverPreview, logoPreview]);

  useEffect(() => {
    const fetchData = async () => {
      setLoadingData(true);
      try {
        const token = tokenStorage.getAccessToken() || '';
        const [usersList, semestersList] = await Promise.all([
          authApi.getUsers(token).catch(err => {
            console.error('Lỗi khi tải danh sách users:', err);
            return [];
          }),
          semesterApi.getSemesters().catch(err => {
            console.error('Lỗi khi tải học kỳ:', err);
            return [];
          })
        ]);
        
        setUsers(usersList);
        setSemesters(semestersList);
      } catch (err) {
        console.error('Lỗi fetch data:', err);
      } finally {
        setLoadingData(false);
      }
    };
    fetchData();
  }, []);

  const handleCoverChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    
    if (file.size > 5 * 1024 * 1024) {
      toast.error('Kích thước ảnh bìa không được vượt quá 5MB.');
      return;
    }
    
    if (!file.type.match(/^image\/(png|jpeg|webp)$/)) {
      toast.error('Chỉ hỗ trợ định dạng PNG, JPEG và WebP.');
      return;
    }
    
    setCoverFile(file);
    setUploadedCoverUrl('');
    
    const previewUrl = URL.createObjectURL(file);
    setCoverPreview(previewUrl);
  };

  const handleLogoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    
    if (file.size > 5 * 1024 * 1024) {
      toast.error('Kích thước logo không được vượt quá 5MB.');
      return;
    }
    
    if (!file.type.match(/^image\/(png|jpeg|webp)$/)) {
      toast.error('Chỉ hỗ trợ định dạng PNG, JPEG và WebP.');
      return;
    }
    
    setLogoFile(file);
    setUploadedLogoUrl('');
    
    const previewUrl = URL.createObjectURL(file);
    setLogoPreview(previewUrl);
  };

  const onSubmit = async (values: CreateClubFormValues) => {
    try {
      setSaving(true);
      
      let finalCoverUrl = uploadedCoverUrl;
      let finalLogoUrl = uploadedLogoUrl;

      // Upload Cover
      if (coverFile && !finalCoverUrl) {
        toast.info('Đang tải lên ảnh bìa...');
        const coverRes = await clubApi.uploadMedia(coverFile, 'cover');
        finalCoverUrl = coverRes.url;
        setUploadedCoverUrl(coverRes.url);
      }

      // Upload Logo
      if (logoFile && !finalLogoUrl) {
        toast.info('Đang tải lên logo...');
        const logoRes = await clubApi.uploadMedia(logoFile, 'logo');
        finalLogoUrl = logoRes.url;
        setUploadedLogoUrl(logoRes.url);
      }

      const payload = {
        name: values.name.trim(),
        code: values.code.trim().toUpperCase(),
        classroom: values.classroom.trim(),
        category: values.category,
        description: values.description?.trim() || undefined,
        cover_url: finalCoverUrl || undefined,
        logo_url: finalLogoUrl || undefined,
        advisor_id: values.advisor_id,
        max_members: values.max_members || undefined,
        semester_id: values.semester_id || undefined,
        settings: {
          ...values.settings,
          point_per_attendance: values.settings.attendance_point_enabled ? values.settings.point_per_attendance : 0
        }
      };

      await clubApi.create(payload as any);
      toast.success('Tạo câu lạc bộ thành công!');
      onSuccess();
    } catch (err: any) {
      toast.error(err?.response?.data?.message || err?.message || 'Lỗi khi tạo câu lạc bộ');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4 overflow-y-auto" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-4xl overflow-hidden border border-slate-100 flex flex-col my-8" onClick={e => e.stopPropagation()}>
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
          <div>
            <h2 className="text-base font-black text-slate-800 tracking-tight">Tạo Câu lạc bộ Mới</h2>
            <p className="text-[11px] text-slate-400 mt-0.5">Khai báo cấu hình và người phụ trách cho câu lạc bộ.</p>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 transition-colors text-xs font-semibold cursor-pointer">
            Đóng
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit(onSubmit)} className="p-6 space-y-6 text-xs font-semibold overflow-y-auto max-h-[80vh]">
          {/* Main Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            
            {/* Cột 1: Thông tin chung */}
            <div className="space-y-4">
              <h3 className="text-slate-700 font-bold border-b border-slate-100 pb-2 uppercase tracking-wider text-[10px]">1. Thông tin chung</h3>
              
              {/* Tên & Mã */}
              <div className="grid grid-cols-3 gap-4">
                <div className="col-span-2">
                  <Input
                    label="Tên CLB"
                    required
                    error={errors.name?.message}
                    placeholder="VD: CLB Nghệ thuật"
                    disabled={saving}
                    {...register('name')}
                  />
                </div>
                <div>
                  <Input
                    label="Mã viết tắt"
                    required
                    error={errors.code?.message}
                    placeholder="VD: ART"
                    disabled={saving}
                    {...register('code')}
                    onChange={(e) => {
                      e.target.value = e.target.value.toUpperCase();
                      register('code').onChange(e);
                    }}
                  />
                </div>
              </div>

              {/* Phòng học mặc định */}
              <div>
                <Input
                  label="Phòng học hoạt động mặc định"
                  required
                  error={errors.classroom?.message}
                  placeholder="VD: Phòng A101"
                  disabled={saving}
                  {...register('classroom')}
                />
              </div>

              {/* Phân loại */}
              <div>
                <Controller
                  name="category"
                  control={control}
                  render={({ field }) => (
                    <Select
                      value={field.value}
                      onValueChange={field.onChange}
                      label="Phân loại câu lạc bộ"
                      required
                      error={errors.category?.message}
                    >
                      <SelectTrigger className="h-10" disabled={saving}>
                        <SelectValue placeholder="-- Chọn phân loại --" />
                      </SelectTrigger>
                      <SelectContent>
                        {Object.entries(categoryConfigs).map(([k, conf]) => (
                          <SelectItem key={k} value={k}>
                            {conf.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                />
              </div>

              {/* Cover Image Upload */}
              <div className="flex flex-col gap-1.5">
                <label className="text-[13px] font-bold text-[#1E293B] px-1">Ảnh bìa câu lạc bộ (Cover Image)</label>
                {coverPreview ? (
                  <div className="relative h-28 w-full rounded-xl overflow-hidden border border-slate-200 bg-slate-50 group">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={coverPreview} alt="Cover Preview" className="object-cover w-full h-full" />
                    <button
                      type="button"
                      disabled={saving}
                      onClick={() => {
                        setCoverFile(null);
                        setCoverPreview('');
                        setUploadedCoverUrl('');
                      }}
                      className="absolute top-2 right-2 p-1.5 rounded-lg bg-black/60 text-white hover:bg-black/80 transition-all cursor-pointer disabled:opacity-50"
                    >
                      <X size={14} />
                    </button>
                  </div>
                ) : (
                  <label className="flex flex-col items-center justify-center h-28 w-full rounded-xl border border-dashed border-slate-300 bg-slate-50/50 hover:bg-slate-50/85 cursor-pointer transition-all gap-2 group">
                    <Upload className="h-5 w-5 text-slate-400 group-hover:text-blue-500 transition-colors" />
                    <span className="text-[10px] text-slate-500 font-semibold px-2 text-center">Tải lên ảnh bìa (PNG, JPG, WebP tối đa 5MB)</span>
                    <input
                      type="file"
                      accept="image/png, image/jpeg, image/webp"
                      className="hidden"
                      onChange={handleCoverChange}
                      disabled={saving}
                    />
                  </label>
                )}
              </div>

              {/* Logo Upload */}
              <div className="flex flex-col gap-1.5">
                <label className="text-[13px] font-bold text-[#1E293B] px-1">Logo câu lạc bộ (Logo Image)</label>
                <div className="flex gap-4 items-center">
                  {logoPreview ? (
                    <div className="relative h-20 w-20 rounded-xl overflow-hidden border border-slate-200 bg-slate-50 group shrink-0">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={logoPreview} alt="Logo Preview" className="object-cover w-full h-full" />
                      <button
                        type="button"
                        disabled={saving}
                        onClick={() => {
                          setLogoFile(null);
                          setLogoPreview('');
                          setUploadedLogoUrl('');
                        }}
                        className="absolute top-1 right-1 p-1 rounded-md bg-black/60 text-white hover:bg-black/85 transition-all cursor-pointer disabled:opacity-50"
                      >
                        <X size={10} />
                      </button>
                    </div>
                  ) : (
                    <label className="flex flex-col items-center justify-center h-20 w-20 rounded-xl border border-dashed border-slate-300 bg-slate-50/50 hover:bg-slate-50/85 cursor-pointer transition-all gap-1.5 group shrink-0">
                      <Upload className="h-4 w-4 text-slate-400 group-hover:text-blue-500 transition-colors" />
                      <span className="text-[9px] text-slate-500 font-bold text-center leading-tight px-1">Logo</span>
                      <input
                        type="file"
                        accept="image/png, image/jpeg, image/webp"
                        className="hidden"
                        onChange={handleLogoChange}
                        disabled={saving}
                      />
                    </label>
                  )}
                  <div className="text-[10px] text-slate-400 font-medium">
                    Logo hiển thị hình vuông (tỉ lệ 1:1). Hỗ trợ PNG, JPG, WebP tối đa 5MB.
                  </div>
                </div>
              </div>

              {/* Mô tả */}
              <div>
                <Input
                  multiline
                  rows={3}
                  label="Mô tả hoạt động"
                  placeholder="Mô tả tôn chỉ và phương thức sinh hoạt của câu lạc bộ..."
                  disabled={saving}
                  {...register('description')}
                />
              </div>
            </div>

            {/* Cột 2: Thời gian, Cố vấn & Thiết lập */}
            <div className="space-y-4">
              <h3 className="text-slate-700 font-bold border-b border-slate-100 pb-2 uppercase tracking-wider text-[10px]">2. Cố vấn & Cấu hình</h3>
              
              {/* Cố vấn phụ trách */}
              <div>
                <Controller
                  name="advisor_id"
                  control={control}
                  render={({ field }) => (
                    <Select
                      value={field.value}
                      onValueChange={field.onChange}
                      label="Giáo viên phụ trách (Cố vấn)"
                      required
                      error={errors.advisor_id?.message}
                    >
                      <SelectTrigger className="h-10" disabled={saving}>
                        <SelectValue placeholder="-- Chọn cố vấn --" />
                      </SelectTrigger>
                      <SelectContent>
                        {teachers.map(u => (
                          <SelectItem key={u._id || u.id} value={u._id || u.id}>
                            {`${u.full_name || u.user_name || u.username} (${u.email || 'Không có email'})${u.department ? ` - ${u.department}` : ''}`}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                />
              </div>

              {/* Học kỳ & Thành viên tối đa */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Controller
                    name="semester_id"
                    control={control}
                    render={({ field }) => (
                      <Select
                        value={field.value}
                        onValueChange={field.onChange}
                        label="Học kỳ"
                        error={errors.semester_id?.message}
                      >
                        <SelectTrigger className="h-10" disabled={saving}>
                          <SelectValue placeholder="-- Chọn học kỳ --" />
                        </SelectTrigger>
                        <SelectContent>
                          {semesters.map(s => (
                            <SelectItem key={s._id} value={s._id}>{s.semester_name}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    )}
                  />
                </div>
                <div>
                  <Input
                    type="number"
                    label="Giới hạn thành viên"
                    placeholder="Để trống nếu không giới hạn"
                    disabled={saving}
                    {...register('max_members')}
                  />
                </div>
              </div>

              {/* Settings Checkboxes */}
              <div className="space-y-3 pt-2">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-slate-700 font-bold">Cho phép tự đăng ký</p>
                    <p className="text-[10px] text-slate-400 font-medium">Người dùng có thể tham gia mà không cần chờ duyệt</p>
                  </div>
                  <input
                    type="checkbox"
                    disabled={saving}
                    {...register('settings.allow_self_registration')}
                    className="w-4 h-4 text-blue-600 border-slate-300 rounded focus:ring-blue-500 cursor-pointer"
                  />
                </div>

                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-slate-700 font-bold">Yêu cầu phê duyệt</p>
                    <p className="text-[10px] text-slate-400 font-medium">Ban chủ nhiệm hoặc Cố văn duyệt đơn</p>
                  </div>
                  <input
                    type="checkbox"
                    disabled={saving}
                    {...register('settings.require_approval')}
                    className="w-4 h-4 text-blue-600 border-slate-300 rounded focus:ring-blue-500 cursor-pointer"
                  />
                </div>

                <div className="flex items-center justify-between border-t border-slate-100 pt-3">
                  <div>
                    <p className="text-slate-700 font-bold">Tích lũy điểm rèn luyện</p>
                    <p className="text-[10px] text-slate-400 font-medium">Cộng điểm rèn luyện khi đi điểm danh</p>
                  </div>
                  <input
                    type="checkbox"
                    disabled={saving}
                    {...register('settings.attendance_point_enabled')}
                    className="w-4 h-4 text-blue-600 border-slate-300 rounded focus:ring-blue-500 cursor-pointer"
                  />
                </div>

                {watchAttendancePointEnabled && (
                  <div className="animate-fade-in pl-4 border-l-2 border-blue-500 py-1 transition-all">
                    <label className="block text-slate-500 mb-1">Số điểm mỗi buổi điểm danh *</label>
                    <input
                      type="number"
                      step="0.1"
                      disabled={saving}
                      {...register('settings.point_per_attendance')}
                      className="w-32 px-3 py-1.5 bg-white border border-slate-200 rounded-lg text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                      placeholder="VD: 0.5"
                    />
                    {errors.settings?.point_per_attendance && <p className="text-red-500 text-[10px] mt-1 font-medium">{errors.settings.point_per_attendance.message}</p>}
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Buttons */}
          <div className="flex justify-end gap-3 pt-4 border-t border-slate-100">
            <button
              type="button"
              onClick={onClose}
              disabled={saving}
              className="px-4 py-2 border border-slate-200 text-slate-500 hover:bg-slate-50 rounded-xl transition-all cursor-pointer disabled:opacity-50"
            >
              Hủy
            </button>
            <button
              type="submit"
              disabled={saving}
              className="px-5 py-2 bg-blue-600 text-white font-bold rounded-xl hover:bg-blue-700 disabled:opacity-50 transition-all shadow-md shadow-blue-500/20 cursor-pointer flex items-center gap-2"
            >
              {saving && <Plus size={14} className="animate-spin" />}
              {saving ? 'Đang tạo...' : 'Tạo câu lạc bộ'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export interface BackgroundTemplate {
  id: string;
  name: string;
  bgClass: string;
  accentColor: string;
  patternId: string;
}

const BACKGROUND_TEMPLATES: BackgroundTemplate[] = [
  {
    id: 'luxury-gold',
    name: 'Hoàng gia Gold (Luxury Gold)',
    bgClass: 'bg-gradient-to-br from-amber-50/60 via-orange-50/10 to-yellow-50/30 border-amber-200',
    accentColor: '#D97706',
    patternId: 'premium-frame',
  },
  {
    id: 'cyber-tech',
    name: 'Cyber Xanh (Cyber Tech)',
    bgClass: 'bg-gradient-to-br from-cyan-50/30 via-slate-50/10 to-blue-50/30 border-cyan-200',
    accentColor: '#06B6D4',
    patternId: 'circuit-corners',
  },
  {
    id: 'academic-prestige',
    name: 'Học thuật Indigo (Academic)',
    bgClass: 'bg-gradient-to-br from-indigo-50/40 via-sky-50/10 to-slate-100/40 border-indigo-200',
    accentColor: '#4F46E5',
    patternId: 'campus-badge-frame',
  },
  {
    id: 'sunset-wave',
    name: 'Hoàng hôn Rose (Sunset Wave)',
    bgClass: 'bg-gradient-to-br from-rose-50/40 via-amber-50/10 to-rose-100/20 border-rose-200',
    accentColor: '#E11D48',
    patternId: 'wave-corner-mix',
  },
  {
    id: 'eco-blossom',
    name: 'Mầm xanh Mint (Eco Blossom)',
    bgClass: 'bg-gradient-to-br from-emerald-50/40 via-teal-50/10 to-green-50/20 border-emerald-200',
    accentColor: '#10B981',
    patternId: 'botanical-corners',
  },
  {
    id: 'minimal-clean',
    name: 'Tối giản Slate (Minimal Clean)',
    bgClass: 'bg-white border-slate-200/80',
    accentColor: '#64748B',
    patternId: 'spark-dot-frame',
  }
];

const getPatternStyle = (pattern?: string, color?: string): React.CSSProperties => {
  const c = color || '#3B82F6';
  
  let svgString = '';
  switch (pattern) {
    case 'gold-corners':
      svgString = `
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 300 320" width="100%" height="100%">
  <defs>
    <linearGradient id="goldGrad" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#F59E0B" stop-opacity="0.35"/>
      <stop offset="100%" stop-color="#D97706" stop-opacity="0.15"/>
    </linearGradient>
  </defs>
  <path d="M 0 0 L 40 0 C 40 20, 20 40, 0 40 Z" fill="url(#goldGrad)"/>
  <path d="M 0 0 L 50 0 C 50 25, 25 50, 0 50 Z" fill="none" stroke="#F59E0B" stroke-width="1.8" opacity="0.35"/>
  <path d="M 0 0 L 30 0 C 30 15, 15 30, 0 30 Z" fill="none" stroke="${c}" stroke-width="1.2" opacity="0.25"/>
  <path d="M 300 0 L 260 0 C 260 20, 280 40, 300 40 Z" fill="url(#goldGrad)"/>
  <path d="M 300 0 L 250 0 C 250 25, 275 50, 300 50 Z" fill="none" stroke="#F59E0B" stroke-width="1.8" opacity="0.35"/>
  <path d="M 0 320 L 40 320 C 40 300, 20 280, 0 280 Z" fill="url(#goldGrad)"/>
  <path d="M 0 320 L 50 320 C 50 295, 25 270, 0 270 Z" fill="none" stroke="#F59E0B" stroke-width="1.8" opacity="0.35"/>
  <path d="M 300 320 L 260 320 C 260 300, 280 280, 300 280 Z" fill="url(#goldGrad)"/>
  <path d="M 300 320 L 250 320 C 250 295, 275 270, 300 270 Z" fill="none" stroke="#F59E0B" stroke-width="1.8" opacity="0.35"/>
</svg>`;
      break;
    case 'soft-waves':
      svgString = `
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 300 320" width="100%" height="100%">
  <path d="M -20,100 Q 80,60, 180,120 T 320,80 L 320,340 L -20,340 Z" fill="${c}" opacity="0.12"/>
  <path d="M -20,140 Q 60,180, 160,110 T 320,160 L 320,340 L -20,340 Z" fill="${c}" opacity="0.08"/>
  <path d="M -20,180 Q 100,120, 200,200 T 320,150 L 320,340 L -20,340 Z" fill="${c}" opacity="0.1"/>
</svg>`;
      break;
    case 'circuit-corners':
      svgString = `
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 300 160" width="100%" height="100%">
  <defs>
    <radialGradient id="cyberGlow" cx="20%" cy="80%" r="50%">
      <stop offset="0%" stop-color="${c}" stop-opacity="0.2"/>
      <stop offset="100%" stop-color="${c}" stop-opacity="0"/>
    </radialGradient>
  </defs>
  <rect width="300" height="160" fill="url(#cyberGlow)" />
  <g fill="${c}" opacity="0.2">
    <circle cx="100" cy="40" r="1" />
    <circle cx="115" cy="40" r="1" />
    <circle cx="130" cy="40" r="1" />
    <circle cx="100" cy="55" r="1" />
    <circle cx="115" cy="55" r="1" />
    <circle cx="130" cy="55" r="1" />
  </g>
  <path d="M 10 135 H 120 L 140 155 H 290" fill="none" stroke="${c}" stroke-width="1.2" opacity="0.35" />
  <path d="M 20 130 H 115" fill="none" stroke="${c}" stroke-width="0.8" stroke-dasharray="3 3" opacity="0.2" />
  <g stroke="${c}" stroke-width="0.8" fill="none" opacity="0.3" transform="translate(160, 45)">
    <circle cx="0" cy="0" r="5" />
    <line x1="-8" y1="0" x2="8" y2="0" />
    <line x1="0" y1="-8" x2="0" y2="8" />
  </g>
</svg>`;
      break;
    case 'diagonal-frames':
      svgString = `
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 300 320" width="100%" height="100%">
  <rect x="10" y="10" width="280" height="300" rx="10" fill="none" stroke="${c}" stroke-width="1.2" opacity="0.22" />
  <g stroke="${c}" stroke-width="1.2" opacity="0.22">
    <line x1="240" y1="10" x2="290" y2="60" />
    <line x1="255" y1="10" x2="290" y2="45" />
    <line x1="270" y1="10" x2="290" y2="30" />
    <line x1="225" y1="10" x2="290" y2="75" />
  </g>
  <g stroke="${c}" stroke-width="1.2" opacity="0.22">
    <line x1="10" y1="240" x2="90" y2="310" />
    <line x1="10" y1="255" x2="75" y2="310" />
    <line x1="10" y1="270" x2="60" y2="310" />
    <line x1="10" y1="225" x2="105" y2="310" />
  </g>
</svg>`;
      break;
    case 'academic-lines':
      svgString = `
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 300 320" width="100%" height="100%">
  <defs>
    <pattern id="acLines" width="100" height="20" patternUnits="userSpaceOnUse">
      <line x1="0" y1="20" x2="100" y2="20" stroke="${c}" stroke-width="0.8" opacity="0.2" />
    </pattern>
  </defs>
  <line x1="40" y1="0" x2="40" y2="320" stroke="#EF4444" stroke-width="1.2" opacity="0.3" />
  <rect width="300" height="320" fill="url(#acLines)" />
</svg>`;
      break;
    case 'premium-frame':
      svgString = `
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 300 160" width="100%" height="100%">
  <defs>
    <radialGradient id="goldGlow" cx="80%" cy="20%" r="60%">
      <stop offset="0%" stop-color="${c}" stop-opacity="0.22"/>
      <stop offset="100%" stop-color="${c}" stop-opacity="0"/>
    </radialGradient>
  </defs>
  <rect width="300" height="160" fill="url(#goldGlow)" />
  <path d="M 0 145 C 80 120, 160 155, 300 130" fill="none" stroke="${c}" stroke-width="1.2" opacity="0.35" />
  <path d="M 0 150 C 75 125, 155 160, 300 135" fill="none" stroke="${c}" stroke-width="0.8" stroke-dasharray="4 2" opacity="0.2" />
  <path d="M 120 30 Q 120 36, 126 36 Q 120 36, 120 42 Q 120 36, 114 36 Q 120 36, 120 30 Z" fill="${c}" opacity="0.5" />
  <path d="M 235 65 Q 235 70, 240 70 Q 235 70, 235 75 Q 235 70, 230 70 Q 235 70, 235 65 Z" fill="${c}" opacity="0.4" />
  <path d="M 45 100 Q 45 103, 48 103 Q 45 103, 45 106 Q 45 103, 42 103 Q 45 103, 45 100 Z" fill="${c}" opacity="0.3" />
</svg>`;
      break;
    case 'botanical-corners':
      svgString = `
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 300 160" width="100%" height="100%">
  <defs>
    <radialGradient id="mintGlow" cx="15%" cy="15%" r="50%">
      <stop offset="0%" stop-color="${c}" stop-opacity="0.18"/>
      <stop offset="100%" stop-color="${c}" stop-opacity="0"/>
    </radialGradient>
  </defs>
  <rect width="300" height="160" fill="url(#mintGlow)" />
  <circle cx="180" cy="35" r="4.5" fill="none" stroke="${c}" stroke-width="0.8" opacity="0.2" />
  <circle cx="230" cy="115" r="8" fill="none" stroke="${c}" stroke-width="0.8" opacity="0.15" />
  <circle cx="75" cy="120" r="3.5" fill="none" stroke="${c}" stroke-width="0.6" opacity="0.18" />
  <path d="M 0,20 C 30,20 40,40 60,30 S 80,10 100,20" fill="none" stroke="${c}" stroke-width="1.2" opacity="0.22" />
  <path d="M 60,30 C 58,25 50,22 46,24 C 42,26 44,32 60,30 Z" fill="${c}" fill-opacity="0.12" stroke="${c}" stroke-width="0.8" opacity="0.22" />
  <path d="M 80,10 C 82,15 90,18 94,16 C 98,14 96,8 80,10 Z" fill="${c}" fill-opacity="0.12" stroke="${c}" stroke-width="0.8" opacity="0.22" />
</svg>`;
      break;
    case 'geometric-ribbon':
      svgString = `
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 300 160" width="100%" height="100%">
  <path d="M 0 24 L 24 0 L 36 0 L 0 36 Z" fill="${c}" opacity="0.25"/>
  <path d="M 0 12 L 12 0 L 16 0 L 0 16 Z" fill="${c}" opacity="0.4"/>
  <path d="M 300 24 L 276 0 L 264 0 L 300 36 Z" fill="${c}" opacity="0.25"/>
  <path d="M 300 12 L 288 0 L 284 0 L 300 16 Z" fill="${c}" opacity="0.4"/>
  <line x1="45" y1="6" x2="255" y2="6" stroke="${c}" stroke-width="1" stroke-dasharray="4 4" opacity="0.3"/>
  <line x1="45" y1="154" x2="255" y2="154" stroke="${c}" stroke-width="1" stroke-dasharray="4 4" opacity="0.3"/>
</svg>`;
      break;
    case 'spark-dot-frame':
      svgString = `
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 300 160" width="100%" height="100%">
  <g fill="${c}" opacity="0.1">
    <circle cx="40" cy="30" r="1" />
    <circle cx="80" cy="30" r="1" />
    <circle cx="120" cy="30" r="1" />
    <circle cx="160" cy="30" r="1" />
    <circle cx="200" cy="30" r="1" />
    <circle cx="240" cy="30" r="1" />
    <circle cx="40" cy="65" r="1" />
    <circle cx="80" cy="65" r="1" />
    <circle cx="120" cy="65" r="1" />
    <circle cx="160" cy="65" r="1" />
    <circle cx="200" cy="65" r="1" />
    <circle cx="240" cy="65" r="1" />
    <circle cx="40" cy="100" r="1" />
    <circle cx="80" cy="100" r="1" />
    <circle cx="120" cy="100" r="1" />
    <circle cx="160" cy="100" r="1" />
    <circle cx="200" cy="100" r="1" />
    <circle cx="240" cy="100" r="1" />
  </g>
  <g stroke="${c}" stroke-width="0.8" opacity="0.25">
    <line x1="20" y1="20" x2="35" y2="20" />
    <line x1="20" y1="20" x2="20" y2="35" />
    <line x1="20" y1="20" x2="60" y2="20" stroke-dasharray="3 3" />
    <line x1="280" y1="140" x2="265" y2="140" />
    <line x1="280" y1="140" x2="280" y2="125" />
    <line x1="280" y1="140" x2="240" y2="140" stroke-dasharray="3 3" />
  </g>
</svg>`;
      break;
    case 'wave-corner-mix':
      svgString = `
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 300 160" width="100%" height="100%">
  <defs>
    <radialGradient id="sunGlow" cx="80%" cy="80%" r="70%">
      <stop offset="0%" stop-color="${c}" stop-opacity="0.22"/>
      <stop offset="100%" stop-color="${c}" stop-opacity="0"/>
    </radialGradient>
  </defs>
  <rect width="300" height="160" fill="url(#sunGlow)" />
  <path d="M -20,110 C 60,80 140,140 220,105 T 320,125" fill="none" stroke="${c}" stroke-width="1.5" opacity="0.22" />
  <path d="M -20,120 C 70,95 130,150 210,115 T 320,135" fill="none" stroke="${c}" stroke-width="1" stroke-dasharray="6 3" opacity="0.15" />
  <circle cx="45" cy="50" r="7" fill="none" stroke="${c}" stroke-width="0.8" opacity="0.18" />
  <circle cx="49" cy="48" r="1.5" fill="${c}" opacity="0.1" />
  <circle cx="110" cy="95" r="12" fill="none" stroke="${c}" stroke-width="0.8" opacity="0.14" />
  <circle cx="210" cy="40" r="5" fill="none" stroke="${c}" stroke-width="0.8" opacity="0.15" />
  <circle cx="255" cy="100" r="8" fill="none" stroke="${c}" stroke-width="0.8" opacity="0.14" />
</svg>`;
      break;
    case 'campus-badge-frame':
      svgString = `
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 300 160" width="100%" height="100%">
  <defs>
    <radialGradient id="acadGlow" cx="50%" cy="50%" r="55%">
      <stop offset="0%" stop-color="${c}" stop-opacity="0.1"/>
      <stop offset="100%" stop-color="${c}" stop-opacity="0"/>
    </radialGradient>
  </defs>
  <rect width="300" height="160" fill="url(#acadGlow)" />
  <line x1="20" y1="50" x2="280" y2="50" stroke="${c}" stroke-width="0.6" opacity="0.12" />
  <line x1="20" y1="80" x2="280" y2="80" stroke="${c}" stroke-width="0.6" opacity="0.12" />
  <line x1="20" y1="110" x2="280" y2="110" stroke="${c}" stroke-width="0.6" opacity="0.12" />
  <path d="M 0 40 A 40 40 0 0 1 40 0" fill="none" stroke="${c}" stroke-width="1.2" opacity="0.2" />
  <path d="M 0 35 A 35 35 0 0 1 35 0" fill="none" stroke="${c}" stroke-width="0.8" stroke-dasharray="3 2" opacity="0.12" />
  <path d="M 300 40 A 40 40 0 0 0 260 0" fill="none" stroke="${c}" stroke-width="1.2" opacity="0.2" />
  <g fill="none" stroke="${c}" stroke-width="1" opacity="0.08" transform="translate(80, 80) scale(1.4)">
    <path d="M -15 -5 L 0 -12 L 15 -5 L 0 2 Z" />
    <path d="M -10 -2 L -10 8 C -10 12, 10 12, 10 8 L 10 -2" />
    <line x1="12" y1="-3" x2="12" y2="8" />
    <circle cx="12" cy="9" r="1.2" fill="${c}" />
  </g>
</svg>`;
      break;
    case 'minimal':
    default:
      return {};
  }

  const cleanSvg = svgString.replace(/[\r\n\t]/g, ' ').trim();
  return {
    backgroundImage: `url("data:image/svg+xml,${encodeURIComponent(cleanSvg)}")`,
    backgroundSize: '100% 100%',
    backgroundRepeat: 'no-repeat',
  };
};

function BackgroundSetupModal({
  club,
  onClose,
  onSuccess,
}: {
  club: ClubWithStats;
  onClose: () => void;
  onSuccess: () => void;
}) {
  const [selectedPreset, setSelectedPreset] = useState(club.background_config?.preset || 'default');
  const [accentColor, setAccentColor] = useState(club.background_config?.accentColor || '#3B82F6');
  const [useAvatarAsBackground, setUseAvatarAsBackground] = useState(club.background_config?.useAvatarAsBackground || false);
  const [backgroundImageUrl, setBackgroundImageUrl] = useState(club.background_config?.backgroundImageUrl || '');
  const [bgFile, setBgFile] = useState<File | null>(null);
  const [bgPreview, setBgPreview] = useState(club.background_config?.backgroundImageUrl ? getImageUrl(club.background_config.backgroundImageUrl) : '');
  
  // New States
  const [selectedPattern, setSelectedPattern] = useState(club.background_config?.pattern || 'minimal');

  const [saving, setSaving] = useState(false);

  useEffect(() => {
    return () => {
      if (bgPreview && bgFile) {
        URL.revokeObjectURL(bgPreview);
      }
    };
  }, [bgPreview, bgFile]);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 5 * 1024 * 1024) {
      toast.error('Kích thước ảnh không được vượt quá 5MB.');
      return;
    }

    setBgFile(file);
    const previewUrl = URL.createObjectURL(file);
    setBgPreview(previewUrl);
    setUseAvatarAsBackground(false);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      let finalBgUrl = backgroundImageUrl;
      if (bgFile) {
        toast.info('Đang tải lên ảnh nền...');
        const res = await clubApi.uploadMedia(bgFile, 'cover');
        finalBgUrl = res.url;
      }

      await clubApi.update(club._id, {
        background_config: {
          preset: selectedPreset,
          accentColor,
          backgroundImageUrl: finalBgUrl,
          useAvatarAsBackground,
          pattern: selectedPattern,
        },
      });

      toast.success('Cập nhật hình nền thành công!');
      onSuccess();
    } catch (err: any) {
      toast.error(err?.response?.data?.message || err?.message || 'Không thể lưu hình nền');
    } finally {
      setSaving(false);
    }
  };

  const previewTemplate = BACKGROUND_TEMPLATES.find((t) => t.id === selectedPattern);
  const previewCardBgClass = previewTemplate 
    ? previewTemplate.bgClass 
    : (BACKGROUND_PRESETS.find((p) => p.id === selectedPreset)?.className || "bg-white border-slate-200");
  const previewCategoryConf = categoryConfigs[club.category] || categoryConfigs.other;

  const previewCustomBgUrl = bgPreview
    ? bgPreview
    : (useAvatarAsBackground && club.logo_url)
      ? getImageUrl(club.logo_url)
      : null;

  return (
    <div className="fixed inset-0 z-[1000] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-fade-in">
      <form onSubmit={handleSave} className="bg-slate-50 border border-slate-200/60 rounded-3xl shadow-2xl w-full max-w-5xl h-[90vh] max-h-[760px] flex flex-col overflow-hidden animate-scale-up">
        {/* Sticky Header */}
        <div className="sticky top-0 bg-white border-b border-slate-200/60 px-6 py-4 md:px-8 md:py-5 flex items-center justify-between z-20 shrink-0">
          <div>
            <h2 className="text-lg font-black text-slate-800 flex items-center gap-2">
              <Palette className="text-blue-500" size={20} /> Thiết lập hình nền thẻ CLB
            </h2>
            <p className="text-xs text-slate-400 font-medium mt-1">
              Tùy chỉnh diện mạo thẻ câu lạc bộ của bạn để tăng tính thẩm mỹ và nhận diện thương hiệu.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 hover:bg-slate-100 text-slate-400 hover:text-slate-600 rounded-full transition-all cursor-pointer"
            aria-label="Đóng"
          >
            <X size={20} />
          </button>
        </div>

        {/* Main Content Area */}
        <div className="flex-1 overflow-hidden flex flex-col lg:flex-row">
          {/* Left Column: Setup Controls */}
          <div className="flex-1 overflow-y-auto p-6 md:p-8 space-y-6 custom-scrollbar">
            {/* Combined Templates Grid */}
            <div className="space-y-2">
              <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Mẫu thiết kế kết hợp (Template)</label>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
                {BACKGROUND_TEMPLATES.map((tpl) => (
                  <button
                    key={tpl.id}
                    type="button"
                    onClick={() => {
                      setSelectedPattern(tpl.id);
                      setSelectedPreset(tpl.id);
                      setAccentColor(tpl.accentColor);
                    }}
                    className={cn(
                      "flex flex-col p-3 rounded-xl border text-xs font-bold transition-all text-left relative overflow-hidden h-16 justify-between cursor-pointer group shadow-sm bg-white",
                      selectedPattern === tpl.id
                        ? "border-blue-500 bg-blue-50/30 text-blue-600 ring-2 ring-blue-500/15"
                        : "border-slate-200 hover:bg-slate-50 hover:border-slate-300 text-slate-700"
                    )}
                  >
                    <div className="z-10 flex items-center justify-between w-full">
                      <span className="text-[10px] font-extrabold uppercase tracking-wider opacity-90">{tpl.name.split(' (')[0]}</span>
                      <div className={cn("w-3 h-3 rounded-full border border-slate-300/30 shrink-0", tpl.bgClass)} />
                    </div>
                    <div 
                      className="absolute inset-0 opacity-20 group-hover:opacity-40 transition-opacity pointer-events-none z-0" 
                      style={getPatternStyle(tpl.patternId, accentColor)} 
                    />
                  </button>
                ))}
              </div>
            </div>

            {/* Accent Color picker */}
            <div className="space-y-2">
              <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Tông màu chủ đạo (Accent Color)</label>
              <div className="flex items-center gap-3">
                <div className="relative w-10 h-10 rounded-xl overflow-hidden border border-slate-200 shrink-0 cursor-pointer">
                  <input
                    type="color"
                    value={accentColor}
                    onChange={(e) => setAccentColor(e.target.value)}
                    className="absolute inset-0 w-full h-full p-0 border-0 cursor-pointer scale-125 origin-center"
                  />
                </div>
                <div className="relative flex-1">
                  <input
                    type="text"
                    value={accentColor}
                    onChange={(e) => setAccentColor(e.target.value)}
                    className="w-full pl-3.5 pr-10 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm font-semibold text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                    placeholder="#HEX Code"
                  />
                  <div 
                    className="absolute right-3.5 top-1/2 -translate-y-1/2 w-4 h-4 rounded-full border border-slate-200 shadow-sm transition-all pointer-events-none"
                    style={{ backgroundColor: accentColor }}
                  />
                </div>
              </div>
            </div>

            {/* Avatar as background toggle */}
            <div className="flex items-center justify-between border-t border-slate-200/60 pt-4">
              <div className="space-y-0.5">
                <p className="text-slate-700 font-bold text-sm">Sử dụng Logo làm ảnh bìa</p>
                <p className="text-[11px] text-slate-400 font-medium leading-relaxed">
                  Sử dụng Logo câu lạc bộ phóng to, làm mờ làm nền cho phần banner thẻ.
                  {!club.logo_url && (
                    <span className="block text-amber-500 font-semibold mt-1">
                      *(Chưa thiết lập Logo cho Câu lạc bộ)
                    </span>
                  )}
                </p>
              </div>
              <label className="relative inline-flex items-center cursor-pointer select-none shrink-0">
                <input
                  type="checkbox"
                  checked={useAvatarAsBackground}
                  disabled={!club.logo_url}
                  onChange={(e) => {
                    setUseAvatarAsBackground(e.target.checked);
                    if (e.target.checked) {
                      setBgPreview('');
                      setBgFile(null);
                      setBackgroundImageUrl('');
                    }
                  }}
                  className="sr-only peer"
                />
                <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed"></div>
              </label>
            </div>

            {/* Custom Image Upload */}
            <div className="space-y-3 border-t border-slate-200/60 pt-4">
              <label className="text-xs font-bold text-slate-500 uppercase tracking-wider block">Tải lên ảnh bìa riêng biệt</label>
              <div className="flex flex-col gap-3.5">
                <div className="flex items-center justify-center w-full">
                  <label className="flex flex-col items-center justify-center w-full h-24 border-2 border-slate-300 border-dashed rounded-2xl cursor-pointer bg-white hover:bg-slate-50/50 transition-colors">
                    <div className="flex flex-col items-center justify-center pt-5 pb-6">
                      <Upload className="w-6 h-6 text-slate-400 mb-1.5" />
                      <p className="text-[11px] font-bold text-slate-500">Kéo thả hoặc nhấp để tải ảnh lên</p>
                      <p className="text-[9px] text-slate-400 mt-0.5">PNG, JPG, JPEG (tối đa 5MB)</p>
                    </div>
                    <input
                      type="file"
                      accept="image/*"
                      onChange={handleFileChange}
                      className="hidden"
                    />
                  </label>
                </div>
                {bgPreview && (
                  <div className="relative w-full h-28 rounded-2xl overflow-hidden border border-slate-200 shadow-inner group/preview">
                    <img src={bgPreview} alt="Preview custom background" className="w-full h-full object-cover" />
                    <div className="absolute inset-0 bg-slate-900/10 opacity-0 group-hover/preview:opacity-100 transition-opacity flex items-center justify-center" />
                    <button
                      type="button"
                      onClick={() => {
                        setBgPreview('');
                        setBgFile(null);
                        setBackgroundImageUrl('');
                      }}
                      className="absolute top-2.5 right-2.5 p-2 bg-red-500 hover:bg-red-600 text-white rounded-xl shadow-lg hover:scale-105 active:scale-95 transition-all cursor-pointer flex items-center justify-center"
                      title="Xóa ảnh bìa"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Right Column: Live Card Preview */}
          <div className="w-full lg:w-[400px] bg-slate-100/50 p-6 md:p-8 flex flex-col items-center justify-center gap-4 shrink-0 order-first lg:order-last border-b lg:border-b-0 lg:border-l border-slate-200/60">
            <p className="text-[10px] font-black text-slate-400 mb-4 uppercase tracking-widest">Bản xem trước thẻ CLB</p>
            
            <div
              className={cn(
                "relative backdrop-blur-md rounded-2xl overflow-hidden shadow-lg flex flex-col sm:flex-row min-h-[210px] sm:min-h-0 sm:h-[160px] w-full border transition-all duration-300 bg-white p-3.5 sm:p-4 justify-between gap-3.5",
                previewCardBgClass
              )}
              style={{
                borderTopWidth: '3px',
                borderTopColor: accentColor || '#3B82F6',
              }}
            >
              {/* Preview Whole-card Custom Background under a light gradient filter backdrop blur */}
              {previewCustomBgUrl && (
                <>
                  <div 
                    className="absolute inset-0 pointer-events-none z-0" 
                    style={{
                      backgroundImage: `url(${previewCustomBgUrl})`,
                      backgroundSize: 'cover',
                      backgroundPosition: 'center',
                      backgroundRepeat: 'no-repeat',
                      filter: 'blur(4.5px)',
                      }}
                    />
                  <div className="absolute inset-0 bg-gradient-to-b from-white/80 via-white/85 to-white/90 pointer-events-none z-0" />
                </>
              )}

              {/* Preview Pattern Overlay */}
              {selectedPattern && (
                <div 
                  className="absolute inset-0 pointer-events-none opacity-65 z-0" 
                  style={getPatternStyle(
                    BACKGROUND_TEMPLATES.find((t) => t.id === selectedPattern)?.patternId || selectedPattern, 
                    accentColor
                  )} 
                />
              )}

              {/* Left Column */}
              <div className="flex-1 flex flex-col justify-between min-w-0 z-10">
                <div>
                  {/* Preview Top Header Flex Row */}
                  <div className="flex flex-wrap items-center gap-1.5 min-w-0">
                    <span className="text-[9px] font-extrabold px-2 py-0.5 rounded-full bg-white/90 text-slate-800 backdrop-blur-sm shadow-sm border border-slate-200/40">
                      {previewCategoryConf.label}
                    </span>
                    <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-white/90 shadow-sm text-emerald-600 border border-slate-200/40">
                      Hoạt động
                    </span>
                    <span className="text-[10px] font-mono font-bold text-slate-400 tracking-wider">
                      {club.code}
                    </span>
                  </div>

                  {/* Preview Club Name */}
                  <h3 className="text-sm font-bold text-slate-800 line-clamp-2 leading-snug mt-2.5">
                    {club.name}
                  </h3>
                </div>

                {/* Preview Footer Info Stats */}
                <div className="flex items-center gap-2 text-slate-500 text-xs font-semibold pt-2">
                  <div className="flex items-center gap-1">
                    <Users size={12} className="text-slate-400 shrink-0" />
                    <span className="text-[11px] font-bold text-slate-700">{club.active_members_count}/{club.max_members || '∞'}</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <Heart size={12} className={club.is_favorited ? "fill-pink-500 text-pink-500 shrink-0" : "text-slate-400 shrink-0"} />
                    <span className="text-[11px] font-bold text-slate-600">{club.favorite_count || 0}</span>
                  </div>
                </div>
              </div>

              {/* Right Column */}
              <div className="flex flex-col justify-between items-end sm:w-[170px] shrink-0 z-10 gap-2">
                {/* Preview Favorite button */}
                <div className="flex justify-end w-full">
                  <button
                    type="button"
                    className="w-8 h-8 rounded-full bg-white/80 text-slate-400 flex items-center justify-center backdrop-blur-sm shadow-sm border border-slate-100/50"
                    disabled
                  >
                    <Heart size={15} className={club.is_favorited ? "fill-pink-500 text-pink-500" : ""} />
                  </button>
                </div>

                {/* Preview Schedule & Location */}
                <div className="space-y-1 text-xs font-semibold w-full">
                  <div className="flex items-center gap-1.5 text-slate-700 bg-blue-50/50 px-2 py-0.5 rounded-md border border-blue-100/30">
                    <Clock size={11} className="text-blue-500 shrink-0" />
                    <div className="min-w-0 flex-1">
                      <span className="block text-slate-800 text-[10px] font-bold truncate">
                        {club.schedule_time || 'Chưa xếp lịch'}
                      </span>
                    </div>
                  </div>
                  <div className="flex items-center gap-1.5 text-slate-700 bg-amber-50/50 px-2 py-0.5 rounded-md border border-amber-100/30">
                    <MapPin size={11} className="text-amber-500 shrink-0" />
                    <div className="min-w-0 flex-1">
                      <span className="block text-slate-800 text-[10px] font-bold truncate">
                        {club.classroom || 'Chưa xếp phòng'}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Preview Button */}
                <Button
                  variant={
                    club.membership_status === 'active' ? 'outline' :
                    club.membership_status === 'pending' ? 'secondary' : 'default'
                  }
                  size="sm"
                  disabled
                  className={cn(
                    "h-7 text-[10px] px-3 font-bold rounded-lg cursor-default shrink-0 truncate",
                    club.membership_status === 'active' && "border-emerald-500 text-emerald-600 bg-emerald-50 hover:bg-emerald-50",
                    club.membership_status === 'pending' && "bg-amber-100 text-amber-700 hover:bg-amber-100",
                    (club.status !== 'active' || !club.settings?.allow_self_registration) && "bg-slate-100 text-slate-400 border-slate-200"
                  )}
                >
                  {
                    club.membership_status === 'active' ? 'Đã tham gia' :
                    club.membership_status === 'pending' ? 'Chờ duyệt' : 'Tham gia'
                  }
                </Button>
              </div>
            </div>
          </div>
        </div>

        {/* Sticky Footer */}
        <div className="sticky bottom-0 border-t border-slate-200/60 px-6 py-4 md:px-8 bg-white flex justify-end gap-3 shrink-0 z-20">
          <button
            type="button"
            onClick={onClose}
            disabled={saving}
            className="px-4 py-2 border border-slate-200 text-slate-500 hover:bg-slate-50 rounded-xl transition-all cursor-pointer disabled:opacity-50 text-xs font-bold"
          >
            Hủy
          </button>
          <button
            type="submit"
            disabled={saving}
            className="px-5 py-2 bg-blue-600 text-white font-bold rounded-xl hover:bg-blue-700 disabled:opacity-50 transition-all shadow-md shadow-blue-500/20 cursor-pointer flex items-center gap-2 text-xs"
          >
            {saving ? 'Đang lưu...' : 'Lưu cấu hình'}
          </button>
        </div>
      </form>
    </div>
  );
}
