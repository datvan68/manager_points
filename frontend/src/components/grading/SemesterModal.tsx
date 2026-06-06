'use client';

import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Calendar, X, Edit2, Trash2, Clock, Settings } from 'lucide-react';
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

export default function SemesterModal({
  isOpen,
  onClose,
  apiSemesters,
  onRefreshSemesters,
  selectedSemester,
  setSelectedSemester
}: SemesterModalProps) {
  const [isCalendarOpen, setIsCalendarOpen] = useState(false);
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
          {/* Overlay */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="absolute inset-0 bg-slate-900/40 backdrop-blur-[2px]"
          />

          {/* Content Box */}
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 15 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 15 }}
            className="bg-white rounded-2xl w-full max-w-[800px] h-[520px] shadow-2xl relative z-10 overflow-hidden flex flex-col border border-slate-100"
          >
            {/* Header */}
            <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between shrink-0 bg-slate-50/50">
              <div className="flex items-center gap-2">
                <Calendar className="text-[#137fec]" size={20} />
                <h3 className="font-bold text-[#0f172a] text-[16px]">Quản lý Học kỳ</h3>
              </div>
              <button
                onClick={onClose}
                className="p-1.5 rounded-full hover:bg-slate-100 text-slate-400 hover:text-slate-600 transition-all cursor-pointer"
              >
                <X size={18} />
              </button>
            </div>

            {/* Body (Split columns) */}
            <div className="flex-1 overflow-hidden flex divide-x divide-slate-100">
              {/* Left side: Semester List */}
              <div className="w-[45%] h-full p-5 overflow-y-auto flex flex-col gap-3 custom-scrollbar">
                <h4 className="font-bold text-[12px] text-slate-400 uppercase tracking-wider mb-1">
                  Danh sách học kỳ ({apiSemesters.length})
                </h4>
                {apiSemesters.length === 0 ? (
                  <div className="text-center py-10 text-slate-400 text-[13px]">
                    Chưa có học kỳ nào được tạo.
                  </div>
                ) : (
                  apiSemesters.map(sem => (
                    <div
                      key={sem._id}
                      className={`p-3 rounded-xl border flex flex-col gap-1 transition-all group relative ${
                        semesterForm._id === sem._id 
                          ? 'border-[#137fec] bg-blue-50/30' 
                          : 'border-slate-100 hover:border-slate-200 bg-white'
                      }`}
                    >
                      <div className="font-bold text-[14px] text-slate-800 pr-12">
                        {sem.semester_name}
                      </div>
                      <div className="text-[11.5px] text-slate-500 font-medium">
                        {sem.start_date ? sem.start_date.substring(0, 10) : ''} → {sem.end_date ? sem.end_date.substring(0, 10) : ''}
                      </div>
                      <div className="flex items-center gap-1.5 mt-1.5">
                        <span className={`px-2 py-0.5 rounded-full text-[9px] font-bold uppercase tracking-wider ${
                          sem.status === 'active' 
                            ? 'bg-emerald-50 text-emerald-700 border border-emerald-100' 
                            : sem.status === 'upcoming'
                              ? 'bg-amber-50 text-amber-700 border border-amber-100'
                              : 'bg-slate-100 text-slate-500 border border-slate-200/50'
                        }`}>
                          {sem.status === 'active' ? 'Hoạt động' : sem.status === 'upcoming' ? 'Sắp diễn ra' : 'Đã ẩn'}
                        </span>
                      </div>

                      {/* Hover Actions */}
                      <div className="absolute right-2.5 top-1/2 -translate-y-1/2 opacity-0 group-hover:opacity-100 transition-opacity flex gap-1 bg-white/90 backdrop-blur-[1px] p-1 rounded-lg border border-slate-100 shadow-sm">
                        <button
                          onClick={() => handleOpenSemesterForm(sem)}
                          className="p-1 rounded text-slate-500 hover:text-[#137fec] hover:bg-slate-50 transition-colors cursor-pointer"
                          title="Sửa học kỳ"
                        >
                          <Edit2 size={13} />
                        </button>
                        <button
                          onClick={() => handleDeleteSemester(sem._id)}
                          className="p-1 rounded text-slate-500 hover:text-red-600 hover:bg-slate-50 transition-colors cursor-pointer"
                          title="Xóa học kỳ"
                        >
                          <Trash2 size={13} />
                        </button>
                      </div>
                    </div>
                  ))
                )}
              </div>

              {/* Right side: Add/Edit Form */}
              <div className="w-[55%] h-full p-6 overflow-y-auto flex flex-col justify-between">
                <div className="flex flex-col gap-4">
                  <h4 className="font-bold text-[14px] text-slate-800 border-b border-slate-50 pb-2">
                    {semesterForm._id ? 'Cập nhật Học kỳ' : 'Thêm Học kỳ mới'}
                  </h4>

                  {/* Tabs */}
                  {semesterForm._id && (
                    <div className="flex bg-slate-100 rounded-xl p-1 gap-1 w-full border border-slate-200/50">
                      <button
                        type="button"
                        onClick={() => setActiveTab('info')}
                        className={`flex-1 py-1.5 rounded-lg text-[12.5px] font-bold transition-all cursor-pointer ${
                          activeTab === 'info' 
                            ? 'bg-white text-[#137fec] shadow-sm' 
                            : 'text-slate-500 hover:text-slate-700'
                        }`}
                      >
                        Thông tin học kỳ
                      </button>
                      <button
                        type="button"
                        onClick={() => setActiveTab('period')}
                        className={`flex-1 py-1.5 rounded-lg text-[12.5px] font-bold transition-all cursor-pointer ${
                          activeTab === 'period' 
                            ? 'bg-white text-[#137fec] shadow-sm' 
                            : 'text-slate-500 hover:text-slate-700'
                        }`}
                      >
                        Kỳ đánh giá rèn luyện
                      </button>
                    </div>
                  )}

                  {activeTab === 'info' ? (
                    <div className="flex flex-col gap-4">
                      {/* Semester Name */}
                      <div className="flex flex-col gap-1.5">
                        <label className="text-[12px] font-bold text-slate-500 uppercase tracking-wide">
                          Tên học kỳ
                        </label>
                        <input
                          type="text"
                          placeholder="Ví dụ: Học kỳ 1 - 2025-2026"
                          className="w-full bg-slate-50 border-none rounded-xl px-4 py-2.5 text-[13.5px] font-medium placeholder:text-gray-400 focus:bg-white focus:ring-2 focus:ring-blue-100 transition-all outline-none"
                          value={semesterForm.semester_name}
                          onChange={(e) => setSemesterForm({ ...semesterForm, semester_name: e.target.value })}
                        />
                      </div>

                      {/* Dates (CustomCalendar) */}
                      <div className="flex flex-col gap-1.5">
                        <label className="text-[12px] font-bold text-slate-500 uppercase tracking-wide">
                          Thời gian diễn ra học kỳ
                        </label>
                        <Popover open={isCalendarOpen} onOpenChange={setIsCalendarOpen}>
                          <PopoverTrigger asChild>
                            <button 
                              type="button"
                              className="w-full bg-slate-50 border-none rounded-xl px-4 py-2.5 text-[13.5px] font-medium text-slate-700 hover:bg-slate-100/70 transition-all outline-none text-left flex items-center justify-between cursor-pointer h-[42px]"
                            >
                              <span>
                                {semesterForm.start_date && semesterForm.end_date
                                  ? `${formatDateToDisplay(semesterForm.start_date)} → ${formatDateToDisplay(semesterForm.end_date)}`
                                  : 'Chọn thời gian học kỳ'}
                              </span>
                              <Calendar size={16} className="text-slate-400" />
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
                        <label className="text-[12px] font-bold text-slate-500 uppercase tracking-wide">
                          Trạng thái học kỳ
                        </label>
                        <Select
                          value={semesterForm.status}
                          onValueChange={(val: any) => setSemesterForm({ ...semesterForm, status: val })}
                        >
                          <SelectTrigger className="h-[42px] bg-slate-55 border-none bg-slate-50 rounded-xl text-[13px] font-medium text-slate-700 focus-within:bg-white focus-within:ring-2 focus-within:ring-blue-100 transition-all shadow-none">
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
                    <div className="flex flex-col gap-4">
                      {/* Trạng thái kỳ đánh giá */}
                      <div className="flex flex-col gap-1.5">
                        <label className="text-[12px] font-bold text-slate-500 uppercase tracking-wide">
                          Giai đoạn hiện tại
                        </label>
                        <Select
                          value={periodForm.status}
                          onValueChange={(val: any) => setPeriodForm({ ...periodForm, status: val })}
                        >
                          <SelectTrigger className="h-[42px] bg-slate-50 border-none rounded-xl text-[13px] font-medium text-slate-700 focus-within:bg-white focus-within:ring-2 focus-within:ring-blue-100 transition-all shadow-none">
                            <SelectValue placeholder="Chọn giai đoạn" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="pending">Chưa bắt đầu (Pending)</SelectItem>
                            <SelectItem value="sv_phase">Sinh viên tự chấm (SV Phase)</SelectItem>
                            <SelectItem value="gv_phase">Cố vấn học tập chấm (GV Phase)</SelectItem>
                            <SelectItem value="admin_phase">Hội đồng phê duyệt (Admin Phase)</SelectItem>
                            <SelectItem value="closed">Đóng kỳ đánh giá (Closed)</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>

                      {/* SV Deadline */}
                      <div className="flex flex-col gap-1.5">
                        <label className="text-[12px] font-bold text-slate-500 uppercase tracking-wide">
                          Hạn chót Sinh viên tự chấm (SV Deadline)
                        </label>
                        <input
                          type="date"
                          className="w-full bg-slate-50 border-none rounded-xl px-4 py-2.5 text-[13px] font-medium text-slate-700 focus:bg-white focus:ring-2 focus:ring-blue-100 transition-all outline-none"
                          value={periodForm.sv_deadline}
                          onChange={(e) => setPeriodForm({ ...periodForm, sv_deadline: e.target.value })}
                        />
                      </div>

                      {/* GV Deadline */}
                      <div className="flex flex-col gap-1.5">
                        <label className="text-[12px] font-bold text-slate-500 uppercase tracking-wide">
                          Hạn chót Cố vấn chấm (GV Deadline)
                        </label>
                        <input
                          type="date"
                          className="w-full bg-slate-50 border-none rounded-xl px-4 py-2.5 text-[13px] font-medium text-slate-700 focus:bg-white focus:ring-2 focus:ring-blue-100 transition-all outline-none"
                          value={periodForm.gv_deadline}
                          onChange={(e) => setPeriodForm({ ...periodForm, gv_deadline: e.target.value })}
                        />
                      </div>

                      {/* Admin Deadline */}
                      <div className="flex flex-col gap-1.5">
                        <label className="text-[12px] font-bold text-slate-500 uppercase tracking-wide">
                          Hạn chót Hội đồng phê duyệt (Admin Deadline)
                        </label>
                        <input
                          type="date"
                          className="w-full bg-slate-50 border-none rounded-xl px-4 py-2.5 text-[13px] font-medium text-slate-700 focus:bg-white focus:ring-2 focus:ring-blue-100 transition-all outline-none"
                          value={periodForm.admin_deadline}
                          onChange={(e) => setPeriodForm({ ...periodForm, admin_deadline: e.target.value })}
                        />
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
                          className="px-4 py-2 rounded-xl text-[13px] font-bold text-slate-500 hover:bg-slate-50 transition-colors cursor-pointer"
                        >
                          Thêm mới
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={handleSaveSemester}
                        className="px-6 py-2.5 rounded-xl text-[13px] font-bold text-white bg-[#137fec] hover:bg-blue-600 transition-all shadow-[0_4px_12px_rgba(19,127,236,0.15)] active:scale-95 cursor-pointer"
                      >
                        Lưu thay đổi
                      </button>
                    </>
                  ) : (
                    <button
                      type="button"
                      onClick={handleSavePeriod}
                      className="px-6 py-2.5 rounded-xl text-[13px] font-bold text-white bg-[#137fec] hover:bg-blue-600 transition-all shadow-[0_4px_12px_rgba(19,127,236,0.15)] active:scale-95 cursor-pointer"
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
