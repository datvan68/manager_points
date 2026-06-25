'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { 
  Search, Users, CheckCircle2, Clock, 
  ChevronLeft, ChevronRight, AlertCircle, Play, Check, ExternalLink,
  Calendar as CalendarIcon, LayoutGrid, List, Filter, X, Eye
} from 'lucide-react';
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/components/ui/select';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { studentTaskApi, StudentTaskProgress, TeacherTaskDetailResponse, TeacherTaskStudentDetail } from '@/api/task-api';
import { classApi } from '@/api/class-api';
import { toast } from 'sonner';
import { useAuth } from '@/providers/auth-provider';
import { usePermission } from '@/components/guards/RouteGuard';
import { CustomPagination } from '@/components/ui/pagination';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { isStudentRole, isTeacherRole, isAdminOrSupervisor } from "@/utils/role.util";

export default function StudentTaskProgressTab() {
  const [items, setItems] = useState<StudentTaskProgress[]>([]);
  const [teacherSummaries, setTeacherSummaries] = useState<any[]>([]);
  const [summary, setSummary] = useState({
    totalAssignees: 0,
    notStarted: 0,
    inProgress: 0,
    completed: 0,
    completionRate: 0,
  });
  
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [teacherDetailOpen, setTeacherDetailOpen] = useState(false);
  const [selectedTeacherProgress, setSelectedTeacherProgress] = useState<StudentTaskProgress | null>(null);
  const [teacherDetail, setTeacherDetail] = useState<TeacherTaskDetailResponse | null>(null);
  const [teacherDetailLoading, setTeacherDetailLoading] = useState(false);
  const [teacherDetailError, setTeacherDetailError] = useState<string | null>(null);

  const [criteriaDialogOpen, setCriteriaDialogOpen] = useState(false);
  const [selectedStudentDetail, setSelectedStudentDetail] = useState<TeacherTaskStudentDetail | null>(null);

  // Filters
  const [searchTerm, setSearchTerm] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'not_started' | 'in_progress' | 'completed'>('all');
  const [assigneeTypeFilter, setAssigneeTypeFilter] = useState<'all' | 'student' | 'teacher' | 'supervisor'>('all');
  
  // New filters data source & state
  const [tasksList, setTasksList] = useState<any[]>([]);
  const [classesList, setClassesList] = useState<any[]>([]);
  const [taskIdFilter, setTaskIdFilter] = useState<string>('');
  const [classIdFilter, setClassIdFilter] = useState<string>('');
  const [sortFilter, setSortFilter] = useState<string>('newest');

  const [viewMode, setViewMode] = useState<'table' | 'card'>('table');
  const [isFilterDialogOpen, setIsFilterDialogOpen] = useState(false);
  const [isSearchExpanded, setIsSearchExpanded] = useState(false);

  useEffect(() => {
    if (typeof window !== 'undefined' && window.innerWidth < 768) {
      setViewMode('card');
    }
  }, []);

  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalCount, setTotalCount] = useState(0);
  const itemsPerPage = 10;
 
  const hasLoadedOnceRef = useRef(false);
  const fetchIdRef = useRef(0);



  // Load tasks and classes for filters
  useEffect(() => {
    const loadFiltersData = async () => {
      try {
        const [classes, tasksRes] = await Promise.all([
          classApi.getClasses().catch(err => {
            console.error('Lỗi load classes list:', err);
            return [];
          }),
          studentTaskApi.getTasks({ page: 1, limit: 100 }).catch(err => {
            console.error('Lỗi load tasks list:', err);
            return { items: [] };
          })
        ]);
        setClassesList(classes);
        setTasksList(tasksRes.items || []);
      } catch (err) {
        console.error('Lỗi load filter data:', err);
      }
    };
    loadFiltersData();
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(searchTerm);
      setCurrentPage(1);
    }, 300);
    return () => clearTimeout(timer);
  }, [searchTerm]);

  const fetchOverview = useCallback(async (showLoading = true) => {
    const currentFetchId = ++fetchIdRef.current;
    if (showLoading) {
      setIsLoading(true);
    }
    setError(null);
    try {
      const res = await studentTaskApi.getTaskProgressOverview({
        page: currentPage,
        limit: itemsPerPage,
        status: statusFilter,
        assigneeType: assigneeTypeFilter,
        search: debouncedSearch,
        taskId: taskIdFilter || undefined,
        classId: classIdFilter || undefined,
        sort: sortFilter || undefined,
      });
      if (currentFetchId !== fetchIdRef.current) return;

      setItems(res.items);
      setTeacherSummaries(res.teacherSummaries || []);
      hasLoadedOnceRef.current = true;
      setSummary(res.summary);
      setTotalPages(res.totalPages);
      setTotalCount(res.total);
    } catch (err: any) {
      if (currentFetchId !== fetchIdRef.current) return;
      console.error(err);
      setError(err.message || 'Không thể tải dữ liệu tiến độ.');
      toast.error('Lỗi khi lấy danh sách tiến độ.');
    } finally {
      if (currentFetchId === fetchIdRef.current) {
        setIsLoading(false);
      }
    }
  }, [currentPage, statusFilter, assigneeTypeFilter, debouncedSearch, taskIdFilter, classIdFilter, sortFilter]);

  useEffect(() => {
    fetchOverview();
    
    // Polling every 15 seconds
    const interval = setInterval(() => {
      fetchOverview(false);
    }, 15000);
    
    return () => clearInterval(interval);
  }, [fetchOverview]);

  const handleOpenTeacherDetail = async (progress: StudentTaskProgress) => {
    setSelectedTeacherProgress(progress);
    setTeacherDetailOpen(true);
    setTeacherDetailLoading(true);
    setTeacherDetailError(null);
    setTeacherDetail(null);
    try {
      const detail = await studentTaskApi.getTeacherProgressDetail(progress.id);
      setTeacherDetail(detail);
    } catch (err: any) {
      setTeacherDetailError(err.message || 'Không thể tải dữ liệu giáo viên');
      toast.error('Lỗi khi lấy chi tiết tiến độ giáo viên');
    } finally {
      setTeacherDetailLoading(false);
    }
  };

  const handleUpdateStatus = async (id: string, currentStatus: string) => {
    let nextStatus = 'in_progress';
    if (currentStatus === 'not_started') nextStatus = 'in_progress';
    else if (currentStatus === 'in_progress') nextStatus = 'completed';
    else nextStatus = 'not_started';

    try {
      await studentTaskApi.updateTaskProgressStatus(id, nextStatus);
      toast.success('Cập nhật trạng thái thành công');
      fetchOverview();
    } catch (err: any) {
      toast.error(err.message || 'Không thể cập nhật trạng thái');
    }
  };

  const { user } = useAuth();
  const isStudent = isStudentRole(user);
  const taskAccess = usePermission({ updateTask: "UPDATE_STUDENT_TASK" });
  const hasManagePermission = isAdminOrSupervisor(user) || taskAccess.updateTask;

  const filterInitializedRef = useRef(false);
  useEffect(() => {
    if (user && !filterInitializedRef.current) {
      const isTeacher = isTeacherRole(user);
      const hasAdminAccess = isAdminOrSupervisor(user);
      if (isTeacher && !hasAdminAccess) {
        setAssigneeTypeFilter('student');
      }
      filterInitializedRef.current = true;
    }
  }, [user]);

  const startItem = totalCount > 0 ? (currentPage - 1) * itemsPerPage + 1 : 0;
  const endItem = Math.min(currentPage * itemsPerPage, totalCount);

  // Polling mechanism
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        fetchOverview();
      }
    };
    
    document.addEventListener('visibilitychange', handleVisibilityChange);
    
    const intervalId = setInterval(() => {
      if (document.visibilityState === 'visible') {
        fetchOverview();
      }
    }, 15000); // 15 seconds

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      clearInterval(intervalId);
    };
  }, [fetchOverview]);

  const renderTeacherProgressBars = () => {
    if (!teacherSummaries || teacherSummaries.length === 0) return null;
    return (
      <div className="bg-white/40 backdrop-blur-md border border-white/70 rounded-xl p-4 shadow-sm mb-2 mt-2">
        <h3 className="text-sm font-bold text-[#1E293B] mb-3">Tiến độ theo Giáo viên chủ nhiệm</h3>
        <div className="flex flex-col gap-3">
          {teacherSummaries.map(t => {
            let colorClass = 'bg-amber-500';
            let textClass = 'text-amber-700';
            let bgClass = 'bg-amber-50';
            
            if (t.completionRate >= 80) {
              colorClass = 'bg-emerald-500';
              textClass = 'text-emerald-700';
              bgClass = 'bg-emerald-50';
            } else if (t.completionRate >= 40) {
              colorClass = 'bg-blue-500';
              textClass = 'text-blue-700';
              bgClass = 'bg-blue-50';
            }

            return (
              <div key={t.teacherId} className="flex flex-col gap-1">
                <div className="flex justify-between items-center text-xs font-semibold">
                  <span className="text-[#334155]">{t.teacherName} (Lớp: {t.classNames.join(', ')})</span>
                  <span className={`px-2 py-0.5 rounded-lg border ${textClass} ${bgClass} border-${colorClass}/20`}>
                    {t.completedStudents}/{t.totalStudents} ({t.completionRate}%)
                  </span>
                </div>
                <div className="w-full bg-slate-200/50 rounded-full h-1.5 overflow-hidden border border-white/40">
                  <div 
                    className={`${colorClass} h-1.5 rounded-full transition-all duration-500 ease-out`} 
                    style={{ width: `${t.completionRate}%` }}
                  />
                </div>
              </div>
            );
          })}
        </div>
      </div>
    );
  };

  const renderKPICards = (isMobile: boolean) => {
    return (
      <div 
        className={`grid gap-3 shrink-0 ${
          isMobile 
            ? "grid-cols-2 md:grid-cols-4 mt-6 pt-4 border-t border-white/30 lg:hidden" 
            : "hidden lg:grid grid-cols-2 lg:grid-cols-4 order-2 lg:order-1 mt-2"
        }`}
      >
        <div className="bg-white/40 backdrop-blur-md border border-white/70 rounded-xl p-2.5 flex flex-col justify-center shadow-sm shadow-slate-300/40 hover:scale-[1.01] hover:bg-white/60 transition-all duration-150 ease-out">
          <span className="text-[10px] font-bold text-[#64748B] uppercase">Tổng người được giao</span>
          <span className="text-xl font-bold text-[#1E293B] mt-0.5">{summary.totalAssignees}</span>
        </div>
        <div className="bg-white/40 backdrop-blur-md border border-white/70 rounded-xl p-2.5 flex flex-col justify-center shadow-sm shadow-slate-300/40 hover:scale-[1.01] hover:bg-white/60 transition-all duration-150 ease-out">
          <span className="text-[10px] font-bold text-[#64748B] uppercase">Chưa hoàn thành</span>
          <span className="text-xl font-bold text-gray-500 mt-0.5">{summary.notStarted}</span>
        </div>
        <div className="bg-white/40 backdrop-blur-md border border-white/70 rounded-xl p-2.5 flex flex-col justify-center shadow-sm shadow-slate-300/40 hover:scale-[1.01] hover:bg-white/60 transition-all duration-150 ease-out">
          <span className="text-[10px] font-bold text-[#64748B] uppercase">Đang thực hiện</span>
          <span className="text-xl font-bold text-blue-600 mt-0.5">{summary.inProgress}</span>
        </div>
        <div className="bg-white/40 backdrop-blur-md border border-white/70 rounded-xl p-2.5 flex flex-col justify-center relative overflow-hidden shadow-sm shadow-slate-300/40 hover:scale-[1.01] hover:bg-white/60 transition-all duration-150 ease-out">
          <span className="text-[10px] font-bold text-[#64748B] uppercase z-10">Đã hoàn thành</span>
          <div className="flex items-baseline gap-1.5 z-10 mt-0.5">
            <span className="text-xl font-bold text-emerald-600">{summary.completed}</span>
            <span className="text-[10px] font-bold text-emerald-600 bg-emerald-50 px-1.5 py-0.5 rounded-xl border border-emerald-100">
              {summary.completionRate}%
            </span>
          </div>
          <div 
            className="absolute bottom-0 left-0 h-1 bg-emerald-500 transition-all" 
            style={{ width: `${summary.completionRate}%` }} 
          />
        </div>
      </div>
    );
  };

  const normalizeProgressStatus = (item: StudentTaskProgress, isCard: boolean) => {
    let completionRate: number | undefined = undefined;
    let hasData = false;
    let detailLabel = '';

    if (item.assigneeType === 'teacher') {
      if (item.teacherProgress) {
        const required = item.teacherProgress.totalRequiredItems;
        const total = required !== undefined ? required : item.teacherProgress.totalStudents;
        if (item.teacherProgress.status === 'no_data' || total === 0) {
          hasData = false;
        } else {
          hasData = true;
          completionRate = item.teacherProgress.completionRate;
          const completed = item.teacherProgress.completedTeacherItems !== undefined ? item.teacherProgress.completedTeacherItems : item.teacherProgress.completedStudents;
          const unit = item.teacherProgress.totalRequiredItems !== undefined ? 'mục đã chấm' : 'sinh viên';
          detailLabel = `${completed}/${total} ${unit}`;
        }
      } else {
        const ts = teacherSummaries?.find(t => t.teacherId === item.assigneeUserId);
        if (ts && ts.totalStudents > 0) {
          hasData = true;
          completionRate = ts.completionRate;
          detailLabel = `${ts.completedStudents}/${ts.totalStudents} sinh viên`;
        } else {
          hasData = false;
        }
      }
    } else if (item.assigneeType === 'student') {
      if (item.criteriaProgress) {
        if (item.criteriaProgress.status === 'no_data' || item.criteriaProgress.totalCriteria === 0) {
          hasData = false;
        } else {
          hasData = true;
          completionRate = item.criteriaProgress.completionRate;
          if (completionRate >= 100) {
            detailLabel = `Đã lưu điểm`;
          } else {
            detailLabel = `Chưa lưu điểm`;
          }
        }
      } else {
        hasData = false;
      }
    } else {
      hasData = false;
    }

    if (completionRate !== undefined) {
      completionRate = Math.max(0, Math.min(100, completionRate));
    }

    let statusType = 'pending';
    if (hasData && completionRate !== undefined) {
      if (completionRate >= 100) statusType = 'completed';
      else if (completionRate > 0) statusType = 'in_progress';
      else statusType = 'pending';
    } else {
      // Fallback for missing criteria data
      if (item.status === 'completed') {
        completionRate = 100;
        statusType = 'completed';
        hasData = true;
      } else if (item.status === 'in_progress') {
        completionRate = 50;
        statusType = 'in_progress';
        hasData = true;
        detailLabel = 'Chưa có DL chi tiết';
      } else if (item.status === 'not_started') {
        completionRate = 0;
        statusType = 'not_started';
        hasData = true;
      } else {
        statusType = 'no_data';
      }
    }

    return { statusType, completionRate, hasData, detailLabel };
  };

  const getStatusElement = (item: StudentTaskProgress, isCard: boolean) => {
    const { statusType, completionRate, detailLabel } = normalizeProgressStatus(item, isCard);

    let colorClass = 'bg-gray-500';
    let textClass = 'text-gray-600';
    let bgClass = 'bg-gray-50';
    let borderClass = 'border-gray-200';
    let label = 'Chưa có dữ liệu';

    if (statusType === 'completed') {
      colorClass = 'bg-emerald-500';
      textClass = 'text-emerald-600';
      bgClass = 'bg-emerald-50';
      borderClass = 'border-emerald-200';
      label = isCard ? 'Đã xong' : 'Đã hoàn thành';
    } else if (statusType === 'in_progress') {
      colorClass = 'bg-blue-500';
      textClass = 'text-blue-600';
      bgClass = 'bg-blue-50';
      borderClass = 'border-blue-200';
      label = isCard ? 'Đang làm' : 'Đang thực hiện';
    } else if (statusType === 'pending' || statusType === 'not_started') {
      colorClass = 'bg-gray-500';
      textClass = 'text-gray-600';
      bgClass = 'bg-gray-50';
      borderClass = 'border-gray-200';
      label = isCard ? 'Chưa xong' : 'Chưa hoàn thành';
    } else {
      colorClass = 'bg-slate-300';
      textClass = 'text-slate-500';
      bgClass = 'bg-slate-50';
      borderClass = 'border-slate-200';
      label = isCard ? 'Không có DL' : 'Chưa có dữ liệu';
    }

    if (completionRate !== undefined && statusType !== 'no_data') {
      return (
        <div className={`flex flex-col gap-1 w-full min-w-[120px] ${isCard ? '' : 'mx-auto max-w-[150px]'}`} title={detailLabel ? `${detailLabel} (${completionRate}%)` : `${completionRate}%`}>
          <div className="flex justify-between items-center text-[10px] font-bold">
            <span className={textClass}>{detailLabel || label}</span>
            <span className={textClass}>{completionRate}%</span>
          </div>
          <div className="w-full bg-slate-200/50 rounded-full h-1.5 overflow-hidden border border-white/40">
            <div 
              className={`${colorClass} h-1.5 rounded-full transition-all duration-500 ease-out`} 
              style={{ width: `${completionRate}%` }}
            />
          </div>
        </div>
      );
    }

    return (
      <span className={`inline-flex px-2 py-0.5 text-[10px] font-bold rounded-xl border ${bgClass} ${textClass} ${borderClass}`}>
        {label}
      </span>
    );
  };

  return (
    <div className="flex-1 flex flex-col gap-4 overflow-hidden min-h-0 bg-transparent">
      {renderTeacherProgressBars()}

      {/* KPI Cards */}
      {renderKPICards(false)}

      <div className="flex-1 bg-white/40 backdrop-blur-md border border-white/70 rounded-2xl flex flex-col min-h-0 overflow-hidden shadow-sm shadow-slate-300/40 order-1 lg:order-2">
        {/* Filters */}
        <div className="p-4 border-b border-white/70 bg-white/20 flex flex-wrap gap-2 lg:gap-3 items-center">
          {/* Trạng thái */}
          <div className="hidden lg:block relative shrink-0 lg:w-36">
            <Select
              value={statusFilter}
              onValueChange={(val: any) => {
                setStatusFilter(val);
                setCurrentPage(1);
              }}
            >
              <SelectTrigger className="h-8 py-1.5 text-xs font-bold text-[#64748B] bg-white/50 border border-white/70 rounded-xl shadow-none focus:ring-2 focus:ring-[#1A73E8]/30">
                <SelectValue placeholder="-- Trạng thái --" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Tất cả</SelectItem>
                <SelectItem value="not_started">Chưa xong</SelectItem>
                <SelectItem value="in_progress">Đang làm</SelectItem>
                <SelectItem value="completed">Đã xong</SelectItem>
              </SelectContent>
            </Select>
          </div>
          
          {/* Đối tượng */}
          <div className="hidden lg:block relative shrink-0 lg:w-36">
            <Select
              value={assigneeTypeFilter}
              onValueChange={(val: any) => {
                setAssigneeTypeFilter(val);
                setCurrentPage(1);
              }}
            >
              <SelectTrigger className="h-8 py-1.5 text-xs font-bold text-[#64748B] bg-white/50 border border-white/70 rounded-xl shadow-none focus:ring-2 focus:ring-[#1A73E8]/30">
                <SelectValue placeholder="-- Đối tượng --" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Tất cả</SelectItem>
                <SelectItem value="student">HSSV</SelectItem>
                <SelectItem value="teacher">Giáo viên</SelectItem>
                <SelectItem value="supervisor">Quản sinh</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Lọc theo Lớp */}
          <div className="hidden lg:block relative shrink-0 lg:w-36">
            <Select
              value={classIdFilter || 'all'}
              onValueChange={(val: any) => {
                setClassIdFilter(val === 'all' ? '' : val);
                setCurrentPage(1);
              }}
            >
              <SelectTrigger className="h-8 py-1.5 text-xs font-bold text-[#64748B] bg-white/50 border border-white/70 rounded-xl shadow-none focus:ring-2 focus:ring-[#1A73E8]/30">
                <SelectValue placeholder="-- Lớp --" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Tất cả</SelectItem>
                {classesList.map(c => (
                  <SelectItem key={c._id} value={c._id}>{c.class_name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Lọc theo Nhiệm vụ */}
          <div className="hidden lg:block relative shrink-0 lg:w-44">
            <Select
              value={taskIdFilter || 'all'}
              onValueChange={(val: any) => {
                setTaskIdFilter(val === 'all' ? '' : val);
                setCurrentPage(1);
              }}
            >
              <SelectTrigger className="h-8 py-1.5 text-xs font-bold text-[#64748B] bg-white/50 border border-white/70 rounded-xl shadow-none focus:ring-2 focus:ring-[#1A73E8]/30">
                <SelectValue placeholder="-- Nhiệm vụ --" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Tất cả</SelectItem>
                {tasksList.map(task => (
                  <SelectItem key={task.id} value={task.id}>{task.title}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Ô Tìm kiếm & Chuyển đổi View Mode */}
          <div className="flex items-center gap-2 w-full lg:flex-1 order-last lg:order-none mt-1 lg:mt-0">
            {/* Desktop-only Search Bar & View Mode Switcher */}
            <div className="hidden lg:flex items-center gap-2 flex-1">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <input
                  type="text"
                  placeholder="Tìm theo tên người thực hiện hoặc tên nhiệm vụ..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full pl-9 pr-4 h-8 text-xs rounded-xl border border-white/70 bg-white/50 focus:outline-none focus:ring-2 focus:ring-[#1A73E8]/30 focus:border-[#1A73E8] transition-all duration-150"
                />
              </div>

              {/* View Mode Switcher */}
              <div className="flex items-center gap-1 bg-white/30 p-0.5 rounded-xl border border-white/70 backdrop-blur-sm shadow-sm shrink-0">
                <button
                  type="button"
                  onClick={() => setViewMode('table')}
                  className={`p-1.5 rounded-lg transition-all duration-150 hover:scale-[1.02] cursor-pointer ${
                    viewMode === 'table' 
                      ? 'bg-white text-[#1A73E8] shadow-sm' 
                      : 'text-slate-400 hover:text-slate-600'
                  }`}
                  title="Xem dạng bảng"
                >
                  <List size={14} />
                </button>
                <button
                  type="button"
                  onClick={() => setViewMode('card')}
                  className={`p-1.5 rounded-lg transition-all duration-150 hover:scale-[1.02] cursor-pointer ${
                    viewMode === 'card' 
                      ? 'bg-white text-[#1A73E8] shadow-sm' 
                      : 'text-slate-400 hover:text-slate-600'
                  }`}
                  title="Xem dạng thẻ"
                >
                  <LayoutGrid size={14} />
                </button>
              </div>
            </div>

            {/* Mobile/Tablet Actions Row */}
            <div className="lg:hidden flex items-center gap-2 w-full">
              {isSearchExpanded ? (
                <div className="flex items-center gap-1.5 w-full">
                  <div className="relative flex-1">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                    <input
                      type="text"
                      placeholder="Tìm kiếm..."
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      autoFocus
                      className="w-full pl-9 pr-4 h-8 text-xs rounded-xl border border-white/70 bg-white/50 focus:outline-none focus:ring-2 focus:ring-[#1A73E8]/30 focus:border-[#1A73E8] transition-all duration-150"
                    />
                  </div>
                  <button
                    onClick={() => {
                      setIsSearchExpanded(false);
                      setSearchTerm('');
                    }}
                    className="flex items-center justify-center bg-white/50 border border-white/70 hover:bg-white/80 active:scale-[0.99] rounded-xl h-8 w-8 text-[#64748B] shrink-0"
                  >
                    <X size={16} />
                  </button>
                </div>
              ) : (
                <div className="flex items-center justify-between gap-2 w-full">
                  {/* Status Select Dropdown (Mobile/Tablet only) */}
                  <div className="relative flex-1 min-w-[120px]">
                    <Select
                      value={statusFilter}
                      onValueChange={(val: any) => {
                        setStatusFilter(val);
                        setCurrentPage(1);
                      }}
                    >
                      <SelectTrigger className="h-8 py-1.5 text-xs font-bold text-[#1A73E8] bg-white border border-white/70 rounded-xl shadow-none focus:ring-2 focus:ring-[#1A73E8]/30">
                        <SelectValue placeholder="Trạng thái" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">Tất cả</SelectItem>
                        <SelectItem value="not_started">Chưa xong</SelectItem>
                        <SelectItem value="in_progress">Đang làm</SelectItem>
                        <SelectItem value="completed">Đã xong</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    {/* Search Icon Button */}
                    <button
                      onClick={() => setIsSearchExpanded(true)}
                      className="flex items-center justify-center bg-white/50 border border-white/70 hover:bg-white/80 active:scale-[0.99] rounded-xl h-8 w-10 text-[#64748B] shrink-0"
                      title="Tìm kiếm"
                    >
                      <Search size={14} />
                    </button>

                    {/* Filter Icon Button */}
                    <button
                      onClick={() => setIsFilterDialogOpen(true)}
                      className="flex items-center justify-center bg-white/50 border border-white/70 hover:bg-white/80 active:scale-[0.99] rounded-xl h-8 w-10 text-[#64748B] shrink-0"
                      title="Bộ lọc"
                    >
                      <Filter size={14} />
                    </button>

                    {/* View Mode Switcher */}
                    <div className="flex items-center gap-1 bg-white/30 p-0.5 rounded-xl border border-white/70 backdrop-blur-sm shadow-sm shrink-0">
                      <button
                        type="button"
                        onClick={() => setViewMode('table')}
                        className={`p-1.5 rounded-lg transition-all duration-150 hover:scale-[1.02] cursor-pointer ${
                          viewMode === 'table' 
                            ? 'bg-white text-[#1A73E8] shadow-sm' 
                            : 'text-slate-400 hover:text-slate-600'
                        }`}
                      >
                        <List size={14} />
                      </button>
                      <button
                        type="button"
                        onClick={() => setViewMode('card')}
                        className={`p-1.5 rounded-lg transition-all duration-150 hover:scale-[1.02] cursor-pointer ${
                          viewMode === 'card' 
                            ? 'bg-white text-[#1A73E8] shadow-sm' 
                            : 'text-slate-400 hover:text-slate-600'
                        }`}
                      >
                        <LayoutGrid size={14} />
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Table */}
        <div className="flex-1 overflow-auto p-4">
          {isLoading && !hasLoadedOnceRef.current ? (
            <div className="flex justify-center py-10"><div className="w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full animate-spin" /></div>
          ) : error ? (
            <div className="text-center text-red-500 py-10">{error}</div>
          ) : items.length === 0 ? (
            <div className={`text-center text-gray-500 py-10 transition-opacity duration-200 ${isLoading ? 'opacity-60 pointer-events-none' : ''}`}>Không có dữ liệu tiến độ.</div>
          ) : viewMode === 'table' ? (
            <div className="overflow-x-auto">
              <table className={`w-full min-w-[1200px] text-left text-sm text-gray-600 transition-opacity duration-200 ${isLoading ? 'opacity-60 pointer-events-none' : ''}`}>
                <thead className="text-xs uppercase bg-white/30 backdrop-blur-sm text-slate-500 sticky top-0">
                  <tr className="whitespace-nowrap border-b border-white/50">
                    <th className="px-4 py-3 rounded-tl-xl font-bold">Người thực hiện</th>
                    <th className="px-4 py-3 font-bold">Vai trò</th>
                    <th className="px-4 py-3 font-bold">Lớp</th>
                    <th className="px-4 py-3 font-bold">Nhiệm vụ</th>
                    <th className="px-4 py-3 font-bold">Loại</th>
                    <th className="px-4 py-3 font-bold">Hạn chót</th>
                    <th className="px-4 py-3 font-bold">Nguồn</th>
                    <th className="px-4 py-3 font-bold">Người cập nhật</th>
                    <th className="px-4 py-3 font-bold">Cập nhật lúc</th>
                    <th className="px-4 py-3 text-center font-bold">Trạng thái</th>
                    <th className="px-4 py-3 rounded-tr-xl text-center font-bold">Hành động</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/30">
                  {items.map((item) => (
                    <tr key={item.id} className="hover:bg-white/50 bg-white/20 transition-colors duration-150">
                      <td className="px-4 py-3 font-semibold text-slate-800 max-w-[130px] truncate" title={item.assigneeName || '-'}>{item.assigneeName || '-'}</td>
                      <td className="px-4 py-3 whitespace-nowrap">
                        {item.assigneeType === 'student' ? 'HSSV' : item.assigneeType === 'teacher' ? 'Giáo viên' : 'Quản sinh'}
                      </td>
                      <td className="px-4 py-3 max-w-[100px] truncate" title={item.className || '-'}>{item.className || '-'}</td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-1.5">
                          <div className="max-w-[180px] truncate font-medium text-slate-700" title={item.taskTitle}>
                            {item.taskTitle}
                          </div>
                          {item.linkedPage && (
                            <a
                                href={item.linkedPage}
                                target="_blank"
                                rel="noreferrer"
                                className="text-blue-500 hover:text-blue-700 shrink-0"
                                title="Mở liên kết nhiệm vụ"
                            >
                              <ExternalLink size={12} />
                            </a>
                          )}
                        </div>
                        <div className="text-xs text-slate-400 mt-0.5 max-w-[180px] truncate" title={item.subject || ''}>{item.subject}</div>
                      </td>
                      <td className="px-4 py-3 text-xs capitalize text-slate-500 whitespace-nowrap">
                        {item.taskType === 'project' ? 'Dự án' : item.taskType === 'assignment' ? 'Bài tập' : 'Hoạt động'}
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap">
                        {item.deadline ? new Date(item.deadline).toLocaleDateString('vi-VN') : '-'}
                      </td>
                      <td className="px-4 py-3 text-xs whitespace-nowrap">
                        {item.statusSource === 'linked_event' ? (
                          <span className="inline-flex items-center text-blue-600 bg-blue-50/70 border border-blue-100/60 px-1.5 py-0.5 rounded-xl font-semibold">
                            Tự động
                          </span>
                        ) : item.statusSource === 'system' ? (
                          <span className="inline-flex items-center text-purple-600 bg-purple-50/70 border border-purple-100/60 px-1.5 py-0.5 rounded-xl font-semibold">
                            Hệ thống
                          </span>
                        ) : (
                          <span className="inline-flex items-center text-slate-600 bg-slate-50/70 border border-slate-100/60 px-1.5 py-0.5 rounded-xl font-semibold">
                            Thủ công
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3 max-w-[120px] truncate whitespace-nowrap" title={item.updatedBy?.name || '-'}>
                        {item.updatedBy?.name || '-'}
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap">
                        {item.updatedAt ? new Date(item.updatedAt).toLocaleString('vi-VN') : '-'}
                      </td>
                      <td className="px-4 py-3 text-center whitespace-nowrap">
                        {getStatusElement(item, false)}
                      </td>
                      <td className="px-4 py-3 text-center whitespace-nowrap">
                        <div className="flex items-center justify-center gap-1.5">
                          {item.assigneeType === 'teacher' && (hasManagePermission || user?.id === item.assigneeUserId) && (
                            <button
                              onClick={() => handleOpenTeacherDetail(item)}
                              title="Chi tiết"
                              className="p-1.5 rounded-xl border border-white/70 bg-white/50 hover:bg-white/80 text-[#1A73E8] hover:text-[#155cb4] hover:border-[#1A73E8]/50 active:scale-[0.98] transition-all duration-150 hover:scale-[1.01]"
                            >
                              <Users size={14} />
                            </button>
                          )}
                          {(hasManagePermission || user?.id === item.assigneeUserId) ? (
                            <button
                              onClick={() => handleUpdateStatus(item.id, item.status)}
                              title="Chuyển trạng thái"
                              className="p-1.5 rounded-xl border border-white/70 bg-white/50 hover:bg-white/80 text-slate-500 hover:text-[#1A73E8] hover:border-[#1A73E8]/50 active:scale-[0.98] transition-all duration-150 hover:scale-[1.01]"
                            >
                              {item.status === 'completed' ? <Check size={14} className="text-emerald-500" /> : <Play size={14} className="text-blue-500" />}
                            </button>
                          ) : (
                            <span className="text-slate-300">-</span>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            /* Card View */
            <div className={`grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 transition-opacity duration-200 ${isLoading ? 'opacity-60 pointer-events-none' : ''}`}>
              {items.map((item) => (
                <div 
                  key={item.id}
                  className="bg-white/45 backdrop-blur-md border border-white/70 rounded-2xl p-4.5 shadow-sm hover:shadow-md hover:border-[#1A73E8]/50 hover:scale-[1.01] transition-all duration-150 ease-out flex flex-col justify-between min-h-[240px] group"
                >
                  {/* Card Header: Category & Status */}
                  <div className="flex items-center justify-between gap-2">
                    <span className={`inline-flex px-2 py-0.5 text-[9px] font-bold rounded-xl border uppercase ${
                      item.taskType === 'project' ? 'text-blue-600 bg-blue-50 border-blue-100/60' :
                      item.taskType === 'assignment' ? 'text-amber-600 bg-amber-50 border-amber-100/60' :
                      'text-purple-600 bg-purple-50 border-purple-100/60'
                    }`}>
                      {item.taskType === 'project' ? 'Dự án' : item.taskType === 'assignment' ? 'Bài tập' : 'Hoạt động'}
                    </span>
                    {getStatusElement(item, true)}
                  </div>

                  {/* Card Body: Task details & Assignee */}
                  <div className="mt-3 flex-1 flex flex-col justify-between">
                    <div>
                      <h4 className="text-sm font-bold text-[#1E293B] line-clamp-2 leading-5 group-hover:text-[#1A73E8] transition-colors" title={item.taskTitle}>
                        {item.taskTitle}
                      </h4>
                      {item.subject && (
                        <p className="text-[11px] text-[#64748B] mt-1 line-clamp-1 font-medium" title={item.subject}>
                          {item.subject}
                        </p>
                      )}
                    </div>

                    <div className="mt-3 pt-3 border-t border-white/40 flex flex-col gap-1.5">
                      <div className="flex items-center justify-between text-[11px]">
                        <span className="text-[#64748B] font-medium">Người thực hiện:</span>
                        <span className="font-bold text-slate-700 max-w-[140px] truncate" title={item.assigneeName || '-'}>
                          {item.assigneeName || '-'}
                        </span>
                      </div>
                      <div className="flex items-center justify-between text-[11px]">
                        <span className="text-[#64748B] font-medium">Vai trò / Lớp:</span>
                        <span className="text-slate-600 font-semibold truncate max-w-[140px]" title={`${item.assigneeType === 'student' ? 'HSSV' : item.assigneeType === 'teacher' ? 'Giáo viên' : 'Quản sinh'} ${item.className ? `• ${item.className}` : ''}`}>
                          {item.assigneeType === 'student' ? 'HSSV' : item.assigneeType === 'teacher' ? 'Giáo viên' : 'Quản sinh'} 
                          {item.className && ` • ${item.className}`}
                        </span>
                      </div>
                      <div className="flex items-center justify-between text-[11px]">
                        <span className="text-[#64748B] font-medium">Hạn chót:</span>
                        <div className="flex items-center gap-1 text-slate-600 font-semibold">
                          <CalendarIcon size={11} className="text-slate-400" />
                          <span>{item.deadline ? new Date(item.deadline).toLocaleDateString('vi-VN') : '-'}</span>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Card Footer: Metadata & Actions */}
                  <div className="mt-4 pt-3 border-t border-white/40 flex items-center justify-between gap-2">
                    <div className="text-[9px] text-[#64748B] font-medium space-y-0.5">
                      <div className="flex items-center gap-1">
                        <span>Nguồn:</span>
                        <span className={`font-semibold ${
                          item.statusSource === 'linked_event' ? 'text-blue-600' :
                          item.statusSource === 'system' ? 'text-purple-600' :
                          'text-slate-600'
                        }`}>
                          {item.statusSource === 'linked_event' ? 'Tự động' : item.statusSource === 'system' ? 'Hệ thống' : 'Thủ công'}
                        </span>
                      </div>
                      {item.updatedBy?.name && (
                        <div className="truncate max-w-[110px]" title={`Cập nhật bởi ${item.updatedBy.name}`}>
                          Bởi: {item.updatedBy.name}
                        </div>
                      )}
                    </div>

                    <div className="flex items-center gap-1.5" onClick={(e) => e.stopPropagation()}>
                      {item.linkedPage && (
                        <a
                          href={item.linkedPage}
                          target="_blank"
                          rel="noreferrer"
                          className="w-7 h-7 rounded-xl border border-white/70 text-[#64748B] bg-white/50 hover:border-[#1A73E8] hover:text-[#1A73E8] flex items-center justify-center transition-all duration-150 hover:scale-[1.01]"
                          title="Mở liên kết nhiệm vụ"
                        >
                          <ExternalLink size={12} />
                        </a>
                      )}
                      {item.assigneeType === 'teacher' && (hasManagePermission || user?.id === item.assigneeUserId) && (
                        <button
                          onClick={() => handleOpenTeacherDetail(item)}
                          className="w-7 h-7 rounded-xl flex items-center justify-center border transition-all duration-150 hover:scale-[1.01] cursor-pointer bg-blue-50/70 border-blue-200 text-[#1A73E8] hover:bg-blue-100/90"
                          title="Chi tiết"
                        >
                          <Users size={14} />
                        </button>
                      )}
                      {(hasManagePermission || user?.id === item.assigneeUserId) && (
                        <button
                          onClick={() => handleUpdateStatus(item.id, item.status)}
                          className={`w-7 h-7 rounded-xl flex items-center justify-center border transition-all duration-150 hover:scale-[1.01] cursor-pointer ${
                            item.status === 'completed'
                              ? 'bg-emerald-50/70 border-emerald-200 text-emerald-600 hover:bg-emerald-100/90'
                              : item.status === 'in_progress'
                              ? 'bg-blue-50/70 border-blue-200 text-[#1A73E8] hover:bg-blue-100/90'
                              : 'bg-white/50 border-white/70 text-[#64748B] hover:border-slate-300 hover:text-[#1E293B]'
                          }`}
                          title="Chuyển trạng thái"
                        >
                          {item.status === 'completed' ? <Check size={14} className="text-emerald-500" /> : <Play size={14} className="text-blue-500" />}
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}

          {renderKPICards(true)}
        </div>

        {/* Pagination */}
        <div className="hidden lg:block">
          <CustomPagination
            currentPage={currentPage}
            pageSize={itemsPerPage}
            totalItems={totalCount}
            onPageChange={setCurrentPage}
            label="bản ghi"
          />
        </div>
      </div>

      {/* Filter Dialog (Mobile/Tablet Only) */}
      <Dialog open={isFilterDialogOpen} onOpenChange={setIsFilterDialogOpen}>
        <DialogContent className="max-w-[340px] rounded-2xl bg-white/90 backdrop-blur-lg border border-white/70 p-5 z-[100]">
          <DialogHeader className="mb-2 text-left">
            <DialogTitle className="text-base font-bold text-[#1E293B]">Bộ lọc tiến độ</DialogTitle>
          </DialogHeader>
          
          <div className="space-y-4 my-2">
            
            {/* Đối tượng */}
            <div className="space-y-1.5">
              <label className="text-[11px] font-bold text-[#64748B] uppercase tracking-wider">Đối tượng</label>
              <Select
                value={assigneeTypeFilter}
                onValueChange={(val: any) => {
                  setAssigneeTypeFilter(val);
                  setCurrentPage(1);
                }}
              >
                <SelectTrigger className="w-full h-9 py-1.5 text-xs font-bold text-[#64748B] bg-white/60 border border-white/80 rounded-xl focus:ring-2 focus:ring-[#1A73E8]/30">
                  <SelectValue placeholder="-- Đối tượng --" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Tất cả</SelectItem>
                  <SelectItem value="student">HSSV</SelectItem>
                  <SelectItem value="teacher">Giáo viên</SelectItem>
                  <SelectItem value="supervisor">Quản sinh</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Lọc theo Lớp */}
            <div className="space-y-1.5">
              <label className="text-[11px] font-bold text-[#64748B] uppercase tracking-wider">Lớp</label>
              <Select
                value={classIdFilter || 'all'}
                onValueChange={(val: any) => {
                  setClassIdFilter(val === 'all' ? '' : val);
                  setCurrentPage(1);
                }}
              >
                <SelectTrigger className="w-full h-9 py-1.5 text-xs font-bold text-[#64748B] bg-white/60 border border-white/80 rounded-xl focus:ring-2 focus:ring-[#1A73E8]/30">
                  <SelectValue placeholder="-- Lớp --" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Tất cả</SelectItem>
                  {classesList.map(c => (
                    <SelectItem key={c._id} value={c._id}>{c.class_name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Lọc theo Nhiệm vụ */}
            <div className="space-y-1.5">
              <label className="text-[11px] font-bold text-[#64748B] uppercase tracking-wider">Nhiệm vụ</label>
              <Select
                value={taskIdFilter || 'all'}
                onValueChange={(val: any) => {
                  setTaskIdFilter(val === 'all' ? '' : val);
                  setCurrentPage(1);
                }}
              >
                <SelectTrigger className="w-full h-9 py-1.5 text-xs font-bold text-[#64748B] bg-white/60 border border-white/80 rounded-xl focus:ring-2 focus:ring-[#1A73E8]/30">
                  <SelectValue placeholder="-- Nhiệm vụ --" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Tất cả</SelectItem>
                  {tasksList.map(task => (
                    <SelectItem key={task.id} value={task.id}>{task.title}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          
          <div className="mt-5 flex justify-end gap-2.5">
            <button
              onClick={() => {
                setStatusFilter('all');
                setAssigneeTypeFilter('all');
                setClassIdFilter('');
                setTaskIdFilter('');
                setCurrentPage(1);
              }}
              className="px-3.5 py-1.5 rounded-xl text-xs font-semibold text-[#64748B] hover:bg-slate-100 active:scale-[0.98] transition-all cursor-pointer border border-slate-200 bg-white"
            >
              Đặt lại
            </button>
            <button
              onClick={() => setIsFilterDialogOpen(false)}
              className="px-4 py-1.5 rounded-xl text-xs font-semibold text-white bg-[#1A73E8] hover:bg-[#155cb4] active:scale-[0.99] transition-all cursor-pointer shadow-sm shadow-blue-500/10"
            >
              Áp dụng
            </button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Teacher Detail Dialog */}
      <Dialog open={teacherDetailOpen} onOpenChange={setTeacherDetailOpen}>
        <DialogContent className="max-w-5xl rounded-2xl bg-[#F8FAFC] border border-white/70 p-0 overflow-hidden flex flex-col h-[85vh] z-[100]">
          <DialogHeader className="p-5 border-b border-slate-200/60 bg-white/50 backdrop-blur-sm sticky top-0 z-10 shrink-0">
            <DialogTitle className="text-lg font-bold text-[#1E293B] flex items-center gap-2">
              <Users size={20} className="text-blue-600" />
              Chi tiết tiến độ: {selectedTeacherProgress?.teacherProgress?.teacherName || teacherDetail?.teacherName || selectedTeacherProgress?.assigneeName || 'Giáo viên'}
            </DialogTitle>
            {teacherDetail && (
              <div className="flex gap-4 mt-2 text-sm">
                <div className="flex items-center gap-1.5"><span className="text-slate-500">Lớp:</span><span className="font-semibold">{teacherDetail.totals.classCount}</span></div>
                <div className="flex items-center gap-1.5"><span className="text-slate-500">Sinh viên:</span><span className="font-semibold">{teacherDetail.totals.studentCount}</span></div>
                <div className="flex items-center gap-1.5"><span className="text-slate-500">Hoàn thành:</span><span className="font-semibold text-emerald-600">{teacherDetail.totals.completionRate}%</span></div>
              </div>
            )}
          </DialogHeader>
          {teacherDetail?.context?.source === 'none' && (
            <div className="px-5 py-2 bg-amber-50 border-b border-amber-200 text-amber-700 text-sm font-medium flex items-center gap-2 shrink-0">
              <AlertCircle size={16} />
              Chưa xác định được học kỳ/kỳ đánh giá để lấy dữ liệu chấm điểm.
            </div>
          )}
          <div className="p-5 overflow-auto flex-1 bg-gradient-to-b from-white/30 to-transparent">
            {teacherDetailLoading ? (
              <div className="flex justify-center py-20"><div className="w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full animate-spin" /></div>
            ) : teacherDetailError ? (
              <div className="text-center text-red-500 py-10 flex flex-col items-center gap-3">
                <AlertCircle size={32} className="text-red-400" />
                <span>{teacherDetailError}</span>
                <button onClick={() => selectedTeacherProgress && handleOpenTeacherDetail(selectedTeacherProgress)} className="px-4 py-1.5 bg-white border border-slate-200 rounded-lg text-sm hover:bg-slate-50">Thử lại</button>
              </div>
            ) : teacherDetail?.classes?.length === 0 ? (
              <div className="text-center text-slate-500 py-10 flex flex-col items-center gap-2">
                <Users size={32} className="text-slate-300" />
                <span>Giáo viên này không chủ nhiệm lớp nào hoặc chưa có dữ liệu sinh viên.</span>
              </div>
            ) : (
              <div className="space-y-6">
                {teacherDetail?.classes.map(cls => (
                  <div key={cls.classId} className="bg-white/60 border border-white/70 rounded-2xl p-4 shadow-sm">
                    <div className="flex items-center justify-between mb-4">
                      <div className="flex items-center gap-2">
                        <h3 className="font-bold text-slate-800 text-base">{cls.className}</h3>
                        <span className="px-2 py-0.5 rounded-full bg-slate-100 text-slate-600 text-xs font-semibold">{cls.totals.studentCount} SV</span>
                      </div>
                      <div className="flex items-center gap-2 text-sm">
                        <span className="text-slate-500">Tiến độ:</span>
                        <div className="flex items-center gap-1.5">
                          <span className="font-bold text-slate-700">{cls.totals.completedTeacherItems}/{cls.totals.totalRequiredItems}</span>
                          <span className="px-1.5 py-0.5 rounded-md bg-blue-50 text-blue-600 font-bold text-xs">{cls.totals.completionRate}%</span>
                        </div>
                      </div>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                      {cls.students.map(student => {
                        let statusColor = 'bg-slate-100 text-slate-600';
                        let statusBg = 'bg-slate-200/50';
                        let progressColor = 'bg-slate-400';
                        if (student.status === 'completed') { statusColor = 'bg-emerald-50 text-emerald-600'; statusBg = 'bg-emerald-100'; progressColor = 'bg-emerald-500'; }
                        else if (student.status === 'in_progress') { statusColor = 'bg-blue-50 text-blue-600'; statusBg = 'bg-blue-100'; progressColor = 'bg-blue-500'; }
                        else if (student.status === 'not_started') { statusColor = 'bg-amber-50 text-amber-600'; statusBg = 'bg-amber-100'; progressColor = 'bg-amber-500'; }
                        
                        return (
                          <div key={student.studentId} className="bg-white border border-slate-200/60 rounded-xl p-3 flex flex-col gap-2 shadow-[0_1px_2px_rgba(0,0,0,0.02)] hover:shadow-md transition-all">
                            <div className="flex justify-between items-start">
                              <div className="flex flex-col">
                                <span className="font-bold text-slate-800 text-sm truncate max-w-[150px]" title={student.fullName}>{student.fullName}</span>
                                <span className="text-xs text-slate-500">{student.studentCode}</span>
                              </div>
                              <button 
                                onClick={() => {
                                  setSelectedStudentDetail(student);
                                  setCriteriaDialogOpen(true);
                                }}
                                className="w-7 h-7 flex items-center justify-center rounded-lg bg-slate-50 hover:bg-blue-50 text-slate-400 hover:text-blue-600 transition-colors shrink-0"
                                title="Xem tiêu chí"
                              >
                                <Eye size={14} />
                              </button>
                            </div>
                            <div className="mt-1 flex flex-col gap-1.5">
                              <div className="flex justify-between items-center text-xs font-semibold">
                                <span className="text-slate-500">
                                  {student.status === 'no_data' 
                                    ? "Chưa có dữ liệu" 
                                    : student.completionRate === 100 ? "Đã lưu điểm" : "Chưa lưu điểm"}
                                </span>
                                {student.status !== 'no_data' && (
                                  <span className={`px-1.5 py-0.5 rounded-md ${statusColor} text-[10px]`}>{student.completionRate}%</span>
                                )}
                              </div>
                              {student.status !== 'no_data' && (
                                <div className={`w-full ${statusBg} rounded-full h-1.5 overflow-hidden`}>
                                  <div className={`${progressColor} h-1.5 rounded-full transition-all`} style={{ width: `${student.completionRate}%` }} />
                                </div>
                              )}
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* Criteria Detail Dialog */}
      <Dialog open={criteriaDialogOpen} onOpenChange={setCriteriaDialogOpen}>
        <DialogContent className="max-w-2xl rounded-2xl bg-white border border-slate-200 p-0 z-[110] overflow-hidden flex flex-col max-h-[80vh]">
          <DialogHeader className="p-4 border-b border-slate-100 bg-slate-50/50 sticky top-0 shrink-0">
            <DialogTitle className="text-base font-bold text-slate-800">
              Chi tiết điểm - {selectedStudentDetail?.fullName} ({selectedStudentDetail?.studentCode})
            </DialogTitle>
          </DialogHeader>
          <div className="p-4 overflow-auto flex-1">
            <table className="w-full text-left text-sm text-slate-600">
              <thead className="text-xs uppercase bg-slate-50 text-slate-500 sticky top-0 z-10 rounded-t-lg">
                <tr>
                  <th className="px-4 py-2 font-bold rounded-tl-lg">Mã TC</th>
                  <th className="px-4 py-2 font-bold text-center">Điểm đạt</th>
                  <th className="px-4 py-2 font-bold text-center rounded-tr-lg">Trạng thái</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {[...(selectedStudentDetail?.criteria || [])]
                  .sort((a, b) => a.criterionCode.localeCompare(b.criterionCode, 'vi', { numeric: true, sensitivity: 'base' }))
                  .map((c, i) => (
                  <tr key={c.criterionId || i} className={`hover:bg-slate-50/50 ${c.isLocked ? 'opacity-60 bg-slate-50' : ''}`}>
                    <td className="px-4 py-2.5 font-medium text-slate-700">
                      <div className="flex items-center gap-2">
                        {c.criterionCode}
                        {c.isLocked && (
                          <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-slate-200 text-slate-500">
                            Đã khóa
                          </span>
                        )}
                      </div>
                    </td>
                    <td className={`px-4 py-2.5 text-center font-semibold ${c.isLocked ? 'text-slate-500' : 'text-blue-600'}`}>
                      {c.score !== null && c.score !== undefined ? c.score : <span className="text-slate-400 font-normal italic">Chưa có điểm</span>}
                    </td>
                    <td className="px-4 py-2.5 text-center">
                      {c.isLocked ? (
                        <span className="inline-flex items-center gap-1 text-[11px] font-bold text-slate-500 bg-slate-200 px-2 py-0.5 rounded-full">
                          Không tính
                        </span>
                      ) : c.isTeacherHandled ? (
                        <span className="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-full">
                          <CheckCircle2 size={12} /> Đã chấm
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 text-[11px] font-bold text-amber-600 bg-amber-50 px-2 py-0.5 rounded-full">
                          <Clock size={12} /> Chờ chấm
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
                {(!selectedStudentDetail?.criteria || selectedStudentDetail.criteria.length === 0) && (
                  <tr>
                    <td colSpan={3} className="px-4 py-6 text-center text-slate-500 italic">
                      Chưa có dữ liệu tiêu chí cho sinh viên này trong kỳ đánh giá đang xem.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
