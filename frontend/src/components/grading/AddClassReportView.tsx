'use client';
import React, { useState, useEffect } from 'react';
import { ArrowLeft, Calendar as CalendarIcon, Loader2, Plus, Trash2, AlertTriangle, FileText, Check, Users, Save } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { CustomCalendar } from '@/components/calendar/CustomCalendar';
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
      className="flex flex-col h-full bg-gradient-to-br from-[#EBF2FA] to-[#DCE6F1] p-[32px] font-sans w-full overflow-y-auto"
    >
      <div className="flex flex-col gap-[24px] max-w-[1200px] mx-auto w-full">
        {/* Header Section */}
        <div className="flex items-center justify-between w-full">
          <div className="flex gap-[16px] items-center">
            {/* Back Button Pill Glassmorphism */}
            <button
              onClick={onBack}
              className="backdrop-blur-[6px] bg-white/50 border border-white/80 rounded-full w-12 h-12 flex items-center justify-center cursor-pointer hover:bg-white/80 transition-colors shadow-sm outline-none shrink-0"
              title="Quay lại"
            >
              <ArrowLeft className="w-4.5 h-4.5 text-slate-800" />
            </button>

            <div className="flex flex-col items-start max-w-[500px]">
              <h2 className="font-['Hanken_Grotesk:Medium'] font-bold text-[28px] text-slate-900 leading-tight">
                {reportToEdit ? 'Chỉnh sửa ghi nhận đánh giá lớp học' : 'Thêm ghi nhận đánh giá lớp học mới'}
              </h2>
              <p className="font-['Inter:Regular'] text-slate-600 text-[15px] leading-relaxed">
                Nhập thông tin chi tiết buổi học và các vi phạm rèn luyện của sinh viên nếu có
              </p>
            </div>
          </div>
        </div>

        {/* Loading Spinner */}
        {isLoadingData ? (
          <div className="backdrop-blur-[6px] bg-white/45 border border-white/75 rounded-[32px] p-[50px] shadow-lg flex flex-col items-center justify-center min-h-[300px] gap-3">
            <Loader2 className="w-8 h-8 text-blue-600 animate-spin" />
            <span className="text-slate-600 font-bold text-sm">Đang nạp dữ liệu ban đầu...</span>
          </div>
        ) : (
          <form onSubmit={handleSave} className="flex flex-col gap-[24px]">
            {/* Form Container Glassmorphic */}
            <div className="backdrop-blur-[6px] bg-white/45 border border-white/75 rounded-[32px] p-[33px] shadow-[0px_20px_25px_-5px_rgba(0,0,0,0.1),0px_8px_10px_-6px_rgba(0,0,0,0.1)] flex flex-col gap-[32px] w-full">

              {/* Section 1: General Info */}
              <div className="w-full">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-[32px]">

                  {/* Mã lớp học */}
                  <div className="flex flex-col gap-[8px] items-start w-full">
                    <label className="font-['Inter:Bold'] font-bold text-[#414754] text-[16px]">Mã lớp học</label>
                    <div className="relative w-full">
                      <select
                        value={classId}
                        onChange={(e) => setClassId(e.target.value)}
                        className="bg-white/60 border border-white/80 h-[56px] rounded-full px-[25px] text-[16px] text-slate-800 font-semibold outline-none focus:ring-2 focus:ring-blue-500/20 focus:bg-white focus:border-blue-400 transition-all appearance-none cursor-pointer w-full shadow-sm"
                        style={{
                          backgroundImage: `url("data:image/svg+xml;charset=utf-8,%3Csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 20 20'%3E%3Cpath stroke='%236B7280' stroke-linecap='round' stroke-linejoin='round' stroke-width='1.5' d='m6 8 4 4 4-4'/%3E%3C/svg%3E")`,
                          backgroundPosition: 'right 20px center',
                          backgroundSize: '1.25rem',
                          backgroundRepeat: 'no-repeat'
                        }}
                      >
                        <option value="">Chọn mã lớp học...</option>
                        {classes.map(c => (
                          <option key={c._id} value={c._id}>{c.class_name}</option>
                        ))}
                      </select>
                    </div>
                  </div>

                  {/* Tên giảng viên */}
                  <div className="flex flex-col gap-[8px] items-start w-full">
                    <label className="font-['Inter:Bold'] font-bold text-[#414754] text-[16px]">Tên giảng viên</label>
                    <input
                      type="text"
                      value={teacherName}
                      onChange={(e) => setTeacherName(e.target.value)}
                      placeholder="Nhập tên giảng viên đứng lớp"
                    // className="bg-white/60 border border-white/80 h-[56px] rounded-full px-[25px] text-[16px] text-slate-800 font-semibold placeholder:text-[#c1c6d6] outline-none focus:ring-2 focus:ring-blue-500/20 focus:bg-white focus:border-blue-400 transition-all w-full shadow-sm"
                    />
                  </div>

                  {/* Ngày ghi nhận */}
                  <div className="flex flex-col gap-[8px] items-start w-full">
                    <label className="font-['Inter:Bold'] font-bold text-[#414754] text-[16px]">Ngày ghi nhận</label>
                    <Popover open={isCalendarOpen} onOpenChange={setIsCalendarOpen}>
                      <PopoverTrigger asChild>
                        <button
                          type="button"
                          className="bg-white/60 border border-white/80 h-[56px] rounded-full px-[25px] text-[16px] text-slate-800 font-semibold outline-none flex items-center justify-between hover:bg-white/80 focus:ring-2 focus:ring-blue-500/20 transition-all w-full shadow-sm text-left"
                        >
                          <span>{format(reportDate, 'dd/MM/yyyy')}</span>
                          <CalendarIcon className="w-[18px] h-[18px] text-slate-400" />
                        </button>
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

              {/* Section 2: Student Violations */}
              <div className="border-t border-white/40 pt-[25px] flex flex-col gap-[24px] w-full">

                {/* Section Title */}
                <div className="flex items-center justify-between w-full">
                  <div className="flex gap-[12px] items-center h-[32px]">
                    <div className="bg-[#ba1a1a]/10 rounded-full w-8 h-8 flex items-center justify-center shrink-0">
                      <AlertTriangle className="w-[15px] h-[15px] text-[#ba1a1a]" />
                    </div>
                    <span className="font-['Hanken_Grotesk:SemiBold'] font-semibold text-[16px] text-slate-900 leading-none">
                      Ghi nhận sinh viên vi phạm
                    </span>
                  </div>

                  <div className="bg-white/50 border border-white/60 rounded-full px-[17px] py-[6px] shadow-sm">
                    <span className="font-['Inter:Medium'] font-medium text-slate-500 text-[11px] uppercase tracking-wider">
                      Tối đa 10 mục
                    </span>
                  </div>
                </div>

                {/* Violation Inputs Area */}
                <div className="bg-white/40 border border-white/60 rounded-[32px] p-[25px] flex flex-col gap-[20px] w-full">
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-[24px]">

                    {/* Chọn sinh viên */}
                    <div className="flex flex-col gap-[8px] items-start w-full">
                      <label className="font-['Inter:Bold'] font-bold text-[#414754] text-[11px] tracking-wider uppercase">
                        Họ tên sinh viên
                      </label>
                      <select
                        value={selectedStudentId}
                        onChange={(e) => setSelectedStudentId(e.target.value)}
                        className="bg-white border border-transparent h-[48px] rounded-full px-[25px] text-[15px] text-slate-800 outline-none w-full shadow-sm focus:ring-2 focus:ring-blue-500/20 transition-all appearance-none cursor-pointer"
                        style={{
                          backgroundImage: `url("data:image/svg+xml;charset=utf-8,%3Csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 20 20'%3E%3Cpath stroke='%236B7280' stroke-linecap='round' stroke-linejoin='round' stroke-width='1.5' d='m6 8 4 4 4-4'/%3E%3C/svg%3E")`,
                          backgroundPosition: 'right 20px center',
                          backgroundSize: '1rem',
                          backgroundRepeat: 'no-repeat'
                        }}
                        disabled={!classId}
                      >
                        <option value="">{classId ? 'Chọn sinh viên...' : 'Vui lòng chọn lớp trước...'}</option>
                        {classStudents.map(s => (
                          <option key={s._id} value={s._id}>{s.full_name} ({s.student_code})</option>
                        ))}
                      </select>
                    </div>

                    {/* Chọn tiêu chí */}
                    <div className="flex flex-col gap-[8px] items-start w-full">
                      <label className="font-['Inter:Bold'] font-bold text-[#414754] text-[11px] tracking-wider uppercase">
                        Tiêu chí vi phạm
                      </label>
                      <select
                        value={selectedCriterionId}
                        onChange={(e) => setSelectedCriterionId(e.target.value)}
                        className="bg-white border border-transparent h-[48px] rounded-full px-[25px] text-[15px] text-slate-800 outline-none w-full shadow-sm focus:ring-2 focus:ring-blue-500/20 transition-all appearance-none cursor-pointer"
                        style={{
                          backgroundImage: `url("data:image/svg+xml;charset=utf-8,%3Csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 20 20'%3E%3Cpath stroke='%236B7280' stroke-linecap='round' stroke-linejoin='round' stroke-width='1.5' d='m6 8 4 4 4-4'/%3E%3C/svg%3E")`,
                          backgroundPosition: 'right 20px center',
                          backgroundSize: '1rem',
                          backgroundRepeat: 'no-repeat'
                        }}
                      >
                        <option value="">Chọn tiêu chí...</option>
                        {criteria.map(c => (
                          <option key={c._id} value={c._id}>{c.criterion_name} ({c.score_per_unit || c.min_score || -5}đ)</option>
                        ))}
                      </select>
                    </div>

                    {/* Ghi chú nhanh */}
                    <div className="flex flex-col gap-[8px] items-start w-full">
                      <label className="font-['Inter:Bold'] font-bold text-[#414754] text-[11px] tracking-wider uppercase">
                        Ghi chú nhanh
                      </label>
                      <input
                        type="text"
                        value={violationNote}
                        onChange={(e) => setViolationNote(e.target.value)}
                        placeholder="Nhập ghi chú nhanh..."
                        className="bg-white border border-transparent h-[48px] rounded-full px-[25px] text-[15px] text-slate-800 placeholder:text-[#c1c6d6] outline-none w-full shadow-sm focus:ring-2 focus:ring-blue-500/20 transition-all"
                      />
                    </div>

                  </div>

                  {/* Add violation button red Pill shape */}
                  <div className="flex justify-end w-full mt-1">
                    <button
                      type="button"
                      onClick={handleAddViolationToList}
                      className="bg-[#ba1a1a] hover:bg-red-700 text-white font-bold h-[48px] px-[32px] rounded-full shadow-[0px_10px_15px_-3px_rgba(186,26,26,0.2)] flex items-center justify-center gap-2 cursor-pointer transition-all border-none outline-none"
                    >
                      <Plus className="w-4.5 h-4.5" />
                      <span>Thêm vào danh sách</span>
                    </button>
                  </div>
                </div>

                {/* Violations Table Glassmorphic */}
                {addedViolations.length > 0 && (
                  <div className="bg-white/60 border border-white/60 rounded-[24px] shadow-[0px_1px_2px_0px_rgba(0,0,0,0.05)] overflow-hidden w-full transition-all">
                    <table className="w-full text-left border-collapse min-w-max">
                      <thead>
                        <tr className="bg-white/30 border-b border-white/40">
                          <th className="px-[32px] py-[16px] font-['Inter:Semi_Bold'] font-bold text-[#414754] text-[11px] tracking-wider uppercase">HỌ TÊN</th>
                          <th className="px-[32px] py-[16px] font-['Inter:Semi_Bold'] font-bold text-[#414754] text-[11px] tracking-wider uppercase">TIÊU CHÍ VI PHẠM</th>
                          <th className="px-[32px] py-[16px] font-['Inter:Semi_Bold'] font-bold text-[#414754] text-[11px] tracking-wider uppercase">GHI CHÚ</th>
                          <th className="px-[32px] py-[16px] font-['Inter:Semi_Bold'] font-bold text-[#414754] text-[11px] text-center tracking-wider uppercase w-28">XÓA</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-white/20">
                        {addedViolations.map((violation, idx) => (
                          <tr key={idx} className="hover:bg-white/20 transition-colors">
                            <td className="px-[32px] py-[20px]">
                              <div className="flex flex-col">
                                <span className="font-['Inter:Regular'] text-slate-900 text-[16px] font-semibold">
                                  {violation.student_name}
                                </span>
                                <span className="text-slate-400 text-xs font-medium">MSSV: {violation.student_code}</span>
                              </div>
                            </td>
                            <td className="px-[32px] py-[20px]">
                              <span className="bg-[#ba1a1a]/15 border border-[#ba1a1a]/20 text-[#ba1a1a] font-bold rounded-full px-[16px] py-[6px] text-[12px] inline-block tracking-wide">
                                {violation.criterion_name} ({violation.points_effect}đ)
                              </span>
                            </td>
                            <td className="px-[32px] py-[20px] font-['Inter:Italic'] italic text-[#414754]/80 text-[13px]">
                              {violation.class_note}
                            </td>
                            <td className="px-[32px] py-[20px] text-center">
                              <button
                                type="button"
                                onClick={() => handleRemoveViolationFromList(idx)}
                                className="w-10 h-10 rounded-full hover:bg-red-50 hover:text-red-600 flex items-center justify-center text-slate-400 transition-colors bg-white/40 shadow-sm border-none outline-none cursor-pointer mx-auto"
                                title="Xóa vi phạm"
                              >
                                <Trash2 className="w-4.5 h-4.5" />
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}

              </div>

              {/* Section 3: Class Notes */}
              <div className="border-t border-white/40 pt-[25px] flex flex-col gap-[16px] w-full">
                <label className="font-['Inter:Bold'] font-bold text-[#414754] text-[16px]">Ghi chú lớp học</label>
                <div className="w-full">
                  <textarea
                    value={classNote}
                    onChange={(e) => setClassNote(e.target.value)}
                    placeholder="Nhập nhận xét hoặc ghi chú quan trọng về buổi học..."
                    className="bg-white/60 border border-white/80 rounded-[32px] p-[25px] min-h-[140px] text-[16px] text-slate-800 outline-none focus:ring-2 focus:ring-blue-500/20 focus:bg-white focus:border-blue-400 transition-all w-full resize-none shadow-sm font-medium"
                  />
                </div>
              </div>

              {/* Sĩ số hiển thị xem nhanh */}
              {classStudents.length > 0 && (
                <div className="flex items-center gap-6 text-[13px] font-bold text-slate-500 px-2 mt-[-10px]">
                  <div className="flex items-center gap-2">
                    <Users className="w-4 h-4 text-blue-500" />
                    <span>Sĩ số lớp: <strong className="text-slate-800">{classStudents.length} SV</strong></span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="w-2.5 h-2.5 rounded-full bg-emerald-500" />
                    <span>Hiện diện: <strong className="text-emerald-600">{totalPresent} SV</strong></span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="w-2.5 h-2.5 rounded-full bg-rose-500" />
                    <span>Nghỉ/Vi phạm: <strong className="text-rose-600">{totalAbsent} SV</strong></span>
                  </div>
                  <div className="ml-auto text-emerald-600 bg-emerald-50 px-3 py-1 rounded-full text-xs">
                    {classStudents.length > 0 ? Math.round((totalPresent / classStudents.length) * 100) : 100}% Chuyên cần
                  </div>
                </div>
              )}

            </div>

            {/* Footer Action Buttons */}
            <div className="flex gap-[24px] items-center justify-end w-full mt-2">
              {/* Cancel Button */}
              <button
                type="button"
                onClick={onBack}
                className="bg-white/40 border border-white/60 rounded-full px-[41px] py-[16px] text-[#414754] font-bold hover:bg-white/80 focus:ring-2 focus:ring-slate-300 transition-all shadow-sm border-none outline-none cursor-pointer text-[16px]"
              >
                Hủy bỏ
              </button>

              {/* Save Button Pill shape blue with shadow */}
              <button
                type="submit"
                disabled={isSaving}
                className="bg-[#1a73e8] text-white font-bold px-[48px] py-[16px] rounded-full shadow-[0px_20px_25px_-5px_rgba(26,115,232,0.3),0px_8px_10px_-6px_rgba(26,115,232,0.3)] hover:bg-blue-700 focus:ring-2 focus:ring-blue-500/20 transition-all flex items-center justify-center gap-2 border-none outline-none cursor-pointer text-[16px] disabled:opacity-75 disabled:cursor-not-allowed"
              >
                {isSaving ? (
                  <>
                    <Loader2 className="w-4.5 h-4.5 animate-spin" />
                    <span>Đang lưu...</span>
                  </>
                ) : (
                  <>
                    <Save className="w-4.5 h-4.5" />
                    <span>Lưu ghi nhận</span>
                  </>
                )}
              </button>
            </div>

          </form>
        )}
      </div>
    </motion.div>
  );
}
