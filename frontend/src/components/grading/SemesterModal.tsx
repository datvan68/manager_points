'use client';

import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Calendar, X, Edit2, Trash2, Clock, Settings, Users, Sparkles, Plus, GraduationCap, ChevronRight, AlertCircle, CalendarRange } from 'lucide-react';
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/components/ui/select';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { CustomCalendar } from '@/components/calendar/CustomCalendar';
import { toast } from 'sonner';
import { semesterApi, Semester } from '../../api/semester-api';
import { evaluationPeriodApi } from '../../api/evaluation-period-api';

interface SemesterModalProps {
  isOpen: boolean;
  onClose: () => void;
  apiSemesters: Semester[];
  onRefreshSemesters: (updatedSemesters: Semester[]) => void;
  selectedSemester: string;
  setSelectedSemester: (val: string) => void;
}

const phases = [
  { id: 'pending', name: 'Chuẩn bị', desc: 'Chưa bắt đầu', icon: Clock, color: 'from-slate-400 to-slate-500', bgLight: 'bg-slate-50 text-slate-600 border-slate-200' },
  { id: 'sv_phase', name: 'Sinh viên', desc: 'SV tự chấm', icon: Users, color: 'from-blue-500 to-indigo-500', bgLight: 'bg-blue-50 text-blue-600 border-blue-100' },
  { id: 'gv_phase', name: 'Cố vấn', desc: 'Cố vấn duyệt', icon: Edit2, color: 'from-purple-500 to-indigo-500', bgLight: 'bg-purple-50 text-purple-600 border-purple-100' },
  { id: 'admin_phase', name: 'Hội đồng', desc: 'Duyệt chốt', icon: GraduationCap, color: 'from-amber-500 to-orange-500', bgLight: 'bg-amber-50 text-amber-600 border-amber-100' },
  { id: 'closed', name: 'Đóng kỳ', desc: 'Kết thúc', icon: X, color: 'from-rose-500 to-red-500', bgLight: 'bg-rose-50 text-rose-600 border-rose-100' }
];

export default function SemesterModal({
  isOpen,
  onClose,
  apiSemesters,
  onRefreshSemesters,
  selectedSemester,
  setSelectedSemester
}: SemesterModalProps) {
  const [isCalendarOpen, setIsCalendarOpen] = useState(false);
  const [isSvCalendarOpen, setIsSvCalendarOpen] = useState(false);
  const [isGvCalendarOpen, setIsGvCalendarOpen] = useState(false);
  const [isAdminCalendarOpen, setIsAdminCalendarOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<'info' | 'period'>('info');
  const [semesterForm, setSemesterForm] = useState({
    _id: '',
    semester_name: '',
    start_date: '',
    end_date: '',
    status: 'active'
  });
  
  const [periodForm, setPeriodForm] = useState({
    _id: '',
    status: 'pending',
    sv_deadline: '',
    gv_deadline: '',
    admin_deadline: ''
  });

  const loadPeriodForSemester = async (semesterId: string) => {
    try {
      const periods = await evaluationPeriodApi.getEvaluationPeriods();
      const found = periods.find(p => {
        const semId = typeof p.semester_id === 'object' ? p.semester_id?._id : p.semester_id;
        return semId === semesterId;
      });
      if (found) {
        setPeriodForm({
          _id: found._id,
          status: found.status,
          sv_deadline: found.sv_deadline ? found.sv_deadline.substring(0, 10) : '',
          gv_deadline: found.gv_deadline ? found.gv_deadline.substring(0, 10) : '',
          admin_deadline: found.admin_deadline ? found.admin_deadline.substring(0, 10) : ''
        });
      } else {
        setPeriodForm({
          _id: '',
          status: 'pending',
          sv_deadline: '',
          gv_deadline: '',
          admin_deadline: ''
        });
      }
    } catch (error) {
      console.error('Lỗi khi tải kỳ đánh giá:', error);
    }
  };

  const handleSavePeriod = async () => {
    if (!semesterForm._id) return;
    if (!periodForm.sv_deadline || !periodForm.gv_deadline || !periodForm.admin_deadline) {
      toast.error('Vui lòng nhập đầy đủ thời hạn cho các giai đoạn!');
      return;
    }
    try {
      if (periodForm._id) {
        await evaluationPeriodApi.updateEvaluationPeriod(periodForm._id, {
          status: periodForm.status as any,
          sv_deadline: new Date(periodForm.sv_deadline).toISOString(),
          gv_deadline: new Date(periodForm.gv_deadline).toISOString(),
          admin_deadline: new Date(periodForm.admin_deadline).toISOString()
        });
        toast.success('Cập nhật kỳ đánh giá thành công!');
      } else {
        const newPeriod = await evaluationPeriodApi.createEvaluationPeriod({
          semester_id: semesterForm._id,
          status: periodForm.status as any,
          sv_deadline: new Date(periodForm.sv_deadline).toISOString(),
          gv_deadline: new Date(periodForm.gv_deadline).toISOString(),
          admin_deadline: new Date(periodForm.admin_deadline).toISOString()
        });
        setPeriodForm(prev => ({ ...prev, _id: newPeriod._id }));
        toast.success('Thiết lập kỳ đánh giá mới thành công!');
      }
    } catch (error: any) {
      toast.error('Lỗi khi lưu kỳ đánh giá: ' + error.message);
    }
  };

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

  const handleOpenSemesterForm = (sem?: any) => {
    setActiveTab('info');
    if (sem) {
      setSemesterForm({
        _id: sem._id,
        semester_name: sem.semester_name,
        start_date: sem.start_date ? sem.start_date.substring(0, 10) : '',
        end_date: sem.end_date ? sem.end_date.substring(0, 10) : '',
        status: sem.status || 'active'
      });
      loadPeriodForSemester(sem._id);
    } else {
      setSemesterForm({
        _id: '',
        semester_name: '',
        start_date: '',
        end_date: '',
        status: 'active'
      });
      setPeriodForm({
        _id: '',
        status: 'pending',
        sv_deadline: '',
        gv_deadline: '',
        admin_deadline: ''
      });
    }
  };

  const handleSaveSemester = async () => {
    if (!semesterForm.semester_name || !semesterForm.start_date || !semesterForm.end_date) {
      toast.error('Vui lòng điền đầy đủ thông tin học kỳ!');
      return;
    }
    try {
      if (semesterForm._id) {
        await semesterApi.updateSemester(semesterForm._id, {
          semester_name: semesterForm.semester_name,
          start_date: semesterForm.start_date,
          end_date: semesterForm.end_date,
          status: semesterForm.status as any
        });
        toast.success('Cập nhật học kỳ thành công!');
      } else {
        await semesterApi.createSemester({
          semester_name: semesterForm.semester_name,
          start_date: semesterForm.start_date,
          end_date: semesterForm.end_date,
          status: semesterForm.status as any
        });
        toast.success('Thêm học kỳ mới thành công!');
      }
      
      const updatedSemesters = await semesterApi.getSemesters();
      onRefreshSemesters(updatedSemesters || []);
      
      setSemesterForm({
        _id: '',
        semester_name: '',
        start_date: '',
        end_date: '',
        status: 'active'
      });
    } catch (error: any) {
      toast.error('Lỗi khi lưu học kỳ: ' + error.message);
    }
  };

  const handleDeleteSemester = async (id: string) => {
    if (!confirm('Bạn có chắc chắn muốn xóa học kỳ này không?')) return;
    try {
      await semesterApi.deleteSemester(id);
      toast.success('Xóa học kỳ thành công!');
      
      const updatedSemesters = await semesterApi.getSemesters();
      onRefreshSemesters(updatedSemesters || []);
      if (selectedSemester === id) {
        setSelectedSemester('');
      }
    } catch (error: any) {
      toast.error('Lỗi khi xóa học kỳ: ' + error.message);
    }
  };

  // Tự động load hoặc reset form khi modal thay đổi trạng thái
  useEffect(() => {
    if (isOpen) {
      handleOpenSemesterForm();
    }
  }, [isOpen]);

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          {/* Overlay - Glassmorphism */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="absolute inset-0 bg-slate-950/60 backdrop-blur-md"
          />

          {/* Content Box */}
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 20 }}
            transition={{ type: 'spring', damping: 25, stiffness: 350 }}
            className="bg-white rounded-[24px] w-full max-w-[850px] h-[580px] shadow-[0_20px_50px_rgba(0,0,0,0.15)] relative z-10 overflow-hidden flex flex-col border border-slate-100"
          >
            {/* Header with elegant subtle gradient */}
            <div className="px-6 py-4.5 border-b border-slate-100 flex items-center justify-between shrink-0 bg-gradient-to-r from-blue-50/50 via-white to-indigo-50/20">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-blue-500/10 flex items-center justify-center text-blue-600">
                  <Calendar size={18} className="animate-pulse" />
                </div>
                <div>
                  <h3 className="font-bold text-slate-800 text-[16px]">Quản lý Học kỳ</h3>
                  <p className="text-[11px] text-slate-400 font-medium mt-0.5">Thiết lập học kỳ giảng dạy và kỳ rèn luyện tương ứng</p>
                </div>
              </div>
              <button
                onClick={onClose}
                className="w-8 h-8 rounded-full hover:bg-slate-100 text-slate-400 hover:text-slate-600 transition-all flex items-center justify-center cursor-pointer border border-transparent hover:border-slate-200/50"
              >
                <X size={16} />
              </button>
            </div>

            {/* Body (Split columns) */}
            <div className="flex-1 overflow-hidden flex divide-x divide-slate-100">
              {/* Left side: Semester List */}
              <div className="w-[45%] h-full p-5 overflow-y-auto flex flex-col gap-3 custom-scrollbar bg-slate-50/30">
                <div className="flex items-center justify-between mb-1">
                  <h4 className="font-bold text-[11px] text-slate-400 uppercase tracking-widest">
                    Danh sách học kỳ ({apiSemesters.length})
                  </h4>
                  <button
                    onClick={() => handleOpenSemesterForm()}
                    className="text-[11px] font-bold text-blue-600 hover:text-blue-700 flex items-center gap-1 cursor-pointer transition-colors"
                  >
                    <Plus size={12} /> Tạo mới
                  </button>
                </div>

                {apiSemesters.length === 0 ? (
                  <div className="text-center py-16 text-slate-400 text-[13px] flex flex-col items-center gap-3">
                    <CalendarRange size={32} className="text-slate-300 stroke-[1.5]" />
                    <span>Chưa có học kỳ nào được tạo.</span>
                  </div>
                ) : (
                  <div className="flex flex-col gap-2.5">
                    {apiSemesters.map(sem => {
                      const isSelected = semesterForm._id === sem._id;
                      return (
                        <motion.div
                          key={sem._id}
                          layoutId={`sem-${sem._id}`}
                          onClick={() => handleOpenSemesterForm(sem)}
                          className={`p-3.5 rounded-xl border flex flex-col gap-1 transition-all group relative cursor-pointer ${
                            isSelected 
                              ? 'border-blue-500 bg-gradient-to-br from-blue-50/20 to-indigo-50/20 shadow-[0_4px_16px_rgba(59,130,246,0.06)]' 
                              : 'border-slate-200/60 hover:border-slate-300 bg-white shadow-[0_2px_8px_rgba(0,0,0,0.01)]'
                          }`}
                        >
                          <div className="font-bold text-[13.5px] text-slate-800 pr-12 group-hover:text-blue-600 transition-colors">
                            {sem.semester_name}
                          </div>
                          <div className="text-[11px] text-slate-400 font-semibold flex items-center gap-1.5 mt-0.5">
                            <Clock size={11.5} className="text-slate-300" />
                            {sem.start_date ? sem.start_date.substring(0, 10) : ''} → {sem.end_date ? sem.end_date.substring(0, 10) : ''}
                          </div>
                          <div className="flex items-center justify-between mt-2.5">
                            <div className="flex items-center gap-1.5">
                              {sem.status === 'active' && (
                                <span className="relative flex h-2 w-2">
                                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                                  <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
                                </span>
                              )}
                              <span className={`px-2.5 py-0.5 rounded-full text-[8.5px] font-extrabold uppercase tracking-wider ${
                                sem.status === 'active' 
                                  ? 'bg-emerald-50 text-emerald-700 border border-emerald-100/60' 
                                  : sem.status === 'upcoming'
                                    ? 'bg-amber-50 text-amber-700 border border-amber-100/60'
                                    : 'bg-slate-100 text-slate-500 border border-slate-200/50'
                              }`}>
                                {sem.status === 'active' ? 'Hoạt động' : sem.status === 'upcoming' ? 'Sắp diễn ra' : 'Đã ẩn'}
                              </span>
                            </div>
                            <ChevronRight size={13} className={`text-slate-300 group-hover:text-blue-500 transition-all ${isSelected ? 'translate-x-0.5 text-blue-500' : ''}`} />
                          </div>

                          {/* Action Buttons with subtle hover glow */}
                          <div className="absolute right-3.5 top-3.5 opacity-0 group-hover:opacity-100 transition-opacity flex gap-1 bg-white/90 backdrop-blur-[2px] p-1 rounded-lg border border-slate-100 shadow-sm" onClick={(e) => e.stopPropagation()}>
                            <button
                              onClick={() => handleOpenSemesterForm(sem)}
                              className="p-1.5 rounded-md text-slate-500 hover:text-blue-600 hover:bg-slate-50 transition-all cursor-pointer"
                              title="Sửa học kỳ"
                            >
                              <Edit2 size={12} />
                            </button>
                            <button
                              onClick={() => handleDeleteSemester(sem._id)}
                              className="p-1.5 rounded-md text-slate-500 hover:text-rose-600 hover:bg-slate-50 transition-all cursor-pointer"
                              title="Xóa học kỳ"
                            >
                              <Trash2 size={12} />
                            </button>
                          </div>
                        </motion.div>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* Right side: Add/Edit Form */}
              <div className="w-[55%] h-full p-6 overflow-y-auto flex flex-col justify-between">
                <div className="flex flex-col gap-5">
                  <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                    <h4 className="font-bold text-[14px] text-slate-800 flex items-center gap-1.5">
                      <Sparkles size={14} className="text-amber-500" />
                      {semesterForm._id ? 'Cập nhật Học kỳ' : 'Thêm Học kỳ mới'}
                    </h4>
                    {semesterForm._id && (
                      <span className="text-[11px] font-bold text-slate-400 bg-slate-100 px-2 py-0.5 rounded-md">ID: {semesterForm._id.substring(semesterForm._id.length - 6)}</span>
                    )}
                  </div>

                  {/* Tabs Slider logic using Framer Motion */}
                  {semesterForm._id && (
                    <div className="flex bg-slate-100 rounded-xl p-1 gap-1 w-full border border-slate-200/20 relative">
                      <button
                        type="button"
                        onClick={() => setActiveTab('info')}
                        className={`flex-1 py-1.5 rounded-lg text-[12px] font-bold transition-all relative z-10 cursor-pointer ${
                          activeTab === 'info' ? 'text-blue-600' : 'text-slate-500 hover:text-slate-700'
                        }`}
                      >
                        {activeTab === 'info' && (
                          <motion.span layoutId="tab-pill" className="absolute inset-0 bg-white rounded-lg shadow-sm z-[-1]" />
                        )}
                        Thông tin học kỳ
                      </button>
                      <button
                        type="button"
                        onClick={() => setActiveTab('period')}
                        className={`flex-1 py-1.5 rounded-lg text-[12px] font-bold transition-all relative z-10 cursor-pointer ${
                          activeTab === 'period' ? 'text-blue-600' : 'text-slate-500 hover:text-slate-700'
                        }`}
                      >
                        {activeTab === 'period' && (
                          <motion.span layoutId="tab-pill" className="absolute inset-0 bg-white rounded-lg shadow-sm z-[-1]" />
                        )}
                        Kỳ đánh giá rèn luyện
                      </button>
                    </div>
                  )}

                  {activeTab === 'info' ? (
                    <div className="flex flex-col gap-4">
                      {/* Semester Name */}
                      <div className="flex flex-col gap-1.5">
                        <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                          Tên học kỳ
                        </label>
                        <input
                          type="text"
                          placeholder="Ví dụ: Học kỳ 1 - 2025-2026"
                          className="w-full bg-slate-50/60 border border-slate-100 focus:border-blue-500 focus:bg-white focus:ring-4 focus:ring-blue-500/10 rounded-xl px-4 py-2.5 text-[13px] font-medium placeholder:text-gray-400 transition-all outline-none"
                          value={semesterForm.semester_name}
                          onChange={(e) => setSemesterForm({ ...semesterForm, semester_name: e.target.value })}
                        />
                      </div>

                      {/* Dates (CustomCalendar) */}
                      <div className="flex flex-col gap-1.5">
                        <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                          Thời gian diễn ra học kỳ
                        </label>
                        <Popover open={isCalendarOpen} onOpenChange={setIsCalendarOpen}>
                          <PopoverTrigger asChild>
                            <button 
                              type="button"
                              className="w-full bg-slate-50/60 border border-slate-100 rounded-xl px-4 py-2.5 text-[13px] font-medium text-slate-700 hover:bg-slate-100/40 focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 transition-all outline-none text-left flex items-center justify-between cursor-pointer h-[42px]"
                            >
                              <span>
                                {semesterForm.start_date && semesterForm.end_date
                                  ? `${formatDateToDisplay(semesterForm.start_date)} → ${formatDateToDisplay(semesterForm.end_date)}`
                                  : 'Chọn thời gian học kỳ'}
                              </span>
                              <Calendar size={15} className="text-slate-400" />
                            </button>
                          </PopoverTrigger>
                          <PopoverContent 
                            className="w-auto p-0 z-[100] bg-transparent border-none shadow-none" 
                            align="start"
                            side="bottom"
                            sideOffset={6}
                          >
                            <CustomCalendar 
                              startDate={semesterForm.start_date ? new Date(semesterForm.start_date) : null}
                              endDate={semesterForm.end_date ? new Date(semesterForm.end_date) : null}
                              onRangeSelect={(start, end) => {
                                setSemesterForm({
                                  ...semesterForm,
                                  start_date: formatDateToString(start),
                                  end_date: formatDateToString(end)
                                });
                              }}
                              onCancel={() => {
                                setSemesterForm({
                                  ...semesterForm,
                                  start_date: '',
                                  end_date: ''
                                });
                                setIsCalendarOpen(false);
                              }}
                              onConfirm={() => setIsCalendarOpen(false)}
                            />
                          </PopoverContent>
                        </Popover>
                      </div>

                      {/* Status */}
                      <div className="flex flex-col gap-1.5">
                        <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                          Trạng thái học kỳ
                        </label>
                        <Select
                          value={semesterForm.status}
                          onValueChange={(val: any) => setSemesterForm({ ...semesterForm, status: val })}
                        >
                          <SelectTrigger className="h-[42px] bg-slate-55 border border-slate-100 bg-slate-50/60 rounded-xl text-[13px] font-medium text-slate-700 focus-within:bg-white focus-within:ring-4 focus-within:ring-blue-500/10 transition-all shadow-none">
                            <SelectValue placeholder="Chọn trạng thái" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="active">Hoạt động (Active)</SelectItem>
                            <SelectItem value="upcoming">Sắp diễn ra (Upcoming)</SelectItem>
                            <SelectItem value="inactive">Đã ẩn (Inactive)</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                  ) : (
                    <div className="flex flex-col gap-5">
                      {/* Stepper Timeline for Evaluation Phases */}
                      <div className="flex flex-col gap-2">
                        <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                          Bản đồ Giai đoạn đánh giá
                        </label>
                        <div className="flex items-center justify-between bg-slate-50 border border-slate-200/50 p-3 rounded-2xl gap-1.5 overflow-x-auto">
                          {phases.map((phase, index) => {
                            const isCurrent = periodForm.status === phase.id;
                            const PhaseIcon = phase.icon;
                            return (
                              <React.Fragment key={phase.id}>
                                <button
                                  type="button"
                                  onClick={() => setPeriodForm({ ...periodForm, status: phase.id })}
                                  className={`flex flex-col items-center gap-1 cursor-pointer group transition-all shrink-0 p-1.5 rounded-xl ${
                                    isCurrent 
                                      ? 'scale-105' 
                                      : 'opacity-50 hover:opacity-85'
                                  }`}
                                  title={`${phase.name}: ${phase.desc}`}
                                >
                                  <div className={`w-8.5 h-8.5 rounded-full flex items-center justify-center border transition-all ${
                                    isCurrent 
                                      ? `bg-gradient-to-br ${phase.color} text-white border-transparent shadow-[0_4px_10px_rgba(59,130,246,0.2)]` 
                                      : 'bg-white text-slate-500 border-slate-200'
                                  }`}>
                                    <PhaseIcon size={14} className={isCurrent ? 'animate-pulse' : ''} />
                                  </div>
                                  <span className={`text-[9.5px] font-bold ${isCurrent ? 'text-slate-800' : 'text-slate-500'}`}>
                                    {phase.name}
                                  </span>
                                </button>
                                {index < phases.length - 1 && (
                                  <div className="h-[1.5px] flex-1 bg-slate-200 min-w-[15px]" />
                                )}
                              </React.Fragment>
                            );
                          })}
                        </div>
                      </div>

                      {/* Info Alert Box */}
                      <div className={`flex items-start gap-2.5 p-3 rounded-xl border ${
                        phases.find(p => p.id === periodForm.status)?.bgLight || 'bg-slate-50 text-slate-600 border-slate-200'
                      }`}>
                        <AlertCircle size={15} className="shrink-0 mt-0.5" />
                        <div className="flex flex-col gap-0.5">
                          <span className="text-[11px] font-extrabold uppercase tracking-wide">
                            Giai đoạn: {phases.find(p => p.id === periodForm.status)?.name}
                          </span>
                          <span className="text-[11px] font-medium leading-relaxed">
                            {phases.find(p => p.id === periodForm.status)?.desc}. Hệ thống sẽ khóa hoặc mở quyền tương ứng với thời hạn thiết lập dưới đây.
                          </span>
                        </div>
                      </div>

                      {/* SV Deadline */}
                      <div className="flex flex-col gap-1.5">
                        <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                          Hạn chót Sinh viên tự chấm (SV Deadline)
                        </label>
                        <Popover open={isSvCalendarOpen} onOpenChange={setIsSvCalendarOpen}>
                          <PopoverTrigger asChild>
                            <button
                              type="button"
                              className="w-full bg-slate-50/60 border border-slate-100 rounded-xl px-4 py-2.5 text-[13px] font-medium text-slate-700 hover:bg-slate-100/40 focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 transition-all outline-none text-left flex items-center justify-between cursor-pointer h-[42px]"
                            >
                              <span>
                                {periodForm.sv_deadline ? formatDateToDisplay(periodForm.sv_deadline) : 'Chọn hạn chót'}
                              </span>
                              <Calendar size={15} className="text-slate-400" />
                            </button>
                          </PopoverTrigger>
                          <PopoverContent
                            className="w-auto p-0 z-[100] bg-transparent border-none shadow-none"
                            align="start"
                            side="bottom"
                            sideOffset={6}
                          >
                            <CustomCalendar
                              startDate={periodForm.sv_deadline ? new Date(periodForm.sv_deadline) : null}
                              endDate={null}
                              onRangeSelect={(start) => {
                                setPeriodForm({
                                  ...periodForm,
                                  sv_deadline: formatDateToString(start)
                                });
                              }}
                              onCancel={() => {
                                setPeriodForm({
                                  ...periodForm,
                                  sv_deadline: ''
                                });
                                setIsSvCalendarOpen(false);
                              }}
                              onConfirm={() => setIsSvCalendarOpen(false)}
                            />
                          </PopoverContent>
                        </Popover>
                      </div>

                      {/* GV Deadline */}
                      <div className="flex flex-col gap-1.5">
                        <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                          Hạn chót Cố vấn chấm (GV Deadline)
                        </label>
                        <Popover open={isGvCalendarOpen} onOpenChange={setIsGvCalendarOpen}>
                          <PopoverTrigger asChild>
                            <button
                              type="button"
                              className="w-full bg-slate-50/60 border border-slate-100 rounded-xl px-4 py-2.5 text-[13px] font-medium text-slate-700 hover:bg-slate-100/40 focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 transition-all outline-none text-left flex items-center justify-between cursor-pointer h-[42px]"
                            >
                              <span>
                                {periodForm.gv_deadline ? formatDateToDisplay(periodForm.gv_deadline) : 'Chọn hạn chót'}
                              </span>
                              <Calendar size={15} className="text-slate-400" />
                            </button>
                          </PopoverTrigger>
                          <PopoverContent
                            className="w-auto p-0 z-[100] bg-transparent border-none shadow-none"
                            align="start"
                            side="bottom"
                            sideOffset={6}
                          >
                            <CustomCalendar
                              startDate={periodForm.gv_deadline ? new Date(periodForm.gv_deadline) : null}
                              endDate={null}
                              onRangeSelect={(start) => {
                                setPeriodForm({
                                  ...periodForm,
                                  gv_deadline: formatDateToString(start)
                                });
                              }}
                              onCancel={() => {
                                setPeriodForm({
                                  ...periodForm,
                                  gv_deadline: ''
                                });
                                setIsGvCalendarOpen(false);
                              }}
                              onConfirm={() => setIsGvCalendarOpen(false)}
                            />
                          </PopoverContent>
                        </Popover>
                      </div>

                      {/* Admin Deadline */}
                      <div className="flex flex-col gap-1.5">
                        <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                          Hạn chót Hội đồng phê duyệt (Admin Deadline)
                        </label>
                        <Popover open={isAdminCalendarOpen} onOpenChange={setIsAdminCalendarOpen}>
                          <PopoverTrigger asChild>
                            <button
                              type="button"
                              className="w-full bg-slate-50/60 border border-slate-100 rounded-xl px-4 py-2.5 text-[13px] font-medium text-slate-700 hover:bg-slate-100/40 focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 transition-all outline-none text-left flex items-center justify-between cursor-pointer h-[42px]"
                            >
                              <span>
                                {periodForm.admin_deadline ? formatDateToDisplay(periodForm.admin_deadline) : 'Chọn hạn chót'}
                              </span>
                              <Calendar size={15} className="text-slate-400" />
                            </button>
                          </PopoverTrigger>
                          <PopoverContent
                            className="w-auto p-0 z-[100] bg-transparent border-none shadow-none"
                            align="start"
                            side="bottom"
                            sideOffset={6}
                          >
                            <CustomCalendar
                              startDate={periodForm.admin_deadline ? new Date(periodForm.admin_deadline) : null}
                              endDate={null}
                              onRangeSelect={(start) => {
                                setPeriodForm({
                                  ...periodForm,
                                  admin_deadline: formatDateToString(start)
                                });
                              }}
                              onCancel={() => {
                                setPeriodForm({
                                  ...periodForm,
                                  admin_deadline: ''
                                });
                                setIsAdminCalendarOpen(false);
                              }}
                              onConfirm={() => setIsAdminCalendarOpen(false)}
                            />
                          </PopoverContent>
                        </Popover>
                      </div>
                    </div>
                  )}
                </div>

                {/* Form actions */}
                <div className="flex items-center justify-end gap-2.5 pt-4 mt-6 border-t border-slate-50 shrink-0">
                  {activeTab === 'info' ? (
                    <>
                      {semesterForm._id && (
                        <button
                          type="button"
                          onClick={() => handleOpenSemesterForm()}
                          className="px-4 py-2.5 rounded-xl text-[12.5px] font-bold text-slate-500 hover:bg-slate-50 transition-colors cursor-pointer flex items-center gap-1.5 border border-transparent hover:border-slate-100"
                        >
                          <Plus size={14} /> Tạo mới
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={handleSaveSemester}
                        className="px-6 py-2.5 rounded-xl text-[12.5px] font-bold text-white bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 transition-all shadow-[0_4px_16px_rgba(37,99,235,0.2)] hover:shadow-[0_4px_20px_rgba(37,99,235,0.3)] active:scale-[0.98] hover:-translate-y-0.5 cursor-pointer"
                      >
                        Lưu học kỳ
                      </button>
                    </>
                  ) : (
                    <button
                      type="button"
                      onClick={handleSavePeriod}
                      className="px-6 py-2.5 rounded-xl text-[12.5px] font-bold text-white bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 transition-all shadow-[0_4px_16px_rgba(37,99,235,0.2)] hover:shadow-[0_4px_20px_rgba(37,99,235,0.3)] active:scale-[0.98] hover:-translate-y-0.5 cursor-pointer"
                    >
                      Lưu kỳ đánh giá
                    </button>
                  )}
                </div>
              </div>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
