'use client';
import React, { useState, useEffect } from 'react';
import { ArrowLeft, Calendar as CalendarIcon, Loader2, Plus, Trash2, AlertTriangle, FileText, Check, Users, Save } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { CustomCalendar } from '@/components/calendar/CustomCalendar';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/Input';
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/components/ui/select';
import { format, parse } from 'date-fns';
import { toast } from 'sonner';
import { classApi, Class } from '@/api/class-api';
import { dailyClassReportApi, DailyClassReport } from '@/api/daily-class-report-api';
import { studentApi, Student } from '@/api/student-api';
import { criteriaApi, Criterion } from '@/api/criteria-api';
import { academicRecordApi, AcademicRecord } from '@/api/academic-record-api';

interface ViolationItem {
  student_id: string;
  student_name: string;
  student_code: string;
  evaluation_detail_id: string;
  criterion_name: string;
  points_effect: number;
  class_note: string;
}

interface AddClassReportViewProps {
  onBack: () => void;
  reportToEdit?: DailyClassReport | null;
  onSuccess: () => void;
}

export default function AddClassReportView({ onBack, reportToEdit, onSuccess }: AddClassReportViewProps) {
  const [classes, setClasses] = useState<Class[]>([]);
  const [allStudents, setAllStudents] = useState<Student[]>([]);
  const [classStudents, setClassStudents] = useState<Student[]>([]);
  const [criteria, setCriteria] = useState<Criterion[]>([]);

  const [isLoadingData, setIsLoadingData] = useState(true);
  const [isSaving, setIsSaving] = useState(false);

  // General Info states
  const [classId, setClassId] = useState('');
  const [reportDate, setReportDate] = useState<Date>(new Date());
  const [isCalendarOpen, setIsCalendarOpen] = useState(false);
  const [teacherName, setTeacherName] = useState('');
  const [classNote, setClassNote] = useState('');

  // Sĩ số states (ẩn chỉnh tay, tự động tính toán hoặc cho phép xem)
  const [totalPresent, setTotalPresent] = useState<number>(0);
  const [totalAbsent, setTotalAbsent] = useState<number>(0);

  // Student Violation inputs
  const [selectedStudentId, setSelectedStudentId] = useState('');
  const [selectedCriterionId, setSelectedCriterionId] = useState('');
  const [violationNote, setViolationNote] = useState('');
  const [addedViolations, setAddedViolations] = useState<ViolationItem[]>([]);

  // Load classes, students, criteria and editing data
  useEffect(() => {
    async function loadData() {
      setIsLoadingData(true);
      try {
        const classList = await classApi.getClasses();
        setClasses(classList);

        const studentList = await studentApi.getStudents();
        setAllStudents(studentList);

        const criteriaList = await criteriaApi.getCriteria();
        // Lọc các tiêu chí có tính chất kỷ luật (điểm phạt / trừ)
        const disciplineCriteria = criteriaList.filter(c => c.criterion_type === 'ky_luat');
        setCriteria(disciplineCriteria);

        if (reportToEdit) {
          // Edit mode - Điền thông tin chung
          const classObj = typeof reportToEdit.class_id === 'object' ? reportToEdit.class_id : null;
          const classIdStr = classObj ? classObj._id : reportToEdit.class_id;
          setClassId(classIdStr || '');

          setTeacherName(reportToEdit.teacher_name || '');
          setClassNote(reportToEdit.class_note || '');
          setTotalPresent(reportToEdit.total_present || 0);
          setTotalAbsent(reportToEdit.total_absent || 0);

          try {
            if (reportToEdit.report_date) {
              const dateStr = reportToEdit.report_date;
              if (dateStr.includes('/')) {
                const parsedDate = parse(dateStr, 'dd/MM/yyyy', new Date());
                setReportDate(parsedDate);
              } else {
                setReportDate(new Date(dateStr));
              }
            }
          } catch (e) {
            console.error('Lỗi parse ngày:', e);
            setReportDate(new Date());
          }

          // Tải danh sách vi phạm học sinh của báo cáo này từ API
          try {
            const records = await academicRecordApi.getAcademicRecordsByDailyReport(reportToEdit._id);
            const violationsMapped: ViolationItem[] = records.map(rec => {
              const stObj = typeof rec.student_id === 'object' ? rec.student_id : null;
              const critObj = typeof rec.evaluation_detail_id === 'object' ? rec.evaluation_detail_id : null;
              return {
                student_id: stObj ? stObj._id : rec.student_id,
                student_name: stObj ? stObj.full_name : 'Sinh viên',
                student_code: stObj ? stObj.student_code : '',
                evaluation_detail_id: critObj ? critObj._id : rec.evaluation_detail_id,
                criterion_name: rec.record_title || 'Vi phạm',
                points_effect: rec.points_effect || -5,
                class_note: rec.record_title || '' // tạm lấy title làm note
              };
            });
            setAddedViolations(violationsMapped);
          } catch (e) {
            console.error('Lỗi tải vi phạm của báo cáo lớp:', e);
          }
        }
      } catch (err) {
        console.error('Lỗi nạp dữ liệu:', err);
        toast.error('Không thể nạp dữ liệu ban đầu');
      } finally {
        setIsLoadingData(false);
      }
    }
    loadData();
  }, [reportToEdit]);

  // Lọc sinh viên theo lớp học đang chọn
  useEffect(() => {
    if (classId && allStudents.length > 0) {
      const filtered = allStudents.filter(s => {
        const sClassId = typeof s.class_id === 'object' ? s.class_id?._id : s.class_id;
        return sClassId === classId;
      });
      setClassStudents(filtered);

      // Nếu không ở edit mode hoặc đổi lớp khác, reset vi phạm cũ
      if (!reportToEdit) {
        setAddedViolations([]);
      }
    } else {
      setClassStudents([]);
      setAddedViolations([]);
    }
    setSelectedStudentId('');
    setSelectedCriterionId('');
    setViolationNote('');
  }, [classId, allStudents]);

  // Tự động tính toán sĩ số dựa trên danh sách sinh viên vắng mặt (vi phạm vắng học)
  useEffect(() => {
    if (classStudents.length > 0) {
      // Đếm số lượng sinh viên duy nhất có vi phạm trong bảng tạm
      const uniqueAbsentIds = new Set(addedViolations.map(v => v.student_id));
      const absentCount = uniqueAbsentIds.size;
      setTotalAbsent(absentCount);
      setTotalPresent(Math.max(0, classStudents.length - absentCount));
    } else {
      setTotalPresent(0);
      setTotalAbsent(0);
    }
  }, [addedViolations, classStudents]);

  // Thêm vi phạm vào danh sách tạm
  const handleAddViolationToList = () => {
    if (!classId) {
      toast.error('Vui lòng chọn lớp học trước!');
      return;
    }
    if (!selectedStudentId) {
      toast.error('Vui lòng chọn sinh viên vi phạm!');
      return;
    }
    if (!selectedCriterionId) {
      toast.error('Vui lòng chọn tiêu chí vi phạm!');
      return;
    }

    if (addedViolations.length >= 10) {
      toast.error('Chỉ được ghi nhận tối đa 10 mục vi phạm!');
      return;
    }

    // Check trùng vi phạm cùng sinh viên
    const isDuplicate = addedViolations.some(
      v => v.student_id === selectedStudentId && v.evaluation_detail_id === selectedCriterionId
    );
    if (isDuplicate) {
      toast.error('Sinh viên này đã bị ghi nhận tiêu chí vi phạm này!');
      return;
    }

    const student = classStudents.find(s => s._id === selectedStudentId);
    const criterion = criteria.find(c => c._id === selectedCriterionId);

    if (student && criterion) {
      const newViolation: ViolationItem = {
        student_id: student._id,
        student_name: student.full_name,
        student_code: student.student_code,
        evaluation_detail_id: criterion._id,
        criterion_name: criterion.criterion_name,
        points_effect: criterion.score_per_unit || criterion.min_score || -5,
        class_note: violationNote.trim() || 'Vi phạm kỷ luật'
      };

      setAddedViolations([...addedViolations, newViolation]);

      // Reset inputs
      setSelectedStudentId('');
      setSelectedCriterionId('');
      setViolationNote('');
      toast.success('Đã thêm vi phạm vào danh sách!');
    }
  };

  // Xóa vi phạm khỏi danh sách tạm
  const handleRemoveViolationFromList = (index: number) => {
    setAddedViolations(prev => prev.filter((_, i) => i !== index));
    toast.success('Đã xóa vi phạm khỏi danh sách tạm.');
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!classId) {
      toast.error('Vui lòng chọn lớp học!');
      return;
    }
    if (!teacherName.trim()) {
      toast.error('Vui lòng nhập tên giảng viên!');
      return;
    }

    setIsSaving(true);
    const dateFormatted = format(reportDate, 'dd/MM/yyyy');

    try {
      let dailyReportId = '';

      if (reportToEdit) {
        // --- CHẾ ĐỘ CHỈNH SỬA ---
        // 1. Cập nhật báo cáo lớp học
        await dailyClassReportApi.updateDailyClassReport(reportToEdit._id, {
          class_id: classId,
          report_date: dateFormatted,
          teacher_name: teacherName.trim(),
          total_present: totalPresent,
          total_absent: totalAbsent,
          class_note: classNote.trim(),
        });
        dailyReportId = reportToEdit._id;

        // 2. Xóa toàn bộ các academic_records cũ của daily report này để ghi đè sạch sẽ
        try {
          const oldRecords = await academicRecordApi.getAcademicRecordsByDailyReport(dailyReportId);
          await Promise.all(oldRecords.map(rec => academicRecordApi.deleteAcademicRecord(rec._id)));
        } catch (e) {
          console.warn('Không thể làm sạch bản ghi cũ hoặc không có bản ghi cũ:', e);
        }

        toast.success('Cập nhật thông tin chung thành công!');
      } else {
        // --- CHẾ ĐỘ TẠO MỚI ---
        // 1. Tạo mới báo cáo lớp học hàng ngày
        const newReport = await dailyClassReportApi.createDailyClassReport({
          class_id: classId,
          user_id: '60d0fe4f5311236168a109ca', // default user placeholder
          report_date: dateFormatted,
          teacher_name: teacherName.trim(),
          total_present: totalPresent,
          total_absent: totalAbsent,
          class_note: classNote.trim(),
        });
        dailyReportId = newReport._id;
        toast.success('Tạo báo cáo lớp học hàng ngày thành công!');
      }

      // 2. Lưu từng bản ghi vi phạm rèn luyện từ bảng tạm
      if (addedViolations.length > 0) {
        await Promise.all(addedViolations.map(violation =>
          academicRecordApi.createAcademicRecord({
            evaluation_detail_id: violation.evaluation_detail_id,
            student_id: violation.student_id,
            semester_id: '60d0fe4f5311236168a109cb', // active semester placeholder
            record_title: `${violation.criterion_name} (${violation.class_note})`,
            points_effect: violation.points_effect,
            status: 'active',
            daily_report_id: dailyReportId
          })
        ));
        toast.success(`Đã ghi nhận ${addedViolations.length} vi phạm rèn luyện thành công!`);
      }

      onSuccess();
    } catch (err: any) {
      console.error('Lỗi khi lưu:', err);
      toast.error(err.message || 'Lưu báo cáo thất bại');
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
      <div className="flex flex-col gap-[20px] max-w-[1280px] mx-auto w-full">
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
                Ghi nhận Đánh giá Lớp học
              </h2>
              <p className="font-normal text-[#414754] text-[13px] lg:text-[14px] leading-relaxed">
                Ghi lại thông tin chuyên cần, kỷ luật và đánh giá chất lượng buổi học hôm nay.
              </p>
            </div>
          </div>
        </div>

        {/* Loading Spinner */}
        {isLoadingData ? (
          <div className="backdrop-blur-[6px] bg-white/45 border border-white/40 rounded-[16px] p-[40px] shadow-sm flex flex-col items-center justify-center min-h-[250px] gap-3">
            <Loader2 className="w-7 h-7 text-blue-600 animate-spin" />
            <span className="text-[#005bbf] font-semibold text-xs">Đang nạp dữ liệu rèn luyện...</span>
          </div>
        ) : (
          <form onSubmit={handleSave} className="flex flex-col gap-[20px]">
            {/* Main Grid Layout (12 Columns) */}
            <div className="grid grid-cols-12 gap-[20px] w-full">

              {/* Left Column: Core Info (col-span-4) */}
              <div className="col-span-12 lg:col-span-4 flex flex-col gap-[20px]">
                {/* Section 1: Thông tin cơ bản */}
                <div className="backdrop-blur-[6px] bg-white/45 border border-white/40 rounded-[16px] p-[22px] lg:p-[26px] shadow-[0px_1px_2px_0px_rgba(0,0,0,0.05)] flex flex-col gap-[16px] w-full">
                  <div className="flex gap-[8px] items-center text-[#005bbf]">
                    <FileText className="w-4.5 h-4.5 shrink-0" />
                    <h3 className="font-bold text-[15px] lg:text-[16px] leading-none">Thông tin cơ bản</h3>
                  </div>

                  <div className="flex flex-col gap-[14px] w-full">
                    {/* Mã lớp học sử dụng Select Component */}
                    <div className="flex flex-col w-full relative">
                      <Select
                        value={classId}
                        onValueChange={setClassId}
                        label="Mã lớp học"
                        required
                        error={""}
                      >
                        <SelectTrigger className="bg-white/80 border-white/15 h-[40px] rounded-full px-[16px] text-[13.5px] text-slate-800 font-semibold outline-none focus-within:ring-2 focus-within:ring-blue-500/20 focus-within:border-blue-400 transition-all cursor-pointer w-full shadow-sm">
                          <SelectValue placeholder="Chọn mã lớp học..." />
                        </SelectTrigger>
                        <SelectContent className="bg-white/95 backdrop-blur-md rounded-xl shadow-xl border border-slate-100/60 max-h-[220px] overflow-y-auto">
                          {classes.map(c => (
                            <SelectItem key={c._id} value={c._id}>{c.class_name}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    {/* Tên giảng viên sử dụng Input Component */}
                    <Input
                      type="text"
                      label="Tên giảng viên"
                      value={teacherName}
                      onChange={(e) => setTeacherName(e.target.value)}
                      placeholder="Nhập tên giảng viên đứng lớp"
                      className="bg-white/80 border-white/15 h-[40px] rounded-full px-[16px] text-[13.5px] text-slate-800 font-semibold placeholder:text-slate-400 focus-visible:ring-2 focus-visible:ring-blue-500/20 focus-visible:bg-white/90 focus-visible:border-blue-400 shadow-sm"
                      containerClassName="w-full"
                    />

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

                {/* Section 2: Ghi chú lớp học sử dụng Input Component với multiline */}
                <div className="backdrop-blur-[6px] bg-white/45 border border-white/40 rounded-[16px] p-[22px] lg:p-[26px] shadow-[0px_1px_2px_0px_rgba(0,0,0,0.05)] flex flex-col gap-[16px] w-full">
                  <div className="flex gap-[8px] items-center text-[#005bbf]">
                    <FileText className="w-4.5 h-4.5 shrink-0" />
                    <h3 className="font-bold text-[15px] lg:text-[16px] leading-none">Ghi chú lớp học</h3>
                  </div>

                  <Input
                    multiline
                    value={classNote}
                    onChange={(e) => setClassNote(e.target.value)}
                    placeholder="Nhập nhận xét chung về tình hình lớp học, mức độ tiếp thu..."
                    className="bg-white/80 border-white/15 rounded-[12px] p-[16px] min-h-[110px] text-[13.5px] text-slate-800 outline-none focus-visible:ring-2 focus-visible:ring-blue-500/20 focus-visible:bg-white/90 focus-visible:border-blue-400 transition-all w-full resize-none shadow-sm font-semibold leading-relaxed placeholder:text-slate-400"
                    containerClassName="w-full"
                  />
                </div>
              </div>

              {/* Right Column: Violations Section (col-span-8) */}
              <div className="col-span-12 lg:col-span-8 flex flex-col gap-[20px]">
                <div className="backdrop-blur-[6px] bg-white/45 border border-white/40 rounded-[16px] p-[22px] lg:p-[26px] shadow-[0px_1px_2px_0px_rgba(0,0,0,0.05)] flex flex-col gap-[16px] w-full">
                  <div className="flex gap-[8px] items-center text-[#005bbf]">
                    <AlertTriangle className="w-4.5 h-4.5 shrink-0" />
                    <h3 className="font-bold text-[15px] lg:text-[16px] leading-none">Ghi nhận sinh viên vi phạm (nếu có)</h3>
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
                          <SelectContent className="bg-white/95 backdrop-blur-md rounded-xl shadow-xl border border-slate-100/60 max-h-[200px] overflow-y-auto">
                            {classStudents.map(s => (
                              <SelectItem key={s._id} value={s._id}>{s.full_name} ({s.student_code})</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>

                      {/* Tiêu chí sử dụng Select Component */}
                      <div className="col-span-12 md:col-span-6 flex flex-col items-start w-full relative">
                        <Select
                          value={selectedCriterionId}
                          onValueChange={setSelectedCriterionId}
                          label="Tiêu chí"
                          error={""}
                        >
                          <SelectTrigger className="bg-white/80 border-white/15 h-[38px] rounded-full px-[14px] text-[12.5px] text-slate-800 font-semibold outline-none w-full shadow-sm focus-within:ring-2 focus-within:ring-blue-500/20 transition-all cursor-pointer font-sans">
                            <SelectValue placeholder="Chọn tiêu chí..." />
                          </SelectTrigger>
                          <SelectContent className="bg-white/95 backdrop-blur-md rounded-xl shadow-xl border border-slate-100/60 max-h-[200px] overflow-y-auto font-sans">
                            {criteria.map(c => (
                              <SelectItem key={c._id} value={c._id}>{c.criterion_name} ({c.score_per_unit || c.min_score || -5}đ)</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>

                      {/* Ghi chú chi tiết sử dụng Input Component */}
                      <Input
                        type="text"
                        label="Ghi chú chi tiết"
                        value={violationNote}
                        onChange={(e) => setViolationNote(e.target.value)}
                        placeholder="VD: Nhắc nhở lần 1..."
                        className="bg-white/80 border-white/15 h-[38px] rounded-full px-[14px] text-[12.5px] text-slate-800 placeholder:text-slate-400 focus-visible:ring-2 focus-visible:ring-blue-500/20 focus-visible:bg-white/90 focus-visible:border-blue-400 shadow-sm"
                        containerClassName="col-span-12 md:col-span-9 w-full"
                      />

                      {/* Nút Thêm sử dụng Button Component */}
                      <div className="col-span-12 md:col-span-3 flex items-end w-full">
                        <Button
                          type="button"
                          onClick={handleAddViolationToList}
                          className="bg-[#005bbf] hover:bg-[#004ca0] text-white font-bold h-[38px] rounded-full shadow-[0px_4px_6px_-1px_rgba(0,91,191,0.1),0px_2px_4px_-2px_rgba(0,91,191,0.1)] flex items-center justify-center gap-2 cursor-pointer transition-all border-none outline-none w-full text-[12.5px]"
                        >
                          <Plus className="w-4 h-4 shrink-0" />
                          <span>Thêm</span>
                        </Button>
                      </div>
                    </div>
                  </div>

                  {/* Violation Table */}
                  <div className="border border-white/20 rounded-[12px] overflow-hidden w-full shadow-sm">
                    <table className="w-full text-left border-collapse min-w-max">
                      <thead>
                        <tr className="bg-white/50 border-b border-white/20">
                          <th className="px-[20px] py-[10px] font-bold text-[#005bbf] text-[12px] tracking-[0.65px] uppercase">HỌ TÊN</th>
                          <th className="px-[20px] py-[10px] font-bold text-[#005bbf] text-[12px] tracking-[0.65px] uppercase">TIÊU CHÍ</th>
                          <th className="px-[20px] py-[10px] font-bold text-[#005bbf] text-[12px] tracking-[0.65px] uppercase">GHI CHÚ</th>
                          <th className="px-[20px] py-[10px] font-bold text-[#005bbf] text-[12px] tracking-[0.65px] uppercase text-center w-32">THAO TÁC</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-white/20 bg-white/25">
                        {addedViolations.map((violation, idx) => {
                          // Xác định màu badge kỷ luật sinh động giống Figma (đỏ nhạt, cam nhạt, v.v.)
                          const isTre = violation.criterion_name.toLowerCase().includes('trễ') || violation.criterion_name.toLowerCase().includes('muộn');
                          const badgeClass = isTre
                            ? 'bg-[rgba(255,218,214,0.6)] border border-[#ffdad6] text-[#93000a]'
                            : 'bg-[#ffdbcb]/80 border border-[#ffcdb2] text-[#783100]';

                          return (
                            <tr key={idx} className="hover:bg-white/30 transition-colors">
                              <td className="px-[20px] py-[12px] font-semibold text-[#111c2d] text-[13.5px]">
                                <div className="flex flex-col">
                                  <span>{violation.student_name}</span>
                                  <span className="text-slate-400 text-[10.5px] font-medium">MSSV: {violation.student_code}</span>
                                </div>
                              </td>
                              <td className="px-[20px] py-[12px]">
                                <span className={`font-bold rounded-full px-[10px] py-[3px] text-[11.5px] inline-block tracking-wide ${badgeClass}`}>
                                  {violation.criterion_name} ({violation.points_effect}đ)
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
                                  title="Xóa vi phạm"
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
                              Chưa có ghi nhận sinh viên vi phạm trong buổi học này.
                            </td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>

                  {/* Sĩ số hiển thị xem nhanh */}
                  {classStudents.length > 0 && (
                    <div className="flex flex-wrap items-center gap-4 lg:gap-6 text-[12px] font-bold text-slate-500 px-2 mt-1">
                      <div className="flex items-center gap-2">
                        <Users className="w-3.5 h-3.5 text-blue-500" />
                        <span>Sĩ số lớp: <strong className="text-slate-800">{classStudents.length} SV</strong></span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="w-2 h-2 rounded-full bg-emerald-500" />
                        <span>Hiện diện: <strong className="text-emerald-600">{totalPresent} SV</strong></span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="w-2 h-2 rounded-full bg-rose-500" />
                        <span>Vắng mặt: <strong className="text-rose-600">{totalAbsent} SV</strong></span>
                      </div>
                      <div className="ml-auto text-emerald-600 bg-emerald-50 px-2.5 py-0.5 rounded-full text-[11px]">
                        {classStudents.length > 0 ? Math.round((totalPresent / classStudents.length) * 100) : 100}% Chuyên cần
                      </div>
                    </div>
                  )}
                </div>
              </div>

            </div>

            {/* Footer Actions Panel */}
            <div className="backdrop-blur-[6px] bg-white/45 border border-white/40 rounded-[16px] p-[18px] flex items-center justify-between gap-4 w-full shadow-[0px_1px_2px_0px_rgba(0,0,0,0.05)]">
              {/* Reset/Placeholder info */}
              <div className="hidden sm:flex items-center text-[12.5px] text-[#414754] font-medium italic">
                Hãy kiểm tra kỹ thông tin chuyên cần & kỷ luật trước khi lưu.
              </div>

              {/* Action Buttons */}
              <div className="flex gap-[12px] items-center justify-end w-full sm:w-auto ml-auto">
                {/* Hủy bỏ sử dụng Custom Button với variant outline */}
                <Button
                  type="button"
                  variant="outline"
                  onClick={onBack}
                  className="border border-[rgba(0,91,191,0.3)] bg-white/30 hover:bg-white/80 rounded-full px-[32px] py-[10px] text-[#005bbf] font-bold text-[13px] tracking-[0.28px] h-auto"
                >
                  Hủy bỏ
                </Button>

                {/* Lưu ghi nhận sử dụng Custom Button với variant default */}
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
