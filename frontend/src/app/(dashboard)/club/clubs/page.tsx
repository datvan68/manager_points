'use client';
 
import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  Plus, Search, Filter, Users, MapPin, Compass, Grid, List,
  Sparkles, Download, ArrowRight, BookOpen, Clock, Calendar, CheckCircle2,
  AlertCircle, ShieldAlert, MoreVertical, Edit2, Trash2, Eye, Shield, HelpCircle,
  X, Upload, Heart, BarChart3, Palette, Settings, Image
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
import { getClubScheduleSummary, BACKGROUND_PRESETS, getClubAccentColor, ScheduleSummaryRow } from './schedule-helper';
import { API_ORIGIN } from '@/api/config';
import ConfirmModal from '@/components/modals/ConfirmModal';
import { CustomPagination } from '@/components/ui/pagination';
 
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
  status_loading?: boolean;
  schedule_time?: string;
  schedule_summary?: ScheduleSummaryRow[];
}

type ClubStatus = 'inactive' | 'suspended' | 'active';

const CLUB_STATUS_OPTIONS = [
  {
    value: 'inactive',
    label: 'Không hoạt động',
    shortLabel: 'Không HĐ',
    Icon: ShieldAlert,
    activeClassName: 'bg-slate-700 text-white border-slate-700 shadow-sm',
  },
  {
    value: 'suspended',
    label: 'Tạm dừng',
    shortLabel: 'Tạm dừng',
    Icon: AlertCircle,
    activeClassName: 'bg-amber-500 text-white border-amber-500 shadow-sm',
  },
  {
    value: 'active',
    label: 'Hoạt động',
    shortLabel: 'Hoạt động',
    Icon: CheckCircle2,
    activeClassName: 'bg-emerald-500 text-white border-emerald-500 shadow-sm',
  },
] as const;

const toClubStatus = (status?: string): ClubStatus => {
  if (status === 'inactive' || status === 'suspended' || status === 'active') {
    return status;
  }
  return 'inactive';
};

const getClubStatusLabel = (status?: string) => {
  const normalizedStatus = toClubStatus(status);
  return CLUB_STATUS_OPTIONS.find((option) => option.value === normalizedStatus)?.label || 'Không hoạt động';
};

const ClubStatusBadge = ({ status, isDark = false }: { status?: string; isDark?: boolean }) => {
  const normalizedStatus = toClubStatus(status);

  return (
    <span className={cn(
      "text-[9px] font-bold px-2 py-0.5 rounded-full shadow-sm border flex items-center gap-1 transition-all duration-300",
      normalizedStatus === 'active' ? (
        isDark
          ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/20"
          : "bg-emerald-50/70 text-emerald-600 border-emerald-200/60"
      ) : normalizedStatus === 'suspended' ? (
        isDark
          ? "bg-amber-500/10 text-amber-400 border-amber-500/20"
          : "bg-amber-50/70 text-amber-600 border-amber-200/60"
      ) : (
        isDark
          ? "bg-slate-500/10 text-slate-400 border-slate-500/20"
          : "bg-slate-50/70 text-slate-500 border-slate-200/60"
      )
    )}>
      <span className={cn(
        "w-1 h-1 rounded-full shrink-0",
        normalizedStatus === 'active' && "bg-emerald-500 animate-pulse",
        normalizedStatus === 'suspended' && "bg-amber-500",
        normalizedStatus === 'inactive' && "bg-slate-400"
      )} />
      {getClubStatusLabel(normalizedStatus)}
    </span>
  );
};

const ClubStatusToggle = ({
  status,
  loading,
  compact = false,
  onChange,
}: {
  status?: string;
  loading?: boolean;
  compact?: boolean;
  onChange: (status: ClubStatus) => void;
}) => {
  const normalizedStatus = toClubStatus(status);

  return (
    <div
      role="group"
      aria-label="Cập nhật trạng thái CLB"
      className={cn(
        "inline-flex items-center rounded-xl border border-slate-200 bg-white/85 p-0.5 shadow-sm",
        compact ? "gap-0.5" : "gap-1"
      )}
    >
      {CLUB_STATUS_OPTIONS.map((option) => {
        const isSelected = normalizedStatus === option.value;
        const Icon = option.Icon;

        return (
          <button
            key={option.value}
            type="button"
            title={option.label}
            aria-pressed={isSelected}
            disabled={loading}
            onClick={() => onChange(option.value)}
            className={cn(
              "inline-flex items-center justify-center gap-1 rounded-lg border text-[10px] font-bold transition-all disabled:cursor-not-allowed disabled:opacity-60",
              compact ? "h-7 min-w-7 px-1.5" : "h-8 px-2.5",
              isSelected
                ? option.activeClassName
                : "border-transparent text-slate-500 hover:bg-slate-50 hover:text-slate-800"
            )}
          >
            {loading && isSelected ? (
              <span className="h-3 w-3 rounded-full border border-current border-t-transparent animate-spin" />
            ) : (
              <Icon size={12} className="shrink-0" />
            )}
            <span className={cn(compact && "sr-only")}>
              {compact ? option.shortLabel : option.label}
            </span>
          </button>
        );
      })}
    </div>
  );
};

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
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [clubPendingDelete, setClubPendingDelete] = useState<{ id: string; name: string } | null>(null);
  const [showEditModal, setShowEditModal] = useState(false);
  const [selectedClubForEdit, setSelectedClubForEdit] = useState<ClubWithStats | null>(null);
  const [filterCategory, setFilterCategory] = useState('');
  const [viewMode, setViewMode] = useState<'grid' | 'table'>('grid');
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showQuickReports, setShowQuickReports] = useState(false);
  const [todaySchedulesCount, setTodaySchedulesCount] = useState(0);
  const [activeSemesterId, setActiveSemesterId] = useState<string | null>(null);
  const [showBgSetupModal, setShowBgSetupModal] = useState(false);
  const [selectedClubForBg, setSelectedClubForBg] = useState<ClubWithStats | null>(null);
 
  // Bulk selection states
  const [selectedClubIds, setSelectedClubIds] = useState<string[]>([]);
  const [bulkActionType, setBulkActionType] = useState<'delete' | 'deactivate' | null>(null);
  const [isBulkActionRunning, setIsBulkActionRunning] = useState(false);
  const selectAllRef = React.useRef<HTMLInputElement>(null);

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
            const scheduleSummary = getClubScheduleSummary(clubSchedules, club._id);

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
              schedule_summary: scheduleSummary,
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
              schedule_summary: [],
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

  const selectableClubsOnPage = paginatedClubs.filter(canManageClub);
  const selectedSelectableClubsOnPage = selectableClubsOnPage.filter(club => selectedClubIds.includes(club._id));
  const isAllSelected = selectableClubsOnPage.length > 0 && selectedSelectableClubsOnPage.length === selectableClubsOnPage.length;
  const isIndeterminate = selectedSelectableClubsOnPage.length > 0 && selectedSelectableClubsOnPage.length < selectableClubsOnPage.length;

  useEffect(() => {
    if (selectAllRef.current) {
      selectAllRef.current.indeterminate = isIndeterminate;
    }
  }, [isIndeterminate]);

  useEffect(() => {
    if (clubs.length > 0 && selectedClubIds.length > 0) {
      const manageableClubIds = new Set(
        clubs.filter(canManageClub).map((c) => c._id)
      );
      setSelectedClubIds((prev) => prev.filter((id) => manageableClubIds.has(id)));
    }
  }, [clubs]);

  // Selection Handlers
  const handleSelectRow = (clubId: string) => {
    setSelectedClubIds((prev) => {
      if (prev.includes(clubId)) {
        return prev.filter((id) => id !== clubId);
      } else {
        return [...prev, clubId];
      }
    });
  };

  const handleSelectAllChange = () => {
    const selectableClubsOnPage = paginatedClubs.filter(canManageClub);
    const selectedSelectableOnPage = selectableClubsOnPage.filter(club => selectedClubIds.includes(club._id));

    if (selectedSelectableOnPage.length === selectableClubsOnPage.length) {
      const selectableIdsOnPage = new Set(selectableClubsOnPage.map(c => c._id));
      setSelectedClubIds((prev) => prev.filter((id) => !selectableIdsOnPage.has(id)));
    } else {
      const selectableIdsOnPage = selectableClubsOnPage.map(c => c._id);
      setSelectedClubIds((prev) => {
        const union = new Set([...prev, ...selectableIdsOnPage]);
        return Array.from(union);
      });
    }
  };

  const handleBulkActionConfirm = async () => {
    if (!bulkActionType || selectedClubIds.length === 0) return;
    
    setIsBulkActionRunning(true);
    const actionType = bulkActionType;
    const idsToProcess = [...selectedClubIds];
    
    try {
      if (actionType === 'delete') {
        const results = await Promise.allSettled(
          idsToProcess.map(async (id) => {
            await clubApi.delete(id);
            return id;
          })
        );
        
        const fulfilledIds: string[] = [];
        const rejectedIds: string[] = [];
        
        results.forEach((res, idx) => {
          if (res.status === 'fulfilled') {
            fulfilledIds.push(res.value);
          } else {
            rejectedIds.push(idsToProcess[idx]);
          }
        });
        
        if (fulfilledIds.length > 0) {
          toast.success(`Đã xóa thành công ${fulfilledIds.length} câu lạc bộ.`);
        }
        if (rejectedIds.length > 0) {
          toast.error(`Xóa thất bại ${rejectedIds.length} câu lạc bộ.`);
        }
        
        setSelectedClubIds(prev => prev.filter(id => !fulfilledIds.includes(id)));
      } else if (actionType === 'deactivate') {
        const results = await Promise.allSettled(
          idsToProcess.map(async (id) => {
            await clubApi.update(id, { status: 'inactive' });
            return id;
          })
        );
        
        const fulfilledIds: string[] = [];
        const rejectedIds: string[] = [];
        
        results.forEach((res, idx) => {
          if (res.status === 'fulfilled') {
            fulfilledIds.push(res.value);
          } else {
            rejectedIds.push(idsToProcess[idx]);
          }
        });
        
        if (fulfilledIds.length > 0) {
          toast.success(`Đã vô hiệu hóa thành công ${fulfilledIds.length} câu lạc bộ.`);
        }
        if (rejectedIds.length > 0) {
          toast.error(`Vô hiệu hóa thất bại ${rejectedIds.length} câu lạc bộ.`);
        }
        
        setSelectedClubIds(prev => prev.filter(id => !fulfilledIds.includes(id)));
      }
      
      await loadClubs();
    } catch (error) {
      toast.error('Có lỗi xảy ra khi thực hiện hành động hàng loạt.');
    } finally {
      setIsBulkActionRunning(false);
      setBulkActionType(null);
    }
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

  const handleClubStatusChange = async (club: ClubWithStats, status: ClubStatus) => {
    const previousStatus = toClubStatus(club.status);
    if (previousStatus === status || club.status_loading) return;

    setClubs((prev) =>
      prev.map((c) =>
        c._id === club._id
          ? { ...c, status, status_loading: true }
          : c
      )
    );

    try {
      const updatedClub = await clubApi.update(club._id, { status });
      const nextStatus = toClubStatus(updatedClub.status);
      setClubs((prev) =>
        prev.map((c) =>
          c._id === club._id
            ? { ...c, ...updatedClub, status: nextStatus, status_loading: false }
            : c
        )
      );
      toast.success('Đã chuyển CLB "' + club.name + '" sang ' + getClubStatusLabel(nextStatus) + '.');
    } catch (err: any) {
      setClubs((prev) =>
        prev.map((c) =>
          c._id === club._id
            ? { ...c, status: previousStatus, status_loading: false }
            : c
        )
      );
      toast.error(err?.response?.data?.message || err?.message || 'Không thể cập nhật trạng thái CLB');
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

  const handleDeleteClub = (id: string, name: string) => {
    setClubPendingDelete({ id, name });
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
          {isSearchOpen ? (
            <div className="relative flex-1 md:max-w-md flex items-center gap-2">
              <div className="relative flex-1">
                <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  type="text"
                  placeholder="Tìm theo tên hoặc mã câu lạc bộ..."
                  value={search}
                  onChange={(e) => {
                    setSearch(e.target.value);
                    setCurrentPage(1);
                  }}
                  autoFocus
                  className="w-full pl-10 pr-10 py-2 bg-white/75 border border-slate-200 rounded-xl text-sm text-slate-700 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all shadow-sm"
                />
                <button
                  type="button"
                  onClick={() => setIsSearchOpen(false)}
                  className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 transition-colors"
                  title="Thu gọn"
                  aria-label="Thu gọn"
                >
                  <X size={16} />
                </button>
              </div>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => setIsSearchOpen(true)}
              className="flex items-center justify-center h-10 w-10 rounded-xl border border-slate-200 bg-white/75 text-slate-600 hover:bg-slate-50 hover:text-slate-900 transition-all shadow-sm cursor-pointer shrink-0"
              title="Tìm kiếm"
              aria-label="Tìm kiếm"
            >
              <Search size={18} />
            </button>
          )}
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
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
             {paginatedClubs.map((club) => {
              const conf = categoryConfigs[club.category] || categoryConfigs.other;
              const currentUser = tokenStorage.getUser();
              const template = BACKGROUND_TEMPLATES.find((t) => t.id === club.background_config?.pattern);
              const isDarkTemplate = !!template?.isDark;
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
                    "group relative bg-white backdrop-blur-md rounded-2xl overflow-hidden shadow-sm hover:shadow-md hover:-translate-y-0.5 hover:bg-slate-50/90 transition-all duration-300 flex flex-col min-h-[240px] cursor-pointer border p-4 justify-between gap-3.5 template-shine-effect",
                    cardBgClass
                  )}
                  style={{
                    borderColor: isDarkTemplate ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.04)',
                    boxShadow: isDarkTemplate ? `0 4px 20px -2px rgba(0,0,0,0.35)` : `0 10px 25px -5px rgba(0,0,0,0.05), 0 8px 10px -6px rgba(0,0,0,0.05)`,
                  }}
                >
                  {/* Corner Dots */}
                  <div className="absolute top-3 left-3 w-1.5 h-1.5 rounded-full z-20 pointer-events-none transition-all duration-300" style={{ backgroundColor: isDarkTemplate ? 'rgba(255,255,255,0.35)' : `${accentColor}50` }} />
                  <div className="absolute top-3 right-3 w-1.5 h-1.5 rounded-full z-20 pointer-events-none transition-all duration-300" style={{ backgroundColor: isDarkTemplate ? 'rgba(255,255,255,0.35)' : `${accentColor}50` }} />
                  <div className="absolute bottom-3 left-3 w-1.5 h-1.5 rounded-full z-20 pointer-events-none transition-all duration-300" style={{ backgroundColor: isDarkTemplate ? 'rgba(255,255,255,0.35)' : `${accentColor}50` }} />
                  <div className="absolute bottom-3 right-3 w-1.5 h-1.5 rounded-full z-20 pointer-events-none transition-all duration-300" style={{ backgroundColor: isDarkTemplate ? 'rgba(255,255,255,0.35)' : `${accentColor}50` }} />

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

                  {/* Pet Motion Accent Layer */}
                  <PetAccentLayer 
                    type={club.background_config?.petAccentType} 
                    color={accentColor} 
                  />

                  {/* Top Header & Favorite Row */}
                  <div className="flex justify-between items-start gap-2 z-10">
                    <div className="flex flex-wrap items-center gap-1.5 min-w-0">
                      {/* Category Badge */}
                      <span className={cn(
                        "text-[9px] font-extrabold px-2 py-0.5 rounded-full backdrop-blur-sm shadow-sm border transition-all duration-300",
                        isDarkTemplate 
                          ? "bg-white/10 text-slate-200 border-white/10" 
                          : "bg-white/70 text-slate-800 border-slate-200/50"
                      )}>
                        {conf.label}
                      </span>

                      {/* Status Badge with Live Pulsing Dot */}
                      <ClubStatusBadge status={club.status} isDark={isDarkTemplate} />

                      {/* Club Code */}
                      <span className={cn(
                        "text-[9px] font-mono font-bold tracking-wider transition-all duration-300",
                        isDarkTemplate ? "text-white/40" : "text-slate-400/80"
                      )}>
                        {club.code}
                      </span>
                    </div>
                    <button
                      disabled={club.favorite_loading}
                      onClick={(e) => handleFavoriteClick(e, club)}
                      className="w-7 h-7 rounded-full bg-white/90 hover:bg-white text-slate-600 hover:text-pink-500 flex items-center justify-center backdrop-blur-sm shadow-sm border border-slate-100/50 active:scale-90 transition-all cursor-pointer disabled:opacity-50 shrink-0"
                    >
                      {club.favorite_loading ? (
                        <span className="w-3 h-3 border border-pink-500 border-t-transparent rounded-full animate-spin" />
                      ) : club.is_favorited ? (
                        <Heart size={13} className="fill-pink-500 text-pink-500" />
                      ) : (
                        <Heart size={13} className="transition-colors" />
                      )}
                    </button>
                  </div>

                  {/* Club Name */}
                  <div className="flex-1 flex flex-col justify-start min-w-0 z-10 mt-1">
                    <h3 className={cn(
                      "text-sm font-bold group-hover:text-blue-600 transition-colors line-clamp-2 leading-snug",
                      isDarkTemplate ? "text-slate-100" : "text-slate-800"
                    )}>
                      {club.name}
                    </h3>
                  </div>

                  {/* Middle: Schedule and Location boxes */}
                  <div className={cn(
                    "space-y-1.5 text-xs font-semibold w-full z-10 my-1",
                    isDarkTemplate ? "text-slate-300" : "text-slate-700"
                  )}>
                    {/* Schedule Time */}
                    {club.schedule_summary && club.schedule_summary.length > 0 ? (
                      <div className="space-y-1">
                        {club.schedule_summary.slice(0, 2).map((row, idx) => (
                          <div key={idx} className="flex items-start gap-1.5 py-0.5">
                            <Clock size={12} className="text-blue-500 shrink-0 mt-0.5" />
                            <div className="min-w-0 flex-1">
                              <span className={cn(
                                "block text-[11px] font-bold leading-normal break-words",
                                isDarkTemplate ? "text-slate-200" : "text-slate-800"
                              )} title={`${row.weekdays.join(', ')}: ${row.timeRange}`}>
                                {row.weekdays.join(', ')}: {row.timeRange}
                              </span>
                            </div>
                          </div>
                        ))}
                        {club.schedule_summary.length > 2 && (
                          <div className="text-[10px] text-slate-500 font-bold pl-2">
                            + {club.schedule_summary.length - 2} ngày khác
                          </div>
                        )}
                      </div>
                    ) : (
                      <div className="flex items-center gap-1.5 py-0.5">
                        <Clock size={12} className="text-blue-500 shrink-0" />
                        <span className={cn(
                          "text-[11px] font-bold",
                          isDarkTemplate ? "text-slate-200" : "text-slate-800"
                        )}>Chưa xếp lịch</span>
                      </div>
                    )}

                    {/* Location / Classroom */}
                    <div className="flex items-center gap-1.5 py-0.5">
                      <MapPin size={12} className="text-amber-500 shrink-0" />
                      <div className="min-w-0 flex-1">
                        <span className={cn(
                          "block text-[11px] font-bold truncate",
                          isDarkTemplate ? "text-slate-200" : "text-slate-800"
                        )} title={club.classroom}>
                          {club.classroom || 'Chưa xếp phòng'}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Bottom Stats and Actions Row */}
                  <div className={cn(
                    "flex items-center justify-between gap-2 z-10 border-t pt-2.5 mt-auto",
                    isDarkTemplate ? "border-white/15" : "border-slate-100/50"
                  )}>
                    {/* Stats */}
                    <div className={cn(
                      "flex items-center gap-2 text-xs font-semibold shrink-0",
                      isDarkTemplate ? "text-slate-400" : "text-slate-500"
                    )}>
                      <div className="flex items-center gap-1" title={`${club.active_members_count} thành viên`}>
                        <Users size={12} className="text-slate-400 shrink-0" />
                        <span className={cn(
                          "text-[11px] font-bold",
                          isDarkTemplate ? "text-slate-300" : "text-slate-700"
                        )}>{club.active_members_count}/{club.max_members || '∞'}</span>
                      </div>
                      <div className="flex items-center gap-1" title={`${club.favorite_count || 0} lượt yêu thích`}>
                        <Heart size={12} className={club.is_favorited ? "fill-pink-500 text-pink-500 shrink-0" : "text-slate-400 shrink-0"} />
                        <span className={cn(
                          "text-[11px] font-bold",
                          isDarkTemplate ? "text-slate-300" : "text-slate-600"
                        )}>{club.favorite_count || 0}</span>
                      </div>
                    </div>

                    {/* Actions */}
                    <div className="flex items-center gap-1.5 shrink-0" onClick={(e) => e.stopPropagation()}>
                      {canManageClub(club) && (
                        <ClubStatusToggle
                          status={club.status}
                          loading={club.status_loading}
                          compact
                          onChange={(status) => handleClubStatusChange(club, status)}
                        />
                      )}
                      {canManageClub(club) && (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => {
                            setSelectedClubForBg(club);
                            setShowBgSetupModal(true);
                          }}
                          className="h-7 text-[10px] px-2 font-bold rounded-lg cursor-pointer transition-all border-blue-500 text-blue-600 hover:bg-blue-50 flex items-center gap-1"
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
                          "h-7 text-[10px] px-2.5 font-bold rounded-lg cursor-pointer transition-all truncate max-w-[90px]",
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
                          'Khóa'
                        ) : (club.max_members ? club.active_members_count >= club.max_members : false) ? (
                          'Đầy'
                        ) : (currentUser?.role && currentUser.role.toLowerCase() !== 'student' && currentUser.role.toLowerCase() !== 'admin') ? (
                          'Chỉ SV'
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
                    <input 
                      type="checkbox" 
                      ref={selectAllRef}
                      checked={isAllSelected}
                      onChange={handleSelectAllChange}
                      className="rounded border-slate-300 h-4 w-4 text-blue-600 focus:ring-blue-500 cursor-pointer"
                      disabled={selectableClubsOnPage.length === 0}
                    />
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
                      <td className="px-5 py-4" onClick={(e) => e.stopPropagation()}>
                        {canManageClub(club) ? (
                          <input 
                            type="checkbox"
                            checked={selectedClubIds.includes(club._id)}
                            onChange={() => handleSelectRow(club._id)}
                            className="rounded border-slate-300 h-4 w-4 text-blue-600 focus:ring-blue-500 cursor-pointer"
                          />
                        ) : (
                          <input 
                            type="checkbox" 
                            disabled 
                            className="rounded border-slate-200 h-4 w-4 opacity-30 cursor-not-allowed"
                            title="Bạn không có quyền quản lý CLB này"
                          />
                        )}
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
                        {canManageClub(club) ? (
                          <div onClick={(e) => e.stopPropagation()}>
                            <ClubStatusToggle
                              status={club.status}
                              loading={club.status_loading}
                              onChange={(status) => handleClubStatusChange(club, status)}
                            />
                          </div>
                        ) : (
                          <ClubStatusBadge status={club.status} />
                        )}
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
                                setSelectedClubForEdit(club);
                                setShowEditModal(true);
                              }}
                              className="p-1.5 rounded-lg text-slate-400 hover:text-blue-600 hover:bg-blue-50 transition-all cursor-pointer"
                              title="Chỉnh sửa Câu lạc bộ"
                            >
                              <Edit2 size={14} />
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
          <CustomPagination
            totalItems={sortedAndFiltered.length}
            pageSize={itemsPerPage}
            currentPage={currentPage}
            onPageChange={setCurrentPage}
            label="câu lạc bộ"
          />
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

      {/* Edit Modal */}
      {showEditModal && selectedClubForEdit && (
        <CreateClubModal
          clubToEdit={selectedClubForEdit}
          onClose={() => {
            setShowEditModal(false);
            setSelectedClubForEdit(null);
          }}
          onSuccess={() => {
            setShowEditModal(false);
            setSelectedClubForEdit(null);
            loadClubs();
          }}
        />
      )}

      {/* Delete Confirmation Modal */}
      <ConfirmModal
        isOpen={!!clubPendingDelete}
        onClose={() => setClubPendingDelete(null)}
        onConfirm={async () => {
          if (!clubPendingDelete) return;
          try {
            await clubApi.delete(clubPendingDelete.id);
            toast.success(`Đã vô hiệu hóa CLB "${clubPendingDelete.name}"`);
            loadClubs();
          } catch {
            toast.error('Lỗi khi vô hiệu hóa CLB');
          }
        }}
        title="Vô hiệu hóa Câu lạc bộ"
        message={`Bạn có chắc chắn muốn vô hiệu hóa câu lạc bộ "${clubPendingDelete?.name}"?`}
        confirmLabel="Vô hiệu hóa"
        cancelLabel="Hủy"
        variant="danger"
      />

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

      {/* Floating Action Bar */}
      {selectedClubIds.length > 0 && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-40 bg-slate-900/90 text-white rounded-2xl px-6 py-4 shadow-2xl border border-white/10 backdrop-blur-md flex items-center justify-between gap-6 min-w-[320px] max-w-[90vw] md:max-w-2xl transition-all duration-300 animate-in fade-in slide-in-from-bottom-5">
          <div className="flex items-center gap-3">
            <span className="bg-blue-600 text-[11px] font-extrabold px-2.5 py-1 rounded-full text-white animate-pulse">
              {selectedClubIds.length}
            </span>
            <span className="text-xs font-bold text-slate-200">câu lạc bộ đã chọn</span>
          </div>

          <div className="h-5 w-[1px] bg-white/20" />

          <div className="flex items-center gap-2">
            <button
              onClick={() => setSelectedClubIds([])}
              disabled={isBulkActionRunning}
              className="px-3 py-1.5 rounded-xl hover:bg-white/10 text-slate-300 hover:text-white text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
              title="Bỏ chọn tất cả"
            >
              <X size={14} />
              <span className="hidden sm:inline">Bỏ chọn</span>
            </button>

            <button
              onClick={() => setBulkActionType('deactivate')}
              disabled={isBulkActionRunning}
              className="px-3 py-1.5 rounded-xl bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 hover:text-amber-200 text-xs font-bold transition-all flex items-center gap-1.5 border border-amber-500/30 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
              title="Vô hiệu hóa các CLB đã chọn"
            >
              <ShieldAlert size={14} />
              <span className="hidden sm:inline">Vô hiệu hóa</span>
            </button>

            <button
              onClick={() => setBulkActionType('delete')}
              disabled={isBulkActionRunning}
              className="px-3 py-1.5 rounded-xl bg-red-500/20 hover:bg-red-500/30 text-red-400 hover:text-red-300 text-xs font-bold transition-all flex items-center gap-1.5 border border-red-500/30 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
              title="Xóa các CLB đã chọn"
            >
              <Trash2 size={14} />
              <span className="hidden sm:inline">Xóa</span>
            </button>
          </div>
        </div>
      )}

      {/* Bulk Action Confirmation Modal */}
      <ConfirmModal
        isOpen={bulkActionType !== null}
        onClose={() => setBulkActionType(null)}
        onConfirm={handleBulkActionConfirm}
        title={bulkActionType === 'delete' ? 'Xóa nhiều Câu lạc bộ' : 'Vô hiệu hóa nhiều Câu lạc bộ'}
        message={
          bulkActionType === 'delete'
            ? `Bạn có chắc chắn muốn xóa ${selectedClubIds.length} câu lạc bộ đã chọn? Hành động này không thể hoàn tác.`
            : `Bạn có chắc chắn muốn vô hiệu hóa ${selectedClubIds.length} câu lạc bộ đã chọn? Các câu lạc bộ sẽ chuyển sang trạng thái không hoạt động.`
        }
        confirmLabel={bulkActionType === 'delete' ? 'Xóa' : 'Vô hiệu hóa'}
        cancelLabel="Hủy"
        variant={bulkActionType === 'delete' ? 'danger' : 'warning'}
      />
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

function CreateClubModal({ onClose, onSuccess, clubToEdit }: { onClose: () => void; onSuccess: () => void; clubToEdit?: ClubWithStats }) {
  const [users, setUsers] = useState<any[]>([]);
  const [semesters, setSemesters] = useState<Semester[]>([]);
  const [loadingData, setLoadingData] = useState(false);
  const [saving, setSaving] = useState(false);

  // Device upload states
  const [coverFile, setCoverFile] = useState<File | null>(null);
  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [coverPreview, setCoverPreview] = useState<string>(clubToEdit?.cover_url ? getImageUrl(clubToEdit.cover_url) : '');
  const [logoPreview, setLogoPreview] = useState<string>(clubToEdit?.logo_url ? getImageUrl(clubToEdit.logo_url) : '');
  const [uploadedCoverUrl, setUploadedCoverUrl] = useState<string>(clubToEdit?.cover_url || '');
  const [uploadedLogoUrl, setUploadedLogoUrl] = useState<string>(clubToEdit?.logo_url || '');
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
    defaultValues: clubToEdit ? {
      name: clubToEdit.name || '',
      code: clubToEdit.code || '',
      classroom: clubToEdit.classroom || '',
      category: clubToEdit.category || 'other',
      cover_url: clubToEdit.cover_url || '',
      logo_url: clubToEdit.logo_url || '',
      description: clubToEdit.description || '',
      advisor_id: clubToEdit.advisor_id?._id || clubToEdit.advisor_id || '',
      max_members: clubToEdit.max_members || undefined,
      semester_id: clubToEdit.semester_id?._id || clubToEdit.semester_id || '',
      activity_start_date: clubToEdit.activity_start_date ? format(new Date(clubToEdit.activity_start_date), 'yyyy-MM-dd') : undefined,
      activity_end_date: clubToEdit.activity_end_date ? format(new Date(clubToEdit.activity_end_date), 'yyyy-MM-dd') : undefined,
      settings: {
        allow_self_registration: clubToEdit.settings?.allow_self_registration ?? true,
        require_approval: clubToEdit.settings?.require_approval ?? true,
        attendance_point_enabled: clubToEdit.settings?.attendance_point_enabled ?? false,
        point_per_attendance: clubToEdit.settings?.point_per_attendance ?? 0,
      }
    } : {
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

      if (clubToEdit) {
        await clubApi.update(clubToEdit._id, payload as any);
        toast.success('Cập nhật câu lạc bộ thành công!');
      } else {
        await clubApi.create(payload as any);
        toast.success('Tạo câu lạc bộ thành công!');
      }
      onSuccess();
    } catch (err: any) {
      toast.error(err?.response?.data?.message || err?.message || (clubToEdit ? 'Lỗi khi cập nhật câu lạc bộ' : 'Lỗi khi tạo câu lạc bộ'));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4 overflow-y-auto" onClick={onClose}>
      <div className="bg-white rounded-3xl shadow-2xl w-full max-w-4xl overflow-hidden border border-slate-100 flex flex-col my-8 animate-in fade-in zoom-in-95 duration-200" onClick={e => e.stopPropagation()}>
        {/* Header */}
        <div className="px-6 py-5 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
          <div>
            <h2 className="text-lg font-black text-slate-800 tracking-tight flex items-center gap-2">
              <Sparkles className="h-5 w-5 text-blue-500 animate-pulse" />
              {clubToEdit ? 'Chỉnh sửa Câu lạc bộ' : 'Tạo Câu lạc bộ Mới'}
            </h2>
            <p className="text-xs text-slate-500 mt-1">
              {clubToEdit ? 'Cập nhật cấu hình và thông tin vận hành cho câu lạc bộ.' : 'Khai báo cấu hình, giáo viên phụ trách và thiết lập hoạt động.'}
            </p>
          </div>
          <button onClick={onClose} className="p-2 rounded-full text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-all cursor-pointer">
            <X size={18} />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit(onSubmit)} className="p-6 space-y-6 overflow-y-auto max-h-[85vh] text-slate-700">
          
          {/* Cover & Logo Preview Section */}
          <div className="relative rounded-2xl overflow-hidden border border-slate-200/80 bg-slate-100/50 shadow-sm group">
            {/* Cover Image Area */}
            <div className="h-44 w-full bg-slate-200 relative overflow-hidden flex items-center justify-center transition-all duration-300">
              {coverPreview ? (
                <>
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
                    className="absolute top-3 right-3 p-1.5 rounded-lg bg-black/60 text-white hover:bg-black/80 transition-all cursor-pointer disabled:opacity-50 z-10"
                    title="Xóa ảnh bìa"
                  >
                    <X size={14} />
                  </button>
                </>
              ) : (
                <div className={cn(
                  "w-full h-full flex flex-col items-center justify-center gap-1.5 transition-all duration-500",
                  watch('category') && categoryConfigs[watch('category')]
                    ? `bg-gradient-to-r ${categoryConfigs[watch('category')].gradient}`
                    : "bg-gradient-to-r from-slate-400 to-slate-500"
                )}>
                  <label className="flex flex-col items-center justify-center w-full h-full cursor-pointer hover:bg-black/10 transition-all gap-1.5 py-8">
                    <div className="p-2 rounded-full bg-white/20 backdrop-blur-md text-white">
                      <Image className="h-5 w-5" />
                    </div>
                    <span className="text-xs text-white font-bold drop-shadow-sm">Tải lên ảnh bìa</span>
                    <span className="text-[9px] text-white/80 font-medium">PNG, JPG, WebP tối đa 5MB</span>
                    <input
                      type="file"
                      accept="image/png, image/jpeg, image/webp"
                      className="hidden"
                      onChange={handleCoverChange}
                      disabled={saving}
                    />
                  </label>
                </div>
              )}
            </div>

            {/* Logo Image Area (overlapping) */}
            <div className="absolute left-6 bottom-4 flex items-end gap-4 z-10">
              <div className="relative h-20 w-20 rounded-2xl overflow-hidden border-4 border-white bg-white shadow-md group/logo shrink-0 flex items-center justify-center">
                {logoPreview ? (
                  <>
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
                      className="absolute top-1 right-1 p-1 rounded-md bg-black/60 text-white hover:bg-black/85 transition-all cursor-pointer disabled:opacity-50 z-10"
                      title="Xóa logo"
                    >
                      <X size={10} />
                    </button>
                  </>
                ) : (
                  <label className="flex flex-col items-center justify-center w-full h-full bg-slate-50 hover:bg-slate-100 cursor-pointer transition-all gap-1">
                    <Upload className="h-4 w-4 text-slate-400" />
                    <span className="text-[9px] text-slate-500 font-bold">Logo</span>
                    <input
                      type="file"
                      accept="image/png, image/jpeg, image/webp"
                      className="hidden"
                      onChange={handleLogoChange}
                      disabled={saving}
                    />
                  </label>
                )}
              </div>
              <div className="mb-1 text-left">
                <p className="text-sm font-bold text-slate-800 drop-shadow-sm bg-white/80 backdrop-blur-md px-2 py-0.5 rounded-lg inline-block border border-slate-100">
                  {watch('name') || "Tên Câu Lạc Bộ"}
                </p>
                <div>
                  <p className="text-[10px] font-bold text-slate-600 bg-white/80 backdrop-blur-md px-2 py-0.5 rounded-md mt-1 inline-block border border-slate-100">
                    {watch('code') ? `${watch('code').toUpperCase()}` : "MÃ CLB"} • {watch('category') ? categoryConfigs[watch('category')]?.label : "Phân loại"}
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* Main Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-2">
            
            {/* Cột 1: Thông tin chung */}
            <div className="space-y-5">
              <div className="flex items-center gap-2 border-b border-slate-100 pb-2">
                <div className="p-1 rounded-lg bg-blue-50 text-blue-600">
                  <Palette className="h-4 w-4" />
                </div>
                <h3 className="text-slate-800 font-extrabold uppercase tracking-wider text-[11px]">1. Thông tin chung</h3>
              </div>
              
              {/* Tên & Mã */}
              <div className="grid grid-cols-3 gap-4">
                <div className="col-span-2">
                  <Input
                    label="Tên câu lạc bộ"
                    required
                    error={errors.name?.message}
                    placeholder="VD: CLB Nghệ thuật sáng tạo"
                    disabled={saving}
                    className="focus:ring-blue-500/20 focus:border-blue-500"
                    {...register('name')}
                  />
                </div>
                <div>
                  <Input
                    label="Mã viết tắt"
                    required
                    error={errors.code?.message}
                    placeholder="VD: ART"
                    disabled={saving || !!clubToEdit}
                    className="focus:ring-blue-500/20 focus:border-blue-500"
                    {...register('code')}
                    onChange={(e) => {
                      e.target.value = e.target.value.toUpperCase();
                      register('code').onChange(e);
                    }}
                  />
                </div>
              </div>

              {/* Phân loại */}
              <div className="flex flex-col gap-1.5 w-full">
                <label className="flex items-center gap-1 px-1 text-[13px] font-bold text-[#1E293B]">
                  Phân loại câu lạc bộ
                  <span className="text-red-500">*</span>
                </label>
                <Controller
                  name="category"
                  control={control}
                  render={({ field }) => (
                    <Select
                      value={field.value}
                      onValueChange={field.onChange}
                      error={errors.category?.message}
                    >
                      <SelectTrigger className="h-10 rounded-xl border border-white/70 bg-white/50 backdrop-blur-sm focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all" disabled={saving}>
                        <SelectValue placeholder="-- Chọn phân loại câu lạc bộ --" />
                      </SelectTrigger>
                      <SelectContent>
                        {Object.entries(categoryConfigs).map(([k, conf]) => (
                          <SelectItem key={k} value={k}>
                            <div className="flex items-center gap-2">
                              <span className={cn("w-2 h-2 rounded-full bg-gradient-to-r", conf.gradient)}></span>
                              <span className="text-xs font-semibold">{conf.label}</span>
                            </div>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                />
              </div>

              {/* Mô tả */}
              <div>
                <Input
                  multiline
                  rows={4}
                  label="Mô tả hoạt động"
                  placeholder="Mô tả chi tiết về tôn chỉ, định hướng hoạt động và phương thức sinh hoạt của câu lạc bộ..."
                  disabled={saving}
                  className="focus:ring-blue-500/20 focus:border-blue-500"
                  {...register('description')}
                />
              </div>
            </div>

            {/* Cột 2: Cố vấn & Vận hành */}
            <div className="space-y-5">
              <div className="flex items-center gap-2 border-b border-slate-100 pb-2">
                <div className="p-1 rounded-lg bg-indigo-50 text-indigo-600">
                  <Settings className="h-4 w-4" />
                </div>
                <h3 className="text-slate-800 font-extrabold uppercase tracking-wider text-[11px]">2. Cố vấn & Vận hành</h3>
              </div>
              
              {/* Cố vấn phụ trách */}
              <div className="flex flex-col gap-1.5 w-full">
                <label className="flex items-center gap-1 px-1 text-[13px] font-bold text-[#1E293B]">
                  Giáo viên phụ trách (Cố vấn)
                  <span className="text-red-500">*</span>
                </label>
                <Controller
                  name="advisor_id"
                  control={control}
                  render={({ field }) => (
                    <Select
                      value={field.value}
                      onValueChange={field.onChange}
                      error={errors.advisor_id?.message}
                    >
                      <SelectTrigger className="h-10 rounded-xl border border-white/70 bg-white/50 backdrop-blur-sm focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all" disabled={saving}>
                        <SelectValue placeholder="-- Chọn cố vấn phụ trách --" />
                      </SelectTrigger>
                      <SelectContent>
                        {teachers.map(u => (
                          <SelectItem key={u._id || u.id} value={u._id || u.id}>
                            <div className="flex flex-col text-left py-0.5">
                              <span className="font-bold text-slate-700 text-xs">{u.full_name || u.user_name || u.username}</span>
                              <span className="text-[10px] text-slate-400 font-semibold">{u.email || 'Không có email'}{u.department ? ` • ${u.department}` : ''}</span>
                            </div>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                />
              </div>

              {/* Học kỳ & Phòng học */}
              <div className="grid grid-cols-2 gap-4">
                <div className="flex flex-col gap-1.5 w-full">
                  <label className="flex items-center gap-1 px-1 text-[13px] font-bold text-[#1E293B]">
                    Học kỳ áp dụng
                  </label>
                  <Controller
                    name="semester_id"
                    control={control}
                    render={({ field }) => (
                      <Select
                        value={field.value}
                        onValueChange={field.onChange}
                        error={errors.semester_id?.message}
                      >
                        <SelectTrigger className="h-10 rounded-xl border border-white/70 bg-white/50 backdrop-blur-sm focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all" disabled={saving}>
                          <SelectValue placeholder="-- Học kỳ --" />
                        </SelectTrigger>
                        <SelectContent>
                          {semesters.map(s => (
                            <SelectItem key={s._id} value={s._id}>
                              <span className="text-xs font-semibold">{s.semester_name}</span>
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    )}
                  />
                </div>
                <div>
                  <Input
                    label="Phòng hoạt động mặc định"
                    required
                    error={errors.classroom?.message}
                    placeholder="VD: Phòng A101"
                    disabled={saving}
                    className="focus:ring-blue-500/20 focus:border-blue-500"
                    {...register('classroom')}
                  />
                </div>
              </div>

              {/* Giới hạn thành viên */}
              <div>
                <Input
                  type="number"
                  label="Giới hạn thành viên tối đa"
                  placeholder="Để trống nếu không giới hạn thành viên"
                  disabled={saving}
                  className="focus:ring-blue-500/20 focus:border-blue-500"
                  {...register('max_members')}
                />
              </div>
            </div>
          </div>

          {/* Quyền hạn & Chế độ hoạt động */}
          <div className="space-y-4 border-t border-slate-100 pt-5">
            <div className="flex items-center gap-2">
              <div className="p-1 rounded-lg bg-rose-50 text-rose-600">
                <ShieldAlert className="h-4 w-4" />
              </div>
              <h3 className="text-slate-800 font-extrabold uppercase tracking-wider text-[11px]">3. Thiết lập hoạt động</h3>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              
              {/* Card Switch 1: Tự đăng ký */}
              <div className={cn(
                "border rounded-2xl p-4 flex items-start justify-between gap-4 transition-all duration-300 bg-slate-50/50 border-slate-100 hover:border-slate-200/80 cursor-pointer",
                watch('settings.allow_self_registration') && "bg-blue-50/20 border-blue-200/60 shadow-sm"
              )} onClick={() => setValue('settings.allow_self_registration', !watch('settings.allow_self_registration'))}>
                <div className="flex gap-3">
                  <div className={cn(
                    "p-2 rounded-xl bg-slate-100 text-slate-500 shrink-0 transition-colors duration-300",
                    watch('settings.allow_self_registration') && "bg-blue-100 text-blue-600"
                  )}>
                    <Users size={16} />
                  </div>
                  <div className="text-left">
                    <h4 className="font-bold text-slate-800 text-xs">Cho phép tự đăng ký</h4>
                    <p className="text-[10px] text-slate-400 font-semibold mt-1 leading-relaxed">Học sinh có thể tự tham gia CLB mà không cần chờ</p>
                  </div>
                </div>
                <div className="relative inline-flex items-center cursor-pointer shrink-0" onClick={e => e.stopPropagation()}>
                  <input
                    type="checkbox"
                    disabled={saving}
                    {...register('settings.allow_self_registration')}
                    className="sr-only peer"
                  />
                  <div className="w-10 h-6 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
                </div>
              </div>

              {/* Card Switch 2: Yêu cầu phê duyệt */}
              <div className={cn(
                "border rounded-2xl p-4 flex items-start justify-between gap-4 transition-all duration-300 bg-slate-50/50 border-slate-100 hover:border-slate-200/80 cursor-pointer",
                watch('settings.require_approval') && "bg-blue-50/20 border-blue-200/60 shadow-sm"
              )} onClick={() => setValue('settings.require_approval', !watch('settings.require_approval'))}>
                <div className="flex gap-3">
                  <div className={cn(
                    "p-2 rounded-xl bg-slate-100 text-slate-500 shrink-0 transition-colors duration-300",
                    watch('settings.require_approval') && "bg-blue-100 text-blue-600"
                  )}>
                    <Shield size={16} />
                  </div>
                  <div className="text-left">
                    <h4 className="font-bold text-slate-800 text-xs">Yêu cầu phê duyệt</h4>
                    <p className="text-[10px] text-slate-400 font-semibold mt-1 leading-relaxed">Cố vấn hoặc Ban chủ nhiệm phải duyệt đơn tham gia</p>
                  </div>
                </div>
                <div className="relative inline-flex items-center cursor-pointer shrink-0" onClick={e => e.stopPropagation()}>
                  <input
                    type="checkbox"
                    disabled={saving}
                    {...register('settings.require_approval')}
                    className="sr-only peer"
                  />
                  <div className="w-10 h-6 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
                </div>
              </div>

              {/* Card Switch 3: Tích lũy điểm rèn luyện */}
              <div className={cn(
                "border rounded-2xl p-4 flex items-start justify-between gap-4 transition-all duration-300 bg-slate-50/50 border-slate-100 hover:border-slate-200/80 cursor-pointer",
                watch('settings.attendance_point_enabled') && "bg-blue-50/20 border-blue-200/60 shadow-sm"
              )} onClick={() => setValue('settings.attendance_point_enabled', !watch('settings.attendance_point_enabled'))}>
                <div className="flex gap-3">
                  <div className={cn(
                    "p-2 rounded-xl bg-slate-100 text-slate-500 shrink-0 transition-colors duration-300",
                    watch('settings.attendance_point_enabled') && "bg-blue-100 text-blue-600"
                  )}>
                    <Sparkles size={16} />
                  </div>
                  <div className="text-left">
                    <h4 className="font-bold text-slate-800 text-xs">Tích lũy điểm rèn luyện</h4>
                    <p className="text-[10px] text-slate-400 font-semibold mt-1 leading-relaxed">Học sinh được cộng điểm rèn luyện khi đi điểm danh</p>
                  </div>
                </div>
                <div className="relative inline-flex items-center cursor-pointer shrink-0" onClick={e => e.stopPropagation()}>
                  <input
                    type="checkbox"
                    disabled={saving}
                    {...register('settings.attendance_point_enabled')}
                    className="sr-only peer"
                  />
                  <div className="w-10 h-6 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
                </div>
              </div>
            </div>

            {/* Attendance points field block */}
            {watchAttendancePointEnabled && (
              <div className="animate-in slide-in-from-top duration-300 pl-4 border-l-4 border-blue-500 py-1 transition-all mt-4">
                <label className="block text-slate-700 font-bold mb-1.5 text-xs">Số điểm mỗi buổi điểm danh *</label>
                <div className="relative rounded-xl overflow-hidden max-w-[220px]">
                  <input
                    type="number"
                    step="0.1"
                    disabled={saving}
                    {...register('settings.point_per_attendance')}
                    className="w-full px-3 py-2 bg-slate-50/50 border border-slate-200 rounded-xl text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 text-xs font-semibold"
                    placeholder="VD: 0.5"
                  />
                </div>
                {errors.settings?.point_per_attendance && <p className="text-red-500 text-[10px] mt-1.5 font-bold">{errors.settings.point_per_attendance.message}</p>}
              </div>
            )}
          </div>

          {/* Buttons */}
          <div className="flex justify-end gap-3 pt-6 border-t border-slate-100">
            <button
              type="button"
              onClick={onClose}
              disabled={saving}
              className="px-5 py-2.5 border border-slate-200 text-slate-500 hover:bg-slate-50 rounded-xl text-xs font-bold transition-all cursor-pointer disabled:opacity-50"
            >
              Hủy
            </button>
            <button
              type="submit"
              disabled={saving}
              className="px-6 py-2.5 bg-blue-600 text-white font-extrabold text-xs rounded-xl hover:bg-blue-700 disabled:opacity-50 transition-all shadow-md shadow-blue-500/25 cursor-pointer flex items-center gap-2"
            >
              {saving && <Plus size={14} className="animate-spin" />}
              {saving ? (clubToEdit ? 'Đang cập nhật...' : 'Đang tạo...') : (clubToEdit ? 'Lưu thay đổi' : 'Tạo câu lạc bộ')}
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
  category: 'classic' | 'premium' | 'active' | 'pet';
  isDark?: boolean;
}

const BACKGROUND_TEMPLATES: BackgroundTemplate[] = [
  // Classic
  {
    id: 'minimal-clean',
    name: 'Tối giản Slate (Minimal Clean)',
    bgClass: 'bg-gradient-to-br from-slate-50 to-slate-100/80 border-slate-200/80 shadow-sm',
    accentColor: '#64748B',
    patternId: 'spark-dot-frame',
    category: 'classic',
  },
  {
    id: 'aurora-glass',
    name: 'Kính Cực quang (Aurora Glass)',
    bgClass: 'bg-gradient-to-tr from-indigo-50/90 via-purple-50/70 to-pink-50/80 border-indigo-100 backdrop-blur-md shadow-sm',
    accentColor: '#8B5CF6',
    patternId: 'glass-grid',
    category: 'classic',
  },
  {
    id: 'academic-crest',
    name: 'Học thuật Indigo (Academic Crest)',
    bgClass: 'bg-gradient-to-br from-indigo-50/80 via-blue-50/40 to-slate-50 border-indigo-200/60 shadow-sm',
    accentColor: '#4F46E5',
    patternId: 'academic-crest-pattern',
    category: 'classic',
  },
  {
    id: 'soft-silk',
    name: 'Lụa Mềm mại (Soft Silk)',
    bgClass: 'bg-gradient-to-br from-rose-50/70 via-orange-50/40 to-slate-100/60 border-rose-100 shadow-sm',
    accentColor: '#F43F5E',
    patternId: 'soft-waves-pattern',
    category: 'classic',
  },
  {
    id: 'eco-leaf',
    name: 'Môi trường Mint (Eco Environment)',
    bgClass: 'bg-gradient-to-br from-emerald-50/80 via-teal-50/30 to-green-50/40 border-emerald-200/60 shadow-sm',
    accentColor: '#10B981',
    patternId: 'eco-leaf-pattern',
    category: 'classic',
  },
  {
    id: 'medical-pulse',
    name: 'Y sinh Nhịp tim (Medical Pulse)',
    bgClass: 'bg-gradient-to-br from-cyan-50/80 via-teal-50/20 to-slate-50 border-cyan-200/60 shadow-sm',
    accentColor: '#06B6D4',
    patternId: 'medical-pulse-pattern',
    category: 'classic',
  },
  {
    id: 'lang-global',
    name: 'Ngôn ngữ Toàn cầu (Global Languages)',
    bgClass: 'bg-gradient-to-br from-blue-50/70 via-indigo-50/30 to-slate-100/50 border-blue-200/60 shadow-sm',
    accentColor: '#3B82F6',
    patternId: 'lang-global-pattern',
    category: 'classic',
  },

  // Premium
  {
    id: 'royal-gold',
    name: 'Hoàng gia Gold (Royal Gold)',
    bgClass: 'bg-gradient-to-br from-amber-500/10 via-amber-600/[0.04] to-yellow-500/10 border-amber-300 shadow-md',
    accentColor: '#D97706',
    patternId: 'premium-frame-pattern',
    category: 'premium',
  },
  {
    id: 'cyber-neon',
    name: 'Cyberpunk Neon (Cyber Neon)',
    bgClass: 'bg-gradient-to-br from-slate-900 via-slate-950 to-zinc-900 border-cyan-500/30 text-white shadow-lg',
    accentColor: '#06B6D4',
    patternId: 'circuit-neon-pattern',
    category: 'premium',
    isDark: true,
  },
  {
    id: 'space-orbit',
    name: 'Vũ trụ Vô tận (Cosmic Space)',
    bgClass: 'bg-gradient-to-br from-violet-950 via-purple-900 to-indigo-950 border-purple-500/30 text-white shadow-lg',
    accentColor: '#A855F7',
    patternId: 'space-orbit-pattern',
    category: 'premium',
    isDark: true,
  },
  {
    id: 'carbon-3d',
    name: 'Vân Carbon (Carbon Tech)',
    bgClass: 'bg-gradient-to-br from-zinc-800 to-zinc-900 border-zinc-700/80 text-white shadow-md',
    accentColor: '#71717A',
    patternId: 'carbon-3d-pattern',
    category: 'premium',
    isDark: true,
  },
  {
    id: 'abstract-geom',
    name: 'Hình học Trừu tượng (Abstract Geo)',
    bgClass: 'bg-gradient-to-br from-slate-50 via-sky-50/50 to-indigo-50/40 border-slate-300 shadow-sm',
    accentColor: '#0284C7',
    patternId: 'abstract-geom-pattern',
    category: 'premium',
  },
  {
    id: 'tech-ai',
    name: 'Trí tuệ Nhân tạo (AI Cognitive)',
    bgClass: 'bg-gradient-to-br from-violet-950 via-slate-900 to-zinc-950 border-purple-500/40 text-white shadow-lg',
    accentColor: '#8B5CF6',
    patternId: 'tech-ai-pattern',
    category: 'premium',
    isDark: true,
  },
  {
    id: 'tech-hardware',
    name: 'Phần cứng Vi mạch (Hardware IoT)',
    bgClass: 'bg-gradient-to-br from-zinc-900 via-slate-950 to-zinc-950 border-emerald-500/40 text-white shadow-lg',
    accentColor: '#10B981',
    patternId: 'tech-hardware-pattern',
    category: 'premium',
    isDark: true,
  },
  {
    id: 'eng-mechanical',
    name: 'Cơ khí Bánh răng (Mechanical Gear)',
    bgClass: 'bg-gradient-to-br from-slate-100 via-amber-500/[0.03] to-slate-200/70 border-slate-300 shadow-sm',
    accentColor: '#B45309',
    patternId: 'eng-mechanical-pattern',
    category: 'premium',
  },

  // Active
  {
    id: 'sport-dynamic',
    name: 'Thể thao Năng động (Sport Dynamic)',
    bgClass: 'bg-gradient-to-br from-orange-500/10 via-amber-500/[0.03] to-red-500/10 border-orange-300 shadow-sm',
    accentColor: '#EA580C',
    patternId: 'sport-stripes-pattern',
    category: 'active',
  },
  {
    id: 'chroma-glow',
    name: 'Chroma Neon (Chroma Glow)',
    bgClass: 'bg-gradient-to-tr from-fuchsia-500/15 via-rose-500/10 to-amber-500/10 border-fuchsia-300/60 shadow-sm',
    accentColor: '#D946EF',
    patternId: 'chroma-glow-pattern',
    category: 'active',
  },
  {
    id: 'comic-pop',
    name: 'Comic Halftone (Comic Pop)',
    bgClass: 'bg-gradient-to-br from-emerald-50 via-teal-50/30 to-cyan-100/40 border-teal-200/80 shadow-sm',
    accentColor: '#0D9488',
    patternId: 'halftone-pop-pattern',
    category: 'active',
  },
  {
    id: 'ocean-wave',
    name: 'Sóng biển Mát lạnh (Ocean Wave)',
    bgClass: 'bg-gradient-to-br from-sky-50 via-cyan-50/40 to-blue-100/30 border-sky-200/80 shadow-sm',
    accentColor: '#0284C7',
    patternId: 'ocean-waves-pattern',
    category: 'active',
  },
  {
    id: 'sport-soccer',
    name: 'Bóng đá Sân cỏ (Soccer Field)',
    bgClass: 'bg-gradient-to-br from-green-500/10 via-emerald-500/[0.03] to-emerald-600/10 border-emerald-300 shadow-sm',
    accentColor: '#22C55E',
    patternId: 'sport-soccer-pattern',
    category: 'active',
  },
  {
    id: 'sport-basketball',
    name: 'Bóng rổ Đường phố (Street Basketball)',
    bgClass: 'bg-gradient-to-br from-orange-500/10 via-red-500/[0.04] to-orange-600/10 border-orange-300 shadow-sm',
    accentColor: '#F97316',
    patternId: 'sport-basketball-pattern',
    category: 'active',
  },
  {
    id: 'art-music',
    name: 'Nghệ thuật Âm nhạc (Art & Music)',
    bgClass: 'bg-gradient-to-br from-fuchsia-500/10 via-purple-500/[0.04] to-violet-600/10 border-fuchsia-300 shadow-sm',
    accentColor: '#D946EF',
    patternId: 'art-music-pattern',
    category: 'active',
  },
  {
    id: 'art-paint',
    name: 'Hội họa Sáng tạo (Creative Canvas)',
    bgClass: 'bg-gradient-to-tr from-pink-500/10 via-rose-500/[0.04] to-amber-500/10 border-rose-300 shadow-sm',
    accentColor: '#F43F5E',
    patternId: 'art-paint-pattern',
    category: 'active',
  },

  // Pet
  {
    id: 'paw-paradise',
    name: 'Dấu chân Vui nhộn (Paw Paradise)',
    bgClass: 'bg-gradient-to-br from-amber-50 via-orange-50/30 to-yellow-50 border-amber-200 shadow-sm',
    accentColor: '#D97706',
    patternId: 'paw-print-pattern',
    category: 'pet',
  },
  {
    id: 'cat-kingdom',
    name: 'Vương quốc Mèo (Cat Kingdom)',
    bgClass: 'bg-gradient-to-br from-rose-50 via-pink-50/20 to-rose-100/20 border-rose-200 shadow-sm',
    accentColor: '#EC4899',
    patternId: 'cat-kingdom-pattern',
    category: 'pet',
  },
  {
    id: 'dog-playland',
    name: 'Sân chơi Cún con (Dog Playland)',
    bgClass: 'bg-gradient-to-br from-sky-50 via-blue-50/20 to-indigo-50/20 border-sky-200 shadow-sm',
    accentColor: '#2563EB',
    patternId: 'dog-playland-pattern',
    category: 'pet',
  },
  {
    id: 'sweet-honey',
    name: 'Ong Mật Ngọt (Sweet Honey)',
    bgClass: 'bg-gradient-to-br from-yellow-500/10 via-amber-500/[0.04] to-orange-500/10 border-yellow-300 shadow-sm',
    accentColor: '#CA8A04',
    patternId: 'honey-comb-pattern',
    category: 'pet',
  }
];

const getPatternStyle = (pattern?: string, color?: string): React.CSSProperties => {
  const c = color || '#3B82F6';
  
  // Ánh xạ (alias) từ pattern cũ sang pattern mới để tương thích ngược dữ liệu
  let targetPattern = pattern;
  const aliasMap: Record<string, string> = {
    'gold-corners': 'premium-frame-pattern',
    'soft-waves': 'soft-waves-pattern',
    'circuit-corners': 'circuit-neon-pattern',
    'diagonal-frames': 'spark-dot-frame',
    'academic-lines': 'academic-crest-pattern',
    'premium-frame': 'premium-frame-pattern',
    'botanical-corners': 'soft-waves-pattern',
    'geometric-ribbon': 'spark-dot-frame',
    'wave-corner-mix': 'chroma-glow-pattern',
    'campus-badge-frame': 'academic-crest-pattern',
    'sport-stripes': 'sport-stripes-pattern',
    'celebration-stars': 'chroma-glow-pattern',
    'paw-print': 'paw-print-pattern',
    'cat-club': 'cat-kingdom-pattern',
    'dog-club': 'dog-playland-pattern',
    'pet-care-icons': 'paw-print-pattern',
    'animal-friends': 'paw-print-pattern',
    'tech-grid-pattern': 'glass-grid',
    'cyber-frame-pattern': 'circuit-neon-pattern',
    'blueprint-pattern': 'glass-grid',
    'carbon-panel-pattern': 'carbon-3d-pattern',
    'precision-blocks-pattern': 'abstract-geom-pattern',
    'symmetric-crest-pattern': 'academic-crest-pattern',
  };
  
  if (targetPattern && aliasMap[targetPattern]) {
    targetPattern = aliasMap[targetPattern];
  }

  let svgString = '';
  switch (targetPattern) {
    case 'spark-dot-frame':
      svgString = `
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 300 160" width="100%" height="100%" preserveAspectRatio="none">
  <g fill="${c}" opacity="0.08">
    <circle cx="20" cy="20" r="1" /><circle cx="60" cy="20" r="1" /><circle cx="100" cy="20" r="1" /><circle cx="140" cy="20" r="1" /><circle cx="180" cy="20" r="1" /><circle cx="220" cy="20" r="1" /><circle cx="260" cy="20" r="1" />
    <circle cx="20" cy="50" r="1" /><circle cx="60" cy="50" r="1" /><circle cx="100" cy="50" r="1" /><circle cx="140" cy="50" r="1" /><circle cx="180" cy="50" r="1" /><circle cx="220" cy="50" r="1" /><circle cx="260" cy="50" r="1" />
    <circle cx="20" cy="80" r="1" /><circle cx="60" cy="80" r="1" /><circle cx="100" cy="80" r="1" /><circle cx="140" cy="80" r="1" /><circle cx="180" cy="80" r="1" /><circle cx="220" cy="80" r="1" /><circle cx="260" cy="80" r="1" />
    <circle cx="20" cy="110" r="1" /><circle cx="60" cy="110" r="1" /><circle cx="100" cy="110" r="1" /><circle cx="140" cy="110" r="1" /><circle cx="180" cy="110" r="1" /><circle cx="220" cy="110" r="1" /><circle cx="260" cy="110" r="1" />
  </g>
  <path d="M 12 12 H 40 M 12 12 V 40" fill="none" stroke="${c}" stroke-width="1.5" opacity="0.3" stroke-linecap="round" />
  <path d="M 288 12 H 260 M 288 12 V 40" fill="none" stroke="${c}" stroke-width="1.5" opacity="0.3" stroke-linecap="round" />
  <path d="M 12 148 H 40 M 12 148 V 120" fill="none" stroke="${c}" stroke-width="1.5" opacity="0.3" stroke-linecap="round" />
  <path d="M 288 148 H 260 M 288 148 V 120" fill="none" stroke="${c}" stroke-width="1.5" opacity="0.3" stroke-linecap="round" />
</svg>`;
      break;
    case 'glass-grid':
      svgString = `
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 300 160" width="100%" height="100%" preserveAspectRatio="none">
  <defs>
    <pattern id="glassGrid" width="20" height="20" patternUnits="userSpaceOnUse">
      <path d="M 20 0 L 0 0 0 20" fill="none" stroke="${c}" stroke-width="0.5" opacity="0.08" />
    </pattern>
    <linearGradient id="shine" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#ffffff" stop-opacity="0.15"/>
      <stop offset="30%" stop-color="#ffffff" stop-opacity="0.3"/>
      <stop offset="40%" stop-color="#ffffff" stop-opacity="0.05"/>
      <stop offset="100%" stop-color="#ffffff" stop-opacity="0"/>
    </linearGradient>
  </defs>
  <rect width="300" height="160" fill="url(#glassGrid)" />
  <path d="M -50 0 L 150 0 L 0 160 L -150 160 Z" fill="url(#shine)" />
</svg>`;
      break;
    case 'academic-crest-pattern':
      svgString = `
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 300 160" width="100%" height="100%" preserveAspectRatio="none">
  <g fill="none" stroke="${c}" stroke-width="0.8" opacity="0.15" transform="translate(150, 80) scale(1.6)">
    <path d="M -12 -15 L 12 -15 C 12 -15, 15 2, 0 16 C -15 2, -12 -15, -12 -15 Z" />
    <path d="M -10 -13 L 10 -13 C 10 -13, 12.5 1, 0 13.5 C -12.5 1, -10 -13, -10 -13 Z" stroke-dasharray="1.5 1.5" />
    <path d="M -6 -4 Q -3 -6, 0 -4 Q 3 -6, 6 -4 L 6 3 Q 3 1, 0 3 Q -3 1, -6 3 Z" fill="${c}" fill-opacity="0.1" />
    <circle cx="0" cy="-8" r="1.5" fill="${c}" />
    <polygon points="0,-18 1,-16 3,-16 1.5,-15 2,-13 0,-14.5 -2,-13 -1.5,-15 -3,-16 -1,-16" fill="${c}" fill-opacity="0.8" stroke="none" />
  </g>
  <path d="M 85,80 Q 95,120, 150,125 Q 205,120, 215,80" fill="none" stroke="${c}" stroke-width="1" stroke-dasharray="4 2" opacity="0.25" />
</svg>`;
      break;
    case 'soft-waves-pattern':
      svgString = `
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 300 160" width="100%" height="100%" preserveAspectRatio="none">
  <path d="M 0 100 Q 75 70, 150 110 T 300 90 L 300 160 L 0 160 Z" fill="${c}" opacity="0.08" />
  <path d="M 0 120 Q 85 95, 170 130 T 300 115 L 300 160 L 0 160 Z" fill="${c}" opacity="0.05" />
  <path d="M 0 80 Q 60 110, 130 75 T 300 100 L 300 160 L 0 160 Z" fill="${c}" opacity="0.03" />
</svg>`;
      break;
    case 'premium-frame-pattern':
      svgString = `
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 300 160" width="100%" height="100%" preserveAspectRatio="none">
  <rect x="6" y="6" width="288" height="148" rx="6" fill="none" stroke="${c}" stroke-width="1.2" opacity="0.3" />
  <rect x="10" y="10" width="280" height="140" rx="4" fill="none" stroke="${c}" stroke-width="0.6" stroke-dasharray="4 3" opacity="0.2" />
  <path d="M 6 22 L 22 6 M 6 26 V 6 H 26" fill="none" stroke="${c}" stroke-width="1.2" opacity="0.4" />
  <path d="M 294 22 L 278 6 M 294 26 V 6 H 274" fill="none" stroke="${c}" stroke-width="1.2" opacity="0.4" />
  <path d="M 6 138 L 22 154 M 6 134 V 154 H 26" fill="none" stroke="${c}" stroke-width="1.2" opacity="0.4" />
  <path d="M 294 138 L 278 154 M 294 134 V 154 H 274" fill="none" stroke="${c}" stroke-width="1.2" opacity="0.4" />
  <path d="M 140 6 L 144 11 L 150 6 L 156 11 L 160 6 L 158 13 H 142 Z" fill="${c}" opacity="0.35" />
</svg>`;
      break;
    case 'circuit-neon-pattern':
      svgString = `
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 300 160" width="100%" height="100%" preserveAspectRatio="none">
  <defs>
    <filter id="neonGlow" x="-20%" y="-20%" width="140%" height="140%">
      <feGaussianBlur stdDeviation="2" result="blur" />
      <feMerge>
        <feMergeNode in="blur" />
        <feMergeNode in="SourceGraphic" />
      </feMerge>
    </filter>
  </defs>
  <g fill="${c}" opacity="0.2">
    <circle cx="20" cy="30" r="1.5" /><circle cx="26" cy="30" r="1" /><circle cx="32" cy="30" r="1" />
    <circle cx="280" cy="130" r="1.5" /><circle cx="274" cy="130" r="1" /><circle cx="268" cy="130" r="1" />
  </g>
  <path d="M 10 120 L 70 120 L 90 140 L 180 140 L 190 130" fill="none" stroke="${c}" stroke-width="1" opacity="0.4" filter="url(#neonGlow)" />
  <path d="M 290 40 L 230 40 L 210 20 L 150 20" fill="none" stroke="${c}" stroke-width="1" opacity="0.4" filter="url(#neonGlow)" />
  <circle cx="90" cy="140" r="2.5" fill="none" stroke="${c}" stroke-width="0.8" opacity="0.5" />
  <circle cx="210" cy="20" r="2.5" fill="none" stroke="${c}" stroke-width="0.8" opacity="0.5" />
</svg>`;
      break;
    case 'space-orbit-pattern':
      svgString = `
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 300 160" width="100%" height="100%" preserveAspectRatio="none">
  <defs>
    <radialGradient id="centerGlow" cx="50%" cy="50%" r="50%">
      <stop offset="0%" stop-color="${c}" stop-opacity="0.3" />
      <stop offset="100%" stop-color="${c}" stop-opacity="0" />
    </radialGradient>
  </defs>
  <rect width="300" height="160" fill="url(#centerGlow)" />
  <ellipse cx="150" cy="80" rx="120" ry="40" fill="none" stroke="${c}" stroke-width="0.8" opacity="0.25" transform="rotate(-15 150 80)" />
  <ellipse cx="150" cy="80" rx="80" ry="25" fill="none" stroke="${c}" stroke-width="0.6" stroke-dasharray="3 3" opacity="0.2" transform="rotate(-15 150 80)" />
  <ellipse cx="150" cy="80" rx="160" ry="55" fill="none" stroke="${c}" stroke-width="0.5" opacity="0.15" transform="rotate(-15 150 80)" />
  <circle cx="60" cy="30" r="1" fill="#fff" opacity="0.6" />
  <circle cx="250" cy="40" r="1.5" fill="#fff" opacity="0.8" />
  <circle cx="80" cy="130" r="0.8" fill="#fff" opacity="0.5" />
  <circle cx="220" cy="120" r="1.2" fill="#fff" opacity="0.7" />
  <polygon points="180,40 181.5,43 185,43 182,45 183,48 180,46.5 177,48 178,45 175,43 178.5,43" fill="${c}" opacity="0.4" />
</svg>`;
      break;
    case 'carbon-3d-pattern':
      svgString = `
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 300 160" width="100%" height="100%" preserveAspectRatio="none">
  <defs>
    <pattern id="carbon" width="6" height="6" patternUnits="userSpaceOnUse">
      <rect width="6" height="6" fill="#18181b" />
      <polygon points="0,0 3,0 0,3" fill="#27272a" />
      <polygon points="3,3 6,3 3,6" fill="#27272a" />
      <polygon points="3,0 6,0 6,3" fill="#09090b" opacity="0.4" />
      <polygon points="0,3 3,3 0,6" fill="#09090b" opacity="0.4" />
    </pattern>
  </defs>
  <rect width="300" height="160" fill="url(#carbon)" opacity="0.4" />
  <line x1="12" y1="0" x2="12" y2="160" stroke="${c}" stroke-width="1.5" opacity="0.25" />
  <line x1="288" y1="0" x2="288" y2="160" stroke="${c}" stroke-width="1.5" opacity="0.25" />
</svg>`;
      break;
    case 'abstract-geom-pattern':
      svgString = `
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 300 160" width="100%" height="100%" preserveAspectRatio="none">
  <polygon points="0,0 120,0 70,160 0,160" fill="${c}" opacity="0.05" />
  <polygon points="300,160 180,160 230,0 300,0" fill="${c}" opacity="0.05" />
  <line x1="120" y1="0" x2="70" y2="160" stroke="${c}" stroke-width="0.8" stroke-dasharray="5 3" opacity="0.15" />
  <line x1="180" y1="160" x2="230" y2="0" stroke="${c}" stroke-width="0.8" stroke-dasharray="5 3" opacity="0.15" />
  <g stroke="${c}" stroke-width="0.8" opacity="0.25" fill="none" transform="translate(250, 40)">
    <circle cx="0" cy="0" r="8" />
    <line x1="-12" y1="0" x2="12" y2="0" />
    <line x1="0" y1="-12" x2="0" y2="12" />
  </g>
</svg>`;
      break;
    case 'sport-stripes-pattern':
      svgString = `
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 300 160" width="100%" height="100%" preserveAspectRatio="none">
  <g fill="${c}" opacity="0.12">
    <polygon points="230,0 260,0 180,160 150,160" />
    <polygon points="265,0 285,0 205,160 185,160" />
    <polygon points="290,0 300,0 220,160 210,160" />
    <polygon points="0,20 30,20 0,80" />
  </g>
  <path d="M 12 140 L 22 148 L 12 156" fill="none" stroke="${c}" stroke-width="2" opacity="0.3" stroke-linecap="round" stroke-linejoin="round" />
  <path d="M 20 140 L 30 148 L 20 156" fill="none" stroke="${c}" stroke-width="1" opacity="0.2" stroke-linecap="round" stroke-linejoin="round" />
</svg>`;
      break;
    case 'chroma-glow-pattern':
      svgString = `
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 300 160" width="100%" height="100%" preserveAspectRatio="none">
  <defs>
    <linearGradient id="neonGrad" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="${c}" stop-opacity="0.3" />
      <stop offset="50%" stop-color="#EC4899" stop-opacity="0.15" />
      <stop offset="100%" stop-color="#EAB308" stop-opacity="0.25" />
    </linearGradient>
  </defs>
  <rect width="300" height="160" fill="url(#neonGrad)" />
  <path d="M 0 60 C 80 20, 120 100, 200 50 T 300 80" fill="none" stroke="${c}" stroke-width="2.5" opacity="0.4" stroke-linecap="round" />
  <path d="M 0 65 C 80 25, 120 105, 200 55 T 300 85" fill="none" stroke="#fff" stroke-width="0.8" opacity="0.3" stroke-linecap="round" />
</svg>`;
      break;
    case 'halftone-pop-pattern':
      svgString = `
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 300 160" width="100%" height="100%" preserveAspectRatio="none">
  <defs>
    <pattern id="halftone" width="30" height="30" patternUnits="userSpaceOnUse">
      <circle cx="3" cy="3" r="1" fill="${c}" opacity="0.15" />
      <circle cx="15" cy="15" r="2" fill="${c}" opacity="0.1" />
      <circle cx="27" cy="27" r="1.5" fill="${c}" opacity="0.12" />
    </pattern>
  </defs>
  <rect width="300" height="160" fill="url(#halftone)" />
  <path d="M 260 20 L 275 25 L 265 32 L 285 35 L 255 48 L 262 35 L 250 32 Z" fill="${c}" opacity="0.3" />
  <path d="M 30 110 L 45 115 L 35 122 L 55 125 L 25 138 L 32 125 L 20 122 Z" fill="${c}" opacity="0.25" />
</svg>`;
      break;
    case 'ocean-waves-pattern':
      svgString = `
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 300 160" width="100%" height="100%" preserveAspectRatio="none">
  <path d="M 0 110 C 60 90, 100 130, 170 100 C 240 70, 270 120, 300 95 L 300 160 L 0 160 Z" fill="${c}" opacity="0.12" />
  <path d="M 0 125 C 50 115, 90 140, 150 120 C 210 100, 250 135, 300 115 L 300 160 L 0 160 Z" fill="${c}" opacity="0.08" />
  <circle cx="45" cy="40" r="3.5" fill="none" stroke="${c}" stroke-width="0.8" opacity="0.2" />
  <circle cx="52" cy="35" r="2" fill="none" stroke="${c}" stroke-width="0.6" opacity="0.15" />
  <circle cx="250" cy="50" r="4" fill="none" stroke="${c}" stroke-width="0.8" opacity="0.18" />
</svg>`;
      break;
    case 'paw-print-pattern':
      svgString = `
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 300 160" width="100%" height="100%" preserveAspectRatio="none">
  <g fill="${c}" opacity="0.15" transform="translate(25, 25) rotate(-15)">
    <path d="M 8 12 C 5 10, 4 14, 8 15 C 12 14, 11 10, 8 12 Z" />
    <circle cx="2" cy="7" r="1.5" /><circle cx="6" cy="4" r="1.5" /><circle cx="10.5" cy="4" r="1.5" /><circle cx="14" cy="7" r="1.5" />
  </g>
  <g fill="${c}" opacity="0.15" transform="translate(265, 115) rotate(20)">
    <path d="M 8 12 C 5 10, 4 14, 8 15 C 12 14, 11 10, 8 12 Z" />
    <circle cx="2" cy="7" r="1.5" /><circle cx="6" cy="4" r="1.5" /><circle cx="10.5" cy="4" r="1.5" /><circle cx="14" cy="7" r="1.5" />
  </g>
  <g fill="${c}" opacity="0.08" transform="translate(250, 25) rotate(35) scale(0.8)">
    <path d="M 8 12 C 5 10, 4 14, 8 15 C 12 14, 11 10, 8 12 Z" />
    <circle cx="2" cy="7" r="1.5" /><circle cx="6" cy="4" r="1.5" /><circle cx="10.5" cy="4" r="1.5" /><circle cx="14" cy="7" r="1.5" />
  </g>
  <g fill="${c}" opacity="0.08" transform="translate(30, 120) rotate(-30) scale(0.8)">
    <path d="M 8 12 C 5 10, 4 14, 8 15 C 12 14, 11 10, 8 12 Z" />
    <circle cx="2" cy="7" r="1.5" /><circle cx="6" cy="4" r="1.5" /><circle cx="10.5" cy="4" r="1.5" /><circle cx="14" cy="7" r="1.5" />
  </g>
</svg>`;
      break;
    case 'cat-kingdom-pattern':
      svgString = `
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 300 160" width="100%" height="100%" preserveAspectRatio="none">
  <g fill="none" stroke="${c}" stroke-width="1.2" opacity="0.22">
    <path d="M 10 2 Q 13 12, 23 14" /><path d="M 10 2 Q 4 8, 2 18" />
    <path d="M 290 2 Q 287 12, 277 14" /><path d="M 290 2 Q 296 8, 298 18" />
  </g>
  <g fill="${c}" opacity="0.14" transform="translate(250, 120) rotate(-15) scale(0.8)">
    <path d="M 12 5 C 9 2, 6 2, 4 4 C 2 6, 2 9, 4 11 C 6 13, 9 13, 12 10 L 15 13 H 17 V 9 V 7 V 3 H 15 Z" />
  </g>
  <g fill="${c}" opacity="0.14" transform="translate(40, 28) scale(0.7)">
    <path d="M 12 5 C 9 2, 6 2, 4 4 C 2 6, 2 9, 4 11 C 6 13, 9 13, 12 10 L 15 13 H 17 V 9 V 7 V 3 H 15 Z" />
  </g>
  <path d="M 12 5 C 10 3, 7 3, 5 5 C 3 7, 3 10, 5 12 L 12 18 L 19 12 C 21 10, 21 7, 19 5 C 17 3, 14 3, 12 5 Z" fill="${c}" opacity="0.12" transform="translate(145, 20) scale(0.6)" />
</svg>`;
      break;
    case 'dog-playland-pattern':
      svgString = `
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 300 160" width="100%" height="100%" preserveAspectRatio="none">
  <g fill="${c}" opacity="0.15" transform="translate(260, 25) rotate(35) scale(0.9)">
    <path d="M 3 6 C 2 4.5, 0.5 5, 1 7 C 0.5 9, 2 9.5, 3 8 L 13 8 C 14 9.5, 15.5 9, 15 7 C 15.5 5, 14 4.5, 13 6 Z" />
  </g>
  <g fill="${c}" opacity="0.15" transform="translate(30, 120) rotate(-25) scale(0.9)">
    <path d="M 3 6 C 2 4.5, 0.5 5, 1 7 C 0.5 9, 2 9.5, 3 8 L 13 8 C 14 9.5, 15.5 9, 15 7 C 15.5 5, 14 4.5, 13 6 Z" />
  </g>
  <circle cx="50" cy="35" r="7" fill="none" stroke="${c}" stroke-width="0.8" opacity="0.14" />
  <path d="M 46.5 30 Q 50 35, 46.5 40 M 53.5 30 Q 50 35, 53.5 40" fill="none" stroke="${c}" stroke-width="0.6" stroke-dasharray="1 1" opacity="0.15" />
</svg>`;
      break;
    case 'honey-comb-pattern':
      svgString = `
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 300 160" width="100%" height="100%" preserveAspectRatio="none">
  <defs>
    <pattern id="honeycomb" width="28" height="16" patternUnits="userSpaceOnUse">
      <path d="M 0 8 L 4 0 L 12 0 L 16 8 L 12 16 L 4 16 Z M 14 16 L 18 8 L 26 8 L 30 16" fill="none" stroke="${c}" stroke-width="0.6" opacity="0.08" />
    </pattern>
  </defs>
  <rect width="300" height="160" fill="url(#honeycomb)" />
  <polygon points="12,12 18,6 30,6 36,12 30,18 18,18" fill="none" stroke="${c}" stroke-width="1.2" opacity="0.25" />
  <polygon points="264,136 270,130 282,130 288,136 282,142 270,142" fill="none" stroke="${c}" stroke-width="1.2" opacity="0.25" />
</svg>`;
      break;
    case 'eco-leaf-pattern':
      svgString = `
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 300 160" width="100%" height="100%" preserveAspectRatio="none">
  <g fill="none" stroke="${c}" stroke-width="1.2" opacity="0.22">
    <path d="M 5 25 C 15 25, 25 15, 25 5 C 15 5, 5 15, 5 25 Z" fill="${c}" fill-opacity="0.08" />
    <path d="M 5 25 L 20 10" />
    <path d="M 295 135 C 285 135, 275 145, 275 155 C 285 155, 295 145, 295 135 Z" fill="${c}" fill-opacity="0.08" />
    <path d="M 295 135 L 280 150" />
  </g>
  <path d="M 90 80 A 15 15 0 0 1 120 80 M 115 75 L 120 80 L 115 85" fill="none" stroke="${c}" stroke-width="0.8" opacity="0.15" />
  <path d="M 120 80 A 15 15 0 0 1 105 95 M 109 99 L 105 95 L 101 99" fill="none" stroke="${c}" stroke-width="0.8" opacity="0.15" />
</svg>`;
      break;
    case 'medical-pulse-pattern':
      svgString = `
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 300 160" width="100%" height="100%" preserveAspectRatio="none">
  <path d="M 10 80 H 80 L 90 60 L 100 110 L 110 50 L 120 90 L 130 80 H 290" fill="none" stroke="${c}" stroke-width="1.5" opacity="0.25" stroke-linecap="round" stroke-linejoin="round" />
  <g stroke="${c}" stroke-width="1" fill="none" opacity="0.15" transform="translate(260, 25) scale(0.9)">
    <path d="M 0 -6 H 4 V -2 H 8 V 2 H 4 V 6 H -4 V 2 H -8 V -2 H -4 V -6 Z" />
  </g>
  <g fill="none" stroke="${c}" stroke-width="0.8" opacity="0.12" transform="translate(30, 115) scale(0.8)">
    <circle cx="10" cy="10" r="8" />
    <path d="M 10 18 Q 10 26, 18 26 T 26 18" />
    <circle cx="26" cy="18" r="3" fill="${c}" fill-opacity="0.2" />
  </g>
</svg>`;
      break;
    case 'lang-global-pattern':
      svgString = `
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 300 160" width="100%" height="100%" preserveAspectRatio="none">
  <g stroke="${c}" stroke-width="0.6" fill="none" opacity="0.16" transform="translate(255, 35)">
    <circle cx="0" cy="0" r="22" />
    <ellipse cx="0" cy="0" rx="22" ry="7" />
    <ellipse cx="0" cy="0" rx="7" ry="22" />
    <line x1="-22" y1="0" x2="22" y2="0" />
    <line x1="0" y1="-22" x2="0" y2="22" />
  </g>
  <g fill="none" stroke="${c}" stroke-width="1" opacity="0.2" transform="translate(35, 120)">
    <path d="M 2 10 A 8 8 0 0 1 18 10 A 8 8 0 0 1 2 10 Z" fill="${c}" fill-opacity="0.08" />
    <path d="M 14 18 L 18 22 L 18 16" />
    <path d="M 8 13 L 10 7 L 12 13 M 9 11 H 11" stroke-width="0.8" />
  </g>
  <g fill="none" stroke="${c}" stroke-width="0.8" opacity="0.15" transform="translate(58, 115) scale(0.8)">
    <path d="M 2 10 A 8 8 0 0 1 18 10 A 8 8 0 0 1 2 10 Z" />
    <path d="M 6 18 L 2 22 L 2 16" />
    <path d="M 6 7 H 14 M 10 7 V 10 M 7 10 Q 10 13, 13 14 M 13 10 Q 10 13, 7 14" />
  </g>
</svg>`;
      break;
    case 'tech-ai-pattern':
      svgString = `
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 300 160" width="100%" height="100%" preserveAspectRatio="none">
  <g stroke="${c}" stroke-width="0.8" fill="none" opacity="0.3">
    <line x1="60" y1="40" x2="100" y2="80" />
    <line x1="60" y1="120" x2="100" y2="80" />
    <line x1="100" y1="80" x2="160" y2="80" />
    <line x1="160" y1="80" x2="200" y2="40" />
    <line x1="160" y1="80" x2="200" y2="120" />
    <circle cx="60" cy="40" r="3.5" fill="#fff" />
    <circle cx="60" cy="120" r="3.5" fill="#fff" />
    <circle cx="100" cy="80" r="5" fill="${c}" />
    <circle cx="160" cy="80" r="5" fill="${c}" />
    <circle cx="200" cy="40" r="3.5" fill="#fff" />
    <circle cx="200" cy="120" r="3.5" fill="#fff" />
  </g>
  <g stroke="${c}" stroke-width="0.8" fill="none" opacity="0.35" transform="translate(130, 68) scale(0.6)">
    <polygon points="20,0 40,10 40,30 20,40 0,30 0,10" fill="${c}" fill-opacity="0.1" />
    <line x1="20" y1="0" x2="20" y2="40" />
    <line x1="0" y1="10" x2="20" y2="20" />
    <line x1="40" y1="10" x2="20" y2="20" />
  </g>
</svg>`;
      break;
    case 'tech-hardware-pattern':
      svgString = `
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 300 160" width="100%" height="100%" preserveAspectRatio="none">
  <g stroke="${c}" stroke-width="1" fill="none" opacity="0.25" transform="translate(125, 55)">
    <rect x="0" y="0" width="50" height="50" rx="3" />
    <rect x="4" y="4" width="42" height="42" stroke-dasharray="2 2" />
    <circle cx="25" cy="25" r="8" opacity="0.3" />
    <line x1="-3" y1="10" x2="0" y2="10" /><line x1="-3" y1="20" x2="0" y2="20" /><line x1="-3" y1="30" x2="0" y2="30" /><line x1="-3" y1="40" x2="0" y2="40" />
    <line x1="50" y1="10" x2="53" y2="10" /><line x1="50" y1="20" x2="53" y2="20" /><line x1="50" y1="30" x2="53" y2="30" /><line x1="50" y1="40" x2="53" y2="40" />
  </g>
  <g stroke="${c}" stroke-width="0.8" opacity="0.2" transform="translate(240, 20)">
    <rect x="0" y="0" width="6" height="120" />
    <rect x="12" y="0" width="6" height="120" />
    <line x1="-4" y1="10" x2="22" y2="10" /><line x1="-4" y1="110" x2="22" y2="110" />
  </g>
  <g fill="none" stroke="${c}" stroke-width="0.8" opacity="0.22">
    <circle cx="40" cy="40" r="6" /><line x1="34" y1="40" x2="46" y2="40" />
    <circle cx="58" cy="40" r="4.5" />
    <circle cx="45" cy="115" r="7" /><line x1="45" y1="109" x2="45" y2="121" />
  </g>
</svg>`;
      break;
    case 'eng-mechanical-pattern':
      svgString = `
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 300 160" width="100%" height="100%" preserveAspectRatio="none">
  <g stroke="${c}" stroke-width="1" fill="none" opacity="0.2" transform="translate(250, 110) scale(1.1)">
    <circle cx="0" cy="0" r="18" />
    <circle cx="0" cy="0" r="8" fill="#fff" />
    <path d="M -3 -22 H 3 L 4 -18 H -4 Z" /><path d="M -3 18 H 3 L 4 22 H -4 Z" transform="rotate(45)" />
    <path d="M -3 18 H 3 L 4 22 H -4 Z" transform="rotate(90)" /><path d="M -3 18 H 3 L 4 22 H -4 Z" transform="rotate(135)" />
    <path d="M -3 18 H 3 L 4 22 H -4 Z" transform="rotate(180)" /><path d="M -3 18 H 3 L 4 22 H -4 Z" transform="rotate(225)" />
    <path d="M -3 18 H 3 L 4 22 H -4 Z" transform="rotate(270)" /><path d="M -3 18 H 3 L 4 22 H -4 Z" transform="rotate(315)" />
  </g>
  <g stroke="${c}" stroke-width="0.8" fill="none" opacity="0.18" transform="translate(210, 80) scale(0.7)">
    <circle cx="0" cy="0" r="15" />
    <circle cx="0" cy="0" r="5" />
    <path d="M -2.5 -18 H 2.5 L 3 -15 H -3 Z" /><path d="M -2.5 15 H 2.5 L 3 18 H -3 Z" transform="rotate(60)" /><path d="M -2.5 15 H 2.5 L 3 18 H -3 Z" transform="rotate(120)" /><path d="M -2.5 15 H 2.5 L 3 18 H -3 Z" transform="rotate(180)" /><path d="M -2.5 15 H 2.5 L 3 18 H -3 Z" transform="rotate(240)" /><path d="M -2.5 15 H 2.5 L 3 18 H -3 Z" transform="rotate(300)" />
  </g>
  <g stroke="${c}" stroke-width="0.6" opacity="0.15">
    <line x1="20" y1="20" x2="160" y2="20" />
    <line x1="20" y1="16" x2="20" y2="24" /><line x1="70" y1="16" x2="70" y2="24" /><line x1="120" y1="16" x2="120" y2="24" /><line x1="160" y1="16" x2="160" y2="24" />
    <text x="90" y="14" fill="${c}" font-size="6" font-family="monospace" text-anchor="middle">scale: 1:10</text>
  </g>
</svg>`;
      break;
    case 'sport-soccer-pattern':
      svgString = `
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 300 160" width="100%" height="100%" preserveAspectRatio="none">
  <g stroke="${c}" stroke-width="0.8" fill="none" opacity="0.18">
    <circle cx="150" cy="80" r="30" />
    <line x1="150" y1="0" x2="150" y2="160" />
    <rect x="0" y="30" width="40" height="100" />
    <rect x="0" y="55" width="15" height="50" />
  </g>
  <g stroke="${c}" stroke-width="0.8" fill="none" opacity="0.16" transform="translate(265, 125) scale(0.9)">
    <circle cx="0" cy="0" r="20" />
    <polygon points="0,-6 5,-3 5,3 0,6 -5,3 -5,-3" />
    <line x1="0" y1="-6" x2="0" y2="-20" />
    <line x1="5" y1="3" x2="16" y2="12" />
    <line x1="-5" y1="3" x2="-16" y2="12" />
    <line x1="5" y1="-3" x2="16" y2="-12" />
    <line x1="-5" y1="-3" x2="-16" y2="-12" />
  </g>
</svg>`;
      break;
    case 'sport-basketball-pattern':
      svgString = `
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 300 160" width="100%" height="100%" preserveAspectRatio="none">
  <g stroke="${c}" stroke-width="1.2" fill="none" opacity="0.18" transform="translate(255, 35) scale(1.1)">
    <circle cx="0" cy="0" r="20" />
    <path d="M -20 0 H 20" />
    <path d="M 0 -20 V 20" />
    <path d="M -14 -14 Q 0 0, -14 14" />
    <path d="M 14 -14 Q 0 0, 14 14" />
  </g>
  <g stroke="${c}" stroke-width="0.8" fill="none" opacity="0.15" transform="translate(35, 120)">
    <ellipse cx="10" cy="0" rx="12" ry="3" fill="${c}" fill-opacity="0.1" />
    <rect x="-6" y="-12" width="32" height="12" />
    <path d="M 0 1 L 4 15 L 10 20 L 16 15 L 20 1 M 2 1 L 10 20 L 18 1 M 6 1 L 2 15 L 10 20 L 18 15 L 14 1" stroke-dasharray="1.5 1.5" />
  </g>
</svg>`;
      break;
    case 'art-music-pattern':
      svgString = `
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 300 160" width="100%" height="100%" preserveAspectRatio="none">
  <g stroke="${c}" stroke-width="0.6" fill="none" opacity="0.14">
    <path d="M 10 70 Q 75 50, 150 70 T 290 70" />
    <path d="M 10 75 Q 75 55, 150 75 T 290 75" />
    <path d="M 10 80 Q 75 60, 150 80 T 290 80" />
    <path d="M 10 85 Q 75 65, 150 85 T 290 85" />
    <path d="M 10 90 Q 75 70, 150 90 T 290 90" />
  </g>
  <g fill="none" stroke="${c}" stroke-width="1" opacity="0.22" transform="translate(35, 62) scale(0.9)">
    <path d="M 6 35 C 6 38, 2 38, 2 35 C 2 28, 12 28, 12 18 C 12 6, 4 2, 4 -12 L 5 -16 C 5 -16, 2 -5, 2 5 C 2 15, -4 20, -4 28 C -4 33, 1 36, 5 36 Z M 4 -16 V 39" />
    <circle cx="4" cy="40" r="2.5" fill="${c}" />
  </g>
  <g fill="${c}" opacity="0.22" transform="translate(180, 45) rotate(15)">
    <ellipse cx="6" cy="10" rx="4" ry="2.8" />
    <line x1="9" y1="10" x2="9" y2="0" stroke="${c}" stroke-width="1.2" />
    <path d="M 9 0 Q 14 2, 14 6" fill="none" stroke="${c}" stroke-width="1.2" />
  </g>
  <g fill="${c}" opacity="0.18" transform="translate(230, 95) scale(0.85) rotate(-10)">
    <ellipse cx="6" cy="10" rx="4" ry="2.8" />
    <line x1="9" y1="10" x2="9" y2="0" stroke="${c}" stroke-width="1.2" />
  </g>
</svg>`;
      break;
    case 'art-paint-pattern':
      svgString = `
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 300 160" width="100%" height="100%" preserveAspectRatio="none">
  <g stroke="${c}" stroke-width="0.8" fill="none" opacity="0.18" transform="translate(245, 110) scale(0.9)">
    <path d="M -15 -10 C -25 -10, -30 10, -15 20 C -5 27, 20 18, 15 0 C 12 -12, -5 -10, -15 -10 Z" fill="${c}" fill-opacity="0.08" />
    <circle cx="-16" cy="4" r="3.5" fill="#fff" />
    <circle cx="-5" cy="-4" r="2" fill="${c}" fill-opacity="0.3" /><circle cx="5" cy="2" r="2" fill="${c}" fill-opacity="0.3" /><circle cx="4" cy="11" r="2" fill="${c}" fill-opacity="0.3" />
    <line x1="-30" y1="28" x2="16" y2="-18" stroke="${c}" stroke-width="1.2" />
    <path d="M 16 -18 L 19 -21 L 18 -16 Z" fill="${c}" />
  </g>
  <g fill="${c}" opacity="0.08">
    <path d="M 30,30 Q 35,25, 45,35 T 55,30 T 40,50 Z" />
    <circle cx="28" cy="45" r="2.5" />
    <circle cx="62" cy="25" r="1.5" />
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

const PetAccentLayer = ({ type, color }: { type?: string; color: string }) => {
  if (!type || type === 'none') return null;

  return (
    <div className="absolute inset-0 pointer-events-none z-[2] overflow-hidden pet-accent-container">
      <style dangerouslySetInnerHTML={{ __html: `
        @keyframes pawBorderTop {
          0% { transform: translate(-20px, 4px) rotate(90deg); opacity: 0; }
          5% { opacity: 0.25; }
          45% { opacity: 0.25; }
          50% { transform: translate(320px, 4px) rotate(90deg); opacity: 0; }
          100% { transform: translate(320px, 4px) rotate(90deg); opacity: 0; }
        }

        @keyframes pawBorderBottom {
          0% { transform: translate(320px, 222px) rotate(-90deg); opacity: 0; }
          50% { transform: translate(320px, 222px) rotate(-90deg); opacity: 0; }
          55% { opacity: 0.25; }
          95% { opacity: 0.25; }
          100% { transform: translate(-20px, 222px) rotate(-90deg); opacity: 0; }
        }

        @keyframes catPeeking {
          0% { transform: translateY(100%); }
          5% { transform: translateY(0); }
          30% { transform: translateY(0); }
          35% { transform: translateY(100%); }
          100% { transform: translateY(100%); }
        }

        @keyframes dogBoneDrift {
          0% { transform: translate(0, 0) rotate(0deg); opacity: 0.15; }
          50% { transform: translate(-8px, 6px) rotate(15deg); opacity: 0.3; }
          100% { transform: translate(0, 0) rotate(0deg); opacity: 0.15; }
        }

        @keyframes petFlying {
          0% { transform: translate(-20px, 2px); opacity: 0; }
          8% { opacity: 0.35; }
          92% { opacity: 0.35; }
          100% { transform: translate(320px, 2px); opacity: 0; }
        }

        .paw-print-top {
          animation: pawBorderTop 15s linear infinite;
        }
        .paw-print-bottom {
          animation: pawBorderBottom 15s linear infinite;
        }
        .cat-peeking {
          animation: catPeeking 12s ease-in-out infinite;
        }
        .dog-bone-float {
          animation: dogBoneDrift 8s ease-in-out infinite;
        }
        .pet-flying {
          animation: petFlying 20s linear infinite;
        }

        @media (prefers-reduced-motion: reduce) {
          .pet-accent-animated {
            animation: none !important;
            display: none !important;
          }
        }
      ` }} />
      {type === 'paw-border' && (
        <>
          <div className="absolute pet-accent-animated paw-print-top" style={{ color }}>
            <svg className="w-3.5 h-3.5" viewBox="0 0 16 16" fill="currentColor">
              <path d="M 8 12 C 5 10, 4 14, 8 15 C 12 14, 11 10, 8 12 Z" />
              <circle cx="2" cy="7" r="1.5" />
              <circle cx="6" cy="4" r="1.5" />
              <circle cx="10.5" cy="4" r="1.5" />
              <circle cx="14" cy="7" r="1.5" />
            </svg>
          </div>
          <div className="absolute pet-accent-animated paw-print-bottom" style={{ color }}>
            <svg className="w-3.5 h-3.5" viewBox="0 0 16 16" fill="currentColor">
              <path d="M 8 12 C 5 10, 4 14, 8 15 C 12 14, 11 10, 8 12 Z" />
              <circle cx="2" cy="7" r="1.5" />
              <circle cx="6" cy="4" r="1.5" />
              <circle cx="10.5" cy="4" r="1.5" />
              <circle cx="14" cy="7" r="1.5" />
            </svg>
          </div>
        </>
      )}
      {type === 'cat-slide' && (
        <div className="absolute bottom-0 left-6 pet-accent-animated cat-peeking" style={{ color }}>
          <svg className="w-8 h-4" viewBox="0 0 32 16" fill="currentColor" opacity="0.25">
            <path d="M 4 16 L 10 2 Q 13 8, 16 16 Z" />
            <path d="M 20 16 L 26 2 Q 29 8, 32 16 Z" />
          </svg>
        </div>
      )}
      {type === 'dog-bone' && (
        <div className="absolute top-8 right-6 pet-accent-animated dog-bone-float" style={{ color }}>
          <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" opacity="0.25">
            <path d="M17 3a2.82 2.82 0 0 0-4 0L12 4l-1-1a2.82 2.82 0 0 0-4 0 2.82 2.82 0 0 0 0 4l.3.3a4.78 4.78 0 0 1 0 6.8l-.3.3a2.82 2.82 0 0 0 0 4 2.82 2.82 0 0 0 4 0l1-1 1 1a2.82 2.82 0 0 0 4 0 2.82 2.82 0 0 0 0-4l-.3-.3a4.78 4.78 0 0 1 0-6.8l.3-.3a2.82 2.82 0 0 0 0-4z" />
          </svg>
        </div>
      )}
      {type === 'pet-orbit' && (
        <div className="absolute top-1 left-0 pet-accent-animated pet-flying" style={{ color }}>
          <svg className="w-4.5 h-3" viewBox="0 0 18 12" fill="currentColor" opacity="0.25">
            <path d="M 0 4 Q 4 -1, 8 3 Q 12 -1, 16 4 Q 8 6, 0 4 Z" />
          </svg>
        </div>
      )}
    </div>
  );
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
  
  const [selectedPattern, setSelectedPattern] = useState(club.background_config?.pattern || 'minimal');
  const [selectedPetAccent, setSelectedPetAccent] = useState(club.background_config?.petAccentType || 'none');
  const [activeTab, setActiveTab] = useState<'all' | 'classic' | 'premium' | 'active' | 'pet'>('all');

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
          petAccentType: selectedPetAccent,
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
  const isPreviewDark = !!previewTemplate?.isDark;
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
            {/* Combined Templates Tab Filter & Grid */}
            <div className="space-y-3">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2.5">
                <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Mẫu thiết kế kết hợp (Template)</label>
                {/* Tab Filter buttons */}
                <div className="flex flex-wrap gap-1 bg-slate-200/50 p-0.5 rounded-lg text-[10px] font-bold">
                  {(['all', 'classic', 'premium', 'active', 'pet'] as const).map((tab) => (
                    <button
                      key={tab}
                      type="button"
                      onClick={() => setActiveTab(tab)}
                      className={cn(
                        "px-2 py-1 rounded-md transition-all cursor-pointer",
                        activeTab === tab ? "bg-white text-blue-600 shadow-sm" : "text-slate-500 hover:text-slate-800"
                      )}
                    >
                      {tab === 'all' ? 'Tất cả' :
                       tab === 'classic' ? 'Tối giản' :
                       tab === 'premium' ? 'Sang trọng' :
                       tab === 'active' ? 'Năng động' : '🐱 Thú cưng'}
                    </button>
                  ))}
                </div>
              </div>

              {/* Grid Layout */}
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5 max-h-[220px] overflow-y-auto pr-1.5 custom-scrollbar">
                {BACKGROUND_TEMPLATES.filter((tpl) => activeTab === 'all' || tpl.category === activeTab).map((tpl) => {
                  const isSelected = selectedPattern === tpl.id;
                  return (
                    <button
                      key={tpl.id}
                      type="button"
                      onClick={() => {
                        setSelectedPattern(tpl.id);
                        setSelectedPreset(tpl.id);
                        setAccentColor(tpl.accentColor);
                      }}
                      className={cn(
                        "flex flex-col p-3 rounded-xl border text-xs font-bold transition-all text-left relative overflow-hidden h-16 justify-between cursor-pointer group shadow-sm transition-all duration-300",
                        tpl.bgClass,
                        isSelected
                          ? "ring-2 ring-offset-1 ring-offset-white"
                          : "hover:scale-[1.02] border-slate-200/60 hover:border-slate-300"
                      )}
                      style={{
                        borderColor: isSelected ? tpl.accentColor : undefined,
                        boxShadow: isSelected ? `0 4px 14px -2px ${tpl.accentColor}30, 0 0 0 2px ${tpl.accentColor}20` : undefined,
                        color: tpl.isDark ? '#F1F5F9' : '#1E293B'
                      }}
                    >
                      <div className="z-10 flex items-center justify-between w-full">
                        <span 
                          className="text-[9px] font-black uppercase tracking-wider opacity-90 truncate pr-1" 
                          title={tpl.name.split(' (')[0]}
                        >
                          {tpl.name.split(' (')[0]}
                        </span>
                        <div 
                          className="w-2.5 h-2.5 rounded-full border border-white/20 shrink-0" 
                          style={{ backgroundColor: tpl.accentColor }} 
                        />
                      </div>
                      <div className="z-10 flex justify-between items-center w-full">
                        <span className="text-[8px] font-bold opacity-60 uppercase tracking-widest">
                          {tpl.category}
                        </span>
                      </div>
                      <div 
                        className="absolute inset-0 opacity-25 group-hover:opacity-45 transition-opacity pointer-events-none z-0" 
                        style={getPatternStyle(tpl.patternId, tpl.accentColor)} 
                      />
                    </button>
                  );
                })}
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

            {/* Hiệu ứng thú cưng chuyển động */}
            <div className="space-y-2 border-t border-slate-200/60 pt-4">
              <label className="text-xs font-bold text-slate-500 uppercase tracking-wider block">Hiệu ứng chuyển động (Motion Accents)</label>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                {[
                  { id: 'none', name: 'Không có hiệu ứng', icon: '🚫' },
                  { id: 'paw-border', name: 'Dấu chân men viền', icon: '🐾' },
                  { id: 'cat-slide', name: 'Mèo con lấp ló', icon: '🐱' },
                  { id: 'dog-bone', name: 'Khúc xương bay nhẹ', icon: '🦴' },
                  { id: 'pet-orbit', name: 'Chim nhỏ bay qua', icon: '🐦' },
                ].map((accent) => (
                  <button
                    key={accent.id}
                    type="button"
                    onClick={() => setSelectedPetAccent(accent.id)}
                    className={cn(
                      "flex items-center gap-2 p-2.5 rounded-xl border text-[11px] font-bold transition-all text-left cursor-pointer bg-white transition-all duration-200 select-none",
                      selectedPetAccent === accent.id
                        ? "border-blue-500 bg-blue-50/40 text-blue-600 ring-2 ring-blue-500/15"
                        : "border-slate-200 hover:border-slate-300 text-slate-700 hover:bg-slate-50"
                    )}
                  >
                    <span className="text-sm shrink-0">{accent.icon}</span>
                    <span className="truncate">{accent.name}</span>
                  </button>
                ))}
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
                "relative bg-white backdrop-blur-md rounded-2xl overflow-hidden shadow-lg flex flex-col min-h-[240px] w-full border transition-all duration-300 p-4 justify-between gap-3.5 template-shine-effect",
                previewCardBgClass
              )}
              style={{
                borderColor: isPreviewDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.04)',
                boxShadow: isPreviewDark ? `0 4px 20px -2px rgba(0,0,0,0.35)` : `0 10px 25px -5px rgba(0,0,0,0.05), 0 8px 10px -6px rgba(0,0,0,0.05)`,
              }}
            >
              {/* Corner Dots */}
              <div className="absolute top-3 left-3 w-1.5 h-1.5 rounded-full z-20 pointer-events-none transition-all duration-300" style={{ backgroundColor: isPreviewDark ? 'rgba(255,255,255,0.35)' : `${accentColor || '#3B82F6'}50` }} />
              <div className="absolute top-3 right-3 w-1.5 h-1.5 rounded-full z-20 pointer-events-none transition-all duration-300" style={{ backgroundColor: isPreviewDark ? 'rgba(255,255,255,0.35)' : `${accentColor || '#3B82F6'}50` }} />
              <div className="absolute bottom-3 left-3 w-1.5 h-1.5 rounded-full z-20 pointer-events-none transition-all duration-300" style={{ backgroundColor: isPreviewDark ? 'rgba(255,255,255,0.35)' : `${accentColor || '#3B82F6'}50` }} />
              <div className="absolute bottom-3 right-3 w-1.5 h-1.5 rounded-full z-20 pointer-events-none transition-all duration-300" style={{ backgroundColor: isPreviewDark ? 'rgba(255,255,255,0.35)' : `${accentColor || '#3B82F6'}50` }} />

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
                  key={`preview-pattern-${selectedPattern}`}
                />
              )}

              {/* Preview Pet Motion Accent Layer */}
              <PetAccentLayer 
                type={selectedPetAccent} 
                color={accentColor} 
              />

              {/* Preview Top Header & Favorite Row */}
              <div className="flex justify-between items-start gap-2 z-10">
                <div className="flex flex-wrap items-center gap-1.5 min-w-0">
                  {/* Category Badge */}
                  <span className={cn(
                    "text-[9px] font-extrabold px-2 py-0.5 rounded-full backdrop-blur-sm shadow-sm border transition-all duration-300",
                    isPreviewDark 
                      ? "bg-white/10 text-slate-200 border-white/10" 
                      : "bg-white/70 text-slate-800 border-slate-200/50"
                  )}>
                    {previewCategoryConf.label}
                  </span>

                  {/* Status Badge with Live Pulsing Dot */}
                  <ClubStatusBadge status={club.status} isDark={isPreviewDark} />

                  {/* Club Code */}
                  <span className={cn(
                    "text-[9px] font-mono font-bold tracking-wider transition-all duration-300",
                    isPreviewDark ? "text-white/40" : "text-slate-400/80"
                  )}>
                    {club.code}
                  </span>
                </div>
                <button
                  type="button"
                  className="w-7 h-7 rounded-full bg-white/90 text-slate-400 flex items-center justify-center backdrop-blur-sm shadow-sm border border-slate-100/50"
                  disabled
                >
                  <Heart size={13} className={club.is_favorited ? "fill-pink-500 text-pink-500" : ""} />
                </button>
              </div>

              {/* Preview Club Name */}
              <div className="flex-1 flex flex-col justify-start min-w-0 z-10 mt-1">
                <h3 className={cn(
                  "text-sm font-bold line-clamp-2 leading-snug",
                  isPreviewDark ? "text-slate-100" : "text-slate-800"
                )}>
                  {club.name}
                </h3>
              </div>

              {/* Preview Middle: Schedule and Location boxes */}
              <div className={cn(
                "space-y-1.5 text-xs font-semibold w-full z-10 my-1",
                isPreviewDark ? "text-slate-300" : "text-slate-700"
              )}>
                {/* Preview Schedule Time */}
                {club.schedule_summary && club.schedule_summary.length > 0 ? (
                  <div className="space-y-1">
                    {club.schedule_summary.slice(0, 2).map((row, idx) => (
                      <div key={idx} className="flex items-start gap-1.5 py-0.5">
                        <Clock size={12} className="text-blue-500 shrink-0 mt-0.5" />
                        <div className="min-w-0 flex-1">
                          <span className={cn(
                            "block text-[11px] font-bold leading-normal break-words",
                            isPreviewDark ? "text-slate-200" : "text-slate-800"
                          )} title={`${row.weekdays.join(', ')}: ${row.timeRange}`}>
                            {row.weekdays.join(', ')}: {row.timeRange}
                          </span>
                        </div>
                      </div>
                    ))}
                    {club.schedule_summary.length > 2 && (
                      <div className="text-[10px] text-slate-500 font-bold pl-2">
                        + {club.schedule_summary.length - 2} ngày khác
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="flex items-center gap-1.5 py-0.5">
                    <Clock size={12} className="text-blue-500 shrink-0" />
                    <span className={cn(
                      "text-[11px] font-bold",
                      isPreviewDark ? "text-slate-200" : "text-slate-800"
                    )}>Chưa xếp lịch</span>
                  </div>
                )}

                {/* Preview Location / Classroom */}
                <div className="flex items-center gap-1.5 py-0.5">
                  <MapPin size={12} className="text-amber-500 shrink-0" />
                  <div className="min-w-0 flex-1">
                    <span className={cn(
                      "block text-[11px] font-bold truncate",
                      isPreviewDark ? "text-slate-200" : "text-slate-800"
                    )} title={club.classroom}>
                      {club.classroom || 'Chưa xếp phòng'}
                    </span>
                  </div>
                </div>
              </div>

              {/* Preview Bottom Stats and Actions Row */}
              <div className={cn(
                "flex items-center justify-between gap-2 z-10 border-t pt-2.5 mt-auto",
                isPreviewDark ? "border-white/15" : "border-slate-100/50"
              )}>
                {/* Stats */}
                <div className={cn(
                  "flex items-center gap-2 text-xs font-semibold shrink-0",
                  isPreviewDark ? "text-slate-400" : "text-slate-500"
                )}>
                  <div className="flex items-center gap-1">
                    <Users size={12} className="text-slate-400 shrink-0" />
                    <span className={cn(
                      "text-[11px] font-bold",
                      isPreviewDark ? "text-slate-300" : "text-slate-700"
                    )}>{club.active_members_count}/{club.max_members || '∞'}</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <Heart size={12} className={club.is_favorited ? "fill-pink-500 text-pink-500 shrink-0" : "text-slate-400 shrink-0"} />
                    <span className={cn(
                      "text-[11px] font-bold",
                      isPreviewDark ? "text-slate-300" : "text-slate-600"
                    )}>{club.favorite_count || 0}</span>
                  </div>
                </div>

                {/* Actions */}
                <div className="flex items-center gap-1.5 shrink-0">
                  <Button
                    variant={
                      club.membership_status === 'active' ? 'outline' :
                      club.membership_status === 'pending' ? 'secondary' : 'default'
                    }
                    size="sm"
                    disabled
                    className={cn(
                      "h-7 text-[10px] px-2.5 font-bold rounded-lg cursor-default truncate max-w-[90px]",
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
