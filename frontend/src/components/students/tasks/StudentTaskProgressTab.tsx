'use client';

import React, { useState, useEffect } from 'react';
import { 
  Search, Users, CheckCircle2, Clock, 
  ChevronLeft, ChevronRight, AlertCircle, Play, Check, ExternalLink,
  Calendar as CalendarIcon
} from 'lucide-react';
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/components/ui/select';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { CustomCalendar } from '@/components/calendar/CustomCalendar';
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
  const [deadlineFrom, setDeadlineFrom] = useState('');
  const [deadlineTo, setDeadlineTo] = useState('');
  
  // New filters data source & state
  const [tasksList, setTasksList] = useState<any[]>([]);
  const [classesList, setClassesList] = useState<any[]>([]);
  const [taskIdFilter, setTaskIdFilter] = useState<string>('');
  const [classIdFilter, setClassIdFilter] = useState<string>('');
  const [sortFilter, setSortFilter] = useState<string>('newest');

  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalCount, setTotalCount] = useState(0);
  const itemsPerPage = 10;

  const [isCalendarOpen, setIsCalendarOpen] = useState(false);

  const formatDateToString = (date: Date) => {
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, '0');
    const d = String(date.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  };

  const formatDateToDisplay = (dateStr: string) => {
    if (!dateStr) return '';
    const date = new Date(dateStr);
    const d = String(date.getDate()).padStart(2, '0');
    const m = String(date.getMonth() + 1).padStart(2, '0');
    const y = date.getFullYear();
    return `${d}/${m}/${y}`;
  };

  // Load tasks and classes for filters
  useEffect(() => {
    const loadFiltersData = async () => {
      try {
        const classes = await classApi.getClasses();
        setClassesList(classes);
      } catch (err) {
        console.error('Lỗi load classes list:', err);
      }

      try {
        const tasksRes = await studentTaskApi.getTasks({ page: 1, limit: 100 });
        setTasksList(tasksRes.items || []);
      } catch (err) {
        console.error('Lỗi load tasks list:', err);
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

  const fetchOverview = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const res = await studentTaskApi.getTaskProgressOverview({
        page: currentPage,
        limit: itemsPerPage,
        status: statusFilter,
        assigneeType: assigneeTypeFilter,
        search: debouncedSearch,
        deadlineFrom: deadlineFrom || undefined,
        deadlineTo: deadlineTo || undefined,
        taskId: taskIdFilter || undefined,
        classId: classIdFilter || undefined,
        sort: sortFilter || undefined,
      });
      setItems(res.items);
      setSummary(res.summary);
      setTotalPages(res.totalPages);
      setTotalCount(res.total);
    } catch (err: any) {
      console.error(err);
      setError(err.message || 'Không thể tải dữ liệu tiến độ.');
      toast.error('Lỗi khi lấy danh sách tiến độ.');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchOverview();
  }, [currentPage, statusFilter, assigneeTypeFilter, debouncedSearch, deadlineFrom, deadlineTo, taskIdFilter, classIdFilter, sortFilter]);

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
                <SelectValue placeholder="Trạng thái: Tất cả" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Trạng thái: Tất cả</SelectItem>
                <SelectItem value="not_started">Trạng thái: Chưa xong</SelectItem>
                <SelectItem value="in_progress">Trạng thái: Đang làm</SelectItem>
                <SelectItem value="completed">Trạng thái: Đã xong</SelectItem>
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
                <SelectValue placeholder="Đối tượng: Tất cả" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Đối tượng: Tất cả</SelectItem>
                <SelectItem value="student">Đối tượng: HSSV</SelectItem>
                <SelectItem value="teacher">Đối tượng: Giáo viên</SelectItem>
                <SelectItem value="supervisor">Đối tượng: Quản sinh</SelectItem>
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
                <SelectValue placeholder="Lớp: Tất cả" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Lớp: Tất cả</SelectItem>
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
                <SelectValue placeholder="Nhiệm vụ: Tất cả" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Nhiệm vụ: Tất cả</SelectItem>
                {tasksList.map(task => (
                  <SelectItem key={task.id} value={task.id}>{task.title}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Sắp xếp */}
          <div className="relative shrink-0 w-36">
            <Select
              value={sortFilter}
              onValueChange={(val: any) => {
                setSortFilter(val);
                setCurrentPage(1);
              }}
            >
              <SelectTrigger className="h-8 py-1.5 text-xs font-bold text-[#64748B] bg-white border border-gray-200 rounded-xl shadow-none">
                <SelectValue placeholder="Sắp xếp: Mới nhất" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="newest">Sắp xếp: Mới nhất</SelectItem>
                <SelectItem value="deadline_asc">Hạn chót: Tăng dần</SelectItem>
                <SelectItem value="deadline_desc">Hạn chót: Giảm dần</SelectItem>
                <SelectItem value="status">Sắp xếp: Trạng thái</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Hạn chót (CustomCalendar) */}
          <div className="relative shrink-0">
            <Popover open={isCalendarOpen} onOpenChange={setIsCalendarOpen}>
              <PopoverTrigger asChild>
                <button
                  type="button"
                  className="flex items-center gap-1.5 h-8 px-3 py-1.5 text-xs font-bold text-[#64748B] bg-white border border-gray-200 rounded-xl hover:bg-slate-50 transition-all cursor-pointer"
                >
                  <CalendarIcon className="w-3.5 h-3.5 text-gray-400" />
                  <span>
                    {deadlineFrom || deadlineTo
                      ? `${deadlineFrom ? formatDateToDisplay(deadlineFrom) : '...'} - ${deadlineTo ? formatDateToDisplay(deadlineTo) : '...'}`
                      : 'Hạn chót: Tất cả'}
                  </span>
                </button>
              </PopoverTrigger>
              <PopoverContent
                className="w-auto p-0 z-50 bg-transparent border-none shadow-none"
                align="start"
                side="bottom"
                sideOffset={6}
              >
                <CustomCalendar
                  startDate={deadlineFrom ? new Date(deadlineFrom) : null}
                  endDate={deadlineTo ? new Date(deadlineTo) : null}
                  onRangeSelect={(start, end) => {
                    setDeadlineFrom(formatDateToString(start));
                    setDeadlineTo(formatDateToString(end));
                  }}
                  onCancel={() => {
                    setDeadlineFrom('');
                    setDeadlineTo('');
                    setIsCalendarOpen(false);
                  }}
                  onConfirm={() => setIsCalendarOpen(false)}
                />
              </PopoverContent>
            </Popover>
          </div>

          {/* Ô Tìm kiếm */}
          <div className="relative flex-1 min-w-[200px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="text"
              placeholder="Tìm theo tên người thực hiện hoặc tên nhiệm vụ..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-9 pr-4 h-8 text-xs rounded-xl border border-gray-200 bg-white focus:outline-none focus:ring-2 focus:ring-[#1A73E8]/30"
            />
          </div>
        </div>

        {/* Table */}
        <div className="flex-1 overflow-auto p-4">
          {isLoading ? (
            <div className="flex justify-center py-10"><div className="w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full animate-spin" /></div>
          ) : error ? (
            <div className="text-center text-red-500 py-10">{error}</div>
          ) : items.length === 0 ? (
            <div className="text-center text-gray-500 py-10">Không có dữ liệu tiến độ.</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm text-gray-600">
                <thead className="text-xs uppercase bg-slate-50 text-slate-500 sticky top-0">
                  <tr>
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
                      <td className="px-4 py-3">
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
                      <td className="px-4 py-3 text-xs capitalize text-slate-500">
                        {item.taskType === 'project' ? 'Dự án' : item.taskType === 'assignment' ? 'Bài tập' : 'Hoạt động'}
                      </td>
                      <td className="px-4 py-3">
                        {item.deadline ? new Date(item.deadline).toLocaleDateString('vi-VN') : '-'}
                      </td>
                      <td className="px-4 py-3 text-xs">
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
                      <td className="px-4 py-3 max-w-[120px] truncate" title={item.updatedBy?.name || '-'}>
                        {item.updatedBy?.name || '-'}
                      </td>
                      <td className="px-4 py-3">
                        {item.updatedAt ? new Date(item.updatedAt).toLocaleString('vi-VN') : '-'}
                      </td>
                      <td className="px-4 py-3 text-center">
                        <span className={`inline-flex px-2 py-1 text-[10px] font-bold rounded-lg border ${
                          item.status === 'completed' ? 'bg-emerald-50 text-emerald-600 border-emerald-200' :
                          item.status === 'in_progress' ? 'bg-blue-50 text-blue-600 border-blue-200' :
                          'bg-gray-50 text-gray-600 border-gray-200'
                        }`}>
                          {item.status === 'completed' ? 'Đã hoàn thành' : item.status === 'in_progress' ? 'Đang thực hiện' : 'Chưa hoàn thành'}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-center">
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
          )}
        </div>

        {/* Pagination */}
        {totalCount > 0 && (
          <div className="p-4 border-t border-white/80 flex items-center justify-between shrink-0">
            <span className="text-xs text-slate-500">
              Tổng số {totalCount} bản ghi
            </span>
            <div className="flex gap-1">
              <button
                onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                disabled={currentPage === 1}
                className="w-8 h-8 flex items-center justify-center rounded-lg border bg-white text-slate-500 hover:bg-slate-50 disabled:opacity-50"
              >
                <ChevronLeft size={16} />
              </button>
              <button
                onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                disabled={currentPage === totalPages}
                className="w-8 h-8 flex items-center justify-center rounded-lg border bg-white text-slate-500 hover:bg-slate-50 disabled:opacity-50"
              >
                <ChevronRight size={16} />
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
