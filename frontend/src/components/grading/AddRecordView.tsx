'use client';
import React, { useState, useEffect } from 'react';
import {
  ArrowLeft, Calendar as CalendarIcon, Loader2, Plus, Trash2, AlertTriangle, FileText, Check, Users, Save, Settings, Sparkles
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { CustomCalendar } from '@/components/calendar/CustomCalendar';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/Input';
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/components/ui/select';
import { format } from 'date-fns';
import { toast } from 'sonner';
import { classApi, Class } from '@/api/class-api';
import { studentApi, Student } from '@/api/student-api';
import { criteriaApi, Criterion } from '@/api/criteria-api';
import { academicRecordApi } from '@/api/academic-record-api';
import { semesterApi } from '@/api/semester-api';
import { summariesPointApi } from '@/api/summaries-point-api';
import { evaluationDetailApi } from '@/api/evaluation-detail-api';

interface ViolationItem {
  student_id: string;
  student_name: string;
  student_code: string;
  evaluation_detail_id: string;
  criterion_name: string;
  points_effect: number;
  class_note: string;
}

export default function AddRecordView({ onBack, onSuccess }: { onBack: () => void, onSuccess?: () => void }) {
  const [classes, setClasses] = useState<Class[]>([]);
  const [allStudents, setAllStudents] = useState<Student[]>([]);
  const [classStudents, setClassStudents] = useState<Student[]>([]);
  const [criteria, setCriteria] = useState<Criterion[]>([]);

  const [isLoadingData, setIsLoadingData] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isStudentsLoading, setIsStudentsLoading] = useState(false);

  // Card Trái (Thông tin cơ bản)
  const [department, setDepartment] = useState('Công nghệ thông tin'); // Khoa mặc định
  const [classId, setClassId] = useState('');
  const [category, setCategory] = useState('ky_luat'); // 'ky_luat' hoặc 'khen_thuong'
  const [criterionId, setCriterionId] = useState('');
  const [reportDate, setReportDate] = useState<Date>(new Date());
  const [isCalendarOpen, setIsCalendarOpen] = useState(false);

  // Card Phải (Ghi nhận sinh viên)
  const [selectedStudentId, setSelectedStudentId] = useState('');
  const [violationNote, setViolationNote] = useState('');
  const [addedViolations, setAddedViolations] = useState<ViolationItem[]>([]);
  const [activeSemesterId, setActiveSemesterId] = useState('60d0fe4f5311236168a109cb');

  // Load classes, students, criteria
  useEffect(() => {
    async function loadData() {
      setIsLoadingData(true);
      try {
        const classList = await classApi.getClasses();
        setClasses(classList);

        const studentList = await studentApi.getStudents();
        setAllStudents(studentList);

        const criteriaList = await criteriaApi.getCriteria();
        setCriteria(criteriaList);

        // Lấy thông tin học kỳ đang hoạt động
        try {
          const semesterList = await semesterApi.getSemesters();
          const activeSem = semesterList.find(s => s.status === 'active');
          if (activeSem) {
            setActiveSemesterId(activeSem._id);
          } else if (semesterList.length > 0) {
            setActiveSemesterId(semesterList[0]._id);
          }
        } catch (semErr) {
          console.warn('Lỗi khi nạp kì học:', semErr);
        }
      } catch (err) {
        console.error('Lỗi nạp dữ liệu:', err);
        toast.error('Không thể nạp dữ liệu ban đầu');
      } finally {
        setIsLoadingData(false);
      }
    }
    loadData();
  }, []);

  // Lọc sinh viên theo lớp học đang chọn
  useEffect(() => {
    if (classId) {
      setIsStudentsLoading(true);
      const timer = setTimeout(() => {
        if (allStudents.length > 0) {
          const filtered = allStudents.filter(s => {
            const sClassId = typeof s.class_id === 'object' ? s.class_id?._id : s.class_id;
            return sClassId === classId;
          });
          setClassStudents(filtered);
        } else {
          setClassStudents([]);
        }
        setIsStudentsLoading(false);
      }, 400); // Tạo trễ nhỏ giả lập loading chuyên nghiệp

      // Reset danh sách ghi nhận tạm nếu đổi lớp
      setAddedViolations([]);
      return () => clearTimeout(timer);
    } else {
      setClassStudents([]);
      setAddedViolations([]);
      setIsStudentsLoading(false);
    }
    setSelectedStudentId('');
    setViolationNote('');
  }, [classId, allStudents]);

  // Lọc danh sách tiêu chí (lấy tất cả không cần qua danh mục)
  const filteredCriteria = criteria;

  // Reset tiêu chí khi đổi danh mục
  useEffect(() => {
    setCriterionId('');
  }, [category]);

  const handleAddViolationToList = () => {
    if (!classId) {
      toast.error('Vui lòng chọn lớp học trước!');
      return;
    }
    if (!criterionId) {
      toast.error('Vui lòng chọn tiêu chí rèn luyện!');
      return;
    }
    if (!selectedStudentId) {
      toast.error('Vui lòng chọn sinh viên!');
      return;
    }

    // Check trùng vi phạm cùng sinh viên
    const isDuplicate = addedViolations.some(
      v => v.student_id === selectedStudentId && v.evaluation_detail_id === criterionId
    );
    if (isDuplicate) {
      toast.error('Sinh viên này đã được ghi nhận tiêu chí này!');
      return;
    }

    const student = classStudents.find(s => s._id === selectedStudentId);
    const criterion = criteria.find(c => c._id === criterionId);

    if (student && criterion) {
      const newViolation: ViolationItem = {
        student_id: student._id,
        student_name: student.full_name,
        student_code: student.student_code,
        evaluation_detail_id: criterion._id,
        criterion_name: criterion.criterion_name,
        points_effect: criterion.score_per_unit || criterion.min_score || -5,
        class_note: violationNote.trim() || 'Không có ghi chú'
      };

      setAddedViolations([...addedViolations, newViolation]);

      // Reset input sinh viên & ghi chú
      setSelectedStudentId('');
      setViolationNote('');
      toast.success('Đã thêm sinh viên vào danh sách tạm!');
    }
  };

  const handleRemoveViolationFromList = (index: number) => {
    setAddedViolations(prev => prev.filter((_, i) => i !== index));
    toast.success('Đã xóa sinh viên khỏi danh sách tạm.');
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (addedViolations.length === 0) {
      toast.error('Vui lòng thêm ít nhất 1 sinh viên vào danh sách ghi nhận!');
      return;
    }

    setIsSaving(true);
    try {
      const summaryList = await summariesPointApi.getSummariesPoints();

      await Promise.all(addedViolations.map(async (violation) => {
        // 1. Tìm hoặc tạo SummaryPoint cho học sinh & kì học
        let studentSummary = summaryList.find(s => {
          const sId = typeof s.student_id === 'object' ? s.student_id?._id : s.student_id;
          const semId = typeof s.semester_id === 'object' ? s.semester_id?._id : s.semester_id;
          return sId === violation.student_id && semId === activeSemesterId;
        });

        if (!studentSummary) {
          studentSummary = await summariesPointApi.createSummariesPoint({
            student_id: violation.student_id,
            semester_id: activeSemesterId,
            total_score: 100,
            grading: 'Xuất sắc',
            status: 'draft'
          });
        }
 
        // 2. Tìm hoặc tạo EvaluationDetail liên kết SummaryPoint và Criterion
        const detailsList = await evaluationDetailApi.getEvaluationDetailsBySummary(studentSummary._id);
        let evalDetail = detailsList.find(d => {
          const cId = typeof d.criterion_id === 'object' ? d.criterion_id?._id : d.criterion_id;
          return cId === violation.evaluation_detail_id;
        });
 
        if (!evalDetail) {
          evalDetail = await evaluationDetailApi.createEvaluationDetail({
            summary_id: studentSummary._id,
            criterion_id: violation.evaluation_detail_id,
            current_count: 0,
            status: 'draft',
            description: `Khởi tạo ghi nhận thủ công`,
            log: []
          });
        }
        // Lưu ý: Không gọi updateEvaluationDetail ở đây nếu đã có evalDetail,
        // vì hàm createAcademicRecord ở dưới sẽ tự động kích hoạt backend cộng thêm 1 vào current_count.

        // 3. Tạo AcademicRecord
        return academicRecordApi.createAcademicRecord({
          student_id: violation.student_id,
          criterion_id: violation.evaluation_detail_id,
          semester_id: activeSemesterId,
          record_title: `${violation.criterion_name} - Ghi chú: ${violation.class_note}`,
          status: 'active',
          recorded_at: reportDate.toISOString()
        });
      }));
      toast.success(`Đã ghi nhận ${addedViolations.length} rèn luyện thành công!`);
      if (onSuccess) {
        onSuccess();
      } else {
        onBack();
      }
    } catch (err) {
      console.error(err);
      toast.error('Có lỗi xảy ra khi lưu ghi nhận!');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="flex flex-col h-full from-[#F4F7FC] to-[#E2EAF4] font-sans w-full overflow-y-auto"
    >
      <div className="flex flex-col gap-[20px] mx-auto w-full">
        {/* Page Header Section */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 w-full">
          <div className="flex gap-[12px] items-center">
            {/* Back Button Pill Glassmorphism using Custom Button */}
            <Button
              type="button"
              variant="ghost"
              onClick={onBack}
              className="backdrop-blur-[6px] bg-white/45 border border-white/40 rounded-[12px] w-[40px] h-[40px] p-0 flex items-center justify-center cursor-pointer hover:bg-white/80 transition-all shadow-[0px_1px_2px_0px_rgba(0,0,0,0.05)] shrink-0"
              title="Quay lại"
            >
              <ArrowLeft className="w-4 h-4 text-slate-700" />
            </Button>

            {/* Figma Icon Block */}
            <div className="hidden xs:flex backdrop-blur-[6px] bg-white/45 border border-white/40 items-center justify-center rounded-[12px] shadow-[0px_1px_2px_0px_rgba(0,0,0,0.05)] shrink-0 w-[40px] h-[40px]">
              <FileText className="w-4 h-4 text-[#005bbf]" />
            </div>

            <div className="flex flex-col items-start min-w-0">
              <h2 className="font-bold text-[20px] lg:text-[23px] text-[#005bbf] leading-tight truncate">
                Thêm Ghi nhận Rèn luyện
              </h2>
              <p className="font-normal text-[#414754] text-[13px] lg:text-[14px] leading-relaxed">
                Ghi nhận khen thưởng hoặc vi phạm của sinh viên
              </p>
            </div>
          </div>
          <div className="flex items-center sm:justify-end shrink-0">
            <div className="bg-[#005bbf]/5 text-[#005bbf] font-bold text-[11px] px-3.5 py-1.5 rounded-full uppercase tracking-wider border border-[#005bbf]/10 flex items-center gap-1.5 shadow-sm bg-white/40 backdrop-blur-sm">
              <Sparkles className="w-3.5 h-3.5 text-[#005bbf] animate-pulse" />
              <span>Hệ thống ghi nhận</span>
            </div>
          </div>
        </div>
        {isLoadingData ? (
          <div className="backdrop-blur-[6px] bg-white/45 border border-white/40 rounded-[16px] p-[40px] shadow-sm flex flex-col items-center justify-center min-h-[250px] gap-3">
            <Loader2 className="w-7 h-7 text-blue-600 animate-spin" />
            <span className="text-[#005bbf] font-semibold text-xs">Đang nạp dữ liệu rèn luyện...</span>
          </div>
        ) : (
          <form onSubmit={handleSave} className="flex flex-col gap-[20px]">
            {/* Main Grid Layout (12 Columns) */}
            <div className="grid grid-cols-12 gap-[20px] w-full relative z-10">

              {/* Left Column: Core Info (col-span-4) */}
              <div className="col-span-12 lg:col-span-4 flex flex-col gap-[20px]">
                {/* Section 1: Thông tin cơ bản */}
                <div className="backdrop-blur-[6px] bg-white/45 border border-white/40 rounded-[16px] p-[22px] lg:p-[26px] shadow-[0px_1px_2px_0px_rgba(0,0,0,0.05)] flex flex-col gap-[16px] w-full">
                  <div className="flex gap-[8px] items-center text-[#005bbf]">
                    <FileText className="w-4.5 h-4.5 shrink-0" />
                    <h3 className="font-bold text-[15px] lg:text-[16px] leading-none">Thông tin cơ bản</h3>
                  </div>

                  <div className="flex flex-col gap-[14px] w-full">
                    {/* Khoa học sử dụng Select Component */}
                    <div className="flex flex-col w-full relative">
                      <Select
                        value={department}
                        onValueChange={setDepartment}
                        label="Khoa"
                        required
                        error={""}
                      >
                        <SelectTrigger className="bg-white/80 border-white/15 h-[40px] rounded-full px-[16px] text-[13.5px] text-slate-800 font-semibold outline-none focus-within:ring-2 focus-within:ring-blue-500/20 focus-within:border-blue-400 transition-all cursor-pointer w-full shadow-sm">
                          <SelectValue placeholder="Chọn Khoa..." />
                        </SelectTrigger>
                        <SelectContent className="bg-white/95 backdrop-blur-md rounded-xl shadow-xl border border-slate-100/60">
                          <SelectItem value="Công nghệ thông tin">Khoa Công nghệ thông tin</SelectItem>
                          <SelectItem value="Điện tử - Viễn thông">Khoa Điện tử - Viễn thông</SelectItem>
                          <SelectItem value="Kinh tế">Khoa Kinh tế</SelectItem>
                          <SelectItem value="Cơ khí">Khoa Cơ khí</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    {/* Lớp học sử dụng Select Component */}
                    <div className="flex flex-col w-full relative">
                      <Select
                        value={classId}
                        onValueChange={setClassId}
                        label="Lớp học"
                        required
                        error={""}
                      >
                        <SelectTrigger className="bg-white/80 border-white/15 h-[40px] rounded-full px-[16px] text-[13.5px] text-slate-800 font-semibold outline-none focus-within:ring-2 focus-within:ring-blue-500/20 focus-within:border-blue-400 transition-all cursor-pointer w-full shadow-sm">
                          <SelectValue placeholder="Chọn lớp học..." />
                        </SelectTrigger>
                        <SelectContent className="bg-white/95 backdrop-blur-md rounded-xl shadow-xl border border-slate-100/60">
                          {classes.map(c => (
                            <SelectItem key={c._id} value={c._id}>{c.class_name}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>


                    {/* Tiêu chí */}
                    <div className="flex flex-col w-full relative">
                      <Select
                        value={criterionId}
                        onValueChange={setCriterionId}
                        label="Tiêu chí ghi nhận"
                        required
                        error={""}
                      >
                        <SelectTrigger className="bg-white/80 border-white/15 h-[40px] rounded-full px-[16px] text-[13.5px] text-slate-800 font-semibold outline-none focus-within:ring-2 focus-within:ring-blue-500/20 focus-within:border-blue-400 transition-all cursor-pointer w-full shadow-sm">
                          <SelectValue placeholder="Chọn tiêu chí..." />
                        </SelectTrigger>
                        <SelectContent className="bg-white/95 backdrop-blur-md rounded-xl shadow-xl border border-slate-100/60 font-sans">
                          {filteredCriteria.map(c => (
                            <SelectItem key={c._id} value={c._id}>{c.criterion_name} ({c.score_per_unit || c.min_score || 0}đ)</SelectItem>
                          ))}
                          {filteredCriteria.length === 0 && (
                            <div className="p-4 text-center text-xs text-slate-400 italic">Không có tiêu chí nào</div>
                          )}
                        </SelectContent>
                      </Select>
                    </div>

                    {/* Ngày báo cáo */}
                    <div className="flex flex-col w-full">
                      <label className="text-[12px] font-medium text-[#414754] mb-1 ml-[4px]">Ngày báo cáo</label>
                      <Popover open={isCalendarOpen} onOpenChange={setIsCalendarOpen}>
                        <PopoverTrigger asChild>
                          <Button
                            type="button"
                            variant="ghost"
                            className="bg-white/80 border border-white/15 h-[40px] rounded-full px-[16px] text-[13.5px] text-slate-800 font-semibold outline-none flex items-center justify-between hover:bg-white focus:ring-2 focus:ring-blue-500/20 transition-all w-full shadow-sm text-left font-sans"
                          >
                            <span>{format(reportDate, 'dd/MM/yyyy')}</span>
                            <CalendarIcon className="w-[16px] h-[16px] text-slate-400 shrink-0" />
                          </Button>
                        </PopoverTrigger>
                        <PopoverContent
                          className="w-auto p-0 z-[100] bg-transparent border-none shadow-none"
                          align="start"
                          side="bottom"
                          sideOffset={6}
                        >
                          <CustomCalendar
                            startDate={reportDate}
                            endDate={null}
                            onRangeSelect={(start) => { if (start) setReportDate(start); }}
                            onCancel={() => setIsCalendarOpen(false)}
                            onConfirm={() => setIsCalendarOpen(false)}
                          />
                        </PopoverContent>
                      </Popover>
                    </div>
                  </div>
                </div>
              </div>

              {/* Right Column: Violations Section (col-span-8) */}
              <div className="col-span-12 lg:col-span-8 flex flex-col gap-[20px]">
                <div className="backdrop-blur-[6px] bg-white/45 border border-white/40 rounded-[16px] p-[22px] lg:p-[26px] shadow-[0px_1px_2px_0px_rgba(0,0,0,0.05)] flex flex-col gap-[16px] w-full">
                  <div className="flex gap-[8px] items-center text-[#005bbf]">
                    <AlertTriangle className="w-4.5 h-4.5 shrink-0" />
                    <h3 className="font-bold text-[15px] lg:text-[16px] leading-none">Ghi nhận sinh viên</h3>
                  </div>

                  {/* Entry Form: Kính mờ gọn gàng */}
                  <div className="backdrop-blur-[6px] bg-white/40 border border-white/30 rounded-[12px] p-[14px] w-full">
                    <div className="grid grid-cols-12 gap-[12px] w-full">
                      {/* Họ tên sinh viên sử dụng Select Component */}
                      <div className="col-span-12 md:col-span-6 flex flex-col items-start w-full relative">
                        <Select
                          value={selectedStudentId}
                          onValueChange={setSelectedStudentId}
                          label="Họ tên sinh viên"
                          error={""}
                        >
                          <SelectTrigger
                            className="bg-white/80 border-white/15 h-[38px] rounded-full px-[14px] text-[12.5px] text-slate-800 font-semibold outline-none w-full shadow-sm focus-within:ring-2 focus-within:ring-blue-500/20 transition-all cursor-pointer font-sans"
                            disabled={!classId}
                          >
                            <SelectValue placeholder={classId ? "Tìm tên..." : "Vui lòng chọn lớp trước..."} />
                          </SelectTrigger>
                          <SelectContent lazyLoad className="bg-white/95 backdrop-blur-md rounded-xl shadow-xl border border-slate-100/60">
                            {classStudents.map(s => (
                              <SelectItem key={s._id} value={s._id}>{s.full_name} ({s.student_code})</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>

                      {/* Ghi chú chi tiết sử dụng Input Component */}
                      <Input
                        type="text"
                        label="Ghi chú"
                        value={violationNote}
                        onChange={(e) => setViolationNote(e.target.value)}
                        placeholder="VD: Vi phạm lần đầu..."
                        className="bg-white/80 border-white/15 h-[38px] rounded-full px-[14px] text-[12.5px] text-slate-800 placeholder:text-slate-400 focus-visible:ring-2 focus-visible:ring-blue-500/20 focus-visible:bg-white/90 focus-visible:border-blue-400 shadow-sm"
                        containerClassName="col-span-12 md:col-span-6 w-full"
                      />

                      {/* Nút Thêm sử dụng Button Component */}
                      <div className="col-span-12 flex justify-end w-full mt-1">
                        <Button
                          type="button"
                          onClick={handleAddViolationToList}
                          className="bg-[#005bbf] hover:bg-[#004ca0] text-white font-bold h-[36px] px-6 rounded-full shadow-[0px_4px_6px_-1px_rgba(0,91,191,0.1),0px_2px_4px_-2px_rgba(0,91,191,0.1)] flex items-center justify-center gap-2 cursor-pointer transition-all border-none outline-none text-[12px] min-w-[120px]"
                        >
                          <Plus className="w-3.5 h-3.5" />
                          <span>Thêm vào danh sách</span>
                        </Button>
                      </div>
                    </div>
                  </div>

                  {/* Bảng chi tiết ghi nhận */}
                  <div className="w-full overflow-hidden border border-white/30 rounded-[12px] shadow-sm bg-white/20">
                    <table className="w-full text-left border-collapse">
                      <thead className="bg-[#005bbf]/5 border-b border-white/20">
                        <tr>
                          <th className="px-[20px] py-[10px] text-[11px] font-bold text-slate-600 uppercase tracking-wider">Họ tên & MSSV</th>
                          <th className="px-[20px] py-[10px] text-[11px] font-bold text-slate-600 uppercase tracking-wider">Tiêu chí ghi nhận</th>
                          <th className="px-[20px] py-[10px] text-[11px] font-bold text-slate-600 uppercase tracking-wider">Ghi chú</th>
                          <th className="px-[20px] py-[10px] text-[11px] font-bold text-slate-600 uppercase tracking-wider text-center w-[80px]">Hành động</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-white/10">
                        {addedViolations.map((violation, idx) => {
                          const criterion = criteria.find(c => c._id === violation.evaluation_detail_id);
                          const type = criterion?.criterion_type || (violation.points_effect > 0 ? 'cong_diem' : 'ky_luat');

                          let badgeClass = 'bg-blue-50 text-blue-600 border border-blue-100';
                          if (type === 'khen_thuong') {
                            badgeClass = 'bg-emerald-50 text-emerald-600 border border-emerald-100';
                          } else if (type === 'ky_luat') {
                            badgeClass = 'bg-rose-50 text-rose-600 border border-rose-100';
                          }

                          return (
                            <tr key={idx} className="hover:bg-white/15 transition-colors">
                              <td className="px-[20px] py-[12px] font-semibold text-slate-800 text-[13px]">
                                <div className="flex flex-col">
                                  <span>{violation.student_name}</span>
                                  <span className="text-slate-400 text-[10.5px] font-medium">MSSV: {violation.student_code}</span>
                                </div>
                              </td>
                              <td className="px-[20px] py-[12px]">
                                <span className={`font-bold rounded-full px-[10px] py-[3px] text-[11.5px] inline-block tracking-wide ${badgeClass}`}>
                                  {violation.criterion_name}
                                </span>
                              </td>
                              <td className="px-[20px] py-[12px] font-normal text-[#414754] text-[13.5px] max-w-[200px] truncate" title={violation.class_note}>
                                {violation.class_note}
                              </td>
                              <td className="px-[20px] py-[12px] text-center">
                                <Button
                                  type="button"
                                  variant="ghost"
                                  onClick={() => handleRemoveViolationFromList(idx)}
                                  className="w-[28px] h-[28px] rounded-full hover:bg-red-50 hover:text-red-600 p-0 flex items-center justify-center text-rose-500 transition-colors bg-white/50 border border-white/80 shadow-sm outline-none cursor-pointer mx-auto"
                                  title="Xóa ghi nhận"
                                >
                                  <Trash2 className="w-[14px] h-[16px]" />
                                </Button>
                              </td>
                            </tr>
                          );
                        })}

                        {addedViolations.length === 0 && (
                          <tr>
                            <td colSpan={4} className="px-[20px] py-[24px] text-center text-[13px] text-slate-500 italic bg-white/10">
                              Chưa có ghi nhận sinh viên trong danh sách tạm.
                            </td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>

                  {/* Hiển thị sĩ số/tổng hợp xem nhanh */}
                  <div className="flex flex-wrap items-center gap-4 lg:gap-6 text-[12px] font-bold text-slate-500 px-2 mt-1">
                    <div className="flex items-center gap-2">
                      <Users className="w-3.5 h-3.5 text-blue-500" />
                      <span>Tổng số SV ghi nhận: <strong className="text-slate-800">
                        {isStudentsLoading ? (
                          <Loader2 className="inline-block w-3.5 h-3.5 animate-spin text-slate-400 align-middle ml-1" />
                        ) : (
                          `${new Set(addedViolations.map(v => v.student_id)).size} SV`
                        )}
                      </strong></span>
                    </div>
                  </div>

                </div>
              </div>

            </div>

            {/* Footer Actions Panel */}
            <div className="backdrop-blur-[6px] bg-white/45 border border-white/40 rounded-[16px] p-[18px] flex items-center justify-between gap-4 w-full shadow-[0px_1px_2px_0px_rgba(0,0,0,0.05)] relative z-0">
              <div className="hidden sm:flex items-center text-[12.5px] text-[#414754] font-medium italic">
                Hãy kiểm tra kỹ thông tin rèn luyện trước khi lưu.
              </div>

              {/* Action Buttons */}
              <div className="flex gap-[12px] items-center justify-end w-full sm:w-auto ml-auto">
                <Button
                  type="button"
                  variant="outline"
                  onClick={onBack}
                  className="border border-[rgba(0,91,191,0.3)] bg-white/30 hover:bg-white/80 rounded-full px-[32px] py-[10px] text-[#005bbf] font-bold text-[13px] tracking-[0.28px] h-auto"
                >
                  Hủy bỏ
                </Button>

                <Button
                  type="submit"
                  disabled={isSaving}
                  className="relative bg-[#005bbf] text-white font-bold px-[38px] py-[10px] rounded-full shadow-[0px_10px_15px_-3px_rgba(0,91,191,0.3),0px_4px_6px_-4px_rgba(0,91,191,0.3)] hover:bg-[#004ca0] focus:ring-2 focus:ring-blue-500/20 transition-all flex items-center justify-center gap-2 border-none outline-none cursor-pointer text-[13px] tracking-[0.28px] h-auto disabled:opacity-75 disabled:cursor-not-allowed"
                >
                  {isSaving ? (
                    <>
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      <span>Đang lưu...</span>
                    </>
                  ) : (
                    <>
                      <Save className="w-3.5 h-3.5" />
                      <span>Lưu ghi nhận</span>
                    </>
                  )}
                </Button>
              </div>
            </div>

          </form>
        )}
      </div>
    </motion.div>
  );
}
