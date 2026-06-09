'use client';

import React, { useState, useEffect } from 'react';
import { 
  Search, Plus, Filter, Play, Check, AlertCircle, 
  Calendar, ChevronLeft, ChevronRight, 
  CheckCircle2, Clock, ExternalLink, Users, UserCheck, ShieldAlert
} from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/providers/auth-provider';
import AddTaskModal from './AddTaskModal';
import Action from '@/components/ui/Action';
import { usePermission } from '@/components/guards/RouteGuard';
import { toast } from 'sonner';
import { addNotification } from '@/lib/notifications';

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
}

const INITIAL_TASKS: Task[] = [
  {
    id: 't-1',
    title: 'Thiết kế UI cho Mobile App',
    type: 'Dự án',
    subject: 'Môn: Thiết kế trải nghiệm người dùng',
    deadline: '25/10/2026',
    priority: 'High',
    status: 'Đang làm',
    linkedPage: '/students',
    targetType: 'HSSV',
    targetScope: 'Cụ thể',
    targetDetail: 'Lớp CNTT-K45A'
  },
  {
    id: 't-2',
    title: 'Giải bài tập giải tích 3',
    type: 'Bài tập',
    subject: 'Môn: Toán cao cấp',
    deadline: '20/10/2026',
    priority: 'Medium',
    status: 'Chưa bắt đầu',
    linkedPage: '/students/record',
    targetType: 'HSSV',
    targetScope: 'Tất cả'
  },
  {
    id: 't-3',
    title: 'Tiểu luận Lịch sử Đảng',
    type: 'Bài tập',
    subject: 'Môn: Lý luận chính trị',
    deadline: '15/10/2026',
    priority: 'Low',
    status: 'Đã xong',
    linkedPage: '/grading/categories',
    targetType: 'HSSV',
    targetScope: 'Tất cả'
  },
  {
    id: 't-4',
    title: 'Tham gia CLB Robot',
    type: 'Hoạt động',
    subject: 'Hoạt động ngoại khóa',
    deadline: '30/10/2026',
    priority: 'Medium',
    status: 'Chưa bắt đầu',
    linkedPage: '/',
    targetType: 'HSSV',
    targetScope: 'Tất cả'
  },
  // Seed more tasks to get exactly 24 tasks, with 12 completed and 5 urgent/High priority not completed.
  // Completed tasks (11 more to reach 12 completed)
  { id: 't-5', title: 'Thuyết trình môn Triết học', type: 'Bài tập', subject: 'Môn: Triết học Mác-Lênin', deadline: '05/09/2026', priority: 'Medium', status: 'Đã xong', linkedPage: '/grading/categories', targetType: 'HSSV', targetScope: 'Tất cả' },
  { id: 't-6', title: 'Nộp báo cáo thực tập cơ sở', type: 'Dự án', subject: 'Môn: Thực tập cơ sở', deadline: '10/09/2026', priority: 'High', status: 'Đã xong', linkedPage: '/students', targetType: 'HSSV', targetScope: 'Cụ thể', targetDetail: 'Nguyễn Văn A' },
  { id: 't-7', title: 'Lập trình website bán hàng', type: 'Dự án', subject: 'Môn: Phát triển Web', deadline: '20/09/2026', priority: 'High', status: 'Đã xong', linkedPage: '/students', targetType: 'HSSV', targetScope: 'Cụ thể', targetDetail: 'Lớp CNTT-K45B' },
  { id: 't-8', title: 'Bài tập tuần 3 cấu trúc dữ liệu', type: 'Bài tập', subject: 'Môn: Cấu trúc dữ liệu và giải thuật', deadline: '12/09/2026', priority: 'Medium', status: 'Đã xong', linkedPage: '/students/record', targetType: 'HSSV', targetScope: 'Tất cả' },
  { id: 't-9', title: 'Tham gia hiến máu nhân đạo', type: 'Hoạt động', subject: 'Đoàn thanh niên', deadline: '18/09/2026', priority: 'Low', status: 'Đã xong', linkedPage: '/', targetType: 'HSSV', targetScope: 'Tất cả' },
  { id: 't-10', title: 'Viết bài thu hoạch quân sự', type: 'Bài tập', subject: 'Môn: Giáo dục quốc phòng', deadline: '22/09/2026', priority: 'Low', status: 'Đã xong', linkedPage: '/students/record', targetType: 'HSSV', targetScope: 'Tất cả' },
  { id: 't-11', title: 'Bài tập lớn OOP Java', type: 'Dự án', subject: 'Môn: Lập trình hướng đối tượng', deadline: '28/09/2026', priority: 'Medium', status: 'Đã xong', linkedPage: '/students', targetType: 'HSSV', targetScope: 'Tất cả' },
  { id: 't-12', title: 'Chuẩn bị slide giới thiệu nhóm', type: 'Bài tập', subject: 'Môn: Kỹ năng mềm', deadline: '01/10/2026', priority: 'Low', status: 'Đã xong', linkedPage: '/students/record', targetType: 'HSSV', targetScope: 'Tất cả' },
  { id: 't-13', title: 'Luyện tập nói tiếng Anh chủ đề học tập', type: 'Bài tập', subject: 'Môn: Tiếng Anh chuyên ngành', deadline: '03/10/2026', priority: 'Medium', status: 'Đã xong', linkedPage: '/students/record', targetType: 'HSSV', targetScope: 'Cụ thể', targetDetail: 'Trần Thị B' },
  { id: 't-14', title: 'Hội thảo hướng nghiệp CNTT', type: 'Hoạt động', subject: 'Hoạt động ngoại khóa', deadline: '06/10/2026', priority: 'Low', status: 'Đã xong', linkedPage: '/students', targetType: 'HSSV', targetScope: 'Tất cả' },
  { id: 't-15', title: 'Giải bài tập xác suất thống kê', type: 'Bài tập', subject: 'Môn: Xác suất thống kê', deadline: '10/10/2026', priority: 'Medium', status: 'Đã xong', linkedPage: '/students/record', targetType: 'HSSV', targetScope: 'Tất cả' },

  // Urgent/High priority tasks not completed (4 more to reach 5 total: t-1 + 4 items below)
  { id: 't-16', title: 'Nộp báo cáo đồ án chuyên ngành', type: 'Dự án', subject: 'Môn: Đồ án chuyên ngành', deadline: '26/10/2026', priority: 'High', status: 'Đang làm', linkedPage: '/students', targetType: 'HSSV', targetScope: 'Cụ thể', targetDetail: 'Nguyễn Văn A' },
  { id: 't-17', title: 'Luyện thi chứng chỉ tiếng Anh', type: 'Bài tập', subject: 'Môn: Tiếng Anh đầu ra', deadline: '28/10/2026', priority: 'High', status: 'Chưa bắt đầu', linkedPage: '/students/record', targetType: 'HSSV', targetScope: 'Tất cả' },
  { id: 't-18', title: 'Sửa lỗi phần mềm quản lý điểm', type: 'Dự án', subject: 'Môn: Đảm bảo chất lượng phần mềm', deadline: '29/10/2026', priority: 'High', status: 'Đang làm', linkedPage: '/grading/categories', targetType: 'Giáo viên', targetScope: 'Cụ thể', targetDetail: 'GV Nguyễn Văn B' },
  { id: 't-19', title: 'Chuẩn bị đề tài nghiên cứu khoa học', type: 'Dự án', subject: 'Nghiên cứu khoa học HSSV', deadline: '31/10/2026', priority: 'High', status: 'Chưa bắt đầu', linkedPage: '/students', targetType: 'Giáo viên', targetScope: 'Tất cả' },

  // Other tasks (Medium/Low priority, not completed) to make a total of 24 tasks
  { id: 't-20', title: 'Ôn tập lý thuyết hệ điều hành', type: 'Bài tập', subject: 'Môn: Hệ điều hành', deadline: '01/11/2026', priority: 'Medium', status: 'Chưa bắt đầu', linkedPage: '/students/record', targetType: 'HSSV', targetScope: 'Tất cả' },
  { id: 't-21', title: 'Thực hành lab 4 mạng máy tính', type: 'Bài tập', subject: 'Môn: Mạng máy tính', deadline: '03/11/2026', priority: 'Medium', status: 'Đang làm', linkedPage: '/students/record', targetType: 'HSSV', targetScope: 'Tất cả' },
  { id: 't-22', title: 'Tham gia giải chạy Marathon trường', type: 'Hoạt động', subject: 'Câu lạc bộ Thể thao', deadline: '05/11/2026', priority: 'Low', status: 'Chưa bắt đầu', linkedPage: '/', targetType: 'HSSV', targetScope: 'Tất cả' },
  { id: 't-23', title: 'Bài tập lập trình Python cơ bản', type: 'Bài tập', subject: 'Môn: Cơ sở lập trình', deadline: '10/11/2026', priority: 'Low', status: 'Chưa bắt đầu', linkedPage: '/students/record', targetType: 'HSSV', targetScope: 'Tất cả' },
  { id: 't-24', title: 'Dọn dẹp phòng Lab và sắp xếp thiết bị', type: 'Hoạt động', subject: 'Hoạt động tình nguyện', deadline: '12/11/2026', priority: 'Low', status: 'Đang làm', linkedPage: '/', targetType: 'Quản sinh', targetScope: 'Tất cả' }
];

const StudentTasksTab = () => {
  const router = useRouter();
  const { user } = useAuth();
  const taskAccess = usePermission({
    viewTask: "READ_STUDENT_TASK",
    createTask: "CREATE_STUDENT_TASK",
    editTask: "UPDATE_STUDENT_TASK",
    deleteTask: "DELETE_STUDENT_TASK"
  });

  const userRole = String(user?.role || '').toLowerCase();
  const isStudent = userRole.includes('student') || userRole.includes('học sinh') || userRole.includes('sinh viên');
  const isTeacher = userRole.includes('teacher') || userRole.includes('giáo viên') || userRole.includes('giảng viên');
  const isStudentOrTeacher = isStudent || isTeacher;
  const [tasks, setTasks] = useState<Task[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [activeTabFilter, setActiveTabFilter] = useState<'Mới nhất' | 'Hoàn thành' | 'Đang làm' | 'Chưa bắt đầu'>('Mới nhất');
  const [priorityFilter, setPriorityFilter] = useState<'All' | 'High' | 'Medium' | 'Low'>('All');
  const [targetFilter, setTargetFilter] = useState<'All' | 'HSSV' | 'Giáo viên' | 'Quản sinh'>('All');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingTask, setEditingTask] = useState<Task | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 6; 

  // Load tasks from LocalStorage or seed defaults
  useEffect(() => {
    const cached = localStorage.getItem('student_tasks');
    if (cached) {
      try {
        setTasks(JSON.parse(cached));
      } catch (e) {
        setTasks(INITIAL_TASKS);
      }
    } else {
      setTasks(INITIAL_TASKS);
      localStorage.setItem('student_tasks', JSON.stringify(INITIAL_TASKS));
    }
  }, []);

  const saveTasks = (newTasks: Task[]) => {
    setTasks(newTasks);
    localStorage.setItem('student_tasks', JSON.stringify(newTasks));
  };

  // KPI Calculations
  const totalTasks = tasks.length;
  const urgentTasks = tasks.filter(t => t.status !== 'Đã xong' && t.priority === 'High').length;
  const completedTasks = tasks.filter(t => t.status === 'Đã xong').length;
  const progressPercentage = totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0;

  // Toggle task status quick action
  const handleQuickAction = (task: Task, e: React.MouseEvent) => {
    e.stopPropagation();
    let nextStatus: Task['status'];
    if (task.status === 'Chưa bắt đầu') nextStatus = 'Đang làm';
    else if (task.status === 'Đang làm') nextStatus = 'Đã xong';
    else nextStatus = 'Chưa bắt đầu';

    const updated = tasks.map(t => t.id === task.id ? { ...t, status: nextStatus } : t);
    saveTasks(updated);
    toast.success(`Đã cập nhật trạng thái nhiệm vụ sang "${nextStatus}"`);

    // Gửi thông báo tự động khi hoàn thành
    if (nextStatus === 'Đã xong') {
      addNotification(
        'Nhiệm vụ đã hoàn thành',
        `Nhiệm vụ "${task.title}" thuộc "${task.subject}" đã được chuyển sang trạng thái Hoàn thành xuất sắc!`,
        'success',
        '/students/tasks'
      );
    }
  };

  // Click card to navigate to page
  const handleCardClick = (task: Task) => {
    if (task.linkedPage) {
      toast.info(`Đang chuyển hướng sang trang: ${task.linkedPage}`);
      router.push(task.linkedPage);
    } else {
      toast.error('Nhiệm vụ này chưa được cấu hình trang liên kết.');
    }
  };

  // Add or Edit save action
  const handleSaveTask = (taskData: Omit<Task, 'id'> & { id?: string }) => {
    if (taskData.id) {
      // Edit mode
      const oldTask = tasks.find(t => t.id === taskData.id);
      const updated = tasks.map(t => t.id === taskData.id ? { ...t, ...taskData } as Task : t);
      saveTasks(updated);
      toast.success('Đã cập nhật nhiệm vụ thành công!');

      // Gửi thông báo tự động khi chuyển sang Đã xong
      if (oldTask && oldTask.status !== 'Đã xong' && taskData.status === 'Đã xong') {
        addNotification(
          'Nhiệm vụ đã hoàn thành',
          `Nhiệm vụ "${taskData.title}" thuộc "${taskData.subject}" đã được chuyển sang trạng thái Hoàn thành xuất sắc!`,
          'success',
          '/students/tasks'
        );
      }
    } else {
      // Add mode
      const newTask: Task = {
        ...taskData,
        id: `t-${Date.now()}`
      };
      const updated = [newTask, ...tasks];
      saveTasks(updated);
      toast.success('Đã tạo nhiệm vụ mới thành công!');

      // Gửi thông báo tự động khi tạo nhiệm vụ mới
      addNotification(
        'Nhiệm vụ học tập mới',
        `Nhiệm vụ mới "${taskData.title}" (${taskData.type}) thuộc "${taskData.subject}" đã được phân công cho ${taskData.targetType} (${taskData.targetScope === 'Cụ thể' ? taskData.targetDetail : 'Tất cả'}).`,
        'info',
        taskData.linkedPage || '/students/tasks'
      );
    }
    setEditingTask(null);
  };

  const handleDeleteTask = (id: string) => {
    const updated = tasks.filter(t => t.id !== id);
    saveTasks(updated);
    toast.success('Đã xóa nhiệm vụ thành công!');
  };

  // Filter tasks
  const filteredTasks = tasks.filter(task => {
    // Search filter
    const matchesSearch = task.title.toLowerCase().includes(searchTerm.toLowerCase()) || 
                          task.subject.toLowerCase().includes(searchTerm.toLowerCase()) ||
                          (task.targetDetail && task.targetDetail.toLowerCase().includes(searchTerm.toLowerCase()));
    
    // Tab filter
    let matchesTab = true;
    if (activeTabFilter === 'Hoàn thành') {
      matchesTab = task.status === 'Đã xong';
    } else if (activeTabFilter === 'Đang làm') {
      matchesTab = task.status === 'Đang làm';
    } else if (activeTabFilter === 'Chưa bắt đầu') {
      matchesTab = task.status === 'Chưa bắt đầu';
    }

    // Priority filter
    const matchesPriority = priorityFilter === 'All' || task.priority === priorityFilter;

    // Target filter based on user role
    let matchesTarget = true;
    if (isTeacher) {
      matchesTarget = task.targetType === 'Giáo viên';
    } else if (isStudent) {
      matchesTarget = task.targetType === 'HSSV';
    } else {
      matchesTarget = targetFilter === 'All' || task.targetType === targetFilter;
    }

    return matchesSearch && matchesTab && matchesPriority && matchesTarget;
  });

  // Pagination calculation
  const totalFiltered = filteredTasks.length;
  const totalPages = Math.ceil(totalFiltered / itemsPerPage) || 1;
  const paginatedTasks = filteredTasks.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);

  const startItem = totalFiltered > 0 ? (currentPage - 1) * itemsPerPage + 1 : 0;
  const endItem = Math.min(currentPage * itemsPerPage, totalFiltered);





  return (
    <div className="flex-1 flex flex-col gap-4 overflow-hidden min-h-0 bg-transparent">
      {/* Header section */}
      {!isStudentOrTeacher && (
        <div className="flex items-center justify-between shrink-0 mt-1">
          <div>
            <h2 className="text-[20px] font-bold text-[#1E293B] leading-7">Quản lý nhiệm vụ</h2>
            <p className="text-xs text-[#64748B] mt-0.5">Tổ chức công việc học tập một cách hiệu quả và khoa học.</p>
          </div>
          {taskAccess.createTask && (
            <button
              onClick={() => {
                setEditingTask(null);
                setIsModalOpen(true);
              }}
              className="flex items-center gap-1.5 px-4 py-2 text-sm font-semibold text-white bg-[#1A73E8] hover:bg-[#155cb4] active:scale-[0.99] rounded-xl transition-all duration-150 ease-out hover:scale-[1.01] shadow-sm shadow-blue-500/10 cursor-pointer"
            >
              <Plus size={16} />
              <span>Thêm nhiệm vụ mới</span>
            </button>
          )}
        </div>
      )}

      {/* KPI Cards Grid */}
      {!isStudentOrTeacher && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 shrink-0">
          {/* KPI Card 1: Total */}
          <div className="bg-white/45 backdrop-blur-md border border-white/80 rounded-2xl p-4 shadow-sm shadow-slate-300/20 hover:scale-[1.01] hover:bg-white/60 transition-all duration-150 ease-out flex items-center justify-between">
            <div className="space-y-1">
              <span className="text-[11px] font-bold text-[#64748B] tracking-wider uppercase">TỔNG NHIỆM VỤ</span>
              <div className="flex items-baseline gap-2">
                <span className="text-3xl font-bold text-[#1E293B]">{totalTasks}</span>
                <span className="inline-flex items-center text-[10px] font-semibold text-[#1A73E8] bg-blue-50/70 border border-blue-100/60 px-1.5 py-0.5 rounded-xl">
                  +3 tuần này
                </span>
              </div>
            </div>
            <div className="w-10 h-10 rounded-xl bg-blue-50 flex items-center justify-center text-[#1A73E8] shrink-0 border border-blue-100/30">
              <Clock size={20} />
            </div>
          </div>

          {/* KPI Card 2: Urgent */}
          <div className="bg-white/45 backdrop-blur-md border border-white/80 rounded-2xl p-4 shadow-sm shadow-slate-300/20 hover:scale-[1.01] hover:bg-white/60 transition-all duration-150 ease-out flex items-center justify-between">
            <div className="space-y-1">
              <span className="text-[11px] font-bold text-[#64748B] tracking-wider uppercase">SẮP HẾT HẠN</span>
              <div className="flex items-baseline gap-2">
                <span className="text-3xl font-bold text-red-600">
                  {String(urgentTasks).padStart(2, '0')}
                </span>
                <span className="inline-flex items-center text-[10px] font-semibold text-red-600 bg-red-50/70 border border-red-100/60 px-1.5 py-0.5 rounded-xl">
                  Cần xử lý ngay
                </span>
              </div>
            </div>
            <div className="w-10 h-10 rounded-xl bg-red-50 flex items-center justify-center text-red-600 shrink-0 border border-red-100/30">
              <AlertCircle size={20} />
            </div>
          </div>

          {/* KPI Card 3: Completed */}
          <div className="bg-white/45 backdrop-blur-md border border-white/80 rounded-2xl p-4 shadow-sm shadow-slate-300/20 hover:scale-[1.01] hover:bg-white/60 transition-all duration-150 ease-out flex items-center justify-between">
            <div className="space-y-1">
              <span className="text-[11px] font-bold text-[#64748B] tracking-wider uppercase">HOÀN THÀNH</span>
              <div className="flex items-baseline gap-2">
                <span className="text-3xl font-bold text-emerald-600">{completedTasks}</span>
                <span className="inline-flex items-center text-[10px] font-semibold text-emerald-600 bg-emerald-50/70 border border-emerald-100/60 px-1.5 py-0.5 rounded-xl">
                  {progressPercentage}% tiến độ
                </span>
              </div>
            </div>
            <div className="w-10 h-10 rounded-xl bg-emerald-50 flex items-center justify-center text-emerald-600 shrink-0 border border-emerald-100/30">
              <CheckCircle2 size={20} />
            </div>
          </div>
        </div>
      )}

      {/* Filter and Grid Container */}
      <div className="flex-1 bg-white/40 backdrop-blur-md border border-white/80 rounded-2xl flex flex-col min-h-0 overflow-hidden shadow-sm shadow-slate-300/10">
        
        {/* Filter Bar */}
        <div className="p-4 border-b border-white/80 bg-white/20 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shrink-0">
          {/* Lọc Trạng thái (Tab phẳng) */}
          <div className="flex items-center gap-1.5 bg-slate-100/60 p-1 rounded-xl w-fit border border-slate-200/20 shrink-0">
            {(['Mới nhất', 'Đang làm', 'Hoàn thành', 'Chưa bắt đầu'] as const).map((tab) => (
              <button
                key={tab}
                onClick={() => {
                  setActiveTabFilter(tab);
                  setCurrentPage(1);
                }}
                className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-all duration-150 cursor-pointer ${
                  activeTabFilter === tab 
                    ? 'bg-white text-[#1A73E8] shadow-sm' 
                    : 'text-[#64748B] hover:text-[#1E293B]'
                }`}
              >
                {tab === 'Mới nhất' ? 'Tất cả' : tab}
              </button>
            ))}
          </div>

          <div className="flex items-center gap-2">
            {/* Lọc đối tượng áp dụng */}
            {!isStudentOrTeacher && (
              <div className="relative shrink-0">
                <select
                  value={targetFilter}
                  onChange={(e) => {
                    setTargetFilter(e.target.value as any);
                    setCurrentPage(1);
                  }}
                  className="pl-3 pr-8 py-2 text-xs font-bold text-[#64748B] bg-white border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#1A73E8]/30 transition-all appearance-none cursor-pointer"
                >
                  <option value="All">Đối tượng: Tất cả</option>
                  <option value="HSSV">Đối tượng: HSSV</option>
                  <option value="Giáo viên">Đối tượng: Giáo viên</option>
                  <option value="Quản sinh">Đối tượng: Quản sinh</option>
                </select>
                <Users className="absolute right-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400 pointer-events-none" />
              </div>
            )}

            {/* Lọc Mức Độ (Priority) */}
            <div className="relative shrink-0">
              <select
                value={priorityFilter}
                onChange={(e) => {
                  setPriorityFilter(e.target.value as any);
                  setCurrentPage(1);
                }}
                className="pl-3 pr-8 py-2 text-xs font-bold text-[#64748B] bg-white border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#1A73E8]/30 transition-all appearance-none cursor-pointer"
              >
                <option value="All">Độ ưu tiên: Tất cả</option>
                <option value="High">Độ ưu tiên: Cao</option>
                <option value="Medium">Độ ưu tiên: Trung bình</option>
                <option value="Low">Độ ưu tiên: Thấp</option>
              </select>
              <Filter className="absolute right-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400 pointer-events-none" />
            </div>

            {/* Tìm kiếm */}
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input
                type="text"
                placeholder="Tìm kiếm nhiệm vụ..."
                value={searchTerm}
                onChange={(e) => {
                  setSearchTerm(e.target.value);
                  setCurrentPage(1);
                }}
                className="pl-9 pr-4 py-2 text-xs rounded-xl border border-gray-200 bg-white/70 focus:outline-none focus:ring-2 focus:ring-[#1A73E8]/30 focus:border-[#1A73E8] transition-all w-48 sm:w-56"
              />
            </div>
          </div>
        </div>

        {/* Task Cards Grid */}
        <div className="flex-1 p-4 overflow-y-auto min-h-0 bg-white/10">
          {paginatedTasks.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {paginatedTasks.map((task) => (
                <div
                  key={task.id}
                  onClick={() => handleCardClick(task)}
                  className={`bg-white/60 backdrop-blur-sm border rounded-2xl p-5 shadow-sm hover:shadow-md hover:scale-[1.01] hover:border-blue-400/60 transition-all duration-150 ease-out flex flex-col justify-between min-h-[230px] relative group border-slate-200/50 cursor-pointer`}
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
                        if (confirm('Bạn có chắc chắn muốn xóa nhiệm vụ này?')) {
                          handleDeleteTask(task.id);
                        }
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
                      <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-lg text-[10px] font-bold border ${
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
                  <div className="mt-4 pt-3 border-t border-slate-100 flex items-end justify-between">
                    <div className="space-y-1.5">
                      {/* Deadline */}
                      <div className="flex items-center gap-1.5 text-[11px] text-[#64748B] font-medium">
                        <Calendar size={13} className="text-gray-400" />
                        <span>Hạn: {task.deadline}</span>
                      </div>
                      
                      {/* Priority Tag */}
                      <div className="flex items-center gap-1.5">
                        <span className="text-[10px] font-bold text-[#64748B]">Độ ưu tiên:</span>
                        <span className={`inline-flex px-1.5 py-0.5 text-[9px] font-bold rounded-md ${
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
                          task.status === 'Đã xong' ? 'bg-emerald-500' :
                          task.status === 'Đang làm' ? 'bg-blue-500' :
                          'bg-gray-400'
                        }`} />
                        <span className="text-[11px] font-bold text-[#1E293B]">
                          {task.status}
                        </span>
                      </div>

                      {/* Link to page button */}
                      <button
                        onClick={() => router.push(task.linkedPage)}
                        className="w-7 h-7 rounded-xl flex items-center justify-center border border-slate-200 text-slate-500 bg-white hover:border-[#1A73E8] hover:text-[#1A73E8] transition-all"
                        title="Chuyển hướng đến trang liên kết"
                      >
                        <ExternalLink size={12} />
                      </button>

                      {/* Quick change status button */}
                      <button
                        onClick={(e) => handleQuickAction(task, e)}
                        className={`w-7 h-7 rounded-xl flex items-center justify-center border transition-all duration-150 ${
                          task.status === 'Đã xong'
                            ? 'bg-emerald-50 border-emerald-200 text-emerald-600 hover:bg-emerald-100'
                            : task.status === 'Đang làm'
                            ? 'bg-blue-50 border-blue-200 text-[#1A73E8] hover:bg-blue-100'
                            : 'bg-white border-slate-200 text-slate-400 hover:border-slate-300 hover:text-slate-600'
                        }`}
                        title="Đổi trạng thái nhanh"
                      >
                        {task.status === 'Đã xong' ? <Check size={14} strokeWidth={2.5} /> : <Play size={12} strokeWidth={2.5} className={task.status === 'Đang làm' ? '' : 'translate-x-0.5'} />}
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="h-64 border border-dashed border-gray-200 rounded-2xl flex flex-col items-center justify-center text-center p-6 bg-white/20">
              <AlertCircle size={32} className="text-gray-300 mb-2" />
              <p className="text-sm font-semibold text-gray-500">Không tìm thấy nhiệm vụ nào.</p>
              <p className="text-xs text-gray-400 mt-1">Hãy tạo nhiệm vụ mới hoặc thay đổi các bộ lọc.</p>
            </div>
          )}
        </div>

        {/* Footer (Pagination) */}
        <div className="px-5 py-3 border-t border-white/80 bg-white/20 flex items-center justify-between shrink-0">
          <span className="text-xs font-semibold text-[#64748B]">
            Hiển thị {startItem}-{endItem} trên tổng số {totalFiltered} nhiệm vụ
          </span>

          <div className="flex items-center gap-1.5">
            <button
              onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
              disabled={currentPage === 1}
              className="w-7 h-7 flex items-center justify-center rounded-xl border border-gray-200 bg-white text-gray-500 hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            >
              <ChevronLeft size={14} />
            </button>
            
            {Array.from({ length: totalPages }).map((_, idx) => (
              <button
                key={idx}
                onClick={() => setCurrentPage(idx + 1)}
                className={`w-7 h-7 flex items-center justify-center rounded-xl text-xs font-bold transition-all ${
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
              className="w-7 h-7 flex items-center justify-center rounded-xl border border-gray-200 bg-white text-gray-500 hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            >
              <ChevronRight size={14} />
            </button>
          </div>
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
      />
    </div>
  );
};

export default StudentTasksTab;
