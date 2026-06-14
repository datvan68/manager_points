'use client';

import React, { useState, useEffect } from 'react';
import { X, PlusCircle, Link as LinkIcon, UserCheck, Calendar as CalendarIcon } from 'lucide-react';
import { studentApi } from '@/api/student-api';
import { classApi } from '@/api/class-api';
import { studentTaskApi } from '@/api/task-api';
import { toast } from 'sonner';
import { getLinkedTaskMode } from '@/lib/task-linked-page';
import { cn } from '@/lib/utils';
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/components/ui/select';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { CustomCalendar } from '@/components/calendar/CustomCalendar';
import { format } from 'date-fns';

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
}

interface AddTaskModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (task: Omit<Task, 'id'> & { id?: string }) => Promise<void> | void;
  editingTask?: Task | null;
  isSaving?: boolean;
}

const PRESET_PAGES = [
  { label: 'Không gắn trang', value: 'none' },
  { label: 'Chấm điểm rèn luyện (Tự động đồng bộ)', value: '/grading/score' },
  { label: 'Ghi nhận chuyên cần & rèn luyện (Tự động đồng bộ)', value: '/students/record' },
  { label: 'Danh sách sinh viên', value: '/students' },
  { label: 'Cấu hình danh mục điểm số', value: '/grading/categories' },
  { label: 'Trang chủ Dashboard', value: '/' }
];

const AddTaskModal: React.FC<AddTaskModalProps> = ({ isOpen, onClose, onSave, editingTask, isSaving }) => {
  const [title, setTitle] = useState('');
  const [type, setType] = useState<'Dự án' | 'Bài tập' | 'Hoạt động'>('Bài tập');
  const [subject, setSubject] = useState('');
  const [deadline, setDeadline] = useState('');
  const [priority, setPriority] = useState<'High' | 'Medium' | 'Low'>('Medium');
  const [status, setStatus] = useState<'Chưa bắt đầu' | 'Đang làm' | 'Đã xong'>('Chưa bắt đầu');
  
  // New Fields States
  const [pageSelection, setPageSelection] = useState('none');
  const [customPageUrl, setCustomPageUrl] = useState('');
  const [targetType, setTargetType] = useState<'HSSV' | 'Giáo viên' | 'Quản sinh'>('HSSV');
  const [targetScope, setTargetScope] = useState<'Tất cả' | 'Cụ thể'>('Tất cả');
  const [targetDetail, setTargetDetail] = useState('');

  // Specific Lists States
  const [studentsList, setStudentsList] = useState<any[]>([]);
  const [classesList, setClassesList] = useState<any[]>([]);
  const [teachersList, setTeachersList] = useState<any[]>([]);
  const [isLoadingSpecificData, setIsLoadingSpecificData] = useState(false);

  // Selected Specific IDs
  const [selectedStudentIds, setSelectedStudentIds] = useState<string[]>([]);
  const [selectedClassIds, setSelectedClassIds] = useState<string[]>([]);
  const [selectedTeacherIds, setSelectedTeacherIds] = useState<string[]>([]);
  const [isCalendarOpen, setIsCalendarOpen] = useState(false);

  useEffect(() => {
    if (editingTask) {
      setTitle(editingTask.title);
      setType(editingTask.type);
      setSubject(editingTask.subject);
      
      // Format deadline to yyyy-MM-dd (hỗ trợ cả ISO string và dd/MM/yyyy)
      if (editingTask.deadline) {
        if (editingTask.deadline.includes('T')) {
          setDeadline(editingTask.deadline.split('T')[0]);
        } else {
          const dateParts = editingTask.deadline.split('/');
          if (dateParts.length === 3) {
            setDeadline(`${dateParts[2]}-${dateParts[1].padStart(2, '0')}-${dateParts[0].padStart(2, '0')}`);
          } else {
            setDeadline(editingTask.deadline);
          }
        }
      }
      
      setPriority(editingTask.priority);
      setStatus(editingTask.status);
      
      // Linked Page
      const currentLinkedPage = editingTask.linkedPage;
      if (!currentLinkedPage) {
        setPageSelection('none');
        setCustomPageUrl('');
      } else {
        const isPreset = PRESET_PAGES.some(p => p.value === currentLinkedPage);
        if (isPreset) {
          setPageSelection(currentLinkedPage);
          setCustomPageUrl('');
        } else {
          setPageSelection('custom');
          setCustomPageUrl(currentLinkedPage || '');
        }
      }

      // Target Audience
      setTargetType(editingTask.targetType || 'HSSV');
      setTargetScope(editingTask.targetScope || 'Tất cả');
      setTargetDetail(editingTask.targetDetail || '');
      setSelectedStudentIds(editingTask.targetStudentIds || []);
      setSelectedClassIds(editingTask.targetClassIds || []);
      setSelectedTeacherIds(editingTask.targetTeacherIds || []);
    } else {
      setTitle('');
      setType('Bài tập');
      setSubject('');
      
      const today = new Date().toISOString().split('T')[0];
      setDeadline(today);
      setPriority('Medium');
      setStatus('Chưa bắt đầu');
      
      // Defaults
      setPageSelection('none');
      setCustomPageUrl('');
      setTargetType('HSSV');
      setTargetScope('Tất cả');
      setTargetDetail('');
      setSelectedStudentIds([]);
      setSelectedClassIds([]);
      setSelectedTeacherIds([]);
    }
  }, [editingTask, isOpen]);

  // Load specific items for checkbox lists when Scope is Cụ thể
  useEffect(() => {
    if (isOpen && targetScope === 'Cụ thể') {
      const loadSpecificData = async () => {
        setIsLoadingSpecificData(true);
        try {
          // Load classes
          const classes = await classApi.getClasses();
          setClassesList(classes);

          // Load students
          const studentsRes = await studentApi.getStudents();
          const students = Array.isArray(studentsRes) ? studentsRes : (studentsRes?.data || []);
          setStudentsList(students);

          // Load teachers sử dụng API đã chuẩn hóa dùng shared httpClient
          const teachers = await studentTaskApi.getTeachers();
          setTeachersList(teachers);
        } catch (err) {
          console.error('Lỗi khi load dữ liệu đối tượng cụ thể:', err);
        } finally {
          setIsLoadingSpecificData(false);
        }
      };
      loadSpecificData();
    }
  }, [isOpen, targetScope]);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !subject.trim() || !deadline) return;

    // Frontend validation cho specific target
    if (targetScope === 'Cụ thể') {
      if (targetType === 'HSSV') {
        if (selectedStudentIds.length === 0 && selectedClassIds.length === 0) {
          toast.error('Vui lòng chọn ít nhất một Lớp học hoặc Học sinh cụ thể.');
          return;
        }
      } else if (targetType === 'Giáo viên') {
        if (selectedTeacherIds.length === 0) {
          toast.error('Vui lòng chọn ít nhất một Giáo viên cụ thể.');
          return;
        }
      } else if (targetType === 'Quản sinh') {
        toast.error('Không hỗ trợ phạm vi Cụ thể cho đối tượng Quản sinh.');
        return;
      }
    }

    // Convert yyyy-MM-dd back to dd/MM/yyyy
    const dateParts = deadline.split('-');
    const formattedDeadline = dateParts.length === 3 
      ? `${dateParts[2]}/${dateParts[1]}/${dateParts[0]}`
      : deadline;

    // Determine target page link
    const finalLinkedPage = pageSelection === 'none' 
      ? '' 
      : pageSelection === 'custom' 
        ? customPageUrl.trim() 
        : pageSelection;

    try {
      await onSave({
        ...(editingTask && { id: editingTask.id }),
        title: title.trim(),
        type,
        subject: subject.trim(),
        deadline: formattedDeadline,
        priority,
        status,
        linkedPage: finalLinkedPage,
        targetType,
        targetScope: targetType === 'Quản sinh' ? 'Tất cả' : targetScope,
        targetDetail: (targetType !== 'Quản sinh' && targetScope === 'Cụ thể') ? targetDetail.trim() : undefined,
        targetStudentIds: (targetType === 'HSSV' && targetScope === 'Cụ thể') ? selectedStudentIds : [],
        targetClassIds: (targetType === 'HSSV' && targetScope === 'Cụ thể') ? selectedClassIds : [],
        targetTeacherIds: (targetType === 'Giáo viên' && targetScope === 'Cụ thể') ? selectedTeacherIds : []
      });
      // Chỉ đóng form khi quá trình save ở component cha hoàn tất thành công (không throw error)
      onClose();
    } catch (err) {
      console.error('Lỗi khi submit form lưu task:', err);
      // Giữ nguyên modal để hiển thị lỗi
    }
  };

  return (
    <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-[999] flex items-center justify-center p-4">
      <div className="w-full md:max-w-3xl lg:max-w-4xl bg-white/80 backdrop-blur-md border border-white/70 rounded-2xl shadow-xl overflow-hidden animate-in fade-in zoom-in-95 duration-150 flex flex-col max-h-[95vh]">
        {/* Header */}
        <div className="px-5 py-4 border-b border-white/50 flex items-center justify-between bg-white/40">
          <div className="flex items-center gap-2">
            <PlusCircle className="text-[#1A73E8] w-5 h-5" />
            <h3 className="font-bold text-base text-[#1E293B]">
              {editingTask ? 'Cập nhật cấu hình nhiệm vụ' : 'Thêm nhiệm vụ mới'}
            </h3>
          </div>
          <button 
            type="button"
            onClick={onClose}
            disabled={isSaving}
            className="p-1 rounded-xl text-slate-400 hover:text-[#1E293B] hover:bg-white/50 transition-all duration-150 disabled:opacity-40 disabled:cursor-not-allowed"
          >
            <X size={18} />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="flex-1 flex flex-col min-h-0 overflow-hidden">
          <div className="p-5 flex-1 overflow-y-auto space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              
              {/* Cột trái: Thông tin nhiệm vụ */}
              <div className="space-y-4">
                {/* Tên nhiệm vụ */}
                <div className="space-y-1">
                  <label className="text-xs font-semibold text-[#64748B] block">Tên nhiệm vụ</label>
                  <input 
                    type="text"
                    required
                    placeholder="Nhập tên nhiệm vụ học tập..."
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    className="w-full rounded-xl border border-white/70 bg-white/50 px-3 py-2 text-sm text-[#1E293B] placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-[#1A73E8]/30 focus:border-[#1A73E8] transition-all duration-150"
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  {/* Loại nhiệm vụ */}
                  <div className="space-y-1">
                    <label className="text-xs font-semibold text-[#64748B] block">Loại nhiệm vụ</label>
                    <Select value={type} onValueChange={(val: any) => setType(val)}>
                      <SelectTrigger className="rounded-xl bg-white/50 border-white/70 focus:ring-2 focus:ring-[#1A73E8]/30">
                        <SelectValue placeholder="Chọn loại nhiệm vụ" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="Bài tập">Bài tập</SelectItem>
                        <SelectItem value="Dự án">Dự án</SelectItem>
                        <SelectItem value="Hoạt động">Hoạt động</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  {/* Mức độ ưu tiên */}
                  <div className="space-y-1">
                    <label className="text-xs font-semibold text-[#64748B] block">Độ ưu tiên</label>
                    <Select value={priority} onValueChange={(val: any) => setPriority(val)}>
                      <SelectTrigger className="rounded-xl bg-white/50 border-white/70 focus:ring-2 focus:ring-[#1A73E8]/30">
                        <SelectValue placeholder="Chọn độ ưu tiên" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="Low">Thấp (Low)</SelectItem>
                        <SelectItem value="Medium">Trung bình (Medium)</SelectItem>
                        <SelectItem value="High">Cao (High)</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                {/* Môn học / Lĩnh vực */}
                <div className="space-y-1">
                  <label className="text-xs font-semibold text-[#64748B] block">Môn học / Lĩnh vực</label>
                  <input 
                    type="text"
                    required
                    placeholder="Ví dụ: Thiết kế trải nghiệm người dùng, Toán cao cấp..."
                    value={subject}
                    onChange={(e) => setSubject(e.target.value)}
                    className="w-full rounded-xl border border-white/70 bg-white/50 px-3 py-2 text-sm text-[#1E293B] placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-[#1A73E8]/30 focus:border-[#1A73E8] transition-all duration-150"
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  {/* Hạn chót */}
                  <div className="space-y-1">
                    <label className="text-xs font-semibold text-[#64748B] block">Hạn chót (Deadline)</label>
                    <Popover open={isCalendarOpen} onOpenChange={setIsCalendarOpen}>
                      <PopoverTrigger asChild>
                        <button
                          type="button"
                          className="w-full flex items-center justify-between rounded-xl border border-white/70 bg-white/50 px-3 py-2.5 text-sm text-[#1E293B] focus:outline-none focus:ring-2 focus:ring-[#1A73E8]/30 focus:border-[#1A73E8] transition-all duration-150 text-left"
                        >
                          <span className={deadline ? 'text-[#1E293B]' : 'text-gray-400'}>
                            {deadline ? format(new Date(deadline), 'dd/MM/yyyy') : 'Chọn ngày...'}
                          </span>
                          <CalendarIcon className="h-4 w-4 text-gray-400" />
                        </button>
                      </PopoverTrigger>
                      <PopoverContent className="w-auto p-0 z-[1000] bg-transparent border-none shadow-none overflow-hidden" align="start">
                        <CustomCalendar
                          startDate={deadline ? new Date(deadline) : null}
                          endDate={deadline ? new Date(deadline) : null}
                          onRangeSelect={(start, end) => {
                            const yyyy = start.getFullYear();
                            const mm = String(start.getMonth() + 1).padStart(2, '0');
                            const dd = String(start.getDate()).padStart(2, '0');
                            setDeadline(`${yyyy}-${mm}-${dd}`);
                          }}
                          onCancel={() => {
                            setIsCalendarOpen(false);
                          }}
                          onConfirm={() => {
                            setIsCalendarOpen(false);
                          }}
                        />
                      </PopoverContent>
                    </Popover>
                  </div>

                  {/* Trạng thái */}
                  <div className="space-y-1">
                    <label className="text-xs font-semibold text-[#64748B] block">
                      {editingTask ? 'Trạng thái tổng hợp' : 'Trạng thái ban đầu'}
                    </label>
                    <Select value={status} onValueChange={(val: any) => setStatus(val)}>
                      <SelectTrigger 
                        className={cn(
                          "rounded-xl bg-white/50 border-white/70 focus:ring-2 focus:ring-[#1A73E8]/30",
                          editingTask && "pointer-events-none bg-slate-100 text-slate-500"
                        )}
                      >
                        <SelectValue placeholder="Chọn trạng thái" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="Chưa bắt đầu">Chưa bắt đầu</SelectItem>
                        <SelectItem value="Đang làm">Đang làm</SelectItem>
                        <SelectItem value="Đã xong">Đã xong</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                {editingTask && (
                  <p className="text-[10px] text-[#64748B] italic mt-1 leading-normal">
                    * Trạng thái được tính toán tự động từ tiến độ cá nhân của các thành viên.
                  </p>
                )}
              </div>

              {/* Cột phải: Đối tượng & Liên kết */}
              <div className="space-y-4">
                {/* Cấu hình Đối tượng áp dụng (Target Audience) */}
                <div className="bg-white/30 border border-white/50 rounded-xl p-3.5 space-y-3.5 shadow-xs">
                  <div className="flex items-center gap-1.5 border-b border-white/50 pb-2">
                    <UserCheck size={16} className="text-[#1A73E8]" />
                    <span className="text-xs font-bold text-[#1E293B]">Đối tượng áp dụng nhiệm vụ</span>
                  </div>

                  <div className="grid grid-cols-3 gap-3">
                    {(['HSSV', 'Giáo viên', 'Quản sinh'] as const).map((role) => (
                      <label 
                        key={role} 
                        className={`flex items-center justify-center gap-2 p-2 rounded-xl border cursor-pointer text-xs font-semibold transition-all duration-150 hover:scale-[1.01] ${
                          targetType === role 
                            ? 'bg-blue-50/70 border-[#1A73E8]/50 text-[#1A73E8] shadow-sm' 
                            : 'bg-white/50 border-white/70 text-[#64748B] hover:bg-white/80 hover:text-[#1E293B]'
                        }`}
                      >
                        <input 
                          type="radio" 
                          name="targetType" 
                          value={role} 
                          checked={targetType === role}
                          onChange={() => {
                            setTargetType(role);
                            if (role === 'Quản sinh') {
                              setTargetScope('Tất cả');
                            }
                          }}
                          className="sr-only"
                        />
                        <span>{role}</span>
                      </label>
                    ))}
                  </div>

                  {targetType !== 'Quản sinh' && (
                    <div className="space-y-3 pt-1 animate-in fade-in slide-in-from-top-1 duration-150">
                      {/* Phạm vi áp dụng */}
                      <div className="space-y-1">
                        <label className="text-xs font-semibold text-[#64748B] block">Phạm vi</label>
                        <Select value={targetScope} onValueChange={(val: any) => setTargetScope(val)}>
                          <SelectTrigger className="rounded-xl bg-white/50 border-white/70 focus:ring-2 focus:ring-[#1A73E8]/30">
                            <SelectValue placeholder="Chọn phạm vi" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="Tất cả">Tất cả {targetType}</SelectItem>
                            <SelectItem value="Cụ thể">{targetType} cụ thể</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>

                      {/* Giao diện chọn các ID thật khi scope cụ thể */}
                      {targetScope === 'Cụ thể' && (
                        <div className="space-y-3 pt-2 animate-in fade-in slide-in-from-top-1 duration-150 border-t border-white/40">
                          {isLoadingSpecificData ? (
                            <div className="flex items-center justify-center py-4">
                              <div className="w-5 h-5 border-2 border-blue-500/20 border-t-blue-500 rounded-full animate-spin"></div>
                              <span className="text-xs text-gray-500 ml-2">Đang tải dữ liệu đối tượng...</span>
                            </div>
                          ) : (
                            <>
                              {targetType === 'HSSV' && (
                                <div className="space-y-3">
                                  {/* Chọn lớp học */}
                                  <div className="space-y-1">
                                    <label className="text-xs font-semibold text-[#64748B] block">Chọn Lớp học áp dụng (Có thể chọn nhiều)</label>
                                    <div className="border border-white/70 rounded-xl p-2 bg-white/50 max-h-32 overflow-y-auto space-y-1.5">
                                      {classesList.map((cls) => {
                                        const isChecked = selectedClassIds.includes(cls._id);
                                        return (
                                          <label key={cls._id} className="flex items-center gap-2 text-xs text-[#1E293B] cursor-pointer hover:bg-slate-50 p-1.5 rounded-md">
                                            <input
                                              type="checkbox"
                                              checked={isChecked}
                                              onChange={() => {
                                                if (isChecked) {
                                                  setSelectedClassIds(selectedClassIds.filter(id => id !== cls._id));
                                                } else {
                                                  setSelectedClassIds([...selectedClassIds, cls._id]);
                                                }
                                              }}
                                              className="rounded border-gray-300 text-[#1A73E8] focus:ring-[#1A73E8]"
                                            />
                                            <span>{cls.class_name} ({cls.class_type})</span>
                                          </label>
                                        );
                                      })}
                                      {classesList.length === 0 && <div className="text-xs text-gray-400 p-2">Không có lớp học nào</div>}
                                    </div>
                                  </div>

                                  {/* Chọn học sinh */}
                                  <div className="space-y-1">
                                    <label className="text-xs font-semibold text-[#64748B] block">Chọn Học sinh cụ thể (Không bắt buộc nếu đã chọn lớp)</label>
                                    <div className="border border-white/70 rounded-xl p-2 bg-white/50 max-h-40 overflow-y-auto space-y-1.5">
                                      {studentsList.map((stud) => {
                                        const isChecked = selectedStudentIds.includes(stud._id);
                                        return (
                                          <label key={stud._id} className="flex items-center gap-2 text-xs text-[#1E293B] cursor-pointer hover:bg-slate-50 p-1.5 rounded-md">
                                            <input
                                              type="checkbox"
                                              checked={isChecked}
                                              onChange={() => {
                                                if (isChecked) {
                                                  setSelectedStudentIds(selectedStudentIds.filter(id => id !== stud._id));
                                                } else {
                                                  setSelectedStudentIds([...selectedStudentIds, stud._id]);
                                                }
                                              }}
                                              className="rounded border-gray-300 text-[#1A73E8] focus:ring-[#1A73E8]"
                                            />
                                            <span>{stud.full_name} ({stud.student_code})</span>
                                          </label>
                                        );
                                      })}
                                      {studentsList.length === 0 && <div className="text-xs text-gray-400 p-2">Không có học sinh nào</div>}
                                    </div>
                                  </div>
                                </div>
                              )}

                              {targetType === 'Giáo viên' && (
                                <div className="space-y-1">
                                  <label className="text-xs font-semibold text-[#64748B] block">Chọn Giáo viên áp dụng (Có thể chọn nhiều)</label>
                                  <div className="border border-white/70 rounded-xl p-2 bg-white/50 max-h-40 overflow-y-auto space-y-1.5">
                                    {teachersList.map((teacher) => {
                                      const isChecked = selectedTeacherIds.includes(teacher._id);
                                      return (
                                        <label key={teacher._id} className="flex items-center gap-2 text-xs text-[#1E293B] cursor-pointer hover:bg-slate-50 p-1.5 rounded-md">
                                          <input
                                            type="checkbox"
                                            checked={isChecked}
                                            onChange={() => {
                                              if (isChecked) {
                                                setSelectedTeacherIds(selectedTeacherIds.filter(id => id !== teacher._id));
                                              } else {
                                                setSelectedTeacherIds([...selectedTeacherIds, teacher._id]);
                                              }
                                            }}
                                            className="rounded border-gray-300 text-[#1A73E8] focus:ring-[#1A73E8]"
                                          />
                                          <span>{teacher.user_name || teacher.username} ({teacher.email})</span>
                                        </label>
                                      );
                                    })}
                                    {teachersList.length === 0 && <div className="text-xs text-gray-400 p-2">Không có giáo viên nào hoặc không thể tải danh sách</div>}
                                  </div>
                                </div>
                              )}

                              {/* Mô tả cụ thể / Nhóm */}
                              <div className="space-y-1">
                                <label className="text-xs font-semibold text-[#64748B] block">Tên cụ thể / Nhóm hiển thị</label>
                                <input 
                                  type="text"
                                  required
                                  placeholder={targetType === 'HSSV' ? 'Ví dụ: Lớp K45A, Nguyễn Văn A...' : 'Ví dụ: GV Nguyễn Văn B...'}
                                  value={targetDetail}
                                  onChange={(e) => setTargetDetail(e.target.value)}
                                  className="w-full rounded-xl border border-white/70 bg-white/50 px-2.5 py-1.5 text-xs text-[#1E293B] placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-[#1A73E8]/30 focus:border-[#1A73E8] transition-all duration-150"
                                />
                              </div>
                            </>
                          )}
                        </div>
                      )}
                    </div>
                  )}
                </div>

                {/* Cấu hình Trang liên kết (Linked Route) */}
                <div className="bg-white/30 border border-white/50 rounded-xl p-3.5 space-y-3.5 shadow-xs">
                  <div className="flex items-center gap-1.5 border-b border-white/50 pb-2">
                    <LinkIcon size={15} className="text-[#1A73E8]" />
                    <span className="text-xs font-bold text-[#1E293B]">Trang liên kết nhiệm vụ</span>
                  </div>

                  <div className="space-y-3">
                    <div className="space-y-1">
                      <label className="text-xs font-semibold text-[#64748B] block">Chọn trang đích</label>
                      <Select value={pageSelection} onValueChange={setPageSelection}>
                        <SelectTrigger className="rounded-xl bg-white/50 border-white/70 focus:ring-2 focus:ring-[#1A73E8]/30">
                          <SelectValue placeholder="Chọn trang đích" />
                        </SelectTrigger>
                        <SelectContent>
                          {PRESET_PAGES.map(page => (
                            <SelectItem key={page.value} value={page.value}>
                              {page.label} {page.value !== 'none' ? `(${page.value})` : ''}
                            </SelectItem>
                          ))}
                          <SelectItem value="custom">Nhập trang tùy chỉnh (Custom URL)...</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    {pageSelection === 'custom' && (
                      <div className="space-y-1 animate-in fade-in slide-in-from-top-1 duration-150">
                        <label className="text-xs font-semibold text-[#64748B] block">Nhập đường dẫn trang (Route)</label>
                        <input 
                          type="text"
                          required
                          placeholder="Ví dụ: /students/123, /classes"
                          value={customPageUrl}
                          onChange={(e) => setCustomPageUrl(e.target.value)}
                          className="w-full rounded-xl border border-white/70 bg-white/50 px-2.5 py-1.5 text-xs text-[#1E293B] placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-[#1A73E8]/30 focus:border-[#1A73E8] transition-all duration-150"
                        />
                      </div>
                    )}

                    {/* Hiển thị thông tin phân loại liên kết trang */}
                    {(() => {
                      const currentPath = pageSelection === 'none' 
                        ? '' 
                        : pageSelection === 'custom' 
                          ? customPageUrl 
                          : pageSelection;
                      const linkMode = getLinkedTaskMode(currentPath);

                      if (linkMode === 'none') {
                        return (
                          <p className="text-[11px] text-gray-500 italic mt-1 leading-relaxed">
                            * Nhiệm vụ không gắn trang (checklist): Người thực hiện sẽ tự cập nhật trạng thái thủ công trên danh sách nhiệm vụ.
                          </p>
                        );
                      }
                      if (linkMode === 'auto') {
                        return (
                          <p className="text-[11px] text-[#10B981] font-medium mt-1 leading-relaxed flex items-start gap-1">
                            <span className="w-1.5 h-1.5 rounded-full bg-[#10B981] shrink-0 mt-1"></span>
                            <span>Nhiệm vụ tự động đồng bộ: Trạng thái sẽ tự động chuyển sang "Đang làm" khi bắt đầu thao tác và "Đã xong" khi hoàn thành nghiệp vụ trên trang đích.</span>
                          </p>
                        );
                      }
                      if (linkMode === 'manual') {
                        return (
                          <p className="text-[11px] text-[#F59E0B] font-medium mt-1 leading-relaxed flex items-start gap-1">
                            <span className="w-1.5 h-1.5 rounded-full bg-[#F59E0B] shrink-0 mt-1"></span>
                            <span>Nhiệm vụ liên kết điều hướng: Nhấp vào nhiệm vụ sẽ điều hướng đến trang đích, người thực hiện cần cập nhật trạng thái thủ công.</span>
                          </p>
                        );
                      }
                      return null;
                    })()}
                  </div>
                </div>
              </div>

            </div>
          </div>

          {/* Action Buttons */}
          <div className="pt-4 flex items-center justify-end gap-3 border-t border-white/50 bg-white/40 p-5 shrink-0">
            <button
              type="button"
              onClick={onClose}
              disabled={isSaving}
              className="px-4 py-2 rounded-xl text-sm font-semibold text-[#64748B] hover:bg-white/50 active:scale-[0.98] transition-all duration-150 hover:scale-[1.01] disabled:opacity-40 disabled:cursor-not-allowed"
            >
              Hủy bỏ
            </button>
            <button
              type="submit"
              disabled={isSaving}
              className="px-5 py-2 rounded-xl text-sm font-semibold text-white bg-[#1A73E8] hover:bg-[#155cb4] active:scale-[0.99] transition-all duration-150 hover:scale-[1.01] shadow-sm shadow-blue-500/10 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isSaving ? 'Đang lưu...' : 'Lưu thay đổi'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default AddTaskModal;
