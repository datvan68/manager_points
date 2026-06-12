'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { 
  Search, Users, CheckCircle2, Clock, 
  ChevronLeft, ChevronRight, AlertCircle, Play, Check, ExternalLink,
  Calendar as CalendarIcon, LayoutGrid, List
} from 'lucide-react';
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/components/ui/select';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { studentTaskApi, StudentTaskProgress } from '@/api/task-api';
import { classApi } from '@/api/class-api';
import { toast } from 'sonner';
import { useAuth } from '@/providers/auth-provider';
import { usePermission } from '@/components/guards/RouteGuard';

export default function StudentTaskProgressTab() {
  const [items, setItems] = useState<StudentTaskProgress[]>([]);
  const [summary, setSummary] = useState({
    totalAssignees: 0,
    notStarted: 0,
    inProgress: 0,
    completed: 0,
    completionRate: 0,
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

  const fetchOverview = useCallback(async () => {
    const currentFetchId = ++fetchIdRef.current;
    if (!hasLoadedOnceRef.current) {
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
  const userRole = String(user?.role || '').toLowerCase();
  const isStudent = userRole.includes('student') || userRole.includes('học sinh') || userRole.includes('sinh viên');
  const taskAccess = usePermission({ updateTask: "UPDATE_STUDENT_TASK" });
  const hasManagePermission = userRole.includes('admin') || userRole.includes('supervisor') || userRole.includes('quản sinh') || taskAccess.updateTask;

  const startItem = totalCount > 0 ? (currentPage - 1) * itemsPerPage + 1 : 0;
  const endItem = Math.min(currentPage * itemsPerPage, totalCount);

  return (
    <div className="flex-1 flex flex-col gap-4 overflow-hidden min-h-0 bg-transparent">
      {/* KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 shrink-0">
        <div className="bg-white/45 backdrop-blur-md border border-white/80 rounded-xl p-2.5 flex flex-col justify-center shadow-sm shadow-slate-300/10">
          <span className="text-[10px] font-bold text-[#64748B] uppercase">Tổng người được giao</span>
          <span className="text-xl font-bold text-[#1E293B] mt-0.5">{summary.totalAssignees}</span>
        </div>
        <div className="bg-white/45 backdrop-blur-md border border-white/80 rounded-xl p-2.5 flex flex-col justify-center shadow-sm shadow-slate-300/10">
          <span className="text-[10px] font-bold text-[#64748B] uppercase">Chưa hoàn thành</span>
          <span className="text-xl font-bold text-gray-500 mt-0.5">{summary.notStarted}</span>
        </div>
        <div className="bg-white/45 backdrop-blur-md border border-white/80 rounded-xl p-2.5 flex flex-col justify-center shadow-sm shadow-slate-300/10">
          <span className="text-[10px] font-bold text-[#64748B] uppercase">Đang thực hiện</span>
          <span className="text-xl font-bold text-blue-600 mt-0.5">{summary.inProgress}</span>
        </div>
        <div className="bg-white/45 backdrop-blur-md border border-white/80 rounded-xl p-2.5 flex flex-col justify-center relative overflow-hidden shadow-sm shadow-slate-300/10">
          <span className="text-[10px] font-bold text-[#64748B] uppercase z-10">Đã hoàn thành</span>
          <div className="flex items-baseline gap-1.5 z-10 mt-0.5">
            <span className="text-xl font-bold text-emerald-600">{summary.completed}</span>
            <span className="text-[10px] font-bold text-emerald-600 bg-emerald-50 px-1.5 py-0.5 rounded border border-emerald-100">
              {summary.completionRate}%
            </span>
          </div>
          <div 
            className="absolute bottom-0 left-0 h-1 bg-emerald-500 transition-all" 
            style={{ width: `${summary.completionRate}%` }} 
          />
        </div>
      </div>

      <div className="flex-1 bg-white/40 backdrop-blur-md border border-white/80 rounded-2xl flex flex-col min-h-0 overflow-hidden">
        {/* Filters */}
        <div className="p-4 border-b border-white/80 flex flex-wrap gap-3 items-center">
          {/* Trạng thái */}
          <div className="relative shrink-0 w-36">
            <Select
              value={statusFilter}
              onValueChange={(val: any) => {
                setStatusFilter(val);
                setCurrentPage(1);
              }}
            >
              <SelectTrigger className="h-8 py-1.5 text-xs font-bold text-[#64748B] bg-white border border-gray-200 rounded-xl shadow-none">
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
          <div className="relative shrink-0 w-36">
            <Select
              value={assigneeTypeFilter}
              onValueChange={(val: any) => {
                setAssigneeTypeFilter(val);
                setCurrentPage(1);
              }}
            >
              <SelectTrigger className="h-8 py-1.5 text-xs font-bold text-[#64748B] bg-white border border-gray-200 rounded-xl shadow-none">
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
          <div className="relative shrink-0 w-36">
            <Select
              value={classIdFilter || 'all'}
              onValueChange={(val: any) => {
                setClassIdFilter(val === 'all' ? '' : val);
                setCurrentPage(1);
              }}
            >
              <SelectTrigger className="h-8 py-1.5 text-xs font-bold text-[#64748B] bg-white border border-gray-200 rounded-xl shadow-none">
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
          <div className="relative shrink-0 w-44">
            <Select
              value={taskIdFilter || 'all'}
              onValueChange={(val: any) => {
                setTaskIdFilter(val === 'all' ? '' : val);
                setCurrentPage(1);
              }}
            >
              <SelectTrigger className="h-8 py-1.5 text-xs font-bold text-[#64748B] bg-white border border-gray-200 rounded-xl shadow-none">
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
          <div className="flex items-center gap-2 flex-1 min-w-[280px]">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input
                type="text"
                placeholder="Tìm theo tên người thực hiện hoặc tên nhiệm vụ..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-9 pr-4 h-8 text-xs rounded-xl border border-gray-200 bg-white focus:outline-none focus:ring-2 focus:ring-[#1A73E8]/30"
              />
            </div>
            
            {/* View Mode Switcher */}
            <div className="flex items-center gap-1 bg-slate-100 p-0.5 rounded-xl border border-slate-200/50 shrink-0">
              <button
                type="button"
                onClick={() => setViewMode('table')}
                className={`p-1.5 rounded-lg transition-all cursor-pointer ${
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
                className={`p-1.5 rounded-lg transition-all cursor-pointer ${
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
                <thead className="text-xs uppercase bg-slate-50 text-slate-500 sticky top-0">
                  <tr className="whitespace-nowrap">
                    <th className="px-4 py-3 rounded-tl-xl">Người thực hiện</th>
                    <th className="px-4 py-3">Vai trò</th>
                    <th className="px-4 py-3">Lớp</th>
                    <th className="px-4 py-3">Nhiệm vụ</th>
                    <th className="px-4 py-3">Loại</th>
                    <th className="px-4 py-3">Hạn chót</th>
                    <th className="px-4 py-3">Nguồn</th>
                    <th className="px-4 py-3">Người cập nhật</th>
                    <th className="px-4 py-3">Cập nhật lúc</th>
                    <th className="px-4 py-3 text-center">Trạng thái</th>
                    <th className="px-4 py-3 rounded-tr-xl text-center">Hành động</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {items.map((item) => (
                    <tr key={item.id} className="hover:bg-slate-50/50 bg-white">
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
                          <span className="inline-flex items-center text-blue-600 bg-blue-50/70 border border-blue-100/60 px-1.5 py-0.5 rounded-lg font-semibold">
                            Tự động
                          </span>
                        ) : item.statusSource === 'system' ? (
                          <span className="inline-flex items-center text-purple-600 bg-purple-50/70 border border-purple-100/60 px-1.5 py-0.5 rounded-lg font-semibold">
                            Hệ thống
                          </span>
                        ) : (
                          <span className="inline-flex items-center text-slate-600 bg-slate-50/70 border border-slate-100/60 px-1.5 py-0.5 rounded-lg font-semibold">
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
                        <span className={`inline-flex px-2 py-1 text-[10px] font-bold rounded-lg border ${
                          item.status === 'completed' ? 'bg-emerald-50 text-emerald-600 border-emerald-200' :
                          item.status === 'in_progress' ? 'bg-blue-50 text-blue-600 border-blue-200' :
                          'bg-gray-50 text-gray-600 border-gray-200'
                        }`}>
                          {item.status === 'completed' ? 'Đã hoàn thành' : item.status === 'in_progress' ? 'Đang thực hiện' : 'Chưa hoàn thành'}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-center whitespace-nowrap">
                        {(hasManagePermission || user?.id === item.assigneeUserId) ? (
                          <button
                            onClick={() => handleUpdateStatus(item.id, item.status)}
                            title="Chuyển trạng thái"
                            className="p-1.5 rounded-lg border bg-white hover:bg-slate-50 transition-colors"
                          >
                            {item.status === 'completed' ? <Check size={14} className="text-emerald-500" /> : <Play size={14} className="text-blue-500" />}
                          </button>
                        ) : (
                          <span className="text-slate-300">-</span>
                        )}
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
                  className="bg-white/70 backdrop-blur-sm border border-slate-200/50 rounded-2xl p-4.5 shadow-sm hover:shadow-md hover:border-blue-400/50 transition-all flex flex-col justify-between min-h-[240px] group"
                >
                  {/* Card Header: Category & Status */}
                  <div className="flex items-center justify-between gap-2">
                    <span className={`inline-flex px-2 py-0.5 text-[9px] font-bold rounded-lg border uppercase ${
                      item.taskType === 'project' ? 'text-blue-600 bg-blue-50 border-blue-100/60' :
                      item.taskType === 'assignment' ? 'text-amber-600 bg-amber-50 border-amber-100/60' :
                      'text-purple-600 bg-purple-50 border-purple-100/60'
                    }`}>
                      {item.taskType === 'project' ? 'Dự án' : item.taskType === 'assignment' ? 'Bài tập' : 'Hoạt động'}
                    </span>
                    <span className={`inline-flex px-2 py-0.5 text-[9px] font-bold rounded-lg border ${
                      item.status === 'completed' ? 'bg-emerald-50 text-emerald-600 border-emerald-200' :
                      item.status === 'in_progress' ? 'bg-blue-50 text-blue-600 border-blue-200' :
                      'bg-gray-50 text-gray-600 border-gray-200'
                    }`}>
                      {item.status === 'completed' ? 'Đã xong' : item.status === 'in_progress' ? 'Đang làm' : 'Chưa xong'}
                    </span>
                  </div>

                  {/* Card Body: Task details & Assignee */}
                  <div className="mt-3 flex-1 flex flex-col justify-between">
                    <div>
                      <h4 className="text-sm font-bold text-slate-800 line-clamp-2 leading-5 group-hover:text-[#1A73E8] transition-colors" title={item.taskTitle}>
                        {item.taskTitle}
                      </h4>
                      {item.subject && (
                        <p className="text-[11px] text-slate-400 mt-1 line-clamp-1 font-medium" title={item.subject}>
                          {item.subject}
                        </p>
                      )}
                    </div>

                    <div className="mt-3 pt-3 border-t border-slate-100/60 flex flex-col gap-1.5">
                      <div className="flex items-center justify-between text-[11px]">
                        <span className="text-slate-400 font-medium">Người thực hiện:</span>
                        <span className="font-bold text-slate-700 max-w-[140px] truncate" title={item.assigneeName || '-'}>
                          {item.assigneeName || '-'}
                        </span>
                      </div>
                      <div className="flex items-center justify-between text-[11px]">
                        <span className="text-slate-400 font-medium">Vai trò / Lớp:</span>
                        <span className="text-slate-600 font-semibold truncate max-w-[140px]" title={`${item.assigneeType === 'student' ? 'HSSV' : item.assigneeType === 'teacher' ? 'Giáo viên' : 'Quản sinh'} ${item.className ? `• ${item.className}` : ''}`}>
                          {item.assigneeType === 'student' ? 'HSSV' : item.assigneeType === 'teacher' ? 'Giáo viên' : 'Quản sinh'} 
                          {item.className && ` • ${item.className}`}
                        </span>
                      </div>
                      <div className="flex items-center justify-between text-[11px]">
                        <span className="text-slate-400 font-medium">Hạn chót:</span>
                        <div className="flex items-center gap-1 text-slate-600 font-semibold">
                          <CalendarIcon size={11} className="text-slate-400" />
                          <span>{item.deadline ? new Date(item.deadline).toLocaleDateString('vi-VN') : '-'}</span>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Card Footer: Metadata & Actions */}
                  <div className="mt-4 pt-3 border-t border-slate-100/60 flex items-center justify-between gap-2">
                    <div className="text-[9px] text-slate-400 font-medium space-y-0.5">
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
                          className="w-7 h-7 rounded-xl border border-slate-200 text-slate-500 bg-white hover:border-[#1A73E8] hover:text-[#1A73E8] flex items-center justify-center transition-all"
                          title="Mở liên kết nhiệm vụ"
                        >
                          <ExternalLink size={12} />
                        </a>
                      )}
                      {(hasManagePermission || user?.id === item.assigneeUserId) && (
                        <button
                          onClick={() => handleUpdateStatus(item.id, item.status)}
                          className={`w-7 h-7 rounded-xl flex items-center justify-center border transition-all duration-150 cursor-pointer ${
                            item.status === 'completed'
                              ? 'bg-emerald-50 border-emerald-200 text-emerald-600 hover:bg-emerald-100'
                              : item.status === 'in_progress'
                              ? 'bg-blue-50 border-blue-200 text-[#1A73E8] hover:bg-blue-100'
                              : 'bg-white border-slate-200 text-slate-400 hover:border-slate-300 hover:text-slate-600'
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
        </div>

        {/* Pagination */}
        {totalCount > 0 && (
          <div className="px-5 py-3 border-t border-white/80 bg-white/20 flex items-center justify-between shrink-0">
            <span className="text-xs font-semibold text-[#64748B]">
              Hiển thị {startItem}-{endItem} trên tổng số {totalCount} bản ghi
            </span>

            <div className="flex items-center gap-1.5">
              <button
                onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                disabled={currentPage === 1}
                className="w-7 h-7 flex items-center justify-center rounded-xl border border-gray-200 bg-white text-gray-500 hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors cursor-pointer"
              >
                <ChevronLeft size={14} />
              </button>
              
              {Array.from({ length: totalPages }).map((_, idx) => (
                <button
                  key={idx}
                  onClick={() => setCurrentPage(idx + 1)}
                  className={`w-7 h-7 flex items-center justify-center rounded-xl text-xs font-bold transition-all cursor-pointer ${
                    currentPage === idx + 1
                      ? 'bg-[#1A73E8] text-white shadow-sm shadow-blue-500/15'
                      : 'border border-gray-200 bg-white text-[#64748B] hover:bg-slate-50'
                  }`}
                >
                  {idx + 1}
                </button>
              ))}

              <button
                onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
                disabled={currentPage === totalPages}
                className="w-7 h-7 flex items-center justify-center rounded-xl border border-gray-200 bg-white text-gray-500 hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors cursor-pointer"
              >
                <ChevronRight size={14} />
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
