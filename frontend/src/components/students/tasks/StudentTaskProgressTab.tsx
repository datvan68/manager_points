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

export default function StudentTaskProgressTab({ showStats = false }: { showStats?: boolean }) {
  const [items, setItems] = useState<StudentTaskProgress[]>([]);
  const [teacherSummaries, setTeacherSummaries] = useState<any[]>([]);
  const [summary, setSummary] = useState({
    totalAssignees: 0,
    notStarted: 0,
    inProgress: 0,
    completed: 0,
  });
  
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

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
    return null;
  };

  const renderKPICards = (isMobile: boolean) => {
    return (
      <div 
        className={`grid gap-3 shrink-0 ${
          isMobile 
            ? "grid-cols-1 sm:grid-cols-3 mt-6 pt-4 border-t border-white/30 lg:hidden" 
            : "hidden lg:grid lg:grid-cols-3 order-2 lg:order-1 mt-2"
        }`}
      >
        <div className="bg-white/40 backdrop-blur-md border border-white/70 rounded-xl p-3 flex flex-row items-center justify-between shadow-sm shadow-slate-300/40 hover:scale-[1.01] hover:bg-white/60 transition-all duration-150 ease-out">
          <span className="text-[10px] font-bold text-[#64748B] uppercase">Tổng người được giao</span>
          <span className="text-xl font-bold text-[#1E293B]">{summary.totalAssignees}</span>
        </div>
        <div className="bg-white/40 backdrop-blur-md border border-white/70 rounded-xl p-3 flex flex-row items-center justify-between shadow-sm shadow-slate-300/40 hover:scale-[1.01] hover:bg-white/60 transition-all duration-150 ease-out">
          <span className="text-[10px] font-bold text-[#64748B] uppercase">Chưa truy cập</span>
          <span className="text-xl font-bold text-amber-500">{summary.notStarted}</span>
        </div>
        <div className="bg-white/40 backdrop-blur-md border border-white/70 rounded-xl p-3 flex flex-row items-center justify-between relative overflow-hidden shadow-sm shadow-slate-300/40 hover:scale-[1.01] hover:bg-white/60 transition-all duration-150 ease-out">
          <span className="text-[10px] font-bold text-[#64748B] uppercase z-10">Đã truy cập</span>
          <span className="text-xl font-bold text-emerald-600 z-10">{summary.inProgress + summary.completed}</span>
        </div>
      </div>
    );
  };

  const getStatusElement = (item: StudentTaskProgress, isCard: boolean) => {
    let label = 'Chưa bắt đầu';
    let textClass = 'text-slate-600';
    let bgClass = 'bg-slate-50';
    let borderClass = 'border-slate-200';

    const now = new Date();
    // Assuming you have item.deadline, if not we rely on status only or add it. 
    // The scope says "The backend finalizer should keep progress as not started if the user never accessed before the deadline."
    // And "After the deadline: users who never accessed display Đã quá hạn."
    // So we can check if it's not_started and the deadline has passed.
    const deadline = item.deadline ? new Date(item.deadline) : null;
    const isOverdue = deadline && deadline.getTime() < now.getTime();

    if (item.status === 'completed') {
      label = 'Đã truy cập';
      textClass = 'text-emerald-600';
      bgClass = 'bg-emerald-50';
      borderClass = 'border-emerald-200';
    } else if (item.status === 'in_progress') {
      label = 'Đã truy cập';
      textClass = 'text-emerald-600';
      bgClass = 'bg-emerald-50';
      borderClass = 'border-emerald-200';
    } else {
      if (isOverdue) {
        label = 'Đã quá hạn';
        textClass = 'text-red-600';
        bgClass = 'bg-red-50';
        borderClass = 'border-red-200';
      } else {
        label = 'Chưa truy cập';
        textClass = 'text-amber-600';
        bgClass = 'bg-amber-50';
        borderClass = 'border-amber-200';
      }
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
      {showStats && renderKPICards(false)}

      <div className="flex-1 bg-white/40 backdrop-blur-md border border-white/70 rounded-2xl flex flex-col min-h-0 overflow-hidden shadow-sm shadow-slate-300/40 order-1 lg:order-2">
        {/* Filters */}
        <div className="p-4 border-b border-white/70 bg-white/20 flex flex-wrap gap-2 lg:gap-3 items-center">
          {/* Trạng thái */}
          <div className="hidden">
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
          <div className="hidden">
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
          <div className="hidden">
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
          <div className="hidden">
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
            <button
              type="button"
              onClick={() => setIsFilterDialogOpen(true)}
              aria-label="Mở bộ lọc theo dõi"
              title="Bộ lọc"
              className="hidden lg:flex h-8 w-9 items-center justify-center rounded-xl border border-white/70 bg-white/50 text-[#64748B] hover:bg-white/80"
            >
              <Filter size={14} />
            </button>
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
                  className={`p-1.5 rounded-lg transition-all duration-150 hover:scale-[1.02] cursor-pointer outline-none focus:outline-none focus-visible:outline-none select-none border ${
                    viewMode === 'table' 
                      ? 'bg-[#E6E8EB] border-white/70 text-[#1E293B]' 
                      : 'border-transparent text-slate-400 hover:text-slate-600'
                  }`}
                  title="Xem dạng bảng"
                >
                  <List size={14} />
                </button>
                <button
                  type="button"
                  onClick={() => setViewMode('card')}
                  className={`p-1.5 rounded-lg transition-all duration-150 hover:scale-[1.02] cursor-pointer outline-none focus:outline-none focus-visible:outline-none select-none border ${
                    viewMode === 'card' 
                      ? 'bg-[#E6E8EB] border-white/70 text-[#1E293B]' 
                      : 'border-transparent text-slate-400 hover:text-slate-600'
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
                        className={`p-1.5 rounded-lg transition-all duration-150 hover:scale-[1.02] cursor-pointer outline-none focus:outline-none focus-visible:outline-none select-none border ${
                          viewMode === 'table' 
                            ? 'bg-[#E6E8EB] border-white/70 text-[#1E293B]' 
                            : 'border-transparent text-slate-400 hover:text-slate-600'
                        }`}
                      >
                        <List size={14} />
                      </button>
                      <button
                        type="button"
                        onClick={() => setViewMode('card')}
                        className={`p-1.5 rounded-lg transition-all duration-150 hover:scale-[1.02] cursor-pointer outline-none focus:outline-none focus-visible:outline-none select-none border ${
                          viewMode === 'card' 
                            ? 'bg-[#E6E8EB] border-white/70 text-[#1E293B]' 
                            : 'border-transparent text-slate-400 hover:text-slate-600'
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
    </div>
  );
}
