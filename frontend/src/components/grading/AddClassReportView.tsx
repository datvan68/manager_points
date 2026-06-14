'use client';
import React, { useState, useEffect } from 'react';
import { ArrowLeft, Calendar as CalendarIcon, Loader2, Plus, Trash2, AlertTriangle, FileText, Check, Users, Save, Settings, Sparkles } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Dialog, DialogContent, DialogTitle, DialogDescription } from '@/components/ui/dialog';
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
import { useAuth } from '@/providers/auth-provider';
import { semesterApi } from '@/api/semester-api';
import { summariesPointApi } from '@/api/summaries-point-api';
import { evaluationDetailApi, EvaluationDetail } from '@/api/evaluation-detail-api';

interface ViolationItem {
  student_id: string;
  student_name: string;
  student_code: string;
  // `criterion_id` is the actual Criterion ObjectId string
  criterion_id: string;
  // `evaluation_detail_id` is the optional EvaluationDetail id after it's created/fetched
  evaluation_detail_id?: string;
  criterion_name: string;
  points_effect: number;
  class_note: string;
}

const OBJECT_ID_REGEX = /^[a-fA-F0-9]{24}$/;

function getIdValue(value: any): string {
  if (!value) return '';
  if (typeof value === 'string') return value;
  if (typeof value === 'object' && value._id) return value._id;
  return '';
}

function isValidObjectId(value: string): boolean {
  return typeof value === 'string' && OBJECT_ID_REGEX.test(value);
}

function normalizeText(value: string): string {
  return (value || '')
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, ' ');
}

function resolveCriterionByName(criteria: Criterion[], names: Array<string | undefined | null>) {
  const normalizedNames = names
    .map(name => normalizeText(name || ''))
    .filter(Boolean);

  if (normalizedNames.length === 0) return null;

  const exactMatches = criteria.filter(criterion => {
    const criterionName = normalizeText(criterion.criterion_name);
    return normalizedNames.some(name => criterionName === name);
  });

  if (exactMatches.length === 1) return exactMatches[0];

  if (exactMatches.length > 1) {
    return exactMatches.find(criterion => {
      const criterionName = normalizeText(criterion.criterion_name);
      return normalizedNames.includes(criterionName);
    }) || exactMatches[0];
  }

  const includesMatches = criteria.filter(criterion => {
    const criterionName = normalizeText(criterion.criterion_name);
    return normalizedNames.some(name => criterionName.includes(name) || name.includes(criterionName));
  });

  if (includesMatches.length === 1) return includesMatches[0];

  return null;
}

function resolveCriterionFromRecord(rec: AcademicRecord, criteria: Criterion[]) {
  const criterionIdFromPrimary = getIdValue((rec as any).criterion_id);
  const criterionIdFromCriteria = getIdValue((rec as any).criteria_id);
  const evalDetailObj = typeof rec.evaluation_detail_id === 'object' ? rec.evaluation_detail_id : null;
  const criterionIdFromEval = evalDetailObj ? getIdValue(evalDetailObj.criterion_id) : '';

  const canonicalName = (rec.record_title || rec.description || '').trim();
  const criterionNameFromRecord = (rec as any).criterion_name || canonicalName;

  const directId = criterionIdFromPrimary || criterionIdFromCriteria || criterionIdFromEval;
  if (directId) {
    const matchedById = criteria.find(c => c._id === directId);
    if (matchedById) return matchedById;
  }

  return resolveCriterionByName(criteria, [criterionNameFromRecord, canonicalName]);
}

interface AddClassReportViewProps {
  onBack: () => void;
  reportToEdit?: DailyClassReport | null;
  onSuccess: () => void;
}

export default function AddClassReportView({ onBack, reportToEdit, onSuccess }: AddClassReportViewProps) {
  const { user } = useAuth();
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

  // Cấu hình tiêu chí vắng mặt
  const [absentCriteriaIds, setAbsentCriteriaIds] = useState<string[]>([]);
  const [isConfigModalOpen, setIsConfigModalOpen] = useState(false);

  // Học kỳ hoạt động thực tế
  const [activeSemesterId, setActiveSemesterId] = useState('60d0fe4f5311236168a109cb');

  // Load classes, students, criteria and editing data
  useEffect(() => {
    async function loadData() {
      setIsLoadingData(true);
      try {
        const classList = await classApi.getClasses();
        setClasses(classList);

        const studentListRes = await studentApi.getStudents();
        const studentList = Array.isArray(studentListRes) ? studentListRes : (studentListRes?.data || []);
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

        // Thiết lập tiêu chí vắng mặt mặc định (chứa từ "vắng" kết hợp với "không phép" hoặc "có phép")
        const cached = localStorage.getItem('absentCriteriaIds');
        if (cached) {
          setAbsentCriteriaIds(JSON.parse(cached));
        } else {
          const defaultAbsents = criteriaList
            .filter(c => {
              const nameLower = c.criterion_name.toLowerCase();
              return nameLower.includes('vắng') && (nameLower.includes('không phép') || nameLower.includes('có phép'));
            })
            .map(c => c._id);
          setAbsentCriteriaIds(defaultAbsents);
          localStorage.setItem('absentCriteriaIds', JSON.stringify(defaultAbsents));
        }

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
              const matchedCriterion = resolveCriterionFromRecord(rec, criteria);
              const evalDetailObj = typeof rec.evaluation_detail_id === 'object' ? rec.evaluation_detail_id : null;
              const evaluationDetailId = evalDetailObj ? (evalDetailObj._id || '') : (typeof rec.evaluation_detail_id === 'string' ? rec.evaluation_detail_id : '');
              const originalCriterionId = getIdValue((rec as any).criterion_id) || getIdValue((rec as any).criteria_id) || (evalDetailObj ? getIdValue(evalDetailObj.criterion_id) : '');
              const criterionName = matchedCriterion?.criterion_name || rec.record_title || (rec as any).criterion_name || 'Vi phạm';
              const pointsEffect = matchedCriterion?.score_per_unit || matchedCriterion?.min_score || rec.points_effect || -5;
              return {
                student_id: stObj ? stObj._id : rec.student_id,
                student_name: stObj ? stObj.full_name : 'Sinh viên',
                student_code: stObj ? stObj.student_code : '',
                criterion_id: matchedCriterion?._id || originalCriterionId || '',
                evaluation_detail_id: evaluationDetailId,
                criterion_name: criterionName,
                points_effect: pointsEffect,
                class_note: rec.description || ''
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

  const [isStudentsLoading, setIsStudentsLoading] = useState(false);
  const [summaryPointCache, setSummaryPointCache] = useState<Record<string, string>>({});
  const [evaluationDetailCache, setEvaluationDetailCache] = useState<Record<string, string>>({});

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

      // Nếu không ở edit mode hoặc đổi lớp khác, reset vi phạm cũ
      if (!reportToEdit) {
        setAddedViolations([]);
      }
      return () => clearTimeout(timer);
    } else {
      setClassStudents([]);
      setAddedViolations([]);
      setIsStudentsLoading(false);
    }
    setSelectedStudentId('');
    setSelectedCriterionId('');
    setViolationNote('');
  }, [classId, allStudents]);

  // Tự động tính toán sĩ số dựa trên danh sách sinh viên vắng mặt (vi phạm vắng học được cấu hình)
  useEffect(() => {
    if (classStudents.length > 0) {
      // Chỉ đếm những vi phạm thuộc tiêu chí được cấu hình tính vắng mặt hoặc có chứa từ khóa "vắng"
      const absentViolations = addedViolations.filter(v => 
        absentCriteriaIds.includes(v.criterion_id) || 
        v.criterion_name.toLowerCase().includes('vắng')
      );
      const uniqueAbsentIds = new Set(absentViolations.map(v => v.student_id));
      const absentCount = uniqueAbsentIds.size;
      setTotalAbsent(absentCount);
      setTotalPresent(Math.max(0, classStudents.length - absentCount));
    } else {
      setTotalPresent(0);
      setTotalAbsent(0);
    }
  }, [addedViolations, classStudents, absentCriteriaIds]);

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
      v => v.student_id === selectedStudentId && v.criterion_id === selectedCriterionId
    );
    if (isDuplicate) {
      toast.error('Sinh viên này đã bị ghi nhận tiêu chí vi phạm này!');
      return;
    }

    const student = classStudents.find(s => s._id === selectedStudentId);
    const criterion = criteria.find(c => c._id === selectedCriterionId);

    if (!student) {
      toast.error('Không tìm thấy sinh viên đã chọn, vui lòng tải lại danh sách');
      return;
    }

    if (!criterion) {
      toast.error('Không tìm thấy tiêu chí đã chọn, vui lòng tải lại danh sách tiêu chí');
      return;
    }

    if (student && criterion) {
      const newViolation: ViolationItem = {
        student_id: student._id,
        student_name: student.full_name,
        student_code: student.student_code,
        criterion_id: criterion._id,
        evaluation_detail_id: undefined,
        criterion_name: criterion.criterion_name,
        points_effect: criterion.score_per_unit || criterion.min_score || -5,
        class_note: violationNote.trim() || 'Không có ghi chú'
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
    const dateFormatted = reportDate.toISOString();

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
          class_notes: classNote.trim(),
        });
        dailyReportId = reportToEdit._id;

        // 2. Xóa toàn bộ các academic_records cũ của daily report này để ghi đè sạch sẽ
        try {
          const oldRecords = await academicRecordApi.getAcademicRecordsByDailyReport(dailyReportId);
          await Promise.all(oldRecords.map(rec => academicRecordApi.deleteAcademicRecord(rec._id, true)));
        } catch (e) {
          console.warn('Không thể làm sạch bản ghi cũ hoặc không có bản ghi cũ:', e);
        }

        toast.success('Cập nhật thông tin chung thành công!');
      } else {
        // --- CHẾ ĐỘ TẠO MỚI ---
        // 1. Tạo mới báo cáo lớp học hàng ngày
        const newReport = await dailyClassReportApi.createDailyClassReport({
          class_id: classId,
          reported_by: user?.id || '60d0fe4f5311236168a109ca', // use logged-in user or fallback
          report_date: dateFormatted,
          teacher_name: teacherName.trim(),
          total_present: totalPresent,
          total_absent: totalAbsent,
          class_notes: classNote.trim(),
        });
        dailyReportId = newReport._id;
        toast.success('Tạo báo cáo lớp học hàng ngày thành công!');
      }

      // 2. Lưu các bản ghi vi phạm bằng batch API
      if (addedViolations.length > 0) {
        const recordsToCreate = addedViolations.map(violation => {
          const resolvedCriterion = criteria.find(c => c._id === violation.criterion_id) || resolveCriterionByName(criteria, [violation.criterion_name]);
          if (!resolvedCriterion) {
            throw new Error(`Khong tim thay tieu chi cho ghi nhan: ${violation.criterion_name}. Vui long tai lai danh sach tieu chi hoac chon lai tieu chi`);
          }

          if (!isValidObjectId(violation.student_id)) {
            throw new Error(`Khong tim thay hoc sinh hop le cho ghi nhan: ${violation.student_name}`);
          }
          if (!isValidObjectId(activeSemesterId)) {
            throw new Error('Du lieu hoc ky khong hop le, vui long kiem tra lai');
          }
          if (!isValidObjectId(dailyReportId)) {
            throw new Error('Du lieu bao cao ngay khong hop le, khong the luu ghi nhan');
          }

          return {
            student_id: violation.student_id,
            criterion_id: resolvedCriterion._id,
            semester_id: activeSemesterId,
            record_title: resolvedCriterion.criterion_name,
            description: violation.class_note,
            daily_report_id: dailyReportId,
            status: 'active' as const,
            recorded_at: reportDate.toISOString(),
            recorded_by: isValidObjectId(user?.id || '') ? user?.id : undefined,
            idempotency_key: `daily_report:${dailyReportId}:${violation.student_id}:${resolvedCriterion._id}`,
            source: 'daily_class_report'
          };
        });

        const response = await academicRecordApi.bulkCreateAcademicRecords(recordsToCreate);
        if (response.insertedCount > 0) {
          toast.success(`Đã ghi nhận ${response.insertedCount} vi phạm rèn luyện thành công!`);
        }
        if (response.duplicatedCount > 0) {
          toast.warning(`Có ${response.duplicatedCount} ghi nhận bị trùng lặp hoặc đã tồn tại.`);
        }
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
      <div className="flex flex-col gap-[20px]  mx-auto w-full">
        {/* Page Header Section */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 w-full">
          <div className="flex gap-[12px] items-center">
            {/* Back Button Pill Glassmorphism using Custom Button */}
            <Button
              type="button"
              variant="ghost"
              onClick={onBack}
              className="backdrop-blur-md bg-white/45 border border-white/70 rounded-xl w-10 h-10 p-0 flex items-center justify-center cursor-pointer hover:bg-white/80 transition-all duration-150 ease-out hover:scale-[1.05] shadow-sm shrink-0"
              title="Quay lại"
            >
              <ArrowLeft className="w-4 h-4 text-slate-700" />
            </Button>

            {/* Figma Icon Block */}
            <div className="hidden xs:flex backdrop-blur-md bg-white/45 border border-white/70 items-center justify-center rounded-xl shadow-sm shrink-0 w-10 h-10">
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
          <div className="flex items-center sm:justify-end shrink-0">
            <div className="bg-[#005bbf]/5 text-[#005bbf] font-bold text-[11px] px-3.5 py-1.5 rounded-xl uppercase tracking-wider border border-[#005bbf]/10 flex items-center gap-1.5 shadow-sm bg-white/40 backdrop-blur-md">
              <Sparkles className="w-3.5 h-3.5 text-[#005bbf] animate-pulse" />
              <span>Hệ thống ghi nhận</span>
            </div>
          </div>
        </div>

        {/* Loading Spinner */}
        {isLoadingData ? (
          <div className="bg-white/45 backdrop-blur-md border border-white/70 rounded-2xl p-10 shadow-sm shadow-slate-300/40 flex flex-col items-center justify-center min-h-[250px] gap-3">
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
                <div className="bg-white/45 backdrop-blur-md border border-white/70 shadow-sm shadow-slate-300/40 rounded-2xl p-[22px] lg:p-[26px] flex flex-col gap-[16px] w-full">
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
                        <SelectTrigger className="bg-white/50 border-white/80 backdrop-blur-sm h-10 rounded-xl px-[16px] text-[13.5px] text-[#1E293B] font-semibold outline-none focus-within:ring-2 focus-within:ring-blue-500/20 focus-within:border-blue-400 transition-all hover:bg-white/70 cursor-pointer w-full shadow-sm">
                          <SelectValue placeholder="Chọn mã lớp học..." />
                        </SelectTrigger>
                        <SelectContent className="bg-white/95 backdrop-blur-md rounded-xl shadow-xl border border-slate-100/60">
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
                      required
                      className="bg-white/50 border-white/80 backdrop-blur-sm h-10 rounded-xl px-[16px] text-[13.5px] text-[#1E293B] font-semibold placeholder:text-[#64748B] focus-visible:ring-2 focus-visible:ring-blue-500/20 focus-visible:bg-white/80 focus-visible:border-blue-400 shadow-sm"
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
                            className="bg-white/50 border border-white/80 h-10 rounded-xl px-[16px] text-[13.5px] text-[#1E293B] font-semibold outline-none flex items-center justify-between hover:bg-white/70 focus:ring-2 focus:ring-blue-500/20 transition-all w-full shadow-sm text-left font-sans"
                          >
                            <span>{format(reportDate, 'dd/MM/yyyy')}</span>
                            <CalendarIcon className="w-[16px] h-[16px] text-slate-400 shrink-0" />
                          </Button>
                        </PopoverTrigger>
                        <PopoverContent
                          className="w-auto p-0 z-[100] bg-transparent border-none shadow-none overflow-hidden"
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
                <div className="bg-white/45 backdrop-blur-md border border-white/70 shadow-sm shadow-slate-300/40 rounded-2xl p-[22px] lg:p-[26px] flex flex-col gap-[16px] w-full">
                  <div className="flex gap-[8px] items-center text-[#005bbf]">
                    <FileText className="w-4.5 h-4.5 shrink-0" />
                    <h3 className="font-bold text-[15px] lg:text-[16px] leading-none">Ghi chú lớp học</h3>
                  </div>

                  <Input
                    multiline
                    value={classNote}
                    onChange={(e) => setClassNote(e.target.value)}
                    placeholder="Nhập nhận xét chung về tình hình lớp học, mức độ tiếp thu..."
                    className="bg-white/50 border-white/80 backdrop-blur-sm rounded-xl p-[16px] min-h-[110px] text-[13.5px] text-[#1E293B] outline-none focus-visible:ring-2 focus-visible:ring-blue-500/20 focus-visible:bg-white/80 focus-visible:border-blue-400 transition-all w-full resize-none shadow-sm font-semibold leading-relaxed placeholder:text-[#64748B]"
                    containerClassName="w-full"
                  />
                </div>
              </div>

              {/* Right Column: Violations Section (col-span-8) */}
              <div className="col-span-12 lg:col-span-8 flex flex-col gap-[20px]">
                <div className="bg-white/45 backdrop-blur-md border border-white/70 shadow-sm shadow-slate-300/40 rounded-2xl p-[22px] lg:p-[26px] flex flex-col gap-[16px] w-full">
                  <div className="flex gap-[8px] items-center text-[#005bbf]">
                    <AlertTriangle className="w-4.5 h-4.5 shrink-0" />
                    <h3 className="font-bold text-[15px] lg:text-[16px] leading-none">Ghi nhận sinh viên vi phạm (nếu có)</h3>
                  </div>

                  {/* Entry Form: Kính mờ gọn gàng */}
                  <div className="bg-white/30 backdrop-blur-sm border border-white/60 rounded-xl p-[14px] w-full relative z-20">
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
                            className="bg-white/50 border-white/80 backdrop-blur-sm h-10 rounded-xl px-[14px] text-[12.5px] text-[#1E293B] font-semibold outline-none w-full shadow-sm focus-within:ring-2 focus-within:ring-blue-500/20 transition-all hover:bg-white/70 cursor-pointer font-sans"
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

                      {/* Tiêu chí sử dụng Select Component */}
                      <div className="col-span-12 md:col-span-6 flex flex-col items-start w-full relative">
                        <Select
                          value={selectedCriterionId}
                          onValueChange={setSelectedCriterionId}
                          label="Tiêu chí ghi nhận"
                          error={""}
                        >
                          <SelectTrigger className="bg-white/50 border-white/80 backdrop-blur-sm h-10 rounded-xl px-[14px] text-[12.5px] text-[#1E293B] font-semibold outline-none w-full shadow-sm focus-within:ring-2 focus-within:ring-blue-500/20 transition-all hover:bg-white/70 cursor-pointer font-sans">
                            <SelectValue placeholder="Chọn tiêu chí..." />
                          </SelectTrigger>
                          <SelectContent className="bg-white/95 backdrop-blur-md rounded-xl shadow-xl border border-slate-100/60 font-sans">
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
                        className="bg-white/50 border-white/80 backdrop-blur-sm h-10 rounded-xl px-[14px] text-[12.5px] text-[#1E293B] placeholder:text-[#64748B] focus-visible:ring-2 focus-visible:ring-blue-500/20 focus-visible:bg-white/80 focus-visible:border-blue-400 shadow-sm"
                        containerClassName="col-span-12 md:col-span-9 w-full"
                      />

                      {/* Nút Thêm sử dụng Button Component */}
                      <div className="col-span-12 md:col-span-3 flex items-end w-full">
                        <Button
                          type="button"
                          onClick={handleAddViolationToList}
                          className="bg-[#005bbf] hover:bg-[#004ca0] text-white font-bold h-10 rounded-xl shadow-sm flex items-center justify-center gap-2 cursor-pointer transition-all duration-150 ease-out hover:scale-[1.01] border-none outline-none w-full text-[12.5px]"
                        >
                          <Plus className="w-4 h-4 shrink-0" />
                          <span>Thêm</span>
                        </Button>
                      </div>
                    </div>
                  </div>

                  {/* Violation Table */}
                  <div className="border border-white/60 rounded-xl overflow-hidden w-full shadow-sm bg-white/15">
                    <table className="w-full text-left border-collapse min-w-max">
                      <thead>
                        <tr className="bg-white/50 backdrop-blur-sm border-b border-white/60">
                          <th className="px-[20px] py-[10px] font-bold text-[#005bbf] text-[12px] tracking-[0.65px] uppercase">HỌ TÊN</th>
                          <th className="px-[20px] py-[10px] font-bold text-[#005bbf] text-[12px] tracking-[0.65px] uppercase">TIÊU CHÍ</th>
                          <th className="px-[20px] py-[10px] font-bold text-[#005bbf] text-[12px] tracking-[0.65px] uppercase">GHI CHÚ</th>
                          <th className="px-[20px] py-[10px] font-bold text-[#005bbf] text-[12px] tracking-[0.65px] uppercase text-center w-32">THAO TÁC</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-white/20">
                        {addedViolations.map((violation, idx) => {
                          const criterion = criteria.find(c => c._id === violation.criterion_id);
                          const type = criterion?.criterion_type || (violation.points_effect > 0 ? 'cong_diem' : 'ky_luat');

                          let badgeClass = 'bg-blue-50 text-blue-600 border border-blue-100';
                          if (type === 'khen_thuong') {
                            badgeClass = 'bg-emerald-50 text-emerald-600 border border-emerald-100';
                          } else if (type === 'ky_luat') {
                            badgeClass = 'bg-rose-50 text-rose-600 border border-rose-100';
                          }

                          return (
                            <tr key={idx} className="hover:bg-white/65 hover:scale-[1.002] transition-all duration-150 ease-out">
                              <td className="px-[20px] py-[12px] font-semibold text-[#111c2d] text-[13.5px]">
                                <div className="flex flex-col">
                                  <span>{violation.student_name}</span>
                                  <span className="text-slate-400 text-[10.5px] font-medium">MSSV: {violation.student_code}</span>
                                </div>
                              </td>
                              <td className="px-[20px] py-[12px]">
                                <span className={`font-bold rounded-xl px-[10px] py-[3px] text-[11.5px] inline-block tracking-wide ${badgeClass}`}>
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
                                  className="w-[28px] h-[28px] rounded-xl hover:bg-rose-100/80 hover:text-rose-600 p-0 flex items-center justify-center text-rose-500 transition-all duration-150 ease-out hover:scale-[1.05] bg-white/50 border border-white/80 shadow-sm outline-none cursor-pointer mx-auto"
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
                  <div className="flex flex-wrap items-center gap-4 lg:gap-6 text-[12px] font-bold text-slate-500 px-2 mt-1">
                    <div className="flex items-center gap-2">
                      <Users className="w-3.5 h-3.5 text-blue-500" />
                      <span>Sĩ số lớp: <strong className="text-slate-800">
                        {isStudentsLoading ? (
                          <Loader2 className="inline-block w-3.5 h-3.5 animate-spin text-slate-400 align-middle ml-1" />
                        ) : (
                          `${classStudents.length} SV`
                        )}
                      </strong></span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="w-2 h-2 rounded-full bg-emerald-500" />
                      <span>Hiện diện: <strong className="text-emerald-600">
                        {isStudentsLoading ? (
                          <Loader2 className="inline-block w-3.5 h-3.5 animate-spin text-emerald-400 align-middle ml-1" />
                        ) : (
                          `${totalPresent} SV`
                        )}
                      </strong></span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="w-2 h-2 rounded-full bg-rose-500" />
                      <span>Vắng mặt: <strong className="text-rose-600">
                        {isStudentsLoading ? (
                          <Loader2 className="inline-block w-3.5 h-3.5 animate-spin text-rose-400 align-middle ml-1" />
                        ) : (
                          `${totalAbsent} SV`
                        )}
                      </strong></span>
                    </div>
                    <div className="ml-auto text-emerald-600 bg-emerald-50 px-2.5 py-0.5 rounded-xl text-[11px] min-w-[90px] text-center">
                      {isStudentsLoading ? (
                        <Loader2 className="inline-block w-3.5 h-3.5 animate-spin text-emerald-500 align-middle" />
                      ) : (
                        `${classStudents.length > 0 ? Math.round((totalPresent / classStudents.length) * 100) : 0}% Chuyên cần`
                      )}
                    </div>
                  </div>
                </div>
              </div>

              {/* Dialog cấu hình tiêu chí vắng mặt */}
              {/* <Dialog open={isConfigModalOpen} onOpenChange={setIsConfigModalOpen}>
                <DialogContent className="max-w-[480px] rounded-[20px] border border-white/60 bg-white/90 backdrop-blur-xl shadow-2xl p-6">
                  <DialogTitle className="text-[17px] font-bold text-slate-800 flex items-center gap-2">
                    <Settings className="w-4 h-4 text-rose-500" />
                    Cấu hình tiêu chí tính vắng mặt
                  </DialogTitle>
                  <DialogDescription className="text-[13px] text-slate-500 mt-1">
                    Chọn các tiêu chí kỷ luật dùng để xác định sinh viên vắng học (ảnh hưởng tới việc tự động tính toán sĩ số vắng mặt/hiện diện).
                  </DialogDescription>
                  <div className="mt-4 max-h-[250px] overflow-y-auto pr-2 flex flex-col gap-2.5">
                    {criteria.map((c) => {
                      const isChecked = absentCriteriaIds.includes(c._id);
                      return (
                        <label
                          key={c._id}
                          className={`flex items-center justify-between p-3 rounded-xl border text-[13px] font-medium transition-all cursor-pointer select-none ${isChecked
                              ? 'bg-rose-50/50 border-rose-200/80 text-rose-700 shadow-sm'
                              : 'bg-slate-50/30 border-slate-100 text-slate-700 hover:bg-slate-50/85'
                            }`}
                        >
                          <span className="flex-1 pr-3">{c.criterion_name}</span>
                          <input
                            type="checkbox"
                            checked={isChecked}
                            onChange={(e) => {
                              if (e.target.checked) {
                                setAbsentCriteriaIds(prev => [...prev, c._id]);
                              } else {
                                setAbsentCriteriaIds(prev => prev.filter(id => id !== c._id));
                              }
                            }}
                            className="w-4 h-4 rounded text-rose-600 border-slate-300 focus:ring-rose-500/20 cursor-pointer accent-rose-600"
                          />
                        </label>
                      );
                    })}
                    {criteria.length === 0 && (
                      <div className="text-center py-6 text-slate-400 italic text-[12.5px]">
                        Không tìm thấy tiêu chí kỷ luật nào.
                      </div>
                    )}
                  </div>
                  <div className="mt-6 flex justify-end">
                    <Button
                      type="button"
                      onClick={() => setIsConfigModalOpen(false)}
                      className="bg-slate-900 text-white font-semibold rounded-full px-5 py-1.5 hover:bg-slate-800 text-[12.5px] cursor-pointer"
                    >
                      Hoàn tất
                    </Button>
                  </div>
                </DialogContent>
              </Dialog> */}

            </div>

            {/* Footer Actions Panel */}
            <div className="bg-white/45 backdrop-blur-md border border-white/70 shadow-sm shadow-slate-300/40 rounded-2xl p-[18px] flex items-center justify-between gap-4 w-full">
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
                  className="border border-[rgba(0,91,191,0.3)] bg-white/30 hover:bg-white/80 rounded-xl px-[32px] py-[10px] text-[#005bbf] font-bold text-[13px] tracking-[0.28px] h-10 hover:scale-[1.01] transition-all duration-150 ease-out"
                >
                  Hủy bỏ
                </Button>

                {/* Lưu ghi nhận sử dụng Custom Button với variant default */}
                <Button
                  type="submit"
                  disabled={isSaving}
                  className="relative bg-[#005bbf] text-white font-bold px-[38px] py-[10px] rounded-xl shadow-sm hover:bg-[#004ca0] focus:ring-2 focus:ring-blue-500/20 transition-all duration-150 ease-out hover:scale-[1.01] flex items-center justify-center gap-2 border-none outline-none cursor-pointer text-[13px] tracking-[0.28px] h-10 disabled:opacity-75 disabled:cursor-not-allowed"
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
