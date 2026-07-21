'use client';

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { 
  Search, Plus, Filter, Play, Check, AlertCircle, 
  Calendar, ChevronLeft, ChevronRight, 
  CheckCircle2, Clock, ExternalLink, Users, UserCheck, ShieldAlert, X
} from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useAuth, isAdminUser } from '@/providers/auth-provider';
import { getModuleIdByPath, getMaintenanceStatesWithCache } from '@/utils/module-maintenance.util';
import AddTaskModal from './AddTaskModal';
import Action from '@/components/ui/Action';
import { usePermission } from '@/components/guards/RouteGuard';
import { toast } from 'sonner';
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/components/ui/select';
import { Button } from "@/components/ui/button";
import { CustomPagination } from '@/components/ui/pagination';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import ConfirmModal from '@/components/modals/ConfirmModal';

import { isStudentRole, isTeacherRole, isAdminOrSupervisor } from "@/utils/role.util";
import { getLinkedTaskMode } from '@/lib/task-linked-page';

import { studentTaskApi, StudentTask as BackendTask, CreateTaskDto, UpdateTaskDto } from '@/api/task-api';

interface Task {
  id: string;
  title: string;
  type: 'Dự án' | 'Bài tập' | 'Hoạt động';
  subject: string;
  deadline: string;
  priority: 'High' | 'Medium' | 'Low';
  status: 'Chưa bắt đầu' | 'Đang làm' | 'Đã xong';
  linkedPage: string;
  targetType: 'HSSV' | 'Giáo viên' | 'Quản sinh';
  targetScope: 'Tất cả' | 'Cụ thể';
  targetDetail?: string;
  targetStudentIds?: string[];
  targetClassIds?: string[];
  targetTeacherIds?: string[];
  userProgress?: {
    id: string;
    status: 'Chưa bắt đầu' | 'Đang làm' | 'Đã xong';
  };
}

const mapBackendToClientTask = (t: BackendTask): Task => {
  let type: Task['type'] = 'Bài tập';
  if (t.type === 'project') type = 'Dự án';
  else if (t.type === 'activity') type = 'Hoạt động';

  let priority: Task['priority'] = 'Medium';
  if (t.priority === 'high') priority = 'High';
  else if (t.priority === 'low') priority = 'Low';

  let status: Task['status'] = 'Chưa bắt đầu';
  if (t.status === 'in_progress') status = 'Đang làm';
  else if (t.status === 'completed') status = 'Đã xong';

  let targetType: Task['targetType'] = 'HSSV';
  if (t.targetType === 'teacher') targetType = 'Giáo viên';
  else if (t.targetType === 'supervisor') targetType = 'Quản sinh';

  let targetScope: Task['targetScope'] = 'Tất cả';
  if (t.targetScope === 'specific') targetScope = 'Cụ thể';

  let deadlineStr = '';
  if (t.deadline) {
    const isoDateStr = t.deadline.split('T')[0];
    const dateParts = isoDateStr.split('-');
    if (dateParts.length === 3) {
      deadlineStr = `${dateParts[2]}/${dateParts[1]}/${dateParts[0]}`;
    } else {
      deadlineStr = t.deadline;
    }
  }

  let userProgress: Task['userProgress'] = undefined;
  if (t.userProgress) {
    let upStatus: Task['status'] = 'Chưa bắt đầu';
    if (t.userProgress.status === 'in_progress') upStatus = 'Đang làm';
    else if (t.userProgress.status === 'completed') upStatus = 'Đã xong';
    userProgress = {
      id: t.userProgress.id,
      status: upStatus,
    };
  }

  return {
    id: t.id,
    title: t.title,
    type,
    subject: t.subject,
    deadline: deadlineStr,
    priority,
    status,
    linkedPage: t.linkedPage,
    targetType,
    targetScope,
    targetDetail: t.targetDetail,
    targetStudentIds: t.targetStudentIds || [],
    targetClassIds: t.targetClassIds || [],
    targetTeacherIds: t.targetTeacherIds || [],
    userProgress,
  };
};

const mapClientToBackendDto = (t: any): CreateTaskDto => {
  let type: CreateTaskDto['type'] = 'assignment';
  if (t.type === 'Dự án') type = 'project';
  else if (t.type === 'Hoạt động') type = 'activity';

  let priority: CreateTaskDto['priority'] = 'medium';
  if (t.priority === 'High') priority = 'high';
  else if (t.priority === 'Low') priority = 'low';

  let status: CreateTaskDto['status'] = 'not_started';
  if (t.status === 'Đang làm') status = 'in_progress';
  else if (t.status === 'Đã xong') status = 'completed';

  let targetType: CreateTaskDto['targetType'] = 'student';
  if (t.targetType === 'Giáo viên') targetType = 'teacher';
  else if (t.targetType === 'Quản sinh') targetType = 'supervisor';

  let targetScope: CreateTaskDto['targetScope'] = 'all';
  if (t.targetScope === 'Cụ thể') targetScope = 'specific';

  let deadlineIso = '';
  if (t.deadline) {
    const parts = t.deadline.split('/');
    if (parts.length === 3) {
      deadlineIso = `${parts[2]}-${parts[1]}-${parts[0]}`;
    } else {
      deadlineIso = t.deadline;
    }
  }

  return {
    title: t.title,
    type,
    subject: t.subject,
    deadline: deadlineIso,
    priority,
    status,
    linkedPage: t.linkedPage,
    targetType,
    targetScope,
    targetDetail: t.targetDetail,
    targetStudentIds: t.targetStudentIds || [],
    targetClassIds: t.targetClassIds || [],
    targetTeacherIds: t.targetTeacherIds || [],
  };
};

const LINKED_PAGE_NAMES: Record<string, string> = {
  '/students': 'Hồ sơ sinh viên',
  '/grading': 'Đánh giá điểm số',
  '/grading/score': 'Ghi nhận điểm số',
  '/grading/categories': 'Danh mục điểm số',
  '/students/record': 'Theo dõi chuyên cần',
  '/students/tasks': 'Nhiệm vụ',
  '/dormitory': 'Quản lý KTX',
  '/activities': 'Câu lạc bộ',
  '/permissions': 'Kiểm soát phân quyền',
  '/system': 'Quản trị hệ thống',
  '/reports': 'Thống kê báo cáo',
  '/notifications': 'Quản lý thông báo',
  '/profile': 'Thông tin cá nhân',
};

const getLinkedPageName = (url: string): string => {
  if (!url) return 'Trang liên kết';
  const path = url.split('?')[0].trim();
  const normalizedPath = (path.startsWith('/') ? path : '/' + path).replace(/\/$/, '');
  return LINKED_PAGE_NAMES[normalizedPath] || url;
};

const StudentTasksTab = () => {
  const router = useRouter();
  const { user } = useAuth();
  const taskAccess = usePermission({
    viewTask: "READ_STUDENT_TASK",
    createTask: "CREATE_STUDENT_TASK",
    editTask: "UPDATE_STUDENT_TASK",
    deleteTask: "DELETE_STUDENT_TASK"
  });

  const isStudent = isStudentRole(user);
  const isTeacher = isTeacherRole(user);
  
  const canManageTasks = !isStudent && (
    isAdminOrSupervisor(user) || 
    taskAccess.createTask || 
    taskAccess.editTask || 
    taskAccess.deleteTask
  );
  
  const canCreateTask = !isStudent && taskAccess.createTask;

  // States từ API
  const [tasks, setTasks] = useState<Task[]>([]);
  const [summary, setSummary] = useState({
    totalTasks: 0,
    urgentTasks: 0,
    completedTasks: 0,
  });
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // States bộ lọc & phân trang
  const [searchTerm, setSearchTerm] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [activeTabFilter, setActiveTabFilter] = useState<'Mới nhất' | 'Hoàn thành' | 'Đang làm' | 'Chưa bắt đầu'>('Mới nhất');
  const [priorityFilter, setPriorityFilter] = useState<'All' | 'High' | 'Medium' | 'Low'>('All');
  const [targetFilter, setTargetFilter] = useState<'All' | 'HSSV' | 'Giáo viên' | 'Quản sinh'>('All');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isFilterDialogOpen, setIsFilterDialogOpen] = useState(false);
  const [isSearchExpanded, setIsSearchExpanded] = useState(false);
  const [editingTask, setEditingTask] = useState<Task | null>(null);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [taskToDelete, setTaskToDelete] = useState<Task | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalCount, setTotalCount] = useState(0);
  const itemsPerPage = 6; 
  const hasLoadedOnceRef = useRef(false);
  const fetchIdRef = useRef(0);
  const lastFetchedTimeRef = useRef(0);

  // Debounce search term
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(searchTerm);
      setCurrentPage(1);
    }, 300);
    return () => clearTimeout(timer);
  }, [searchTerm]);

  // Fetch tasks
  const fetchTasks = useCallback(async () => {
    const currentFetchId = ++fetchIdRef.current;
    if (!hasLoadedOnceRef.current) {
      setIsLoading(true);
    }
    setError(null);
    try {
      let statusQuery = 'all';
      if (activeTabFilter === 'Hoàn thành') statusQuery = 'completed';
      else if (activeTabFilter === 'Đang làm') statusQuery = 'in_progress';
      else if (activeTabFilter === 'Chưa bắt đầu') statusQuery = 'not_started';

      let priorityQuery = 'all';
      if (priorityFilter === 'High') priorityQuery = 'high';
      else if (priorityFilter === 'Medium') priorityQuery = 'medium';
      else if (priorityFilter === 'Low') priorityQuery = 'low';

      let targetTypeQuery = 'all';
      if (targetFilter === 'HSSV') targetTypeQuery = 'student';
      else if (targetFilter === 'Giáo viên') targetTypeQuery = 'teacher';
      else if (targetFilter === 'Quản sinh') targetTypeQuery = 'supervisor';

      const response = await studentTaskApi.getTasks({
        page: currentPage,
        limit: itemsPerPage,
        status: statusQuery,
        priority: priorityQuery,
        targetType: targetTypeQuery,
        search: debouncedSearch,
        sort: 'newest',
      });

      if (currentFetchId !== fetchIdRef.current) return;

      lastFetchedTimeRef.current = Date.now();
      hasLoadedOnceRef.current = true;

      const mappedItems = (response.items || []).map(mapBackendToClientTask);
      setTasks(mappedItems);
      if (response.summary) {
        setSummary(response.summary);
      }
      setTotalPages(response.totalPages || 1);
      setTotalCount(response.total || 0);
    } catch (err: any) {
      if (currentFetchId !== fetchIdRef.current) return;
      console.error(err);
      setError(err.message || 'Không thể tải danh sách nhiệm vụ.');
      toast.error(err.message || 'Lỗi kết nối máy chủ khi lấy danh sách nhiệm vụ.');
    } finally {
      if (currentFetchId === fetchIdRef.current) {
        setIsLoading(false);
      }
    }
  }, [activeTabFilter, priorityFilter, targetFilter, debouncedSearch, currentPage]);

  useEffect(() => {
    fetchTasks();
  }, [fetchTasks]);

  // Refetch when window gets focus
  useEffect(() => {
    const handleFocus = () => {
      if (Date.now() - lastFetchedTimeRef.current > 30000) {
        fetchTasks();
      }
    };
    window.addEventListener('focus', handleFocus);
    return () => {
      window.removeEventListener('focus', handleFocus);
    };
  }, [fetchTasks]);

  // Toggle task status quick action
  const handleQuickAction = async (task: Task, e: React.MouseEvent) => {
    e.stopPropagation();
    
    const isManager = isAdminOrSupervisor(user) || taskAccess.editTask;
    
    // Nếu có progress cá nhân và không phải manager
    if (!isManager && task.userProgress) {
      let nextStatus: Task['status'];
      if (task.userProgress.status === 'Chưa bắt đầu') nextStatus = 'Đang làm';
      else if (task.userProgress.status === 'Đang làm') nextStatus = 'Đã xong';
      else nextStatus = 'Chưa bắt đầu';

      let statusBackend = 'not_started';
      if (nextStatus === 'Đang làm') statusBackend = 'in_progress';
      else if (nextStatus === 'Đã xong') statusBackend = 'completed';

      try {
        await studentTaskApi.updateTaskProgressStatus(task.userProgress.id, statusBackend);
        toast.success(`Đã cập nhật trạng thái tiến độ cá nhân sang "${nextStatus}"`);
        fetchTasks();
      } catch (err: any) {
        console.error(err);
        toast.error(err.message || 'Không thể đổi trạng thái tiến độ cá nhân.');
      }
    } else {
      let nextStatus: Task['status'];
      if (task.status === 'Chưa bắt đầu') nextStatus = 'Đang làm';
      else if (task.status === 'Đang làm') nextStatus = 'Đã xong';
      else nextStatus = 'Chưa bắt đầu';

      let statusBackend = 'not_started';
      if (nextStatus === 'Đang làm') statusBackend = 'in_progress';
      else if (nextStatus === 'Đã xong') statusBackend = 'completed';

      try {
        await studentTaskApi.updateTaskStatus(task.id, statusBackend);
        toast.success(`Đã cập nhật trạng thái tổng hợp nhiệm vụ sang "${nextStatus}"`);
        fetchTasks();
      } catch (err: any) {
        console.error(err);
        toast.error(err.message || 'Không thể đổi trạng thái nhanh.');
      }
    }
  };

  // Click card to navigate to page
  const handleCardClick = async (task: Task) => {
    const mode = getLinkedTaskMode(task.linkedPage);
    if (mode === 'none') {
      return;
    }

    // Pre-navigation check for maintenance mode
    if (user && !isAdminUser(user)) {
      const moduleId = getModuleIdByPath(task.linkedPage);
      if (moduleId) {
        try {
          const states = await getMaintenanceStatesWithCache();
          if (states[moduleId] === true) {
            toast.error('Phân hệ này đang bảo trì. Vui lòng quay lại sau.');
            return;
          }
        } catch (err) {
          console.error('Failed to check maintenance state:', err);
        }
      }
    }
    
    try {
      await studentTaskApi.markTaskAccess(task.id, task.linkedPage);
    } catch (err: any) {
      toast.error(err.message || 'Bạn không có quyền truy cập nhiệm vụ này');
      return;
    }

    toast.info(`Đang chuyển hướng sang trang: ${getLinkedPageName(task.linkedPage)}`);
    const isManager = isAdminOrSupervisor(user) || taskAccess.editTask;
    
    const separator = task.linkedPage.includes('?') ? '&' : '?';
    if (mode === 'auto') {
      router.push(`${task.linkedPage}${separator}taskId=${task.id}`);
    } else {
      if (isManager) {
        router.push(task.linkedPage);
      } else {
        router.push(`${task.linkedPage}${separator}taskId=${task.id}`);
      }
    }
  };

  // Add or Edit save action
  const handleSaveTask = async (taskData: Omit<Task, 'id'> & { id?: string }) => {
    setIsSaving(true);
    try {
      const dto = mapClientToBackendDto(taskData);
      if (taskData.id) {
        await studentTaskApi.updateTask(taskData.id, dto as UpdateTaskDto);
        toast.success('Đã cập nhật nhiệm vụ thành công!');
      } else {
        await studentTaskApi.createTask(dto);
        toast.success('Đã tạo nhiệm vụ mới thành công!');
      }
      setIsModalOpen(false);
      setEditingTask(null);
      fetchTasks();
    } catch (err: any) {
      console.error(err);
      toast.error(err.message || 'Lưu nhiệm vụ thất bại.');
      throw err; // Ném lỗi để modal biết và không đóng form
    } finally {
      setIsSaving(false);
    }
  };

  const handleDeleteTask = async (id: string) => {
    try {
      await studentTaskApi.deleteTask(id);
      toast.success('Đã xóa nhiệm vụ thành công!');
      fetchTasks();
    } catch (err: any) {
      console.error(err);
      toast.error(err.message || 'Không thể xóa nhiệm vụ.');
    }
  };

  // Tính toán KPI lấy trực tiếp từ state summary cập nhật từ API
  const totalTasks = summary.totalTasks;
  const urgentTasks = summary.urgentTasks;
  const completedTasks = summary.completedTasks;

  const startItem = totalCount > 0 ? (currentPage - 1) * itemsPerPage + 1 : 0;
  const endItem = Math.min(currentPage * itemsPerPage, totalCount);





  const renderKPICards = (isMobile: boolean) => {
    if (!canManageTasks) return null;
    return (
      <div 
        className={`grid gap-3 shrink-0 ${
          isMobile 
            ? "grid-cols-1 md:grid-cols-3 mt-6 pt-4 border-t border-white/30 lg:hidden" 
            : "hidden lg:grid lg:grid-cols-3 order-2 lg:order-1"
        }`}
      >
        {/* KPI Card 1: Total */}
        <div className="bg-white/40 backdrop-blur-md border border-white/70 rounded-xl p-2.5 shadow-sm shadow-slate-300/40 hover:bg-white/60 hover:scale-[1.01] transition-all duration-150 ease-out flex items-center justify-between">
          <div className="space-y-0.5">
            <span className="text-[10px] font-bold text-[#64748B] tracking-wider uppercase">TỔNG NHIỆM VỤ</span>
            <div className="flex items-baseline gap-1.5">
              <span className="text-xl font-bold text-[#1E293B]">{totalTasks}</span>
              <span className="inline-flex items-center text-[9px] font-semibold text-[#1A73E8] bg-blue-50/70 border border-blue-100/60 px-1.5 py-0.5 rounded-xl">
                +3 tuần này
              </span>
            </div>
          </div>
          <div className="w-8 h-8 rounded-xl bg-blue-50 flex items-center justify-center text-[#1A73E8] shrink-0 border border-blue-100/30">
            <Clock size={16} />
          </div>
        </div>

        {/* KPI Card 2: Urgent */}
        <div className="bg-white/40 backdrop-blur-md border border-white/70 rounded-xl p-2.5 shadow-sm shadow-slate-300/40 hover:bg-white/60 hover:scale-[1.01] transition-all duration-150 ease-out flex items-center justify-between">
          <div className="space-y-0.5">
            <span className="text-[10px] font-bold text-[#64748B] tracking-wider uppercase">SẮP HẾT HẠN</span>
            <div className="flex items-baseline gap-1.5">
              <span className="text-xl font-bold text-red-600">
                {String(urgentTasks).padStart(2, '0')}
              </span>
              <span className="inline-flex items-center text-[9px] font-semibold text-red-600 bg-red-50/70 border border-red-100/60 px-1.5 py-0.5 rounded-xl">
                Cần xử lý ngay
              </span>
            </div>
          </div>
          <div className="w-8 h-8 rounded-xl bg-red-50 flex items-center justify-center text-red-600 shrink-0 border border-red-100/30">
            <AlertCircle size={16} />
          </div>
        </div>

        {/* KPI Card 3: Completed */}
        <div className="bg-white/40 backdrop-blur-md border border-white/70 rounded-xl p-2.5 shadow-sm shadow-slate-300/40 hover:bg-white/60 hover:scale-[1.01] transition-all duration-150 ease-out flex items-center justify-between">
          <div className="space-y-0.5">
            <span className="text-[10px] font-bold text-[#64748B] tracking-wider uppercase">HOÀN THÀNH</span>
            <div className="flex items-baseline gap-1.5">
              <span className="text-xl font-bold text-emerald-600">{completedTasks}</span>
              <span className="inline-flex items-center text-[9px] font-semibold text-emerald-600 bg-emerald-50/70 border border-emerald-100/60 px-1.5 py-0.5 rounded-xl">
                Hoàn thành
              </span>
            </div>
          </div>
          <div className="w-8 h-8 rounded-xl bg-emerald-50 flex items-center justify-center text-emerald-600 shrink-0 border border-emerald-100/30">
            <CheckCircle2 size={16} />
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="flex-1 flex flex-col gap-4 overflow-hidden min-h-0 bg-transparent">


      {/* KPI Cards Grid */}
      {renderKPICards(false)}

      {/* Filter and Grid Container */}
      <div className="flex-1 bg-white/40 backdrop-blur-md border border-white/70 rounded-2xl flex flex-col min-h-0 overflow-hidden shadow-sm shadow-slate-300/40 order-1 lg:order-2">
        
        <div className="p-4 border-b border-white/70 bg-white/20 flex flex-col lg:flex-row lg:items-center justify-between gap-3 shrink-0">
          {/* Lọc Trạng thái (Tab phẳng) */}
          <div className="hidden lg:flex items-center gap-1.5 bg-white/30 p-1 rounded-xl w-full lg:w-fit border border-white/70 backdrop-blur-sm shadow-sm shrink-0 overflow-x-auto scrollbar-none">
            {(['Mới nhất', 'Đang làm', 'Hoàn thành', 'Chưa bắt đầu'] as const).map((tab) => (
              <button
                key={tab}
                onClick={() => {
                  setActiveTabFilter(tab);
                  setCurrentPage(1);
                }}
                className={`px-3 py-1.5 text-xs font-semibold rounded-xl transition-all duration-150 ease-out hover:scale-[1.01] cursor-pointer flex-1 lg:flex-none text-center ${
                  activeTabFilter === tab 
                    ? 'bg-white text-[#1A73E8] shadow-sm' 
                    : 'text-[#64748B] hover:text-[#1E293B]'
                }`}
              >
                {tab === 'Mới nhất' ? 'Tất cả' : tab}
              </button>
            ))}
          </div>

          <div className="flex flex-wrap items-center gap-2 w-full lg:w-auto mt-2 lg:mt-0">
            {/* Lọc đối tượng áp dụng */}
            {canManageTasks && (
              <div className="hidden lg:block relative shrink-0 lg:w-36">
                <Select
                  value={targetFilter}
                  onValueChange={(val: any) => {
                    setTargetFilter(val);
                    setCurrentPage(1);
                  }}
                >
                  <SelectTrigger className="h-8 py-1.5 text-xs font-bold text-[#64748B] bg-white/50 border border-white/70 rounded-xl shadow-none focus:ring-2 focus:ring-[#1A73E8]/30">
                    <SelectValue placeholder="-- Đối tượng --" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="All">Tất cả</SelectItem>
                    <SelectItem value="HSSV">HSSV</SelectItem>
                    <SelectItem value="Giáo viên">Giáo viên</SelectItem>
                    <SelectItem value="Quản sinh">Quản sinh</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            )}

            {/* Lọc Mức Độ (Priority) */}
            <div className="hidden lg:block relative shrink-0 lg:w-36">
              <Select
                value={priorityFilter}
                onValueChange={(val: any) => {
                  setPriorityFilter(val);
                  setCurrentPage(1);
                }}
              >
                <SelectTrigger className="h-8 py-1.5 text-xs font-bold text-[#64748B] bg-white/50 border border-white/70 rounded-xl shadow-none focus:ring-2 focus:ring-[#1A73E8]/30">
                  <SelectValue placeholder="-- Độ ưu tiên --" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="All">Tất cả</SelectItem>
                  <SelectItem value="High">Cao</SelectItem>
                  <SelectItem value="Medium">Trung bình</SelectItem>
                  <SelectItem value="Low">Thấp</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Desktop-only Inline Search Bar */}
            <div className="hidden lg:relative lg:block">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input
                type="text"
                placeholder="Tìm kiếm nhiệm vụ..."
                value={searchTerm}
                onChange={(e) => {
                  setSearchTerm(e.target.value);
                }}
                className="pl-9 pr-4 py-2 text-xs rounded-xl border border-white/70 bg-white/50 focus:outline-none focus:ring-2 focus:ring-[#1A73E8]/30 focus:border-[#1A73E8] transition-all duration-150 w-56"
              />
            </div>

            {/* Desktop-only Add Task Button */}
            {canCreateTask && (
              <button
                onClick={() => {
                  setEditingTask(null);
                  setIsModalOpen(true);
                }}
                className="hidden lg:flex items-center justify-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-white bg-[#1A73E8] hover:bg-[#155cb4] active:scale-[0.99] rounded-xl transition-all duration-150 ease-out hover:scale-[1.01] shadow-sm shadow-blue-500/10 cursor-pointer h-8 shrink-0 w-auto"
              >
                <Plus size={14} />
                <span>Thêm nhiệm vụ mới</span>
              </button>
            )}

            {/* Mobile/Tablet Actions Row (Search, Filter, Add Task, Status Select) */}
            <div className="lg:hidden flex items-center gap-2 w-full">
              {isSearchExpanded ? (
                <div className="flex items-center gap-1.5 w-full">
                  <div className="relative flex-1">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                    <input
                      type="text"
                      placeholder="Tìm kiếm nhiệm vụ..."
                      value={searchTerm}
                      onChange={(e) => {
                        setSearchTerm(e.target.value);
                      }}
                      autoFocus
                      className="w-full pl-9 pr-4 py-2 text-xs rounded-xl border border-white/70 bg-white/50 focus:outline-none focus:ring-2 focus:ring-[#1A73E8]/30 focus:border-[#1A73E8] transition-all duration-150 h-8"
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
                  {/* Status Select Dropdown (Mobile only) */}
                  <div className="relative flex-1 min-w-[120px]">
                    <Select
                      value={activeTabFilter}
                      onValueChange={(val: any) => {
                        setActiveTabFilter(val);
                        setCurrentPage(1);
                      }}
                    >
                      <SelectTrigger className="h-8 py-1.5 text-xs font-bold text-[#1A73E8] bg-white border border-white/70 rounded-xl shadow-none focus:ring-2 focus:ring-[#1A73E8]/30">
                        <SelectValue placeholder="Trạng thái" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="Mới nhất">Tất cả</SelectItem>
                        <SelectItem value="Chưa bắt đầu">Chưa bắt đầu</SelectItem>
                        <SelectItem value="Đang làm">Đang làm</SelectItem>
                        <SelectItem value="Hoàn thành">Hoàn thành</SelectItem>
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

                    {/* Add Task Button (Icon only on mobile) */}
                    {canCreateTask && (
                      <button
                        onClick={() => {
                          setEditingTask(null);
                          setIsModalOpen(true);
                        }}
                        className="flex items-center justify-center bg-[#1A73E8] hover:bg-[#155cb4] active:scale-[0.99] rounded-xl h-8 w-10 text-white shrink-0 shadow-sm shadow-blue-500/10 cursor-pointer"
                        title="Thêm nhiệm vụ"
                      >
                        <Plus size={14} />
                      </button>
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Task Cards Grid */}
        <div className="flex-1 p-4 overflow-y-auto min-h-0 bg-white/10 flex flex-col">
          {isLoading && !hasLoadedOnceRef.current ? (
            <div className="flex-1 flex flex-col items-center justify-center p-6 bg-white/20 min-h-[300px]">
              <div className="w-10 h-10 border-4 border-blue-500/20 border-t-blue-500 rounded-full animate-spin mb-3"></div>
              <p className="text-sm font-semibold text-gray-500">Đang tải danh sách nhiệm vụ...</p>
            </div>
          ) : error ? (
            <div className="flex-1 flex flex-col items-center justify-center p-6 bg-white/20 min-h-[300px]">
              <AlertCircle size={32} className="text-red-500 mb-2" />
              <p className="text-sm font-semibold text-red-500">Đã xảy ra lỗi</p>
              <p className="text-xs text-gray-500 mt-1">{error}</p>
              <button
                onClick={fetchTasks}
                className="mt-3 px-4 py-1.5 text-xs font-semibold text-[#1A73E8] bg-blue-50 hover:bg-blue-100 rounded-lg border border-blue-100 transition-all cursor-pointer"
              >
                Thử lại
              </button>
            </div>
          ) : tasks.length > 0 ? (
            <div className={`grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 transition-opacity duration-200 ${isLoading ? 'opacity-60 pointer-events-none' : ''}`}>
              {tasks.map((task) => {
                const isCardManager = !isStudent && (isAdminOrSupervisor(user) || taskAccess.editTask);
                const displayStatus = (!isCardManager && task.userProgress) ? task.userProgress.status : task.status;
                const linkMode = getLinkedTaskMode(task.linkedPage);
                const isChecklist = linkMode === 'none';
                return (
                  <div
                    key={task.id}
                    onClick={() => handleCardClick(task)}
                    className={`bg-white/45 backdrop-blur-md border rounded-2xl p-5 shadow-sm transition-all duration-150 ease-out flex flex-col justify-between min-h-[230px] relative group border-white/70 ${
                      isChecklist
                        ? 'cursor-default'
                        : 'hover:shadow-md hover:scale-[1.01] hover:border-[#1A73E8]/50 cursor-pointer'
                    }`}
                  >
                    {/* Actions */}
                    <div className="absolute top-4 right-4 z-10" onClick={(e) => e.stopPropagation()}>
                      <Action
                        permissionEdit="UPDATE_STUDENT_TASK"
                        permissionDelete="DELETE_STUDENT_TASK"
                        onEdit={() => {
                          setEditingTask(task);
                          setIsModalOpen(true);
                        }}
                        onDelete={() => {
                          setTaskToDelete(task);
                          setIsDeleteModalOpen(true);
                        }}
                        hideView
                      />
                    </div>

                    {/* Top: Category Tag & Targets */}
                    <div>
                      <div className="flex items-center gap-2">
                        {/* Category Type */}
                        <span className={`inline-flex px-2.5 py-1 text-[10px] font-bold rounded-xl border ${
                          task.type === 'Dự án' ? 'text-blue-600 bg-blue-50 border-blue-100/60' :
                          task.type === 'Bài tập' ? 'text-amber-600 bg-amber-50 border-amber-100/60' :
                          'text-purple-600 bg-purple-50 border-purple-100/60'
                        }`}>
                          {task.type}
                        </span>
                      </div>

                      {/* Task Title */}
                      <h3 className="mt-3 text-sm font-bold text-[#1E293B] line-clamp-2 leading-5 group-hover:text-[#1A73E8] transition-colors">
                        {task.title}
                      </h3>
                      
                      {/* Subject/Description */}
                      <span className="mt-1 block text-[11px] text-[#64748B] font-medium truncate">
                        {task.subject}
                      </span>

                      {/* Target Audience Badge */}
                      <div className="mt-3 flex items-center gap-1.5 w-fit">
                        <span className="text-[10px] font-bold text-[#64748B]">Áp dụng:</span>
                        <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-xl text-[10px] font-bold border ${
                          task.targetType === 'HSSV' 
                            ? 'bg-blue-50 text-blue-600 border-blue-100/50' 
                            : task.targetType === 'Giáo viên' 
                            ? 'bg-purple-50 text-purple-600 border-purple-100/50' 
                            : 'bg-amber-50 text-amber-600 border-amber-100/50'
                        }`}>
                          {task.targetType === 'HSSV' ? <Users size={10} /> : task.targetType === 'Giáo viên' ? <UserCheck size={10} /> : <ShieldAlert size={10} />}
                          <span>
                            {task.targetType} ({task.targetScope === 'Cụ thể' ? task.targetDetail : 'Tất cả'})
                          </span>
                        </span>
                      </div>
                    </div>

                    {/* Bottom: Date, Priority & Actions */}
                    <div className="mt-4 pt-3 border-t border-white/40 flex items-end justify-between">
                      <div className="space-y-1.5">
                        {/* Deadline */}
                        <div className="flex items-center gap-1.5 text-[11px] text-[#64748B] font-medium">
                          <Calendar size={13} className="text-gray-400" />
                          <span>Hạn: {task.deadline}</span>
                        </div>
                        
                        {/* Priority Tag */}
                        <div className="flex items-center gap-1.5">
                          <span className="text-[10px] font-bold text-[#64748B]">Độ ưu tiên:</span>
                          <span className={`inline-flex px-1.5 py-0.5 text-[9px] font-bold rounded-xl ${
                            task.priority === 'High' ? 'text-red-600 bg-red-50 border border-red-100/50' :
                            task.priority === 'Medium' ? 'text-amber-600 bg-amber-50 border border-amber-100/50' :
                            'text-emerald-600 bg-emerald-50 border border-emerald-100/50'
                          }`}>
                            {task.priority === 'High' ? 'Cao' : task.priority === 'Medium' ? 'Trung bình' : 'Thấp'}
                          </span>
                        </div>
                      </div>

                      {/* Status Circle & Actions */}
                      <div className="flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
                        {/* Status indicator */}
                        <div className="flex items-center gap-1">
                          <span className={`w-1.5 h-1.5 rounded-full ${
                            displayStatus === 'Đã xong' ? 'bg-emerald-500' :
                            displayStatus === 'Đang làm' ? 'bg-blue-500' :
                            'bg-gray-400'
                          }`} />
                          <span className="text-[11px] font-bold text-[#1E293B]">
                            {displayStatus}
                          </span>
                        </div>

                        {/* Link to page button */}
                        {linkMode !== 'none' && (
                          <button
                            onClick={async () => {
                              const isManager = isAdminOrSupervisor(user) || taskAccess.editTask;

                              // Pre-navigation check for maintenance mode
                              if (user && !isAdminUser(user)) {
                                const moduleId = getModuleIdByPath(task.linkedPage);
                                if (moduleId) {
                                  try {
                                    const states = await getMaintenanceStatesWithCache();
                                    if (states[moduleId] === true) {
                                      toast.error('Phân hệ này đang bảo trì. Vui lòng quay lại sau.');
                                      return;
                                    }
                                  } catch (err) {
                                    console.error('Failed to check maintenance state:', err);
                                  }
                                }
                              }

                              toast.info(`Đang chuyển hướng sang trang: ${getLinkedPageName(task.linkedPage)}`);
                              if (isManager) {
                                router.push(task.linkedPage);
                              } else {
                                const separator = task.linkedPage.includes('?') ? '&' : '?';
                                router.push(`${task.linkedPage}${separator}taskId=${task.id}`);
                              }
                            }}
                            className="w-7 h-7 rounded-xl flex items-center justify-center border border-white/70 text-[#64748B] bg-white/50 hover:border-[#1A73E8] hover:text-[#1A73E8] transition-all duration-150 hover:scale-[1.01]"
                            title="Chuyển hướng đến trang liên kết"
                          >
                            <ExternalLink size={12} />
                          </button>
                        )}

                        {/* Quick change status button */}
                        {(() => {
                          const showQuickAction = linkMode === 'none' || linkMode === 'manual' || isCardManager;
                          
                          let quickActionTitle = 'Đổi trạng thái nhanh';
                          if (linkMode === 'auto') {
                            if (isCardManager) {
                              quickActionTitle = 'Cập nhật thủ công (Quyền quản trị)';
                            } else {
                              quickActionTitle = 'Cập nhật thủ công';
                            }
                          }

                          if (!showQuickAction) return null;

                          return (
                            <button
                              onClick={(e) => handleQuickAction(task, e)}
                              className={`w-7 h-7 rounded-xl flex items-center justify-center border transition-all duration-150 hover:scale-[1.01] ${
                                displayStatus === 'Đã xong'
                                  ? 'bg-emerald-50/70 border-emerald-200 text-emerald-600 hover:bg-emerald-100/90'
                                  : displayStatus === 'Đang làm'
                                  ? 'bg-blue-50/70 border-blue-200 text-[#1A73E8] hover:bg-blue-100/90'
                                  : 'bg-white/50 border-white/70 text-[#64748B] hover:border-slate-300 hover:text-[#1E293B]'
                              }`}
                              title={quickActionTitle}
                            >
                              {displayStatus === 'Đã xong' ? <Check size={14} strokeWidth={2.5} /> : <Play size={12} strokeWidth={2.5} className={displayStatus === 'Đang làm' ? '' : 'translate-x-0.5'} />}
                            </button>
                          );
                        })()}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className={`h-64 border border-dashed border-gray-200 rounded-2xl flex flex-col items-center justify-center text-center p-6 bg-white/20 transition-opacity duration-200 ${isLoading ? 'opacity-60 pointer-events-none' : ''}`}>
              <AlertCircle size={32} className="text-gray-300 mb-2" />
              <p className="text-sm font-semibold text-gray-500">Không tìm thấy nhiệm vụ nào.</p>
              <p className="text-xs text-gray-400 mt-1">Hãy tạo nhiệm vụ mới hoặc thay đổi các bộ lọc.</p>
            </div>
          )}

          {renderKPICards(true)}
        </div>

        {/* Footer (Pagination) */}
        <div className="hidden lg:block">
          <CustomPagination
            currentPage={currentPage}
            pageSize={itemsPerPage}
            totalItems={totalCount}
            onPageChange={setCurrentPage}
            label="nhiệm vụ"
          />
        </div>

      </div>

      {/* Add/Edit Modal */}
      <AddTaskModal
        isOpen={isModalOpen}
        onClose={() => {
          setIsModalOpen(false);
          setEditingTask(null);
        }}
        onSave={handleSaveTask}
        editingTask={editingTask}
        isSaving={isSaving}
      />

      {/* Confirm Delete Modal */}
      <ConfirmModal
        isOpen={isDeleteModalOpen}
        onClose={() => {
          setIsDeleteModalOpen(false);
          setTaskToDelete(null);
        }}
        onConfirm={() => {
          if (taskToDelete) {
            handleDeleteTask(taskToDelete.id);
          }
        }}
        title="Xác nhận xóa nhiệm vụ"
        message={`Bạn có chắc chắn muốn xóa nhiệm vụ "${taskToDelete?.title || ''}"? Hành động này sẽ không thể hoàn tác.`}
        confirmLabel="Xóa nhiệm vụ"
        cancelLabel="Hủy"
        variant="danger"
      />

      {/* Filter Dialog (Mobile/Tablet Only) */}
      <Dialog open={isFilterDialogOpen} onOpenChange={setIsFilterDialogOpen}>
        <DialogContent className="max-w-[340px] rounded-2xl bg-white/90 backdrop-blur-lg border border-white/70 p-5 z-[100]">
          <DialogHeader className="mb-2 text-left">
            <DialogTitle className="text-base font-bold text-[#1E293B]">Bộ lọc nhiệm vụ</DialogTitle>
          </DialogHeader>
          
          <div className="space-y-4 my-2">
            {/* Lọc đối tượng áp dụng */}
            {canManageTasks && (
              <div className="space-y-1.5">
                <label className="text-[11px] font-bold text-[#64748B] uppercase tracking-wider">Đối tượng</label>
                <Select
                  value={targetFilter}
                  onValueChange={(val: any) => {
                    setTargetFilter(val);
                    setCurrentPage(1);
                  }}
                >
                  <SelectTrigger className="w-full h-9 py-1.5 text-xs font-bold text-[#64748B] bg-white/60 border border-white/80 rounded-xl focus:ring-2 focus:ring-[#1A73E8]/30">
                    <SelectValue placeholder="-- Đối tượng --" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="All">Tất cả</SelectItem>
                    <SelectItem value="HSSV">HSSV</SelectItem>
                    <SelectItem value="Giáo viên">Giáo viên</SelectItem>
                    <SelectItem value="Quản sinh">Quản sinh</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            )}

            {/* Lọc Mức Độ (Priority) */}
            <div className="space-y-1.5">
              <label className="text-[11px] font-bold text-[#64748B] uppercase tracking-wider">Độ ưu tiên</label>
              <Select
                value={priorityFilter}
                onValueChange={(val: any) => {
                  setPriorityFilter(val);
                  setCurrentPage(1);
                }}
              >
                <SelectTrigger className="w-full h-9 py-1.5 text-xs font-bold text-[#64748B] bg-white/60 border border-white/80 rounded-xl focus:ring-2 focus:ring-[#1A73E8]/30">
                  <SelectValue placeholder="-- Độ ưu tiên --" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="All">Tất cả</SelectItem>
                  <SelectItem value="High">Cao</SelectItem>
                  <SelectItem value="Medium">Trung bình</SelectItem>
                  <SelectItem value="Low">Thấp</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          
          <div className="mt-5 flex justify-end gap-2.5">
            <button
              onClick={() => {
                setTargetFilter('All');
                setPriorityFilter('All');
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
};

export default StudentTasksTab;
